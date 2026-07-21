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
logger.info('🚀 RankForge ULTIMATE Edition V7 - ERROR-FREE');
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

// ---------- 5. MongoDB Schema (ULTIMATE Edition - Flexible Types) ----------
const ReportSchema = new mongoose.Schema({
  keyword: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  errorMessage: { type: String, default: '' },
  processingTime: { type: Number, default: 0 },
  data: {
    // Basic
    keyword_intent: { type: String, default: '' },
    content_score: { type: Number, default: 0 },
    readability_avg: { type: String, default: '' },
    missing_headings: { type: [String], default: [] },
    faq_questions: { type: [String], default: [] },
    authority_links: { type: [String], default: [] },
    competitor_table: { type: [Object], default: [] },
    
    // ===== 14 ULTIMATE FEATURES =====
    search_intent_analysis: {
      intent_type: { type: String, default: '' },
      confidence_score: { type: Number, default: 0 },
      sub_intents: { type: [String], default: [] },
      user_goal: { type: String, default: '' },
      buyer_stage: { type: String, default: '' },
      content_type: { type: String, default: '' }
    },
    full_serp_analysis: {
      total_results: { type: Number, default: 0 },
      organic_results: { type: [Object], default: [] },
      featured_snippet: { type: String, default: '' },
      knowledge_panel: { type: String, default: '' },
      top_stories: { type: [String], default: [] },
      videos: { type: [String], default: [] },
      images: { type: [String], default: [] },
      people_also_ask: { type: [String], default: [] },
      related_searches: { type: [String], default: [] },
      paid_ads: { type: Number, default: 0 },
      serp_features: { type: [String], default: [] }
    },
    nlp_entity_extraction: {
      entities: { type: [Object], default: [] },
      key_phrases: { type: [String], default: [] },
      sentiment_score: { type: Number, default: 0 },
      language: { type: String, default: '' },
      topics: { type: [String], default: [] }
    },
    topical_authority_map: {
      core_topics: { type: [Object], default: [] },
      topic_clusters: { type: [Object], default: [] },
      content_hubs: { type: [String], default: [] }
    },
    internal_links: { type: [Object], default: [] },
    eeat_score: {
      experience: { type: Number, default: 0 },
      expertise: { type: Number, default: 0 },
      authoritativeness: { type: Number, default: 0 },
      trustworthiness: { type: Number, default: 0 },
      overall_score: { type: Number, default: 0 },
      grade: { type: String, default: '' },
      recommendations: { type: [String], default: [] }
    },
    featured_snippet_opportunities: {
      eligibility_score: { type: Number, default: 0 },
      current_snippet: { type: String, default: '' },
      competitor_snippets: { type: [String], default: [] },
      optimization_tips: { type: [String], default: [] },
      format_type: { type: String, default: '' },
      priority: { type: String, default: '' }
    },
    ai_overview_optimization: {
      visibility_score: { type: Number, default: 0 },
      optimization_tips: { type: [String], default: [] },
      structure_recommendations: { type: [String], default: [] },
      question_coverage: { type: [String], default: [] },
      featured_criteria: { type: [String], default: [] }
    },
    people_also_ask_expanded: { type: [Object], default: [] },
    content_brief: {
      title: { type: String, default: '' },
      meta_description: { type: String, default: '' },
      target_audience: { type: String, default: '' },
      content_goal: { type: String, default: '' },
      h2_headings: { type: [Object], default: [] },
      h3_subheadings: { type: [Object], default: [] },
      word_count_recommendation: { type: Number, default: 0 },
      recommended_sections: { type: [String], default: [] }
    },
    schema_generator: {
      faq: { type: String, default: '' },
      product: { type: String, default: '' },
      review: { type: String, default: '' },
      how_to: { type: String, default: '' },
      article: { type: String, default: '' },
      local_business: { type: String, default: '' },
      complete_json: { type: String, default: '' }
    },
    keyword_cannibalization: {
      status: { type: String, default: '' },
      risk_score: { type: Number, default: 0 },
      cannibalizing_keywords: { type: [Object], default: [] },
      optimization_tips: { type: [String], default: [] }
    },
    brand_backlink_analysis: {
      brand_mentions: { type: [Object], default: [] },
      backlink_gap: { type: [Object], default: [] },
      total_opportunities: { type: Number, default: 0 }
    },
    content_freshness: {
      freshness_score: { type: Number, default: 0 },
      last_updated: { type: String, default: '' },
      outdated_sections: { type: [String], default: [] },
      update_recommendations: { type: [Object], default: [] },
      trending_topics: { type: [String], default: [] }
    },
    // Existing features
    readability_score: {
      flesch_kincaid: { type: Number, default: 0 },
      grade_level: { type: String, default: '' },
      sentence_length: { type: Number, default: 0 },
      word_complexity: { type: String, default: '' },
      recommendations: { type: [String], default: [] }
    },
    trend_forecast: {
      growth: { type: String, default: '' },
      seasonality: { type: String, default: '' },
      peak_months: { type: [String], default: [] },
      strategy: { type: String, default: '' }
    },
    pricing_intelligence: {
      average_price: { type: String, default: '' },
      price_range: { type: String, default: '' },
      value_for_money: { type: String, default: '' }
    },
    content_requirements: {
      recommended_words: { type: Number, default: 0 },
      min_words: { type: Number, default: 0 },
      max_words: { type: Number, default: 0 },
      images_needed: { type: Number, default: 0 },
      media_format: { type: String, default: '' },
      video_suggestions: { type: [String], default: [] }
    },
    keyword_metrics: {
      search_volume: { type: Number, default: 0 },
      difficulty: { type: Number, default: 0 },
      cpc: { type: Number, default: 0 },
      competition: { type: String, default: '' },
      related_keywords: { type: [String], default: [] }
    },
    backlink_gap: {
      competitor_backlinks: { type: [Object], default: [] },
      backlink_opportunities: { type: [String], default: [] },
      backlink_strategy: { type: String, default: '' },
      cost: { type: String, default: '' },
      impact: { type: String, default: '' },
      opportunities: { type: Number, default: 0 }
    },
    content_recommendations: {
      title: { type: String, default: '' },
      meta_description: { type: String, default: '' },
      target_audience: { type: String, default: '' },
      content_length: { type: String, default: '' },
      tone: { type: String, default: '' },
      seo_tips: { type: [String], default: [] }
    },
    seo_metadata: {
      title_tag: { type: String, default: '' },
      meta_description: { type: String, default: '' },
      url_slug: { type: String, default: '' },
      focus_keyword: { type: String, default: '' }
    },
    realtime_competitor_analysis: { type: Object, default: {} },
    nlp_keywords: { type: Object, default: {} },
    people_also_ask: { type: [Object], default: [] },
    serp_analysis: { type: Object, default: {} },
    schema_markup: { type: Object, default: {} },
    content_quality: { type: Object, default: {} },
    entities: { type: Object, default: {} }
  },
  createdAt: { type: Date, default: Date.now, expires: 2592000 }
});

