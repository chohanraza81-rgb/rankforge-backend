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
logger.info('🚀 RankForge ULTIMATE Edition V7 - FINAL');
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

// ---------- 5. MongoDB Schema (ULTIMATE Edition) ----------
const ReportSchema = new mongoose.Schema({
  keyword: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  errorMessage: { type: String, default: '' },
  processingTime: { type: Number, default: 0 },
  data: {
    // ===== 14 ULTIMATE FEATURES =====
    search_intent_analysis: {
      intent_type: String,
      confidence_score: Number,
      sub_intents: [String],
      user_goal: String,
      buyer_stage: String,
      content_type: String
    },
    full_serp_analysis: {
      total_results: Number,
      organic_results: [{ rank: Number, title: String, link: String, snippet: String, domain: String }],
      featured_snippet: String,
      knowledge_panel: String,
      top_stories: [String],
      videos: [String],
      images: [String],
      people_also_ask: [String],
      related_searches: [String],
      paid_ads: Number,
      serp_features: [String]
    },
    nlp_entity_extraction: {
      entities: [{ name: String, type: String, salience: Number, mention_count: Number, category: String }],
      key_phrases: [String],
      sentiment_score: Number,
      language: String,
      topics: [String]
    },
    topical_authority_map: {
      core_topics: [{ topic: String, authority_score: Number, coverage_score: Number, gap_score: Number, recommendations: [String] }],
      topic_clusters: [{ cluster_name: String, keywords: [String], priority: String }],
      content_hubs: [String]
    },
    internal_links: [{ anchor_text: String, target_url: String, relevance_score: Number, context: String, page_type: String }],
    eeat_score: {
      experience: Number,
      expertise: Number,
      authoritativeness: Number,
      trustworthiness: Number,
      overall_score: Number,
      grade: String,
      recommendations: [String]
    },
    featured_snippet_opportunities: {
      eligibility_score: Number,
      current_snippet: String,
      competitor_snippets: [String],
      optimization_tips: [String],
      format_type: String,
      priority: String
    },
    ai_overview_optimization: {
      visibility_score: Number,
      optimization_tips: [String],
      structure_recommendations: [String],
      question_coverage: [String],
      featured_criteria: [String]
    },
    people_also_ask_expanded: [{
      question: String,
      answer: String,
      difficulty: String,
      related_questions: [String],
      source: String
    }],
    content_brief: {
      title: String,
      meta_description: String,
      target_audience: String,
      content_goal: String,
      h2_headings: [{ heading: String, key_points: [String], word_count: Number, priority: String }],
      h3_subheadings: [{ heading: String, context: String, keywords: [String] }],
      word_count_recommendation: Number,
      recommended_sections: [String]
    },
    schema_generator: {
      faq: String,
      product: String,
      review: String,
      how_to: String,
      article: String,
      local_business: String,
      complete_json: String
    },
    keyword_cannibalization: {
      status: String,
      risk_score: Number,
      cannibalizing_keywords: [{ keyword: String, current_rank: Number, conflicts: [String], recommendation: String }],
      optimization_tips: [String]
    },
    brand_backlink_analysis: {
      brand_mentions: [{ source: String, url: String, anchor_text: String, sentiment: String, date: String }],
      backlink_gap: [{ competitor: String, backlinks: Number, missing_links: [String], opportunity_score: Number }],
      total_opportunities: Number
    },
    content_freshness: {
      freshness_score: Number,
      last_updated: String,
      outdated_sections: [String],
      update_recommendations: [{ section: String, reason: String, priority: String, suggested_updates: [String] }],
      trending_topics: [String]
    },
    // ===== EXISTING FEATURES =====
    keyword_intent: String,
    content_score: Number,
    readability_avg: String,
    missing_headings: [String],
    faq_questions: [String],
    authority_links: [String],
    competitor_table: [Object],
    readability_score: Object,
    trend_forecast: Object,
    pricing_intelligence: Object,
    content_requirements: Object,
    keyword_metrics: Object,
    backlink_gap: Object,
    content_recommendations: Object,
    seo_metadata: Object,
    realtime_competitor_analysis: Object,
    nlp_keywords: Object,
    people_also_ask: [Object],
    serp_analysis: Object,
    schema_markup: Object,
    internal_links: [Object],
    content_quality: Object,
    entities: Object
  },
  createdAt: { type: Date, default: Date.now, expires: 2592000 }
});

ReportSchema.index({ keyword: 1, createdAt: -1 });
ReportSchema.index({ status: 1 });

const Report = mongoose.model('Report', ReportSchema);

