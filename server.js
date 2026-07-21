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

// ---------- 1. Logger Setup ----------
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

// ---------- 2. Security & Performance ----------
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
app.use(express.json({ limit: '10mb' }));

// CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'https://rankforge-front.vercel.app',
  optionsSuccessStatus: 200,
  credentials: true,
};
app.use(cors(corsOptions));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ---------- 3. Startup Logging ----------
logger.info('='.repeat(60));
logger.info('🚀 RankForge Enterprise Backend V4');
logger.info('='.repeat(60));
logger.info(`🔍 GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing'}`);
logger.info(`🔍 SERPAPI_KEY: ${process.env.SERPAPI_KEY ? '✅ Set' : '❌ Missing'}`);
logger.info(`🔍 MONGODB_URI: ${process.env.MONGODB_URI ? '✅ Set' : '❌ Missing'}`);
logger.info(`🔍 FRONTEND_URL: ${process.env.FRONTEND_URL || 'Not Set'}`);

// ---------- 4. MongoDB Connection ----------
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => logger.info('✅ MongoDB Connected'))
  .catch(err => {
    logger.error('❌ MongoDB Error:', err);
    process.exit(1);
  });

// ---------- 5. MongoDB Schema (V4 - Premium) ----------
const ReportSchema = new mongoose.Schema({
  keyword: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  errorMessage: { type: String, default: '' },
  processingTime: { type: Number, default: 0 },
  data: {
    keyword_intent: String,
    content_score: Number,
    readability_avg: String,
    missing_headings: [String],
    faq_questions: [String],
    authority_links: [String],
    competitor_table: [Object],
    
    // V4 Premium Fields
    content_recommendations: {
      title: String,
      meta_description: String,
      target_audience: String,
      content_length: String,
      tone: String,
      seo_tips: [String]
    },
    competitor_analysis: {
      top_strengths: [String],
      top_weaknesses: [String],
      gap_opportunities: [String]
    },
    keyword_opportunities: {
      primary_keywords: [String],
      secondary_keywords: [String],
      long_tail_keywords: [String]
    },
    content_structure: {
      introduction: String,
      main_points: [String],
      conclusion: String,
      call_to_action: String
    },
    seo_metadata: {
      title_tag: String,
      meta_description: String,
      url_slug: String,
      focus_keyword: String
    }
  },
  createdAt: { type: Date, default: Date.now, expires: 2592000 }
});

ReportSchema.index({ keyword: 1, createdAt: -1 });
ReportSchema.index({ status: 1 });

const Report = mongoose.model('Report', ReportSchema);

// ---------- 6. GROQ AI Service (V4 - Enhanced) ----------
if (!process.env.GROQ_API_KEY) {
  logger.error('❌ Fatal Error: GROQ_API_KEY is missing!');
  process.exit(1);
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const generatePremiumInsights = async (keyword, serpData) => {
  const competitors = serpData.organic_results?.slice(0, 5).map((r, i) => ({
    rank: i + 1,
    title: (r.title || 'N/A').substring(0, 60),
    snippet: (r.snippet || '').substring(0, 200),
    link: r.link || '#'
  })) || [];

  logger.info(`🤖 GROQ Premium Analysis for: "${keyword}"`);
  logger.info(`📊 Analyzing ${competitors.length} competitors`);

  const prompt = `
    You are a Senior SEO Expert and Content Strategist. Perform a DEEP, PREMIUM analysis for keyword: "${keyword}".
    
    **CRITICAL RULES:**
    1. Return ONLY valid JSON.
    2. NO markdown, NO explanations outside JSON.
    3. Be specific, actionable, and data-driven.
    4. Think like a $10,000/month SEO consultant.
    
    Competitor Data (Top 5):
    ${JSON.stringify(competitors, null, 2)}
    
    Generate this EXACT JSON structure:
    {
      "keyword_intent": "Commercial/Informational/Transactional",
      "content_score": 85,
      "readability_avg": "Easy/Medium/Hard",
      
      "missing_headings": ["H2 heading 1", "H2 heading 2"],
      "faq_questions": ["Question 1?", "Question 2?"],
      "authority_links": ["https://example1.com", "https://example2.com"],
      
      "competitor_table": [
        {"rank": 1, "title": "Competitor 1", "strength": "Their main advantage"}
      ],
      
      "content_recommendations": {
        "title": "SEO-optimized title suggestion",
        "meta_description": "Meta description under 160 chars",
        "target_audience": "Who should read this content",
        "content_length": "1500-2000 words",
        "tone": "Professional",
        "seo_tips": ["Tip 1", "Tip 2", "Tip 3"]
      },
      
      "competitor_analysis": {
        "top_strengths": ["Strength 1", "Strength 2"],
        "top_weaknesses": ["Weakness 1", "Weakness 2"],
        "gap_opportunities": ["Opportunity 1", "Opportunity 2"]
      },
      
      "keyword_opportunities": {
        "primary_keywords": ["kw1", "kw2"],
        "secondary_keywords": ["kw3", "kw4"],
        "long_tail_keywords": ["long tail 1", "long tail 2"]
      },
      
      "content_structure": {
        "introduction": "Compelling intro paragraph",
        "main_points": ["Point 1", "Point 2", "Point 3", "Point 4"],
        "conclusion": "Conclusion paragraph",
        "call_to_action": "Specific CTA suggestion"
      },
      
      "seo_metadata": {
        "title_tag": "SEO title tag",
        "meta_description": "SEO meta description",
        "url_slug": "url-friendly-slug",
        "focus_keyword": "main keyword"
      }
    }
  `;

  try {
    const startTime = Date.now();
    const response = await groq.chat.completions.create({
      messages: [
        { 
          role: 'system', 
          content: 'You are a Senior SEO Expert. Return ONLY valid JSON. No markdown, no explanations.' 
        },
        { 
          role: 'user', 
          content: prompt 
        }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 4096,
    });
    const endTime = Date.now();
    logger.info(`⏱️ GROQ Response Time: ${(endTime - startTime) / 1000}s`);

    const text = response.choices[0].message.content;
    logger.info(`📝 GROQ Response: ${text.substring(0, 150)}...`);
    
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    logger.error('❌ GROQ Error:', error.message);
    if (error.response) {
      logger.error('Response:', error.response.data);
    }
    throw new Error(`GROQ API Error: ${error.message}`);
  }
};

// ---------- 7. SerpAPI Service ----------
const fetchSerp = async (keyword) => {
  logger.info(`🔍 Fetching SERP for: "${keyword}"`);
  
  try {
    const startTime = Date.now();
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        q: keyword,
        api_key: process.env.SERPAPI_KEY,
        num: 5,
        location: 'Pakistan'
      },
      timeout: 15000
    });
    const endTime = Date.now();
    logger.info(`⏱️ SerpAPI Response Time: ${(endTime - startTime) / 1000}s`);
    
    if (!response.data.organic_results || response.data.organic_results.length === 0) {
      throw new Error('No organic results found. Try a different keyword.');
    }
    
    logger.info(`✅ SERP fetched: ${response.data.organic_results.length} results`);
    return response.data;
  } catch (error) {
    logger.error('❌ SerpAPI Error:', error.message);
    throw new Error(`⚠️ SerpAPI failed: ${error.message}`);
  }
};