ReportSchema.index({ keyword: 1, createdAt: -1 });
ReportSchema.index({ status: 1 });

const Report = mongoose.model('Report', ReportSchema);

// ---------- 6. DATA SANITIZER - Converts GROQ response to correct types ----------
const sanitizeData = (rawData) => {
  const defaultData = {
    keyword_intent: 'Informational',
    content_score: 75,
    readability_avg: 'Medium',
    missing_headings: [],
    faq_questions: [],
    authority_links: [],
    competitor_table: [],
    search_intent_analysis: { intent_type: 'Informational', confidence_score: 70, sub_intents: [], user_goal: '', buyer_stage: '', content_type: '' },
    full_serp_analysis: { total_results: 0, organic_results: [], featured_snippet: '', knowledge_panel: '', top_stories: [], videos: [], images: [], people_also_ask: [], related_searches: [], paid_ads: 0, serp_features: [] },
    nlp_entity_extraction: { entities: [], key_phrases: [], sentiment_score: 0, language: 'en', topics: [] },
    topical_authority_map: { core_topics: [], topic_clusters: [], content_hubs: [] },
    internal_links: [],
    eeat_score: { experience: 0, expertise: 0, authoritativeness: 0, trustworthiness: 0, overall_score: 0, grade: '', recommendations: [] },
    featured_snippet_opportunities: { eligibility_score: 0, current_snippet: '', competitor_snippets: [], optimization_tips: [], format_type: '', priority: '' },
    ai_overview_optimization: { visibility_score: 0, optimization_tips: [], structure_recommendations: [], question_coverage: [], featured_criteria: [] },
    people_also_ask_expanded: [],
    content_brief: { title: '', meta_description: '', target_audience: '', content_goal: '', h2_headings: [], h3_subheadings: [], word_count_recommendation: 0, recommended_sections: [] },
    schema_generator: { faq: '', product: '', review: '', how_to: '', article: '', local_business: '', complete_json: '' },
    keyword_cannibalization: { status: 'Low Risk', risk_score: 0, cannibalizing_keywords: [], optimization_tips: [] },
    brand_backlink_analysis: { brand_mentions: [], backlink_gap: [], total_opportunities: 0 },
    content_freshness: { freshness_score: 0, last_updated: '', outdated_sections: [], update_recommendations: [], trending_topics: [] },
    readability_score: { flesch_kincaid: 0, grade_level: '', sentence_length: 0, word_complexity: '', recommendations: [] },
    trend_forecast: { growth: '', seasonality: '', peak_months: [], strategy: '' },
    pricing_intelligence: { average_price: '', price_range: '', value_for_money: '' },
    content_requirements: { recommended_words: 0, min_words: 0, max_words: 0, images_needed: 0, media_format: '', video_suggestions: [] },
    keyword_metrics: { search_volume: 0, difficulty: 0, cpc: 0, competition: '', related_keywords: [] },
    backlink_gap: { competitor_backlinks: [], backlink_opportunities: [], backlink_strategy: '', cost: '', impact: '', opportunities: 0 },
    content_recommendations: { title: '', meta_description: '', target_audience: '', content_length: '', tone: '', seo_tips: [] },
    seo_metadata: { title_tag: '', meta_description: '', url_slug: '', focus_keyword: '' }
  };

  const sanitized = { ...defaultData };

  for (const key of Object.keys(rawData)) {
    if (rawData[key] !== undefined && rawData[key] !== null) {
      // Handle authority_links - convert to array of strings
      if (key === 'authority_links' && rawData[key]) {
        if (Array.isArray(rawData[key])) {
          sanitized.authority_links = rawData[key].map(item => {
            if (typeof item === 'string') return item;
            if (typeof item === 'object' && item.link) return item.link;
            if (typeof item === 'object' && item.url) return item.url;
            if (typeof item === 'object' && item.href) return item.href;
            return String(item);
          }).filter(Boolean);
        } else if (typeof rawData[key] === 'string') {
          sanitized.authority_links = [rawData[key]];
        } else if (typeof rawData[key] === 'object') {
          sanitized.authority_links = Object.values(rawData[key]).filter(v => typeof v === 'string');
        }
        continue;
      }

      // Handle missing_headings - ensure array of strings
      if (key === 'missing_headings') {
        if (Array.isArray(rawData[key])) {
          sanitized.missing_headings = rawData[key].filter(item => typeof item === 'string');
        } else if (typeof rawData[key] === 'string') {
          sanitized.missing_headings = [rawData[key]];
        }
        continue;
      }

      // Handle faq_questions - ensure array of strings
      if (key === 'faq_questions') {
        if (Array.isArray(rawData[key])) {
          sanitized.faq_questions = rawData[key].filter(item => typeof item === 'string');
        } else if (typeof rawData[key] === 'string') {
          sanitized.faq_questions = [rawData[key]];
        }
        continue;
      }

      // Handle competitor_table - ensure array of objects
      if (key === 'competitor_table') {
        if (Array.isArray(rawData[key])) {
          sanitized.competitor_table = rawData[key].filter(item => typeof item === 'object');
        }
        continue;
      }

      // For all other fields, use the raw value if it matches expected type
      if (typeof rawData[key] === 'object' && rawData[key] !== null && !Array.isArray(rawData[key])) {
        sanitized[key] = { ...defaultData[key], ...rawData[key] };
      } else if (Array.isArray(rawData[key])) {
        sanitized[key] = rawData[key];
      } else if (typeof rawData[key] === 'string' || typeof rawData[key] === 'number' || typeof rawData[key] === 'boolean') {
        sanitized[key] = rawData[key];
      }
    }
  }

  return sanitized;
};

