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
  trustProxy: true,
  validate: { trustProxy: false },
});
app.use('/api/', limiter);

// ---------- 3. Startup Logging ----------
logger.info('='.repeat(60));
logger.info('🚀 RankForge Enterprise Backend V6 - POWER EDITION');
logger.info('='.repeat(60));
logger.info(`🔍 GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ Set' : '❌ Missing'}`);
logger.info(`🔍 SERPAPI_KEY: ${process.env.SERPAPI_KEY ? '✅ Set' : '❌ Missing'}`);
logger.info(`🔍 MONGODB_URI: ${process.env.MONGODB_URI ? '✅ Set' : '❌ Missing'}`);

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

// ---------- 5. MongoDB Schema (V6 - Power Edition) ----------
const ReportSchema = new mongoose.Schema({
  keyword: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  errorMessage: { type: String, default: '' },
  processingTime: { type: Number, default: 0 },
  data: {
    // Basic
    keyword_intent: String,
    content_score: Number,
    readability_avg: String,
    missing_headings: [String],
    faq_questions: [String],
    authority_links: [String],
    competitor_table: [Object],
    
    // Readability Score
    readability_score: {
      flesch_kincaid: Number,
      grade_level: String,
      sentence_length: Number,
      word_complexity: String,
      recommendations: [String]
    },
    
    // Trend Forecast
    trend_forecast: {
      growth: String,
      seasonality: String,
      peak_months: [String],
      strategy: String
    },
    
    // Pricing Intelligence
    pricing_intelligence: {
      average_price: String,
      price_range: String,
      value_for_money: String
    },
    
    // Content Requirements
    content_requirements: {
      recommended_words: Number,
      min_words: Number,
      max_words: Number,
      images_needed: Number,
      media_format: String,
      video_suggestions: [String]
    },
    
    // Keyword Metrics
    keyword_metrics: {
      search_volume: Number,
      difficulty: Number,
      cpc: Number,
      competition: String,
      related_keywords: [String]
    },
    
    // Backlink Gap
    backlink_gap: {
      competitor_backlinks: [Object],
      backlink_opportunities: [String],
      backlink_strategy: String,
      cost: String,
      impact: String,
      opportunities: Number
    },
    
    // Content Strategy
    content_recommendations: {
      title: String,
      meta_description: String,
      target_audience: String,
      content_length: String,
      tone: String,
      seo_tips: [String]
    },
    
    // SEO Metadata
    seo_metadata: {
      title_tag: String,
      meta_description: String,
      url_slug: String,
      focus_keyword: String
    },

    // ===== 🆕 V6 POWER EDITION FEATURES =====
    
    // 1. Real-time Competitor Analysis
    realtime_competitor_analysis: {
      competitors: [{
        name: String,
        domain: String,
        traffic: String,
        keyword_count: Number,
        domain_authority: Number,
        backlinks: Number,
        strengths: [String],
        weaknesses: [String]
      }],
      market_position: String,
      competitive_edge: String
    },
    
    // 2. NLP Keywords (Semantic Analysis)
    nlp_keywords: {
      primary: [String],
      secondary: [String],
      long_tail: [String],
      lsi: [String],
      semantic_related: [String],
      keyword_clusters: [Object]
    },
    
    // 3. People Also Ask (PAA)
    people_also_ask: [{
      question: String,
      answer: String,
      source: String,
      related_questions: [String]
    }],
    
    // 4. SERP Analysis
    serp_analysis: {
      featured_snippet: String,
      knowledge_panel: String,
      top_stories: [String],
      videos: [String],
      images: [String],
      maps: String,
      total_results: Number,
      paid_ads: Number,
      organic_results_count: Number
    },
    
    // 5. Schema Markup (Ready-to-use JSON-LD)
    schema_markup: {
      article: String,
      faq: String,
      product: String,
      how_to: String,
      organization: String,
      complete_json: String
    },
    
    // 6. Internal Links Suggestions
    internal_links: [{
      anchor_text: String,
      target_url: String,
      relevance_score: Number,
      context: String
    }],
    
    // 7. Content Quality Score (Detailed)
    content_quality: {
      uniqueness: Number,
      comprehensiveness: Number,
      engagement: Number,
      readability_score: Number,
      seo_friendliness: Number,
      overall_grade: String,
      improvement_suggestions: [String]
    },
    
    // 8. Entity Recognition
    entities: {
      people: [String],
      organizations: [String],
      locations: [String],
      products: [String],
      dates: [String],
      concepts: [String]
    }
  },
  createdAt: { type: Date, default: Date.now, expires: 2592000 }
});

ReportSchema.index({ keyword: 1, createdAt: -1 });
ReportSchema.index({ status: 1 });

const Report = mongoose.model('Report', ReportSchema);

