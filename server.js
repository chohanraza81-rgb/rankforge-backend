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

// ---------- 1. MongoDB Connection ----------
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ---------- 2. MongoDB Schema (Report) ----------
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

// ---------- 3. Gemini AI Service (UPDATED - Model changed to gemini-pro) ----------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateInsights = async (keyword, serpData) => {
  // ✅ FIX: "gemini-1.5-flash" ki jagah "gemini-pro" use karein
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  
  const competitors = serpData.organic_results?.slice(0, 5).map((r, i) => ({
    rank: i + 1,
    title: r.title,
    link: r.link,
    snippet: r.snippet
  })) || [];

  const prompt = `
    You are an SEO strategist. Analyze the SERP for keyword: "${keyword}".
    **RULE: Return ONLY valid JSON. DO NOT WRITE ARTICLES.**
    Provide valid JSON with these keys:
    1. "keyword_intent": "Commercial", "Informational", or "Transactional".
    2. "content_score": (Number 0-100).
    3. "readability_avg": "Easy", "Medium", or "Hard".
    4. "missing_headings": Array of 5 sub-topics missing from new sites.
    5. "faq_questions": Array of 5 "People Also Ask" questions.
    6. "authority_links": Array of 5 high-authority links.
    7. "competitor_table": Array of objects with keys "rank", "title", "strength".

    Competitor Data:
    ${JSON.stringify(competitors, null, 2)}
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    // Agar AI ne markdown wrap kiya hai toh usko hatao
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Gemini Error:', error);
    // Fallback data return karo taake tool crash na ho
    return {
      keyword_intent: "Informational",
      content_score: 75,
      readability_avg: "Medium",
      missing_headings: ["Unable to fetch headings", "Check API key", "Try again later"],
      faq_questions: ["What is this keyword about?"],
      authority_links: ["https://example.com"],
      competitor_table: [{ rank: 1, title: "Example", strength: "N/A" }]
    };
  }
};

// ---------- 4. SerpAPI Service ----------
const fetchSerp = async (keyword) => {
  const response = await axios.get('https://serpapi.com/search', {
    params: {
      q: keyword,
      api_key: process.env.SERPAPI_KEY,
      num: 10,
      location: 'Pakistan'
    }
  });
  return response.data;
};

// ---------- 5. API Routes ----------
// Route 1: Generate Report (Check Cache + Create New)
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

    // Cache miss: Create new pending report
    const newReport = new Report({ keyword, status: 'pending' });
    await newReport.save();

    // Background processing (non-blocking)
    res.json({ reportId: newReport._id, cached: false, message: 'Processing started. Please wait...' });

    (async () => {
      try {
        const serpData = await fetchSerp(keyword);
        const insights = await generateInsights(keyword, serpData);
        await Report.findByIdAndUpdate(newReport._id, {
          status: 'completed',
          data: insights
        });
        console.log(`✅ Completed: ${keyword}`);
      } catch (error) {
        console.error(`❌ Failed: ${keyword}`, error.message);
        await Report.findByIdAndUpdate(newReport._id, { status: 'failed' });
      }
    })();

  } catch (error) {
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

// Route 3: Health Check (Testing ke liye)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'RankForge Backend is Live!' });
});

// ---------- 6. Start Server ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