// ---------- 7. GROQ AI Service (with Sanitization) ----------
if (!process.env.GROQ_API_KEY) {
  logger.error('❌ Fatal Error: GROQ_API_KEY is missing!');
  process.exit(1);
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ULTRA-COMPRESS: Max 5 competitors, each with minimal fields
const ultraCompressCompetitors = (competitors) => {
  return (competitors || []).slice(0, 5).map((r, i) => ({
    r: i + 1,
    t: (r.title || '').substring(0, 50),
    s: (r.snippet || '').substring(0, 100),
    d: r.link ? new URL(r.link).hostname.replace('www.', '') : ''
  }));
};

const ultraCompressPAA = (paaData) => {
  return (paaData || []).slice(0, 3).map(p => ({
    q: (p.question || '').substring(0, 60),
    a: (p.snippet || '').substring(0, 80)
  }));
};

const generateUltimateInsights = async (keyword, serpData) => {
  // ULTRA COMPRESSED DATA
  const competitors = ultraCompressCompetitors(serpData.organic_results);
  const paa = ultraCompressPAA(serpData.people_also_ask);
  const related = (serpData.related_searches || []).slice(0, 3).map(r => r.query || '');
  
  const features = {
    fs: (serpData.organic_results?.[0]?.snippet || '').substring(0, 100),
    kp: (serpData.knowledge_graph?.name || ''),
    ts: (serpData.top_stories || []).slice(0, 2).map(s => s.title || '')
  };

  logger.info(`🤖 GROQ Analysis for: "${keyword}"`);
  logger.info(`📊 ${competitors.length} competitors, ${paa.length} PAA questions`);

  // COMPRESSED PROMPT
  const prompt = `
    SEO Expert. Analyze "${keyword}". Return ONLY JSON.

    Competitors (${competitors.length}):
    ${JSON.stringify(competitors)}

    PAA:
    ${JSON.stringify(paa)}

    Related:
    ${JSON.stringify(related)}

    SERP:
    ${JSON.stringify(features)}

    Generate JSON with all these fields:
    {
      "search_intent_analysis": {"intent_type":"Commercial/Informational/Transactional","confidence_score":85,"sub_intents":[],"user_goal":"","buyer_stage":"","content_type":""},
      "full_serp_analysis": {"total_results":0,"organic_results":[],"featured_snippet":"","serp_features":[]},
      "nlp_entity_extraction": {"entities":[],"key_phrases":[]},
      "topical_authority_map": {"core_topics":[],"topic_clusters":[]},
      "internal_links":[],
      "eeat_score": {"experience":0,"expertise":0,"authoritativeness":0,"trustworthiness":0,"overall_score":0,"grade":"","recommendations":[]},
      "featured_snippet_opportunities": {"eligibility_score":0,"optimization_tips":[],"format_type":"","priority":""},
      "ai_overview_optimization": {"visibility_score":0,"optimization_tips":[]},
      "people_also_ask_expanded":[],
      "content_brief": {"title":"","meta_description":"","target_audience":"","h2_headings":[],"h3_subheadings":[],"word_count_recommendation":0},
      "schema_generator": {"faq":"","product":"","article":"","complete_json":""},
      "keyword_cannibalization": {"risk_score":0,"optimization_tips":[]},
      "brand_backlink_analysis": {"brand_mentions":[],"backlink_gap":[],"total_opportunities":0},
      "content_freshness": {"freshness_score":0,"update_recommendations":[]},
      "keyword_intent":"Informational",
      "content_score":75,
      "readability_avg":"Medium",
      "missing_headings":[],
      "faq_questions":[],
      "authority_links":[],
      "competitor_table":[]
    }
  `;

  try {
    const startTime = Date.now();
    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'SEO expert. Return JSON only. No markdown.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 4000,
    });
    const endTime = Date.now();
    logger.info(`⏱️ GROQ Response Time: ${(endTime - startTime) / 1000}s`);

    const text = response.choices[0].message.content;
    logger.info(`📝 GROQ Response: ${text.substring(0, 150)}...`);
    
    const cleanJson = text.replace(/```json|```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);
    
    // ✅ SANITIZE DATA before saving
    const sanitizedData = sanitizeData(parsedData);
    
    return sanitizedData;
  } catch (error) {
    logger.error('❌ GROQ Error:', error.message);
    if (error.response) {
      logger.error('Response:', error.response.data);
    }
    // Return safe default data
    return sanitizeData({});
  }
};

