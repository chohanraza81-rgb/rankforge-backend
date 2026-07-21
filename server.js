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
logger.info('🚀 RankForge ULTIMATE Edition V7');
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

// ---------- 6. GROQ AI Service (V7 - ULTIMATE Edition) ----------
if (!process.env.GROQ_API_KEY) {
  logger.error('❌ Fatal Error: GROQ_API_KEY is missing!');
  process.exit(1);
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const generateUltimateInsights = async (keyword, serpData) => {
  const competitors = serpData.organic_results?.slice(0, 10).map((r, i) => ({
    rank: i + 1,
    title: (r.title || 'N/A').substring(0, 80),
    snippet: (r.snippet || '').substring(0, 300),
    link: r.link || '#',
    domain: r.link ? new URL(r.link).hostname : ''
  })) || [];

  // Extract People Also Ask
  const peopleAlsoAsk = serpData.people_also_ask?.map(p => ({
    question: p.question || '',
    answer: p.snippet || ''
  })) || [];

  // Extract Related Searches
  const relatedSearches = serpData.related_searches?.map(r => r.query || '') || [];

  // Extract SERP features
  const serpFeatures = {
    featured_snippet: serpData.organic_results?.[0]?.snippet || '',
    knowledge_panel: serpData.knowledge_graph?.name || '',
    top_stories: serpData.top_stories?.map(s => s.title) || [],
    videos: serpData.video_results?.map(v => v.title) || [],
    images: serpData.images_results?.map(i => i.title) || [],
  };

  logger.info(`🤖 GROQ ULTIMATE Analysis for: "${keyword}"`);
  logger.info(`📊 Analyzing ${competitors.length} competitors`);

  const prompt = `
    You are the World's Best Senior SEO Expert and Data Analyst. Perform ULTIMATE, COMPLETE, ENTERPRISE-GRADE analysis for keyword: "${keyword}".
    
    **CRITICAL RULES:**
    1. Return ONLY valid JSON.
    2. NO markdown, NO explanations outside JSON.
    3. Be specific, actionable, and data-driven.
    4. Think like a $100,000/year SEO consultant.
    
    Competitor Data (Top 10):
    ${JSON.stringify(competitors, null, 2)}
    
    People Also Ask Data:
    ${JSON.stringify(peopleAlsoAsk, null, 2)}
    
    Related Searches:
    ${JSON.stringify(relatedSearches, null, 2)}
    
    SERP Features:
    ${JSON.stringify(serpFeatures, null, 2)}
    
    Generate EXACT JSON with ALL 14 ULTIMATE sections:
    {
      // 1. AI Search Intent Analysis
      "search_intent_analysis": {
        "intent_type": "Commercial/Informational/Transactional/Navigational",
        "confidence_score": 92,
        "sub_intents": ["Compare", "Review", "Buy"],
        "user_goal": "User wants to find best product",
        "buyer_stage": "Consideration",
        "content_type": "Comparison/Review/Guide"
      },
      
      // 2. Full SERP Analysis (Top 10)
      "full_serp_analysis": {
        "total_results": 1000000,
        "organic_results": [
          {"rank": 1, "title": "Title", "link": "URL", "snippet": "Snippet", "domain": "domain.com"}
        ],
        "featured_snippet": "Featured snippet content",
        "knowledge_panel": "Knowledge panel info",
        "top_stories": ["Story 1", "Story 2"],
        "videos": ["Video 1"],
        "images": ["Image 1"],
        "people_also_ask": ["Q1?", "Q2?"],
        "related_searches": ["Related 1", "Related 2"],
        "paid_ads": 4,
        "serp_features": ["Featured Snippet", "Knowledge Panel", "People Also Ask"]
      },
      
      // 3. NLP & Entity Extraction
      "nlp_entity_extraction": {
        "entities": [
          {"name": "Entity 1", "type": "Organization", "salience": 0.85, "mention_count": 5, "category": "Tech"}
        ],
        "key_phrases": ["Phrase 1", "Phrase 2"],
        "sentiment_score": 0.75,
        "language": "en",
        "topics": ["Topic 1", "Topic 2"]
      },
      
      // 4. Topical Authority Map
      "topical_authority_map": {
        "core_topics": [
          {"topic": "Topic 1", "authority_score": 80, "coverage_score": 75, "gap_score": 25, "recommendations": ["Create more content"]}
        ],
        "topic_clusters": [
          {"cluster_name": "Cluster 1", "keywords": ["kw1", "kw2"], "priority": "High"}
        ],
        "content_hubs": ["Hub 1", "Hub 2"]
      },
      
      // 5. Internal Link Suggestions
      "internal_links": [
        {"anchor_text": "Link 1", "target_url": "/category/page1", "relevance_score": 85, "context": "Relevant context", "page_type": "Blog"}
      ],
      
      // 6. EEAT Score
      "eeat_score": {
        "experience": 85,
        "expertise": 80,
        "authoritativeness": 78,
        "trustworthiness": 82,
        "overall_score": 81,
        "grade": "B+",
        "recommendations": ["Add author bio", "Cite sources"]
      },
      
      // 7. Featured Snippet Opportunities
      "featured_snippet_opportunities": {
        "eligibility_score": 75,
        "current_snippet": "Current snippet content",
        "competitor_snippets": ["Comp snippet 1", "Comp snippet 2"],
        "optimization_tips": ["Use bullet points", "Write clear definitions"],
        "format_type": "Paragraph/List/Table",
        "priority": "High"
      },
      
      // 8. AI Overview Optimization
      "ai_overview_optimization": {
        "visibility_score": 70,
        "optimization_tips": ["Use structured data", "Answer questions directly"],
        "structure_recommendations": ["Use H2 headings", "Include FAQ"],
        "question_coverage": ["Question 1", "Question 2"],
        "featured_criteria": ["Clear answers", "Well-structured content"]
      },
      
      // 9. People Also Ask Expansion
      "people_also_ask_expanded": [
        {"question": "Q1?", "answer": "Answer 1", "difficulty": "Medium", "related_questions": ["Related 1"], "source": "Google PAA"}
      ],
      
      // 10. Content Brief with H2/H3 Outline
      "content_brief": {
        "title": "Best Sports Shoes in India: A Complete Guide",
        "meta_description": "Meta description under 160 chars",
        "target_audience": "Sports enthusiasts and fitness-conscious individuals",
        "content_goal": "To help readers choose the right sports shoes",
        "h2_headings": [
          {"heading": "Top Sports Shoes Brands in India", "key_points": ["Point 1", "Point 2"], "word_count": 300, "priority": "High"}
        ],
        "h3_subheadings": [
          {"heading": "Sub-heading 1", "context": "Context", "keywords": ["kw1", "kw2"]}
        ],
        "word_count_recommendation": 2500,
        "recommended_sections": ["Introduction", "Buying Guide", "Top Picks", "FAQ"]
      },
      
      // 11. Schema Generator
      "schema_generator": {
        "faq": "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"FAQPage\"}</script>",
        "product": "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"Product\"}</script>",
        "review": "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"Review\"}</script>",
        "how_to": "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"HowTo\"}</script>",
        "article": "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"Article\"}</script>",
        "local_business": "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"LocalBusiness\"}</script>",
        "complete_json": "{\"@context\":\"https://schema.org\",\"@type\":\"Article\",\"headline\":\"Title\"}"
      },
      
      // 12. Keyword Cannibalization Check
      "keyword_cannibalization": {
        "status": "Low Risk",
        "risk_score": 25,
        "cannibalizing_keywords": [
          {"keyword": "keyword 1", "current_rank": 1, "conflicts": ["similar term"], "recommendation": "Merge content"}
        ],
        "optimization_tips": ["Avoid duplicate content", "Use canonical tags"]
      },
      
      // 13. Brand Mention & Backlink Gap Analysis
      "brand_backlink_analysis": {
        "brand_mentions": [
          {"source": "Site 1", "url": "URL", "anchor_text": "text", "sentiment": "Positive", "date": "2024-01-01"}
        ],
        "backlink_gap": [
          {"competitor": "Comp 1", "backlinks": 1000, "missing_links": ["Link 1"], "opportunity_score": 80}
        ],
        "total_opportunities": 15
      },
      
      // 14. Content Freshness Suggestions
      "content_freshness": {
        "freshness_score": 70,
        "last_updated": "2024-01-01",
        "outdated_sections": ["Section 1", "Section 2"],
        "update_recommendations": [
          {"section": "Section 1", "reason": "Outdated data", "priority": "High", "suggested_updates": ["Update stats", "Add new products"]}
        ],
        "trending_topics": ["Topic 1", "Topic 2"]
      },
      
      // ===== EXISTING FEATURES =====
      "keyword_intent": "Commercial/Informational/Transactional",
      "content_score": 85,
      "readability_avg": "Medium",
      "missing_headings": ["H2 heading 1", "H2 heading 2", "H2 heading 3"],
      "faq_questions": ["Q1?", "Q2?", "Q3?", "Q4?", "Q5?", "Q6?"],
      "authority_links": ["https://example1.com"],
      "competitor_table": [{"rank": 1, "title": "Competitor 1", "strength": "Main advantage"}],
      "readability_score": {"flesch_kincaid": 70, "grade_level": "9th Grade", "sentence_length": 18, "word_complexity": "Medium", "recommendations": ["Tip 1"]},
      "trend_forecast": {"growth": "20%", "seasonality": "Peak in Q4", "peak_months": ["Nov", "Dec"], "strategy": "Create content before peak"},
      "pricing_intelligence": {"average_price": "50,000 JPY", "price_range": "30,000 - 200,000 JPY", "value_for_money": "Best value"},
      "content_requirements": {"recommended_words": 3000, "min_words": 2000, "max_words": 4000, "images_needed": 10, "media_format": "HD Images + Videos", "video_suggestions": ["Unboxing video"]},
      "keyword_metrics": {"search_volume": 1000, "difficulty": 44, "cpc": 0.9, "competition": "High", "related_keywords": ["kw1", "kw2"]},
      "backlink_gap": {"competitor_backlinks": [{"domain": "example.com", "backlinks": 1200, "da": 92}], "backlink_opportunities": ["Guest Post"], "backlink_strategy": "Create content and outreach", "cost": "10 hours", "impact": "15-25 points", "opportunities": 8},
      "content_recommendations": {"title": "SEO title", "meta_description": "Meta desc", "target_audience": "Audience", "content_length": "2000-2500 words", "tone": "Professional", "seo_tips": ["Tip 1", "Tip 2"]},
      "seo_metadata": {"title_tag": "SEO title", "meta_description": "Meta desc", "url_slug": "url-friendly-slug", "focus_keyword": "main keyword"},
      "realtime_competitor_analysis": {"competitors": [{"name": "Comp 1", "domain": "comp.com", "traffic": "1.2M/month", "keyword_count": 45000, "domain_authority": 85, "backlinks": 50000, "strengths": ["Strength 1"], "weaknesses": ["Weakness 1"]}], "market_position": "High competition", "competitive_edge": "Focus on quality"},
      "nlp_keywords": {"primary": ["kw1", "kw2"], "secondary": ["kw3"], "long_tail": ["long tail 1"], "lsi": ["LSI 1"], "semantic_related": ["Semantic 1"], "keyword_clusters": [{"cluster": "Group 1", "keywords": ["kw1"]}]},
      "people_also_ask": [{"question": "Q1?", "answer": "Answer 1", "source": "Google PAA", "related_questions": ["Related 1"]}],
      "serp_analysis": {"featured_snippet": "Snippet", "knowledge_panel": "Panel", "top_stories": ["Story 1"], "videos": ["Video 1"], "images": ["Image 1"], "maps": "Map", "total_results": 1000000, "paid_ads": 4, "organic_results_count": 10},
      "schema_markup": {"article": "", "faq": "", "product": "", "how_to": "", "organization": "", "complete_json": ""},
      "content_quality": {"uniqueness": 85, "comprehensiveness": 80, "engagement": 75, "readability_score": 78, "seo_friendliness": 82, "overall_grade": "B+", "improvement_suggestions": ["Add more examples"]},
      "entities": {"people": ["Person 1"], "organizations": ["Company 1"], "locations": ["Location 1"], "products": ["Product 1"], "dates": ["Date 1"], "concepts": ["Concept 1"]}
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
      max_tokens: 16000,
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
    message: 'RankForge ULTIMATE Edition V7 is Live!',
    version: '7.0.0',
    timestamp: new Date().toISOString(),
    mongodb: dbStatus,
    groq: process.env.GROQ_API_KEY ? 'Configured' : 'Missing',
    serpapi: process.env.SERPAPI_KEY ? 'Configured' : 'Missing',
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
  logger.info(`📊 Model: GROQ: llama-3.3-70b-versatile`);
  logger.info(`⚡ 14 ULTIMATE Features: Intent, SERP, NLP, Topical Map, Internal Links, EEAT, Featured Snippet, AI Overview, PAA, Content Brief, Schema, Cannibalization, Brand Backlink, Freshness`);
  logger.info(`📈 Health Check: /api/health`);
  logger.info(`📊 Analytics: /api/analytics`);
  logger.info('='.repeat(60));
});
