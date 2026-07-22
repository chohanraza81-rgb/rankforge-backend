import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import Groq from 'groq-sdk';
import axios from 'axios';
import cron from 'node-cron';
import winston from 'winston';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// ===== 1. LOGGER SETUP =====
// ============================================================
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// ============================================================
// ===== 2. SECURITY & PERFORMANCE =====
// ============================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(compression());
app.use(express.json({ limit: '20mb' }));

// CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'https://rankforge-front.vercel.app',
  optionsSuccessStatus: 200,
  credentials: true,
};
app.use(cors(corsOptions));

// Rate Limiting (FIXED for Railway)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,
  validate: { 
    trustProxy: false,
    xForwardedForHeader: false
  },
});
app.use('/api/', limiter);

// ============================================================
// ===== 3. STARTUP LOGGING =====
// ============================================================
logger.info('='.repeat(60));
logger.info('🚀 RankForge V10 ULTIMATE Backend');
logger.info('='.repeat(60));
logger.info(`🔍 GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing'}`);
logger.info(`🔍 SERPAPI_KEY: ${process.env.SERPAPI_KEY ? '✅ Set' : '❌ Missing'}`);
logger.info(`🔍 MONGODB_URI: ${process.env.MONGODB_URI ? '✅ Set' : '❌ Missing'}`);

// ============================================================
// ===== 4. MONGODB CONNECTION =====
// ============================================================
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => logger.info('✅ MongoDB Connected'))
  .catch(err => {
    logger.error('❌ MongoDB Error:', err);
    process.exit(1);
  });

// ============================================================
// ===== 5. MONGODB SCHEMA (V10) =====
// ============================================================
const ReportSchema = new mongoose.Schema({
  keyword: { type: String, required: true, index: true },
  domain: { type: String, default: '' },
  niche: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  errorMessage: { type: String, default: '' },
  processingTime: { type: Number, default: 0 },
  data: {
    keywords: { type: [Object], default: [] },
    trend: { type: [Object], default: [] },
    competitors: { type: [Object], default: [] },
    actions: { type: [String], default: [] },
    outline: { type: Object, default: {} },
    backlinks: { type: [Object], default: [] },
    checklist: { type: [Object], default: [] },
    score: { type: Number, default: 0 },
    plan: { type: [Object], default: [] },
    niche: { type: Object, default: {} },
    rank: { type: Object, default: {} },
    brief: { type: Object, default: {} }
  },
  createdAt: { type: Date, default: Date.now, expires: 2592000 }
});

ReportSchema.index({ keyword: 1, createdAt: -1 });
ReportSchema.index({ status: 1 });

const Report = mongoose.model('Report', ReportSchema);

// ============================================================
// ===== 6. GROQ AI SERVICE (V10) =====
// ============================================================
if (!process.env.GROQ_API_KEY) {
  logger.error('❌ Fatal Error: GROQ_API_KEY is missing!');
  process.exit(1);
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const callGroq = async (prompt, systemMsg = 'You are an SEO expert. Return valid JSON.') => {
  try {
    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 10000,
    });
    const text = response.choices[0].message.content;
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch (error) {
    logger.error('❌ GROQ Error:', error.message);
    throw error;
  }
};

// ============================================================
// ===== 7. SERPAPI SERVICE =====
// ============================================================
const fetchSerp = async (keyword) => {
  try {
    logger.info(`🔍 Fetching SERP for: "${keyword}"`);
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        q: keyword,
        api_key: process.env.SERPAPI_KEY,
        num: 10,
        location: 'Pakistan'
      },
      timeout: 15000
    });
    if (!response.data.organic_results || response.data.organic_results.length === 0) {
      throw new Error('No organic results found');
    }
    logger.info(`✅ SERP fetched: ${response.data.organic_results.length} results`);
    return response.data;
  } catch (error) {
    logger.error('❌ SerpAPI Error:', error.message);
    throw error;
  }
};

// ============================================================
// ===== 8. V10 API ROUTES =====
// ============================================================

