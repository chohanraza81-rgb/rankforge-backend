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

// ---------- 4. Gemini AI Service (WITH RATE LIMIT HANDLING) ----------
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ Fatal Error: GEMINI_API_KEY is missing!");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Rate Limit Tracking
let requestCount = 0;
let lastResetTime = Date.now();
const MAX_REQUESTS_PER_MINUTE = 2; // Gemini free tier limit
const RETRY_DELAY = 60000; // 60 seconds

const checkRateLimit = () => {
  const now = Date.now();
  if (now - lastResetTime > 60000) {
    requestCount = 0;
    lastResetTime = now;
  }
  if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
    const waitTime = 60000 - (now - lastResetTime);
    console.log(`⏳ Rate limit reached. Waiting ${Math.ceil(waitTime/1000)}s...`);
    return waitTime;
  }
  return 0;
};

const generateInsights = async (keyword, serpData, retryCount = 0) => {
  // ✅ Check rate limit before making request
  const waitTime = checkRateLimit();
  if (waitTime > 0) {
    console.log(`⏳ Waiting ${Math.ceil(waitTime/1000)}s before next request...`);
    await new Promise(resolve => setTimeout(resolve, waitTime + 1000));
  }

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  
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
    1. "keyword_intent": "Commercial", "Informational", or "Transactional".
    2. "content_score": (Number 0-100).
    3. "readability_avg": "Easy", "Medium", or "Hard".
    4. "missing_headings": Array of 6 unique sub-topics.
    5. "faq_questions": Array of 6 questions from "People Also Ask".
    6. "authority_links": Array of 5 high DA links.
    7. "competitor_table": Array of objects with keys "rank", "title", "strength".

    Competitor Data (Top 5):
    ${JSON.stringify(competitors, null, 2)}
  `;

  try {
    // Track request
    requestCount++;
    console.log(`📊 Request ${requestCount}/${MAX_REQUESTS_PER_MINUTE} this minute`);
    
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
    
  } catch (error) {
    console.error(`❌ Gemini Error (Attempt ${retryCount + 1}):`, error.message);
    
    // Check if it's a quota/rate limit error
    if (error.message?.includes('quota') || 
        error.message?.includes('rate limit') ||
        error.message?.includes('429')) {
      
      if (retryCount < 3) {
        const waitTime = (retryCount + 1) * 30; // 30s, 60s, 90s
        console.log(`⏳ Rate limit hit. Retrying in ${waitTime}s... (Attempt ${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        return generateInsights(keyword, serpData, retryCount + 1);
      } else {
        throw new Error('⚠️ Gemini API quota exhausted. Please wait 1-2 hours or use a new API key.');
      }
    }
    
    // If it's not a rate limit error, throw it
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
    throw new Error('⚠️ SerpAPI failed. Please check your API key.');
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

    // Check if there's a pending report for this keyword
    const pending = await Report.findOne({ keyword, status: 'pending' });
    if (pending) {
      return res.json({ 
        reportId: pending._id, 
        cached: false, 
        message: 'Already processing... Please wait.' 
      });
    }

    const newReport = new Report({ keyword, status: 'pending' });
    await newReport.save();

    res.json({ reportId: newReport._id, cached: false, message: 'Processing started...' });

    // Background processing
    (async () => {
      try {
        const serpData = await fetchSerp(keyword);
        const insights = await generateInsights(keyword, serpData);
        await Report.findByIdAndUpdate(newReport._id, {
          status: 'completed',
          data: insights,
          errorMessage: ''
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
  const now = Date.now();
  const timeSinceReset = Math.floor((now - lastResetTime) / 1000);
  const remainingRequests = Math.max(0, MAX_REQUESTS_PER_MINUTE - requestCount);
  
  res.json({ 
    status: 'OK', 
    message: 'RankForge Backend is Live!',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    gemini: process.env.GEMINI_API_KEY ? 'Configured' : 'Missing',
    serpapi: process.env.SERPAPI_KEY ? 'Configured' : 'Missing',
    rate_limit: {
      requests_this_minute: requestCount,
      max_per_minute: MAX_REQUESTS_PER_MINUTE,
      remaining: remainingRequests,
      reset_in_seconds: 60 - timeSinceReset
    }
  });
});

// ---------- 7. Start Server ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Rate Limit: ${MAX_REQUESTS_PER_MINUTE} requests per minute`);
});
