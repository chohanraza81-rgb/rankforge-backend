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
logger.info('🚀 RankForge ULTIMATE Edition V7 - Quality Optimized');
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

// ---------- 5. MongoDB Schema (V7 - ULTIMATE Edition) ----------
const ReportSchema = new mongoose.Schema({
  keyword: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  errorMessage: { type: String, default: '' },
  processingTime: { type: Number, default: 0 },
  data: {
    // ===== 14 ULTIMATE FEATURES =====

    // 1. AI Search Intent Analysis
    search_intent_analysis: {
      intent_type: String,
      confidence_score: Number,
      sub_intents: [String],
      user_goal: String,
      buyer_stage: String,
      content_type: String
    },

    // 2. Full SERP Analysis (Top 10)
    full_serp_analysis: {
      total_results: Number,
      organic_results: [{
        rank: Number,
        title: String,
        link: String,
        snippet: String,
        domain: String
      }],
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

    // 3. NLP & Entity Extraction
    nlp_entity_extraction: {
      entities: [{
        name: String,
        type: String,
        salience: Number,
        mention_count: Number,
        category: String
      }],
      key_phrases: [String],
      sentiment_score: Number,
      language: String,
      topics: [String]
    },

    // 4. Topical Authority Map
    topical_authority_map: {
      core_topics: [{
        topic: String,
        authority_score: Number,
        coverage_score: Number,
        gap_score: Number,
        recommendations: [String]
      }],
      topic_clusters: [{
        cluster_name: String,
        keywords: [String],
        priority: String
      }],
      content_hubs: [String]
    },

    // 5. Internal Link Suggestions
    internal_links: [{
      anchor_text: String,
      target_url: String,
      relevance_score: Number,
      context: String,
      page_type: String
    }],

    // 6. EEAT Score
    eeat_score: {
      experience: Number,
      expertise: Number,
      authoritativeness: Number,
      trustworthiness: Number,
      overall_score: Number,
      grade: String,
      recommendations: [String]
    },

    // 7. Featured Snippet Opportunities
    featured_snippet_opportunities: {
      eligibility_score: Number,
      current_snippet: String,
      competitor_snippets: [String],
      optimization_tips: [String],
      format_type: String,
      priority: String
    },

    // 8. AI Overview Optimization
    ai_overview_optimization: {
      visibility_score: Number,
      optimization_tips: [String],
      structure_recommendations: [String],
      question_coverage: [String],
      featured_criteria: [String]
    },

    // 9. People Also Ask Expansion
    people_also_ask_expanded: [{
      question: String,
      answer: String,
      difficulty: String,
      related_questions: [String],
      source: String
    }],

    // 10. Content Brief with H2/H3 Outline
    content_brief: {
      title: String,
      meta_description: String,
      target_audience: String,
      content_goal: String,
      h2_headings: [{
        heading: String,
        key_points: [String],
        word_count: Number,
        priority: String
      }],
      h3_subheadings: [{
        heading: String,
        context: String,
        keywords: [String]
      }],
      word_count_recommendation: Number,
      recommended_sections: [String]
    },

    // 11. Schema Generator
    schema_generator: {
      faq: String,
      product: String,
      review: String,
      how_to: String,
      article: String,
      local_business: String,
      complete_json: String
    },

    // 12. Keyword Cannibalization Check
    keyword_cannibalization: {
      status: String,
      risk_score: Number,
      cannibalizing_keywords: [{
        keyword: String,
        current_rank: Number,
        conflicts: [String],
        recommendation: String
      }],
      optimization_tips: [String]
    },

    // 13. Brand Mention & Backlink Gap Analysis
    brand_backlink_analysis: {
      brand_mentions: [{
        source: String,
        url: String,
        anchor_text: String,
        sentiment: String,
        date: String
      }],
      backlink_gap: [{
        competitor: String,
        backlinks: Number,
        missing_links: [String],
        opportunity_score: Number
      }],
      total_opportunities: Number
    },

    // 14. Content Freshness Suggestions
    content_freshness: {
      freshness_score: Number,
      last_updated: String,
      outdated_sections: [String],
      update_recommendations: [{
        section: String,
        reason: String,
        priority: String,
        suggested_updates: [String]
      }],
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

// ---------- 6. GROQ AI Service (V7 - Quality Optimized with Token Limit) ----------
if (!process.env.GROQ_API_KEY) {
  logger.error('❌ Fatal Error: GROQ_API_KEY is missing!');
  process.exit(1);
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Helper: Compress competitor data intelligently
const compressCompetitors = (competitors) => {
  return competitors.slice(0, 10).map((r, i) => ({
    r: i + 1, // rank
    t: (r.title || 'N/A').substring(0, 60), // title
    s: (r.snippet || '').substring(0, 150), // snippet
    d: r.link ? new URL(r.link).hostname : '' // domain
  }));
};

// Helper: Compress PAA data
const compressPAA = (paaData) => {
  return (paaData || []).slice(0, 5).map(p => ({
    q: p.question || '',
    a: (p.snippet || '').substring(0, 100)
  }));
};

const generateUltimateInsights = async (keyword, serpData) => {
  // Compress data to reduce tokens
  const compressedCompetitors = compressCompetitors(serpData.organic_results || []);
  const compressedPAA = compressPAA(serpData.people_also_ask || []);
  const compressedRelated = (serpData.related_searches || []).slice(0, 5).map(r => r.query || '');
  
  const serpFeatures = {
    fs: serpData.organic_results?.[0]?.snippet?.substring(0, 150) || '',
    kp: serpData.knowledge_graph?.name || '',
    ts: (serpData.top_stories || []).slice(0, 3).map(s => s.title || ''),
    vd: (serpData.video_results || []).slice(0, 3).map(v => v.title || '')
  };

  logger.info(`🤖 GROQ Optimized Analysis for: "${keyword}"`);
  logger.info(`📊 Compressed ${compressedCompetitors.length} competitors`);

  // Quality-focused prompt with compressed data
  const prompt = `
    You are a World-Class SEO Expert. Analyze keyword: "${keyword}" with ULTIMATE precision.

    COMPRESSED COMPETITOR DATA (Top 10):
    ${JSON.stringify(compressedCompetitors, null, 2)}

    PEOPLE ALSO ASK:
    ${JSON.stringify(compressedPAA, null, 2)}

    RELATED SEARCHES:
    ${JSON.stringify(compressedRelated, null, 2)}

    SERP FEATURES:
    ${JSON.stringify(serpFeatures, null, 2)}

    Return EXACT JSON with these 14 sections (QUALITY focused, no fluff):
    {
      "search_intent_analysis": {"intent_type":"Commercial/Informational/Transactional","confidence_score":0-100,"sub_intents":[],"user_goal":"","buyer_stage":"Awareness/Consideration/Decision","content_type":"Guide/Review/Comparison"},
      
      "full_serp_analysis": {"total_results":0,"organic_results":[{"rank":0,"title":"","domain":""}],"featured_snippet":"","knowledge_panel":"","top_stories":[],"videos":[],"images":[],"people_also_ask":[],"related_searches":[],"paid_ads":0,"serp_features":[]},
      
      "nlp_entity_extraction": {"entities":[{"name":"","type":"Organization/Person/Product","salience":0,"mention_count":0,"category":""}],"key_phrases":[],"sentiment_score":0,"language":"en","topics":[]},
      
      "topical_authority_map": {"core_topics":[{"topic":"","authority_score":0,"coverage_score":0,"gap_score":0,"recommendations":[]}],"topic_clusters":[{"cluster_name":"","keywords":[],"priority":"High/Medium/Low"}],"content_hubs":[]},
      
      "internal_links":[{"anchor_text":"","target_url":"","relevance_score":0,"context":"","page_type":"Blog/Product/Guide"}],
      
      "eeat_score": {"experience":0,"expertise":0,"authoritativeness":0,"trustworthiness":0,"overall_score":0,"grade":"A/B/C/D","recommendations":[]},
      
      "featured_snippet_opportunities": {"eligibility_score":0,"current_snippet":"","competitor_snippets":[],"optimization_tips":[],"format_type":"Paragraph/List/Table","priority":"High/Medium/Low"},
      
      "ai_overview_optimization": {"visibility_score":0,"optimization_tips":[],"structure_recommendations":[],"question_coverage":[],"featured_criteria":[]},
      
      "people_also_ask_expanded":[{"question":"","answer":"","difficulty":"Easy/Medium/Hard","related_questions":[],"source":"Google PAA"}],
      
      "content_brief": {"title":"","meta_description":"","target_audience":"","content_goal":"","h2_headings":[{"heading":"","key_points":[],"word_count":0,"priority":"High/Medium/Low"}],"h3_subheadings":[{"heading":"","context":"","keywords":[]}],"word_count_recommendation":0,"recommended_sections":[]},
      
      "schema_generator": {"faq":"","product":"","review":"","how_to":"","article":"","local_business":"","complete_json":""},
      
      "keyword_cannibalization": {"status":"Low/Medium/High Risk","risk_score":0,"cannibalizing_keywords":[{"keyword":"","current_rank":0,"conflicts":[],"recommendation":""}],"optimization_tips":[]},
      
      "brand_backlink_analysis": {"brand_mentions":[{"source":"","url":"","anchor_text":"","sentiment":"Positive/Negative/Neutral","date":""}],"backlink_gap":[{"competitor":"","backlinks":0,"missing_links":[],"opportunity_score":0}],"total_opportunities":0},
      
      "content_freshness": {"freshness_score":0,"last_updated":"","outdated_sections":[],"update_recommendations":[{"section":"","reason":"","priority":"High/Medium/Low","suggested_updates":[]}],"trending_topics":[]},
      
      "keyword_intent":"Commercial/Informational/Transactional",
      "content_score":0-100,
      "readability_avg":"Easy/Medium/Hard",
      "missing_headings":[],
      "faq_questions":[],
      "authority_links":[],
      "competitor_table":[{"rank":0,"title":"","strength":""}]
    }

    CRITICAL: Return ONLY valid JSON. No markdown, no explanations. Keep responses detailed but concise.
  `;

  try {
    const startTime = Date.now();
    const response = await groq.chat.completions.create({
      messages: [
        { 
          role: 'system', 
          content: 'You are a Senior SEO Expert. Return ONLY valid JSON. No markdown, no explanations. Be thorough and insightful.' 
        },
        { 
          role: 'user', 
          content: prompt 
        }
      ],
      model: 'llama-3.1-8b-instant', // ✅ Fast + Quality model
      temperature: 0.3,
      max_tokens: 6000, // ✅ Optimal for quality response
    });
    const endTime = Date.now();
    logger.info(`⏱️ GROQ Response Time: ${(endTime - startTime) / 1000}s`);

    const text = response.choices[0].message.content;
    logger.info(`📝 GROQ Response: ${text.substring(0, 150)}...`);
    
    const cleanJson = text.replace(/```json|```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);
    
    // Validate critical fields
    if (!parsedData.keyword_intent) {
      logger.warn('⚠️ Missing keyword_intent, adding fallback');
      parsedData.keyword_intent = 'Informational';
    }
    if (!parsedData.content_score) {
      parsedData.content_score = 75;
    }
    
    return parsedData;
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
    message: 'RankForge ULTIMATE Edition V7 - Quality Optimized',
    version: '7.0.0',
    timestamp: new Date().toISOString(),
    mongodb: dbStatus,
    groq: process.env.GROQ_API_KEY ? 'Configured' : 'Missing',
    serpapi: process.env.SERPAPI_KEY ? 'Configured' : 'Missing',
    model: 'llama-3.1-8b-instant',
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
  logger.info(`🚀 ULTIMATE Server V7 running on port ${PORT}`);
  logger.info(`📊 Model: GROQ: llama-3.1-8b-instant (Quality Optimized)`);
  logger.info(`⚡ 14 ULTIMATE Features with Token Optimization`);
  logger.info(`📈 Health Check: /api/health`);
  logger.info(`📊 Analytics: /api/analytics`);
  logger.info('='.repeat(60));
});