// ---------- 8. API Routes ----------

// GET: Health Check
app.get('/api/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  const totalReports = await Report.countDocuments();
  const completedReports = await Report.countDocuments({ status: 'completed' });
  
  res.json({
    status: 'OK',
    message: 'RankForge Enterprise Backend V4 is Live!',
    version: '4.0.0',
    timestamp: new Date().toISOString(),
    mongodb: dbStatus,
    groq: process.env.GROQ_API_KEY ? 'Configured' : 'Missing',
    serpapi: process.env.SERPAPI_KEY ? 'Configured' : 'Missing',
    stats: {
      total_reports: totalReports,
      completed_reports: completedReports,
      success_rate: totalReports > 0 ? Math.round((completedReports / totalReports) * 100) : 0
    }
  });
});

// POST: Generate Report
app.post('/api/generate', async (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  try {
    const cached = await Report.findOne({ keyword, status: 'completed' }).sort({ createdAt: -1 });
    if (cached) {
      logger.info(`✅ Cache hit for: "${keyword}"`);
      return res.json({ reportId: cached._id, cached: true, data: cached.data });
    }

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

    res.json({ reportId: newReport._id, cached: false, message: 'Processing premium analysis...' });

    (async () => {
      const startTime = Date.now();
      try {
        logger.info(`🔄 Starting Premium Analysis for: "${keyword}"`);
        
        const serpData = await fetchSerp(keyword);
        const insights = await generatePremiumInsights(keyword, serpData);
        const endTime = Date.now();
        
        await Report.findByIdAndUpdate(newReport._id, {
          status: 'completed',
          data: insights,
          processingTime: (endTime - startTime) / 1000
        });
        logger.info(`✅ Premium Analysis Completed: "${keyword}" in ${(endTime - startTime) / 1000}s`);
      } catch (error) {
        logger.error(`❌ Failed: "${keyword}"`, error.message);
        await Report.findByIdAndUpdate(newReport._id, { 
          status: 'failed',
          errorMessage: error.message
        });
      }
    })();

  } catch (error) {
    logger.error('❌ Route Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET: Report Status
app.get('/api/report/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Analytics
app.get('/api/analytics', async (req, res) => {
  try {
    const total = await Report.countDocuments();
    const completed = await Report.countDocuments({ status: 'completed' });
    const failed = await Report.countDocuments({ status: 'failed' });
    const pending = await Report.countDocuments({ status: 'pending' });
    
    const avgScore = await Report.aggregate([
      { $match: { status: 'completed', 'data.content_score': { $exists: true } } },
      { $group: { _id: null, avg: { $avg: '$data.content_score' } } }
    ]);
    
    const recentReports = await Report.find({ status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('keyword createdAt data.content_score');
    
    res.json({
      total_reports: total,
      completed_reports: completed,
      failed_reports: failed,
      pending_reports: pending,
      average_score: avgScore[0]?.avg || 0,
      recent_reports: recentReports
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------- 9. Cron Jobs ----------
cron.schedule('0 9 * * 1', async () => {
  logger.info('📊 Generating weekly analytics report...');
  try {
    const total = await Report.countDocuments();
    const completed = await Report.countDocuments({ status: 'completed' });
    logger.info(`📊 Weekly Stats: Total: ${total}, Completed: ${completed}`);
  } catch (error) {
    logger.error('❌ Cron Error:', error);
  }
});

cron.schedule('0 0 * * *', async () => {
  logger.info('🗑️ Cleaning up failed reports...');
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const result = await Report.deleteMany({
      status: 'failed',
      createdAt: { $lt: sevenDaysAgo }
    });
    logger.info(`🗑️ Deleted ${result.deletedCount} failed reports`);
  } catch (error) {
    logger.error('❌ Cleanup Error:', error);
  }
});

// ---------- 10. Start Server ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info('='.repeat(60));
  logger.info(`🚀 Enterprise Server running on port ${PORT}`);
  logger.info(`📊 Model: GROQ: llama-3.3-70b-versatile`);
  logger.info(`📈 Health Check: /api/health`);
  logger.info(`📊 Analytics: /api/analytics`);
  logger.info('='.repeat(60));
});
