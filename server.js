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

// ---------- 2. MongoDB Schema (Report with Cache) ----------
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

// ---------- 3. Gemini AI Service (WORKING - Latest Library v0.21.0) ----------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const generateInsights = async (keyword, serpData) => {
  // ✅ FIXED: Using stable "gemini-1.5-flash" with latest SDK
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  // Competitors ka data prepare karo
  const competitors = serpData.organic_results?.slice(0, 5).map((r, i) => ({
    rank: i + 1,
    title: r.title,
    link: r.link,
    snippet: r.snippet
  })) || [];

  // Exact JSON prompt (AI ko sirf data generate karne ko kaho)
  const prompt = `
    You are an expert SEO analyst. Analyze the SERP for keyword: "${keyword}".
    **CRITICAL RULE: Return ONLY valid JSON. NO markdown, NO explanations, NO articles.**
    
    Generate a JSON object with these exact 7 keys:
    1. "keyword_intent": (String) "Commercial", "Informational", or "Transactional".
    2. "content_score": (Number) Score out of 100 for how well top results answer the query.
    3. "readability_avg": (String) "Easy", "Medium", or "Hard".
    4. "missing_headings": (Array of 6 strings) Unique sub-topics the top pages cover but a new site might miss.
    5. "faq_questions": (Array of 6 strings) High-volume questions from "People Also Ask".
    6. "authority_links": (Array of 5 strings) High DA (edu/gov/well-known) links to cite.
    7. "competitor_table": (Array of objects) with keys "rank" (number), "title" (string), "strength" (string - one line summary of their advantage).

    Competitor Data (Top 5):
    ${JSON.stringify(competitors, null, 2)}
  `;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  // AI agar markdown wrap kare toh usko hatao
  const cleanJson = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleanJson);
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
// Route 1: Generate Report (Cache Check + Background Processing)
app.post('/api/generate', async (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  try {
    // 🔥 CACHE CHECK: Agar 7 din pehle ye keyword search hua hai toh direct cache se do
    const cached = await Report.findOne({ keyword, status: 'completed' }).sort({ createdAt: -1 });
    if (cached) {
      console.log(`✅ Cache hit for: ${keyword}`);
      return res.json({ reportId: cached._id, cached: true, data: cached.data });
    }

    // Cache miss: Naya report create karo
    const newReport = new Report({ keyword, status: 'pending' });
    await newReport.save();

    // Frontend ko turant response do, background process start karo
    res.json({ reportId: newReport._id, cached: false, message: 'Processing started...' });

    // ⚙️ Background Processing (Async)
    (async () => {
      try {
        // Step 1: SerpAPI se data lo
        const serpData = await fetchSerp(keyword);
        // Step 2: Gemini se insights generate karo (Abhi 100% working)
        const insights = await generateInsights(keyword, serpData);
        // Step 3: Database mein save karo
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

// Route 2: Get Report Status / Data (Polling ke liye)
app.get('/api/report/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route 3: Health Check (Test endpoint)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'RankForge Backend is Live!' });
});

// ---------- 6. Start Server ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
