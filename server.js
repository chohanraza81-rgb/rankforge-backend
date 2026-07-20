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

// ---------- 1. Debugging: Check API Key ----------
console.log("🔍 Checking GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "✅ Key is set" : "❌ Key is MISSING");
if (process.env.GEMINI_API_KEY) {
  console.log("🔑 Key starts with:", process.env.GEMINI_API_KEY.substring(0, 8));
}

// ---------- 2. MongoDB Connection ----------
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ---------- 3. MongoDB Schema ----------
const ReportSchema = new mongoose.Schema({
  keyword: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  data: {
    keyword_intent: String,
    content_score: Number,
    readability_avg: String,
    missing_headings: [String],
    faq_questions: [String],
    authority_links: [String],
    competitor_table: [Object]
  },
  createdAt: { type: Date, default: Date.now, expires: 604800 } // 7 din cache
});
const Report = mongoose.model('Report', ReportSchema);

// ---------- 4. Gemini AI Service (FIXED: gemini-2.5-flash) ----------
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ Fatal Error: GEMINI_API_KEY is missing!");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateInsights = async (keyword, serpData) => {
  // ✅ Using "gemini-2.5-flash" - Stable, Fast, 1M token limit
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  const competitors = serpData.organic_results?.slice(0, 5).map((r, i) => ({
    rank: i + 1,
    title: r.title || 'N/A',
    link: r.link || '#',
    snippet: r.snippet || 'No snippet available'
  })) || [];

  const prompt = `
    You are an expert SEO analyst. Analyze the SERP for keyword: "${keyword}".
    **CRITICAL RULE: Return ONLY valid JSON. NO markdown, NO explanations, NO articles.**
    
    Generate a JSON object with these exact 7 keys:
    1. "keyword_intent": (String) "Commercial", "Informational", or "Transactional".
    2. "content_score": (Number) Score out of 100 based on how well top results answer the query.
    3. "readability_avg": (String) "Easy", "Medium", or "Hard".
    4. "missing_headings": (Array of 6 strings) Unique sub-topics the top pages cover but a new site might miss.
    5. "faq_questions": (Array of 6 strings) High-volume "People Also Ask" questions.
    6. "authority_links": (Array of 5 strings) High DA (edu/gov/well-known) links to cite.
    7. "competitor_table": (Array of objects) with keys "rank" (number), "title" (string), "strength" (string - one line summary).

    Competitor Data (Top 5):
    ${JSON.stringify(competitors, null, 2)}
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('❌ Gemini Error:', error.message);
    throw error;
  }
};

// ---------- 5. SerpAPI Service ----------
const fetchSerp = async (keyword) => {
  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        q: keyword,
        api_key: process.env.SERPAPI_KEY,
        num: 10,
        location: 'Pakistan'
      }
    });
    return response.data;
  } catch (error) {
    console.error('❌ SerpAPI Error:', error.message);
    throw error;
  }
};

// ---------- 6. API Routes ----------
// Route 1: Generate Report (Cache Check + Background Processing)
app.post('/api/generate', async (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  try {
    // Check Cache (7 days)
    const cached = await Report.findOne({ keyword, status: 'completed' }).sort({ createdAt: -1 });
    if (cached) {
      console.log(`✅ Cache hit for: ${keyword}`);
      return res.json({ reportId: cached._id, cached: true, data: cached.data });
    }

    // Create new pending report
    const newReport = new Report({ keyword, status: 'pending' });
    await newReport.save();

    // Send immediate response
    res.json({ reportId: newReport._id, cached: false, message: 'Processing started...' });

    // Background processing
    (async () => {
      try {
        // Step 1: Fetch SERP data
        const serpData = await fetchSerp(keyword);
        
        // Step 2: Generate insights with Gemini
        const insights = await generateInsights(keyword, serpData);
        
        // Step 3: Save to database
        await Report.findByIdAndUpdate(newReport._id, {
          status: 'completed',
          data: insights
        });
        console.log(`✅ Completed: ${keyword}`);
      } catch (error) {
        console.error(`❌ Failed: ${keyword}`, error.message);
        await Report.findByIdAndUpdate(newReport._id, { 
          status: 'failed',
          data: {
            keyword_intent: "Error",
            content_score: 0,
            readability_avg: "N/A",
            missing_headings: ["Processing failed", "Check API keys", "Try again later"],
            faq_questions: ["API Error Occurred"],
            authority_links: [],
            competitor_table: []
          }
        });
      }
    })();

  } catch (error) {
    console.error('❌ Route Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route 2: Get Report Status / Data
app.get('/api/report/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route 3: Health Check
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
  console.log(`✅ Health Check: http://localhost:${PORT}/api/health`);
});
