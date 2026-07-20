import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import axios from 'axios';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// ---------- 1. Debugging ----------
console.log("=".repeat(50));
console.log("🚀 RankForge Backend Starting... (GROQ Version)");
console.log("=".repeat(50));
console.log("🔍 GROQ_API_KEY:", process.env.GROQ_API_KEY ? "✅ Set" : "❌ Missing");
if (process.env.GROQ_API_KEY) {
  console.log("🔑 Key starts with:", process.env.GROQ_API_KEY.substring(0, 8));
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

// ---------- 4. GROQ AI Service (UPDATED MODEL) ----------
if (!process.env.GROQ_API_KEY) {
  console.error("❌ Fatal Error: GROQ_API_KEY is missing!");
  process.exit(1);
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const generateInsights = async (keyword, serpData) => {
  const competitors = serpData.organic_results?.slice(0, 3).map((r, i) => ({
    rank: i + 1,
    title: (r.title || 'N/A').substring(0, 60),
    snippet: (r.snippet || '').substring(0, 150)
  })) || [];

  console.log(`🤖 Calling GROQ for: "${keyword}"`);
  console.log(`📊 Analyzing ${competitors.length} competitors`);

  const prompt = `
    You are an expert SEO analyst. Analyze the SERP for keyword: "${keyword}".
    **CRITICAL RULE: Return ONLY valid JSON. NO markdown, NO explanations, NO articles.**
    
    Generate a JSON object with these exact 7 keys:
    1. "keyword_intent": "Commercial", "Informational", or "Transactional".
    2. "content_score": (Number 0-100).
    3. "readability_avg": "Easy", "Medium", or "Hard".
    4. "missing_headings": Array of 6 unique sub-topics that competitors cover but a new site might miss.
    5. "faq_questions": Array of 6 questions from "People Also Ask".
    6. "authority_links": Array of 5 high DA (edu/gov/well-known) links to cite.
    7. "competitor_table": Array of objects with keys "rank", "title", "strength".

    Competitor Data (Top 3):
    ${JSON.stringify(competitors, null, 2)}
  `;

  try {
    const response = await groq.chat.completions.create({
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert SEO analyst. Return ONLY valid JSON. No markdown, no explanations.' 
        },
        { 
          role: 'user', 
          content: prompt 
        }
      ],
      // ✅ UPDATED: Using active model
      model: "llama-3.1-70b-versatile",
      temperature: 0.3,
      max_tokens: 2048,
    });

    const text = response.choices[0].message.content;
    console.log(`📝 GROQ Response: ${text.substring(0, 100)}...`);
    
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('❌ GROQ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    throw new Error(`GROQ API Error: ${error.message}`);
  }
};

// ---------- 5. SerpAPI Service ----------
const fetchSerp = async (keyword) => {
  console.log(`🔍 Fetching SERP for: "${keyword}"`);
  
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
    
    if (!response.data.organic_results || response.data.organic_results.length === 0) {
      throw new Error('No organic results found. Try a different keyword.');
    }
    
    console.log(`✅ SERP fetched: ${response.data.organic_results.length} results`);
    return response.data;
  } catch (error) {
    console.error('❌ SerpAPI Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw new Error(`⚠️ SerpAPI failed: ${error.message}`);
  }
};

// ---------- 6. API Routes ----------

// Route 1: Generate Report
app.post('/api/generate', async (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  try {
    // Check Cache
    const cached = await Report.findOne({ keyword, status: 'completed' }).sort({ createdAt: -1 });
    if (cached) {
      console.log(`✅ Cache hit for: "${keyword}"`);
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
        console.log(`🔄 Starting analysis for: "${keyword}"`);
        
        const serpData = await fetchSerp(keyword);
        const insights = await generateInsights(keyword, serpData);
        
        await Report.findByIdAndUpdate(newReport._id, {
          status: 'completed',
          data: insights
        });
        console.log(`✅ Completed: "${keyword}"`);
      } catch (error) {
        console.error(`❌ Failed: "${keyword}"`, error.message);
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

// Route 2: Get Report Status
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
    message: 'RankForge Backend is Live! (GROQ Version)',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    groq: process.env.GROQ_API_KEY ? 'Configured' : 'Missing',
    serpapi: process.env.SERPAPI_KEY ? 'Configured' : 'Missing',
    model: 'GROQ: llama-3.1-70b-versatile'
  });
});

// ---------- 7. Start Server ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Model: GROQ: llama-3.1-70b-versatile`);
  console.log(`✅ Health Check: /api/health`);
  console.log("=".repeat(50));
});