// ----- TAB 1: KEYWORD RESEARCH (30-50 Keywords) -----
app.post('/api/v10/keyword-research', async (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  try {
    const cached = await Report.findOne({ keyword, status: 'completed' }).sort({ createdAt: -1 });
    if (cached) {
      logger.info(`✅ Cache hit for: "${keyword}"`);
      return res.json({ cached: true, data: cached.data });
    }

    const serpData = await fetchSerp(keyword);
    
    const prompt = `
      Analyze SERP data for keyword "${keyword}" and generate 30-50 REAL keywords:
      ${JSON.stringify(serpData, null, 2)}
      
      Return JSON:
      {
        "keywords": [
          {"keyword": "", "volume": 0, "kd": 0, "cpc": 0, "intent": ""}
        ],
        "trend": [{"month": "Jan", "value": 0}, ...12 months]
      }
      
      RULES:
      - Generate 30-50 REAL keywords
      - ONLY include keywords with KD < 25
      - Volume: 100-10,000+
      - KD: 0-100
      - CPC: $0.10-$5.00
      - Intent: Commercial, Informational, Transactional
      - Trend: 12 months 0-100
    `;
    const data = await callGroq(prompt);
    
    const newReport = new Report({ keyword, status: 'completed', data });
    await newReport.save();
    
    res.json({ cached: false, data });
  } catch (error) {
    logger.error('❌ Keyword Research Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----- TAB 2: COMPETITOR GAP -----
app.post('/api/v10/competitor-gap', async (req, res) => {
  const { keyword, domain } = req.body;
  if (!keyword || !domain) return res.status(400).json({ error: 'Keyword and domain required' });

  try {
    const cacheKey = `${keyword}-${domain}`;
    const cached = await Report.findOne({ keyword: cacheKey, status: 'completed' }).sort({ createdAt: -1 });
    if (cached) {
      logger.info(`✅ Cache hit for: "${cacheKey}"`);
      return res.json({ cached: true, data: cached.data });
    }

    const serpData = await fetchSerp(keyword);
    
    const prompt = `
      Analyze REAL competitors for "${keyword}" and find gaps for "${domain}":
      ${JSON.stringify(serpData, null, 2)}
      
      Return JSON:
      {
        "competitors": [
          {"rank": 0, "domain": "", "authority": 0, "word_count": 0, "backlinks": 0, "missing_headings": [], "missing_faq": []}
        ],
        "actions": ["Action 1", "Action 2", "Action 3", "Action 4", "Action 5"]
      }
      
      RULES:
      - Extract 5-10 REAL competitors
      - Authority: 0-100
      - Missing headings: What ${domain} doesn't have
      - Missing FAQ: What ${domain} doesn't answer
      - Actions: 5 specific steps
    `;
    const data = await callGroq(prompt);
    
    const newReport = new Report({ keyword: cacheKey, domain, status: 'completed', data });
    await newReport.save();
    
    res.json({ cached: false, data });
  } catch (error) {
    logger.error('❌ Competitor Gap Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----- TAB 3: CONTENT OUTLINE -----
app.post('/api/v10/content-outline', async (req, res) => {
  const { keyword, niche } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  try {
    const cacheKey = niche ? `${keyword}-${niche}` : keyword;
    const cached = await Report.findOne({ keyword: cacheKey, status: 'completed' }).sort({ createdAt: -1 });
    if (cached) {
      logger.info(`✅ Cache hit for: "${cacheKey}"`);
      return res.json({ cached: true, data: cached.data });
    }

    const serpData = await fetchSerp(keyword);
    
    const prompt = `
      Create COMPREHENSIVE content outline for "${keyword}":
      ${JSON.stringify(serpData, null, 2)}
      ${niche ? `Include ${niche} specific examples.` : ''}
      
      Return JSON:
      {
        "outline": {
          "h1": "",
          "meta_title": "",
          "meta_description": "",
          "h2_headings": [10 headings],
          "faq": [10 questions],
          "lsi_keywords": [30 keywords],
          "local_angle": ""
        }
      }
      
      RULES:
      - H1: Compelling, keyword-rich
      - Meta Title: 50-60 chars
      - Meta Description: 150-160 chars
      - H2 Headings: 10 covering ALL aspects
      - FAQ: 10 common questions
      - LSI Keywords: 30 related terms
    `;
    const data = await callGroq(prompt);
    
    const newReport = new Report({ keyword: cacheKey, niche, status: 'completed', data });
    await newReport.save();
    
    res.json({ cached: false, data });
  } catch (error) {
    logger.error('❌ Content Outline Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----- TAB 4: BACKLINK OPPORTUNITIES (30-50 Sites) -----
app.post('/api/v10/backlink-opportunities', async (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  try {
    const cached = await Report.findOne({ keyword: `${keyword}-backlinks`, status: 'completed' }).sort({ createdAt: -1 });
    if (cached) {
      logger.info(`✅ Cache hit for: "${keyword}-backlinks"`);
      return res.json({ cached: true, data: cached.data });
    }

    const serpData = await fetchSerp(keyword);
    
    const prompt = `
      Find 30-50 REAL backlink opportunities for "${keyword}":
      ${JSON.stringify(serpData, null, 2)}
      
      Return JSON:
      {
        "backlinks": [
          {"domain": "", "da": 0, "email": "", "link_type": "", "opportunity": ""}
        ]
      }
      
      RULES:
      - Extract 30-50 REAL domains
      - DA: 20-60 only
      - Link type: Guest Post, Resource Page, Directory, Forum
      - Opportunity: High (DA 40-60), Medium (DA 30-39), Low (DA 20-29)
    `;
    const data = await callGroq(prompt);
    
    const newReport = new Report({ keyword: `${keyword}-backlinks`, status: 'completed', data });
    await newReport.save();
    
    res.json({ cached: false, data });
  } catch (error) {
    logger.error('❌ Backlink Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----- TAB 5: TREND TRACKER -----
app.post('/api/v10/trend-tracker', async (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  try {
    const cached = await Report.findOne({ keyword: `${keyword}-trend`, status: 'completed' }).sort({ createdAt: -1 });
    if (cached) {
      logger.info(`✅ Cache hit for: "${keyword}-trend"`);
      return res.json({ cached: true, data: cached.data });
    }

    const serpData = await fetchSerp(keyword);
    
    const prompt = `
      Analyze search trend for "${keyword}":
      ${JSON.stringify(serpData, null, 2)}
      
      Return JSON:
      {
        "trend": [{"month": "Jan", "value": 0}, ...12 months],
        "peak_month": "",
        "best_publish_date": ""
      }
      
      RULES:
      - Values: 0-100
      - Peak month: Highest value month
      - Best publish date: 3-4 weeks before peak
    `;
    const data = await callGroq(prompt);
    
    const newReport = new Report({ keyword: `${keyword}-trend`, status: 'completed', data });
    await newReport.save();
    
    res.json({ cached: false, data });
  } catch (error) {
    logger.error('❌ Trend Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----- TAB 6: ON-PAGE SEO (15 Points) -----
app.post('/api/v10/onpage-seo', async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });

  try {
    const cacheKey = `onpage-${content.substring(0, 50).replace(/\s/g, '-')}`;
    const cached = await Report.findOne({ keyword: cacheKey, status: 'completed' }).sort({ createdAt: -1 });
    if (cached) {
      logger.info(`✅ Cache hit for onpage`);
      return res.json({ cached: true, data: cached.data });
    }

    const prompt = `
      Analyze this content for on-page SEO (15 point checklist):
      ${content.substring(0, 3000)}
      
      Return JSON:
      {
        "checklist": [
          {"check": "", "status": "", "issue": ""}
        ],
        "score": 0
      }
      
      RULES:
      - 15 checklist items
      - Status: pass/fail
      - Issue: Specific problem
      - Score: 0-15
    `;
    const data = await callGroq(prompt);
    
    const newReport = new Report({ keyword: cacheKey, status: 'completed', data });
    await newReport.save();
    
    res.json({ cached: false, data });
  } catch (error) {
    logger.error('❌ On-Page Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----- TAB 7: 90 DAY PLAN (12 Weeks) -----
app.post('/api/v10/action-plan', async (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  try {
    const cached = await Report.findOne({ keyword: `${keyword}-plan`, status: 'completed' }).sort({ createdAt: -1 });
    if (cached) {
      logger.info(`✅ Cache hit for: "${keyword}-plan"`);
      return res.json({ cached: true, data: cached.data });
    }

    const prompt = `
      Create 90 day SEO action plan for "${keyword}" to reach TOP 10:
      
      Return JSON:
      {
        "plan": [
          {"week": 1, "focus": "", "priority": "", "tasks": []}
        ]
      }
      
      RULES:
      - 12 weeks
      - Focus: Research, Content, On-Page, Backlinks, Monitoring
      - Priority: High/Medium/Low
      - Each week: 3-4 specific tasks
    `;
    const data = await callGroq(prompt);
    
    const newReport = new Report({ keyword: `${keyword}-plan`, status: 'completed', data });
    await newReport.save();
    
    res.json({ cached: false, data });
  } catch (error) {
    logger.error('❌ Action Plan Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----- TAB 8: NICHE MEMORY -----
app.post('/api/v10/niche-memory', async (req, res) => {
  const { niche } = req.body;
  if (!niche) return res.status(400).json({ error: 'Niche required' });

  try {
    const cached = await Report.findOne({ keyword: `niche-${niche}`, status: 'completed' }).sort({ createdAt: -1 });
    if (cached) {
      logger.info(`✅ Cache hit for: "niche-${niche}"`);
      return res.json({ cached: true, data: cached.data });
    }

    const serpData = await fetchSerp(niche);
    
    const prompt = `
      Provide comprehensive niche analysis for "${niche}":
      ${JSON.stringify(serpData, null, 2)}
      
      Return JSON:
      {
        "niche": {
          "name": "",
          "description": "",
          "competitors": ["", "", "", ""],
          "insights": ["", "", "", "", "", ""]
        }
      }
    `;
    const data = await callGroq(prompt);
    
    const newReport = new Report({ keyword: `niche-${niche}`, niche, status: 'completed', data });
    await newReport.save();
    
    res.json({ cached: false, data });
  } catch (error) {
    logger.error('❌ Niche Memory Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----- TAB 9: RANK CHECKER -----
app.post('/api/v10/rank-checker', async (req, res) => {
  const { domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain required' });

  try {
    const cached = await Report.findOne({ keyword: `rank-${domain}`, status: 'completed' }).sort({ createdAt: -1 });
    if (cached) {
      logger.info(`✅ Cache hit for: "rank-${domain}"`);
      return res.json({ cached: true, data: cached.data });
    }

    const serpData = await fetchSerp(domain);
    
    const prompt = `
      Analyze domain "${domain}" ranking:
      ${JSON.stringify(serpData, null, 2)}
      
      Return JSON:
      {
        "rank": {
          "position": 0,
          "total_keywords": 0,
          "traffic": 0,
          "improvement": ["", "", "", "", ""]
        }
      }
    `;
    const data = await callGroq(prompt);
    
    const newReport = new Report({ keyword: `rank-${domain}`, domain, status: 'completed', data });
    await newReport.save();
    
    res.json({ cached: false, data });
  } catch (error) {
    logger.error('❌ Rank Checker Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----- TAB 10: CONTENT BRIEF -----
app.post('/api/v10/content-brief', async (req, res) => {
  const { keyword, niche } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  try {
    const cacheKey = niche ? `brief-${keyword}-${niche}` : `brief-${keyword}`;
    const cached = await Report.findOne({ keyword: cacheKey, status: 'completed' }).sort({ createdAt: -1 });
    if (cached) {
      logger.info(`✅ Cache hit for: "${cacheKey}"`);
      return res.json({ cached: true, data: cached.data });
    }

    const serpData = await fetchSerp(keyword);
    
    const prompt = `
      Create COMPLETE content brief for "${keyword}":
      ${JSON.stringify(serpData, null, 2)}
      ${niche ? `Include ${niche} specific examples.` : ''}
      
      Return JSON:
      {
        "brief": {
          "title": "",
          "description": "",
          "word_count": "",
          "images": "",
          "target_audience": "",
          "tone": "",
          "key_headings": ["", "", "", "", ""],
          "seo_tips": ["", "", "", "", ""]
        }
      }
      
      RULES:
      - Title: Compelling, keyword-rich
      - Word count: 2000-4000 words
      - Images: 8-15
      - Key Headings: 5 main headings
      - SEO Tips: 5 actionable tips
    `;
    const data = await callGroq(prompt);
    
    const newReport = new Report({ keyword: cacheKey, niche, status: 'completed', data });
    await newReport.save();
    
    res.json({ cached: false, data });
  } catch (error) {
    logger.error('❌ Content Brief Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// ===== 9. HEALTH CHECK =====
// ============================================================
app.get('/api/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  const totalReports = await Report.countDocuments();
  
  res.json({
    status: 'OK',
    message: 'RankForge V10 ULTIMATE Backend',
    version: '10.0.0',
    timestamp: new Date().toISOString(),
    mongodb: dbStatus,
    groq: process.env.GROQ_API_KEY ? 'Configured' : 'Missing',
    serpapi: process.env.SERPAPI_KEY ? 'Configured' : 'Missing',
    features: [
      '30-50 Keywords Research',
      '5-10 Competitor Gap',
      '10 H2 + 10 FAQ + 30 LSI',
      '30-50 Backlink Opportunities',
      '12 Month Trend',
      '15 Point On-Page SEO',
      '12 Week 90 Day Plan',
      'Niche Intelligence',
      'Rank Checker',
      'Content Brief'
    ],
    stats: {
      total_reports: totalReports
    }
  });
});

// ============================================================
// ===== 10. START SERVER =====
// ============================================================
app.listen(PORT, () => {
  logger.info('='.repeat(60));
  logger.info(`🚀 V10 ULTIMATE Server running on port ${PORT}`);
  logger.info(`⚡ 10 Features: Keywords | Competitors | Outline | Backlinks | Trend | On-Page | Plan | Niche | Rank | Brief`);
  logger.info(`📈 Health Check: http://localhost:${PORT}/api/health`);
  logger.info('='.repeat(60));
});