// ---------- 6. GROQ AI Service (V6 - Power Edition) ----------
if (!process.env.GROQ_API_KEY) {
  logger.error('❌ Fatal Error: GROQ_API_KEY is missing!');
  process.exit(1);
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const generatePowerInsights = async (keyword, serpData) => {
  const competitors = serpData.organic_results?.slice(0, 5).map((r, i) => ({
    rank: i + 1,
    title: (r.title || 'N/A').substring(0, 80),
    snippet: (r.snippet || '').substring(0, 250),
    link: r.link || '#'
  })) || [];

  // Extract People Also Ask from SERP
  const peopleAlsoAsk = serpData.people_also_ask?.map(p => ({
    question: p.question || '',
    answer: p.snippet || ''
  })) || [];

  // Extract SERP features
  const serpFeatures = {
    featured_snippet: serpData.organic_results?.[0]?.snippet || '',
    knowledge_panel: serpData.knowledge_graph?.name || '',
    top_stories: serpData.top_stories?.map(s => s.title) || [],
    videos: serpData.video_results?.map(v => v.title) || [],
    images: serpData.images_results?.map(i => i.title) || [],
  };

  logger.info(`🤖 GROQ Power Analysis for: "${keyword}"`);
  logger.info(`📊 Analyzing ${competitors.length} competitors`);

  const prompt = `
    You are a Senior SEO Expert and Data Analyst. Perform ULTIMATE, POWERFUL analysis for keyword: "${keyword}".
    
    **CRITICAL RULES:**
    1. Return ONLY valid JSON.
    2. NO markdown, NO explanations outside JSON.
    3. Be specific, actionable, and data-driven.
    
    Competitor Data (Top 5):
    ${JSON.stringify(competitors, null, 2)}
    
    People Also Ask Data:
    ${JSON.stringify(peopleAlsoAsk, null, 2)}
    
    SERP Features:
    ${JSON.stringify(serpFeatures, null, 2)}
    
    Generate EXACT JSON with ALL these sections:
    {
      "keyword_intent": "Commercial/Informational/Transactional",
      "content_score": 85,
      "readability_avg": "Easy/Medium/Hard",
      
      "missing_headings": ["H2 heading 1", "H2 heading 2", "H2 heading 3", "H2 heading 4", "H2 heading 5", "H2 heading 6"],
      "faq_questions": ["Q1?", "Q2?", "Q3?", "Q4?", "Q5?", "Q6?"],
      "authority_links": ["https://example1.com", "https://example2.com", "https://example3.com"],
      
      "competitor_table": [
        {"rank": 1, "title": "Competitor 1", "strength": "Main advantage"},
        {"rank": 2, "title": "Competitor 2", "strength": "Main advantage"},
        {"rank": 3, "title": "Competitor 3", "strength": "Main advantage"}
      ],
      
      "readability_score": {
        "flesch_kincaid": 70,
        "grade_level": "9th Grade",
        "sentence_length": 18,
        "word_complexity": "Medium",
        "recommendations": ["Use shorter sentences", "Simplify vocabulary"]
      },
      
      "trend_forecast": {
        "growth": "20%",
        "seasonality": "Peak in Q4 and Q1",
        "peak_months": ["November", "December", "January"],
        "strategy": "Create content before peak season"
      },
      
      "pricing_intelligence": {
        "average_price": "50,000 JPY",
        "price_range": "30,000 - 200,000 JPY",
        "value_for_money": "Best value models"
      },
      
      "content_requirements": {
        "recommended_words": 3000,
        "min_words": 2000,
        "max_words": 4000,
        "images_needed": 10,
        "media_format": "HD Images + Videos",
        "video_suggestions": ["Unboxing video", "Comparison video"]
      },
      
      "keyword_metrics": {
        "search_volume": 1000,
        "difficulty": 44,
        "cpc": 0.9,
        "competition": "High",
        "related_keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4", "keyword 5"]
      },
      
      "backlink_gap": {
        "competitor_backlinks": [
          {"domain": "example1.com", "backlinks": 1200, "da": 92},
          {"domain": "example2.com", "backlinks": 500, "da": 65}
        ],
        "backlink_opportunities": ["TechRadar Guest Post", "Statista Resource Page"],
        "backlink_strategy": "Create high-quality content and reach out",
        "cost": "10 hours content + 5 hours outreach per week",
        "impact": "15-25 points",
        "opportunities": 8
      },
      
      "content_recommendations": {
        "title": "SEO-optimized title",
        "meta_description": "Meta description under 160 chars",
        "target_audience": "Target audience description",
        "content_length": "2000-2500 words",
        "tone": "Professional",
        "seo_tips": ["Tip 1", "Tip 2", "Tip 3", "Tip 4"]
      },
      
      "seo_metadata": {
        "title_tag": "SEO title tag",
        "meta_description": "SEO meta description",
        "url_slug": "url-friendly-slug",
        "focus_keyword": "main keyword"
      },

      "realtime_competitor_analysis": {
        "competitors": [
          {"name": "Competitor 1", "domain": "comp1.com", "traffic": "1.2M/month", "keyword_count": 45000, "domain_authority": 85, "backlinks": 50000, "strengths": ["High DA", "Content depth"], "weaknesses": ["Slow loading"]},
          {"name": "Competitor 2", "domain": "comp2.com", "traffic": "800K/month", "keyword_count": 35000, "domain_authority": 78, "backlinks": 35000, "strengths": ["Brand authority"], "weaknesses": ["Limited content"]}
        ],
        "market_position": "High competition market",
        "competitive_edge": "Focus on depth and quality"
      },
      
      "nlp_keywords": {
        "primary": ["keyword 1", "keyword 2", "keyword 3"],
        "secondary": ["keyword 4", "keyword 5", "keyword 6"],
        "long_tail": ["long tail 1", "long tail 2", "long tail 3"],
        "lsi": ["LSI 1", "LSI 2", "LSI 3"],
        "semantic_related": ["Semantic 1", "Semantic 2"],
        "keyword_clusters": [{"cluster": "Group 1", "keywords": ["kw1", "kw2"]}]
      },
      
      "people_also_ask": [
        {"question": "Question 1?", "answer": "Answer 1", "source": "Google PAA", "related_questions": ["Related 1", "Related 2"]},
        {"question": "Question 2?", "answer": "Answer 2", "source": "Google PAA", "related_questions": ["Related 3"]}
      ],
      
      "serp_analysis": {
        "featured_snippet": "Featured snippet content",
        "knowledge_panel": "Knowledge panel data",
        "top_stories": ["Story 1", "Story 2"],
        "videos": ["Video 1", "Video 2"],
        "images": ["Image 1", "Image 2"],
        "maps": "Map data",
        "total_results": 1000000,
        "paid_ads": 4,
        "organic_results_count": 10
      },
      
      "schema_markup": {
        "article": "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"Article\"}</script>",
        "faq": "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"FAQPage\"}</script>",
        "product": "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"Product\"}</script>",
        "how_to": "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"HowTo\"}</script>",
        "organization": "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"Organization\"}</script>",
        "complete_json": "{\"@context\":\"https://schema.org\",\"@type\":\"Article\",\"headline\":\"Title\"}"
      },
      
      "internal_links": [
        {"anchor_text": "Link 1", "target_url": "/category/page1", "relevance_score": 85, "context": "Relevant context"},
        {"anchor_text": "Link 2", "target_url": "/category/page2", "relevance_score": 75, "context": "Relevant context"}
      ],
      
      "content_quality": {
        "uniqueness": 85,
        "comprehensiveness": 80,
        "engagement": 75,
        "readability_score": 78,
        "seo_friendliness": 82,
        "overall_grade": "B+",
        "improvement_suggestions": ["Add more examples", "Include data points", "Improve readability"]
      },
      
      "entities": {
        "people": ["Person 1", "Person 2"],
        "organizations": ["Company 1", "Company 2"],
        "locations": ["Location 1", "Location 2"],
        "products": ["Product 1", "Product 2"],
        "dates": ["Date 1"],
        "concepts": ["Concept 1", "Concept 2"]
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
      max_tokens: 12000,
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

// ---------- 7. SerpAPI Service (with PAA extraction) ----------
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
    message: 'RankForge Power Edition V6 is Live!',
    version: '6.0.0',
    timestamp: new Date().toISOString(),
    mongodb: dbStatus,
    groq: process.env.GROQ_API_KEY ? 'Configured' : 'Missing',
    serpapi: process.env.SERPAPI_KEY ? 'Configured' : 'Missing',
    features: [
      'Real-time Competitor Analysis',
      'NLP Keywords',
      'People Also Ask',
      'SERP Analysis',
      'Schema Markup',
      'Internal Links',
      'Content Quality Score',
      'Entity Recognition'
    ],
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

    res.json({ reportId: newReport._id, cached: false, message: 'Processing power analysis...' });

    (async () => {
      const startTime = Date.now();
      try {
        logger.info(`🔄 Starting Power Analysis for: "${keyword}"`);
        
        const serpData = await fetchSerp(keyword);
        const insights = await generatePowerInsights(keyword, serpData);
        const endTime = Date.now();
        
        await Report.findByIdAndUpdate(newReport._id, {
          status: 'completed',
          data: insights,
          processingTime: (endTime - startTime) / 1000
        });
        logger.info(`✅ Power Analysis Completed: "${keyword}" in ${(endTime - startTime) / 1000}s`);
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
  logger.info(`🚀 Power Server V6 running on port ${PORT}`);
  logger.info(`📊 Model: GROQ: llama-3.3-70b-versatile`);
  logger.info(`⚡ Features: Real-time Competitor, NLP, PAA, SERP, Schema, Internal Links, Quality Score, Entities`);
  logger.info(`📈 Health Check: /api/health`);
  logger.info(`📊 Analytics: /api/analytics`);
  logger.info('='.repeat(60));
});
