import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import Groq from 'groq-sdk';
import axios from 'axios';
import winston from 'winston';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// ===== LOGGER =====
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [new winston.transports.Console()]
});

// ===== MIDDLEWARE =====
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://rankforge-front.vercel.app',
  credentials: true,
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  trustProxy: true,
  validate: { trustProxy: false, xForwardedForHeader: false },
});
app.use('/api/', limiter);

// ===== MONGODB =====
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => logger.info('✅ MongoDB Connected'))
  .catch(err => { logger.error('❌ MongoDB Error:', err); process.exit(1); });

// ===== SCHEMA =====
const ReportSchema = new mongoose.Schema({
  keyword: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  data: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now, expires: 604800 }
});
const Report = mongoose.model('Report', ReportSchema);

// ===== GROQ SETUP =====
if (!process.env.GROQ_API_KEY) {
  logger.error('❌ GROQ_API_KEY missing!');
  process.exit(1);
}
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ===== HELPERS =====
const callGroq = async (prompt, systemMsg = 'You are an SEO expert. Return valid JSON.') => {
  try {
    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 6000,
    });
    const text = response.choices[0].message.content;
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch (error) {
    logger.error('❌ GROQ Error:', error.message);
    throw error;
  }
};

const fetchSerp = async (keyword) => {
  const response = await axios.get('https://serpapi.com/search', {
    params: { q: keyword, api_key: process.env.SERPAPI_KEY, num: 10, location: 'Pakistan' },
    timeout: 15000
  });
  return response.data;
};

// ============================================================
// ===== V8 API ROUTES (Sirf 8 Tabs) =====
// ============================================================

// ---- TAB 1: KEYWORD RESEARCH ----
app.post('/api/v8/keyword-research', async (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  try {
    const serpData = await fetchSerp(keyword);
    const prompt = `
      Analyze keyword "${keyword}" for SEO.
      Return JSON: {
        "keywords": [{"keyword": "", "volume": 0, "kd": 0, "cpc": 0, "intent": ""}],
        "trend": [{"month": "", "value": 0}]
      }
      Filter: KD < 25 keywords only. Max 10 keywords.
    `;
    const data = await callGroq(prompt);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- TAB 2: COMPETITOR GAP ANALYZER ----
app.post('/api/v8/competitor-gap', async (req, res) => {
  const { keyword, domain } = req.body;
  if (!keyword || !domain) return res.status(400).json({ error: 'Keyword and domain required' });

  try {
    const serpData = await fetchSerp(keyword);
    const competitors = (serpData.organic_results || []).slice(0, 5).map(r => ({
      domain: new URL(r.link).hostname,
      word_count: Math.floor(Math.random() * 2000) + 500,
      backlinks: Math.floor(Math.random() * 5000) + 100,
      missing_headings: ['Best Features', 'User Reviews', 'Price Comparison'].slice(0, Math.floor(Math.random() * 3) + 1),
      missing_faq: ['What is the best?', 'How to choose?'].slice(0, Math.floor(Math.random() * 2) + 1)
    }));

    const prompt = `
      For keyword "${keyword}", analyze competitors.
      Return JSON: {
        "competitors": [{"domain": "", "word_count": 0, "backlinks": 0, "missing_headings": [], "missing_faq": []}],
        "actions": ["Action 1", "Action 2", "Action 3"]
      }
    `;
    const data = await callGroq(prompt);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- TAB 3: AI CONTENT OUTLINE ----
app.post('/api/v8/content-outline', async (req, res) => {
  const { keyword, niche } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  try {
    const serpData = await fetchSerp(keyword);
    const localAngle = niche ? `Include local angle for ${niche}` : '';

    const prompt = `
      Create content outline for "${keyword}". ${localAngle}
      Return JSON: {
        "outline": {
          "h1": "",
          "meta_title": "",
          "meta_description": "",
          "h2_headings": ["", "", "", "", "", "", "", ""],
          "faq": ["", "", "", "", ""],
          "lsi_keywords": ["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
          "local_angle": "${niche ? `Include ${niche} specific examples` : ''}"
        }
      }
    `;
    const data = await callGroq(prompt);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- TAB 4: BACKLINK OPPORTUNITIES ----
app.post('/api/v8/backlink-opportunities', async (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  try {
    const prompt = `
      Find 20 websites for backlinks for niche "${keyword}".
      Filter: DA between 20-60 only.
      Return JSON: {
        "backlinks": [
          {"domain": "", "da": 0, "email": "", "link_type": "Guest Post", "opportunity": "High"}
        ]
      }
    `;
    const data = await callGroq(prompt);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- TAB 5: TREND & SEASONALITY ----
app.post('/api/v8/trend-tracker', async (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  try {
    const prompt = `
      Analyze trend for "${keyword}" last 12 months.
      Return JSON: {
        "trend": [{"month": "Jan", "value": 0}, ...12 months],
        "peak_month": "December",
        "best_publish_date": "2026-10-01"
      }
    `;
    const data = await callGroq(prompt);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- TAB 6: ON-PAGE SEO CHECKLIST ----
app.post('/api/v8/onpage-seo', async (req, res) => {
  const { url, content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });

  try {
    const prompt = `
      Analyze this content: "${content.substring(0, 2000)}"
      Return JSON: {
        "checklist": [
          {"check": "Title Tag", "status": "pass/fail", "issue": ""},
          {"check": "Meta Description", "status": "pass/fail", "issue": ""},
          {"check": "Keyword Density", "status": "pass/fail", "issue": ""},
          {"check": "Image Alt Tags", "status": "pass/fail", "issue": ""},
          {"check": "Internal Links", "status": "pass/fail", "issue": ""},
          {"check": "H1 Tag", "status": "pass/fail", "issue": ""},
          {"check": "H2 Headings", "status": "pass/fail", "issue": ""},
          {"check": "Readability", "status": "pass/fail", "issue": ""},
          {"check": "Word Count", "status": "pass/fail", "issue": ""},
          {"check": "External Links", "status": "pass/fail", "issue": ""}
        ],
        "score": 0
      }
    `;
    const data = await callGroq(prompt);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- TAB 7: 90 DAY ACTION PLAN ----
app.post('/api/v8/action-plan', async (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  try {
    const prompt = `
      Create 90 day SEO action plan for "${keyword}".
      Return JSON: {
        "plan": [
          {"week": 1, "focus": "Research", "tasks": ["Task 1", "Task 2"]},
          ...12 weeks
        ]
      }
    `;
    const data = await callGroq(prompt);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- TAB 8: NICHE MEMORY ----
app.post('/api/v8/niche-memory', async (req, res) => {
  const { niche } = req.body;
  if (!niche) return res.status(400).json({ error: 'Niche required' });

  try {
    const prompt = `
      Provide info for niche "${niche}".
      Return JSON: {
        "niche": {
          "name": "",
          "description": "",
          "competitors": ["", "", "", ""],
          "insights": ["", "", ""]
        }
      }
    `;
    const data = await callGroq(prompt);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== HEALTH =====
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', version: 'V8', features: '8 Tabs' });
});

// ===== START =====
app.listen(PORT, () => {
  logger.info(`🚀 RankForge V8 running on port ${PORT}`);
  logger.info(`⚡ 8 Tabs: Keyword | Competitor | Outline | Backlink | Trend | OnPage | Plan | Niche`);
});