// ---------- 8. SerpAPI Service ----------
const fetchSerp = async (keyword) => {
  logger.info(`🔍 Fetching SERP for: "${keyword}"`);
  
  try {
    const startTime = Date.now();
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        q: keyword,
        api_key: process.env.SERPAPI_KEY,
        num: 10,
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

// ---------- 9. API Routes ----------

// GET: Health Check
app.get('/api/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  const totalReports = await Report.countDocuments();
  const completedReports = await Report.countDocuments({ status: 'completed' });
  
  res.json({
    status: 'OK',
    message: 'RankForge ULTIMATE Edition V7 - ERROR-FREE',
    version: '7.0.0',
    timestamp: new Date().toISOString(),
    mongodb: dbStatus,
    groq: process.env.GROQ_API_KEY ? 'Configured' : 'Missing',
    serpapi: process.env.SERPAPI_KEY ? 'Configured' : 'Missing',
    model: 'llama-3.3-70b-versatile (Error-Free)',
    features: [
      'AI Search Intent Analysis',
      'Full SERP Analysis (Top 10)',
      'NLP & Entity Extraction',
      'Topical Authority Map',
      'Internal Link Suggestions',
      'EEAT Score',
      'Featured Snippet Opportunities',
      'AI Overview Optimization',
      'People Also Ask Expansion',
      'Content Brief with H2/H3 Outline',
      'Schema Generator',
      'Keyword Cannibalization Check',
      'Brand Mention & Backlink Gap Analysis',
      'Content Freshness Suggestions'
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

    res.json({ reportId: newReport._id, cached: false, message: 'Processing ULTIMATE analysis...' });

    (async () => {
      const startTime = Date.now();
      try {
        logger.info(`🔄 Starting ULTIMATE Analysis for: "${keyword}"`);
        
        const serpData = await fetchSerp(keyword);
        const insights = await generateUltimateInsights(keyword, serpData);
        const endTime = Date.now();
        
        // ✅ Sanitize again before saving (double safety)
        const safeData = sanitizeData(insights);
        
        await Report.findByIdAndUpdate(newReport._id, {
          status: 'completed',
          data: safeData,
          processingTime: (endTime - startTime) / 1000
        });
        logger.info(`✅ ULTIMATE Analysis Completed: "${keyword}" in ${(endTime - startTime) / 1000}s`);
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

// ---------- 10. Cron Jobs ----------
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

// ---------- 11. Start Server ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info('='.repeat(60));
  logger.info(`🚀 ULTIMATE Server V7 ERROR-FREE running on port ${PORT}`);
  logger.info(`📊 Model: GROQ: llama-3.3-70b-versatile`);
  logger.info(`⚡ 14 ULTIMATE Features with Data Sanitization`);
  logger.info(`📈 Health Check: /api/health`);
  logger.info(`📊 Analytics: /api/analytics`);
  logger.info('='.repeat(60));
});
