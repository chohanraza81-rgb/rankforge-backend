import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// ---------- 1. Debugging ----------
console.log("🔍 GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "✅ Set" : "❌ Missing");
if (process.env.GEMINI_API_KEY) {
  console.log("🔑 Key starts with:", process.env.GEMINI_API_KEY.substring(0, 8));
}
console.log("🔍 SERPAPI_KEY:", process.env.SERPAPI_KEY ? "✅ Set" : "❌ Missing");
console.log("🔍 MONGODB_URI:", process.env.MONGODB_URI ? "✅ Set" : "❌ Missing");

// ---------- 2. MongoDB Connection ----------
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ---------- 3. MongoDB Schema ----------
const ReportSchema = new mongoose.Schema({
  keyword: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  errorMessage: { type: String, default: '' },
  data: {
    keyword_intent: String,
    content_score: Number,
    readability_avg: String,
    missing_headings: [String],
    faq_questions: [String],
    authority_links: [String],
    competitor_table: [Object]
  },
  createdAt: { type: Date, default: Date.now, expires: 604800 }
});
const Report = mongoose.model('Report', ReportSchema);

// ---------- 4. Gemini AI Service ----------
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ Fatal Error: GEMINI_API_KEY is missing!");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateInsights = async (keyword, serpData) => {
  // ✅ FINAL: "gemini-2.5-pro" use karein (jo aapki list mein HAI)
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
  
  const competitors = serpData.organic_results?.slice(0, 3).map((r, i) => ({
    rank: i + 1,
    title: (r.title || 'N/A').substring(0, 60),
    snippet: (r.snippet || '').substring(0, 150)
  })) || [];

  const prompt = `
    Analyze SERP for "${keyword}". Return ONLY valid JSON:
    {
      "keyword_intent": "Commercial/Informational/Transactional",
      "content_score": 85,
      "readability_avg": "Easy/Medium/Hard",
      "missing_headings": ["h1", "h2", "h3", "h4", "h5", "h6"],
      "faq_questions": ["q1", "q2", "q3", "q4", "q5", "q6"],
      "authority_links": ["link1", "link2", "link3", "link4", "link5"],
      "competitor_table": [{"rank":1,"title":"title","strength":"strength"}]
    }
    Competitors: ${JSON.stringify(competitors)}
  `;

  console.log(`🤖 Calling Gemini for: ${keyword}`);
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  console.log(`📝 Gemini Response: ${text.substring(0, 100)}...`);
  
  const cleanJson = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleanJson);
};

// ---------- 5. SerpAPI Service ----------
const fetchSerp = async (keyword) => {
  console.log(`🔍 Fetching SERP for: ${keyword}`);
  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        q: keyword,
        api_key: process.env.SERPAPI_KEY,
        num: 3,
        location: 'Pakistan'
      },
      timeout: 15000
    });
    console.log(`✅ SERP fetched: ${response.data.organic_results?.length || 0} results`);
    
    if (!response.data.organic_results || response.data.organic_results.length === 0) {
      throw new Error('No organic results found');
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ SerpAPI Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw new Error(`SerpAPI failed: ${error.message}`);
  }
};

// ---------- 6. API Routes ----------
app.post('/api/generate', async (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  try {
    // Check Cache
    const cached = await Report.findOne({ keyword, status: 'completed' }).sort({ createdAt: -1 });
    if (cached) {
      console.log(`✅ Cache hit for: ${keyword}`);
      return res.json({ reportId: cached._id, cached: true, data: cached.data });
    }

    // Check pending
    const pending = await Report.findOne({ keyword, status: 'pending' });
    if (pending) {
      return res.json({ 
        reportId: pending._id, 
        cached: false, 
        message: 'Already processing...' 
      });
    }

    const newReport = new Report({ keyword, status: 'pending' });
    await newReport.save();

    res.json({ reportId: newReport._id, cached: false, message: 'Processing...' });

    // Background processing
    (async () => {
      try {
        console.log(`🔄 Starting analysis for: ${keyword}`);
        
        const serpData = await fetchSerp(keyword);
        const insights = await generateInsights(keyword, serpData);
        
        await Report.findByIdAndUpdate(newReport._id, {
          status: 'completed',
          data: insights
        });
        console.log(`✅ Completed: ${keyword}`);
      } catch (error) {
        console.error(`❌ Failed: ${keyword}`, error.message);
        await Report.findByIdAndUpdate(newReport._id, { 
          status: 'failed',
          errorMessage: error.message
        });
      }
    })();

  } catch (error) {
    console.error('❌ Route Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/report/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'RankForge Backend is Live!',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    gemini: process.env.GEMINI_API_KEY ? 'Configured' : 'Missing',
    serpapi: process.env.SERPAPI_KEY ? 'Configured' : 'Missing'
  });
});

// ---------- 7. Start Server ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Health Check: https://rankforge-backend-production.up.railway.app/api/health`);
});