// ---------- 6. GROQ AI Service (ULTRA-Compressed for Token Limit) ----------
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

  logger.info(`🤖 GROQ ULTRA-Compressed Analysis for: "${keyword}"`);
  logger.info(`📊 ${competitors.length} competitors, ${paa.length} PAA questions`);

  // SUPER COMPRESSED PROMPT (under 4000 tokens)
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

    Generate JSON with:
    {
      "search_intent_analysis":{"intent_type":"Commercial/Informational/Transactional","confidence_score":0-100,"sub_intents":[],"user_goal":"","buyer_stage":"","content_type":""},
      "full_serp_analysis":{"total_results":0,"organic_results":[{"rank":0,"title":"","domain":""}],"featured_snippet":"","serp_features":[]},
      "nlp_entity_extraction":{"entities":[{"name":"","type":"","salience":0}],"key_phrases":[]},
      "topical_authority_map":{"core_topics":[{"topic":"","authority_score":0}],"topic_clusters":[]},
      "internal_links":[{"anchor_text":"","target_url":"","relevance_score":0}],
      "eeat_score":{"experience":0,"expertise":0,"authoritativeness":0,"trustworthiness":0,"overall_score":0,"grade":"","recommendations":[]},
      "featured_snippet_opportunities":{"eligibility_score":0,"optimization_tips":[],"format_type":"","priority":""},
      "ai_overview_optimization":{"visibility_score":0,"optimization_tips":[]},
      "people_also_ask_expanded":[{"question":"","answer":"","difficulty":""}],
      "content_brief":{"title":"","meta_description":"","target_audience":"","h2_headings":[{"heading":"","key_points":[]}],"h3_subheadings":[{"heading":""}],"word_count_recommendation":0},
      "schema_generator":{"faq":"","product":"","article":"","complete_json":""},
      "keyword_cannibalization":{"risk_score":0,"optimization_tips":[]},
      "brand_backlink_analysis":{"brand_mentions":[],"backlink_gap":[{"competitor":"","backlinks":0}],"total_opportunities":0},
      "content_freshness":{"freshness_score":0,"update_recommendations":[]},
      "keyword_intent":"Commercial/Informational/Transactional",
      "content_score":0-100,
      "readability_avg":"Easy/Medium/Hard",
      "missing_headings":[],
      "faq_questions":[],
      "authority_links":[],
      "competitor_table":[{"rank":0,"title":"","strength":""}]
    }
  `;

  try {
    const startTime = Date.now();
    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'SEO expert. Return JSON only. No markdown.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile', // ✅ Higher token limit
      temperature: 0.3,
      max_tokens: 4000, // ✅ Reduced
    });
    const endTime = Date.now();
    logger.info(`⏱️ GROQ Response Time: ${(endTime - startTime) / 1000}s`);

    const text = response.choices[0].message.content;
    logger.info(`📝 GROQ Response: ${text.substring(0, 150)}...`);
    
    const cleanJson = text.replace(/```json|```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);
    
    // Ensure all fields exist
    const defaults = {
      keyword_intent: 'Informational',
      content_score: 75,
      readability_avg: 'Medium',
      missing_headings: [],
      faq_questions: [],
      authority_links: [],
      competitor_table: [],
      search_intent_analysis: { intent_type: 'Informational', confidence_score: 70, sub_intents: [], user_goal: '', buyer_stage: '', content_type: '' },
      full_serp_analysis: { total_results: 0, organic_results: [], featured_snippet: '', serp_features: [] },
      nlp_entity_extraction: { entities: [], key_phrases: [] },
      topical_authority_map: { core_topics: [], topic_clusters: [] },
      internal_links: [],
      eeat_score: { experience: 0, expertise: 0, authoritativeness: 0, trustworthiness: 0, overall_score: 0, grade: '', recommendations: [] },
      featured_snippet_opportunities: { eligibility_score: 0, optimization_tips: [], format_type: '', priority: '' },
      ai_overview_optimization: { visibility_score: 0, optimization_tips: [] },
      people_also_ask_expanded: [],
      content_brief: { title: '', meta_description: '', target_audience: '', h2_headings: [], h3_subheadings: [], word_count_recommendation: 0 },
      schema_generator: { faq: '', product: '', article: '', complete_json: '' },
      keyword_cannibalization: { risk_score: 0, optimization_tips: [] },
      brand_backlink_analysis: { brand_mentions: [], backlink_gap: [], total_opportunities: 0 },
      content_freshness: { freshness_score: 0, update_recommendations: [] }
    };

    // Merge with defaults
    for (const key of Object.keys(defaults)) {
      if (!parsedData[key] || (typeof parsedData[key] === 'object' && Object.keys(parsedData[key]).length === 0)) {
        parsedData[key] = defaults[key];
      }
    }

    return parsedData;
  } catch (error) {
    logger.error('❌ GROQ Error:', error.message);
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

// ---------- 8. API Routes ----------

// GET: Health Check
app.get('/api/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  const totalReports = await Report.countDocuments();
  const completedReports = await Report.countDocuments({ status: 'completed' });
  
  res.json({
    status: 'OK',
    message: 'RankForge ULTIMATE Edition V7 - FINAL',
    version: '7.0.0',
    timestamp: new Date().toISOString(),
    mongodb: dbStatus,
    groq: process.env.GROQ_API_KEY ? 'Configured' : 'Missing',
    serpapi: process.env.SERPAPI_KEY ? 'Configured' : 'Missing',
    model: 'llama-3.3-70b-versatile (Token Optimized)',
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
        
        await Report.findByIdAndUpdate(newReport._id, {
          status: 'completed',
          data: insights,
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
  logger.info(`🚀 ULTIMATE Server V7 FINAL running on port ${PORT}`);
  logger.info(`📊 Model: GROQ: llama-3.3-70b-versatile (Token Optimized)`);
  logger.info(`⚡ 14 ULTIMATE Features with ULTRA-Compressed Data`);
  logger.info(`📈 Health Check: /api/health`);
  logger.info(`📊 Analytics: /api/analytics`);
  logger.info('='.repeat(60));
});
