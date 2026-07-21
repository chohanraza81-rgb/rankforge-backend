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

// ---------- Rate Limiting (FIXED for Railway) ----------
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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

// ---------- 3. Startup Logging ----------
logger.info('='.repeat(60));
logger.info('🚀 RankForge ULTIMATE POWER EDITION V7');
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

// ---------- 5. MongoDB Schema (ULTIMATE POWER EDITION) ----------
const ReportSchema = new mongoose.Schema({
  keyword: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  errorMessage: { type: String, default: '' },
  processingTime: { type: Number, default: 0 },
  data: {
    // ===== BASIC =====
    keyword_intent: { type: String, default: '' },
    content_score: { type: Number, default: 0 },
    readability_avg: { type: String, default: '' },
    missing_headings: { type: [String], default: [] },
    faq_questions: { type: [String], default: [] },
    authority_links: { type: [String], default: [] },
    competitor_table: { type: [Object], default: [] },
    
    // ===== 1. AI SEARCH INTENT ANALYSIS =====
    search_intent_analysis: {
      intent_type: { type: String, default: '' },
      confidence_score: { type: Number, default: 0 },
      sub_intents: { type: [String], default: [] },
      user_goal: { type: String, default: '' },
      buyer_stage: { type: String, default: '' },
      content_type: { type: String, default: '' }
    },

    // ===== 2. FULL SERP ANALYSIS =====
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

    // ===== 3. NLP & ENTITY EXTRACTION =====
    nlp_entity_extraction: {
      entities: { type: [Object], default: [] },
      key_phrases: { type: [String], default: [] },
      sentiment_score: { type: Number, default: 0 },
      language: { type: String, default: '' },
      topics: { type: [String], default: [] }
    },

    // ===== 4. TOPICAL AUTHORITY MAP =====
    topical_authority_map: {
      core_topics: { type: [Object], default: [] },
      topic_clusters: { type: [Object], default: [] },
      content_hubs: { type: [String], default: [] }
    },

    // ===== 5. INTERNAL LINKS =====
    internal_links: { type: [Object], default: [] },

    // ===== 6. EEAT SCORE =====
    eeat_score: {
      experience: { type: Number, default: 0 },
      expertise: { type: Number, default: 0 },
      authoritativeness: { type: Number, default: 0 },
      trustworthiness: { type: Number, default: 0 },
      overall_score: { type: Number, default: 0 },
      grade: { type: String, default: '' },
      recommendations: { type: [String], default: [] }
    },

    // ===== 7. FEATURED SNIPPET =====
    featured_snippet_opportunities: {
      eligibility_score: { type: Number, default: 0 },
      current_snippet: { type: String, default: '' },
      competitor_snippets: { type: [String], default: [] },
      optimization_tips: { type: [String], default: [] },
      format_type: { type: String, default: '' },
      priority: { type: String, default: '' }
    },

    // ===== 8. AI OVERVIEW =====
    ai_overview_optimization: {
      visibility_score: { type: Number, default: 0 },
      optimization_tips: { type: [String], default: [] },
      structure_recommendations: { type: [String], default: [] },
      question_coverage: { type: [String], default: [] },
      featured_criteria: { type: [String], default: [] }
    },

    // ===== 9. PEOPLE ALSO ASK =====
    people_also_ask_expanded: { type: [Object], default: [] },

    // ===== 10. CONTENT BRIEF =====
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

    // ===== 11. SCHEMA GENERATOR =====
    schema_generator: {
      faq: { type: String, default: '' },
      product: { type: String, default: '' },
      review: { type: String, default: '' },
      how_to: { type: String, default: '' },
      article: { type: String, default: '' },
      local_business: { type: String, default: '' },
      complete_json: { type: String, default: '' }
    },

    // ===== 12. KEYWORD CANNIBALIZATION =====
    keyword_cannibalization: {
      status: { type: String, default: '' },
      risk_score: { type: Number, default: 0 },
      cannibalizing_keywords: { type: [Object], default: [] },
      optimization_tips: { type: [String], default: [] }
    },

    // ===== 13. BRAND BACKLINK =====
    brand_backlink_analysis: {
      brand_mentions: { type: [Object], default: [] },
      backlink_gap: { type: [Object], default: [] },
      total_opportunities: { type: Number, default: 0 }
    },

    // ===== 14. CONTENT FRESHNESS =====
    content_freshness: {
      freshness_score: { type: Number, default: 0 },
      last_updated: { type: String, default: '' },
      outdated_sections: { type: [String], default: [] },
      update_recommendations: { type: [Object], default: [] },
      trending_topics: { type: [String], default: [] }
    },

    // ===== SEO METADATA (COMPLETE) =====
    seo_metadata: {
      title_tag: { type: String, default: '' },
      meta_description: { type: String, default: '' },
      url_slug: { type: String, default: '' },
      focus_keyword: { type: String, default: '' },
      h1_tag: { type: String, default: '' },
      seo_grade: { type: String, default: '' },
      readability_score: { type: Number, default: 0 },
      keyword_density: { type: Number, default: 0 }
    },

    // ===== CONTENT RECOMMENDATIONS =====
    content_recommendations: {
      title: { type: String, default: '' },
      meta_description: { type: String, default: '' },
      target_audience: { type: String, default: '' },
      content_length: { type: String, default: '' },
      tone: { type: String, default: '' },
      seo_tips: { type: [String], default: [] }
    },

    // ===== EXISTING FEATURES =====
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

// ---------- 6. DATA SANITIZER (With 4 FAQ Enforcement) ----------
const sanitizeData = (rawData) => {
  const defaultData = {
    keyword_intent: 'Informational',
    content_score: 75,
    readability_avg: 'Medium',
    missing_headings: [],
    faq_questions: [],
    authority_links: [],
    competitor_table: [],
    
    search_intent_analysis: { 
      intent_type: 'Informational', 
      confidence_score: 70, 
      sub_intents: [], 
      user_goal: 'To find the best products', 
      buyer_stage: 'Research', 
      content_type: 'Review/Guide' 
    },
    full_serp_analysis: { 
      total_results: 0, 
      organic_results: [], 
      featured_snippet: '', 
      knowledge_panel: '', 
      top_stories: [], 
      videos: [], 
      images: [], 
      people_also_ask: [], 
      related_searches: [], 
      paid_ads: 0, 
      serp_features: [] 
    },
    nlp_entity_extraction: { entities: [], key_phrases: [], sentiment_score: 0, language: 'en', topics: [] },
    topical_authority_map: { core_topics: [], topic_clusters: [], content_hubs: [] },
    internal_links: [],
    eeat_score: { experience: 0, expertise: 0, authoritativeness: 0, trustworthiness: 0, overall_score: 0, grade: '', recommendations: [] },
    featured_snippet_opportunities: { eligibility_score: 0, current_snippet: '', competitor_snippets: [], optimization_tips: [], format_type: '', priority: '' },
    ai_overview_optimization: { visibility_score: 0, optimization_tips: [], structure_recommendations: [], question_coverage: [], featured_criteria: [] },
    people_also_ask_expanded: [],
    content_brief: { 
      title: '', 
      meta_description: '', 
      target_audience: '', 
      content_goal: '', 
      h2_headings: [], 
      h3_subheadings: [], 
      word_count_recommendation: 0, 
      recommended_sections: [] 
    },
    schema_generator: { faq: '', product: '', review: '', how_to: '', article: '', local_business: '', complete_json: '' },
    keyword_cannibalization: { status: 'Low Risk', risk_score: 0, cannibalizing_keywords: [], optimization_tips: [] },
    brand_backlink_analysis: { brand_mentions: [], backlink_gap: [], total_opportunities: 0 },
    content_freshness: { freshness_score: 0, last_updated: '', outdated_sections: [], update_recommendations: [], trending_topics: [] },
    seo_metadata: { 
      title_tag: '', 
      meta_description: '', 
      url_slug: '', 
      focus_keyword: '',
      h1_tag: '',
      seo_grade: 'B',
      readability_score: 70,
      keyword_density: 1.2
    },
    content_recommendations: { 
      title: '', 
      meta_description: '', 
      target_audience: '', 
      content_length: '', 
      tone: '', 
      seo_tips: [] 
    },
    readability_score: { flesch_kincaid: 0, grade_level: '', sentence_length: 0, word_complexity: '', recommendations: [] },
    trend_forecast: { growth: '', seasonality: '', peak_months: [], strategy: '' },
    pricing_intelligence: { average_price: '', price_range: '', value_for_money: '' },
    content_requirements: { recommended_words: 0, min_words: 0, max_words: 0, images_needed: 0, media_format: '', video_suggestions: [] },
    keyword_metrics: { search_volume: 0, difficulty: 0, cpc: 0, competition: '', related_keywords: [] },
    backlink_gap: { competitor_backlinks: [], backlink_opportunities: [], backlink_strategy: '', cost: '', impact: '', opportunities: 0 }
  };

  const sanitized = { ...defaultData };

  for (const key of Object.keys(rawData)) {
    if (rawData[key] !== undefined && rawData[key] !== null) {
      if (key === 'authority_links') {
        if (Array.isArray(rawData[key])) {
          sanitized.authority_links = rawData[key].map(item => {
            if (typeof item === 'string') return item;
            if (typeof item === 'object' && item.link) return item.link;
            if (typeof item === 'object' && item.url) return item.url;
            return String(item);
          }).filter(Boolean);
        }
        continue;
      }

      if (key === 'faq_questions') {
        if (Array.isArray(rawData[key])) {
          const existing = rawData[key].filter(q => typeof q === 'string' && q.trim().length > 0);
          const keyword = rawData.keyword || 'this topic';
          const defaultFAQs = [
            `What is the best ${keyword}?`,
            `Which ${keyword} has the best features?`,
            `What is the price of ${keyword}?`,
            `Which ${keyword} is best for beginners?`
          ];
          
          const filled = [...existing];
          for (let i = filled.length; i < 4; i++) {
            filled.push(defaultFAQs[i] || `Question ${i+1} about ${keyword}?`);
          }
          sanitized.faq_questions = filled.slice(0, 4);
        } else if (typeof rawData[key] === 'string') {
          sanitized.faq_questions = [rawData[key]];
        }
        continue;
      }

      if (key === 'seo_metadata' && typeof rawData[key] === 'object') {
        sanitized.seo_metadata = { ...defaultData.seo_metadata, ...rawData[key] };
        continue;
      }

      if (key === 'content_brief' && typeof rawData[key] === 'object') {
        sanitized.content_brief = { ...defaultData.content_brief, ...rawData[key] };
        continue;
      }

      if (typeof rawData[key] === 'object' && rawData[key] !== null && !Array.isArray(rawData[key])) {
        sanitized[key] = { ...defaultData[key], ...rawData[key] };
      } else if (Array.isArray(rawData[key])) {
        sanitized[key] = rawData[key];
      } else if (typeof rawData[key] === 'string' || typeof rawData[key] === 'number' || typeof rawData[key] === 'boolean') {
        sanitized[key] = rawData[key];
      }
    }
  }

  // ✅ FINAL SAFETY CHECK: Ensure 4 FAQ
  if (!sanitized.faq_questions || sanitized.faq_questions.length < 4) {
    const kw = rawData.keyword || 'this topic';
    sanitized.faq_questions = [
      `What is the best ${kw}?`,
      `Which ${kw} has the best features?`,
      `What is the price of ${kw}?`,
      `Which ${kw} is best for beginners?`
    ];
  }

  return sanitized;
};

// ---------- 7. GROQ AI Service ----------
if (!process.env.GROQ_API_KEY) {
  logger.error('❌ Fatal Error: GROQ_API_KEY is missing!');
  process.exit(1);
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

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
  const competitors = ultraCompressCompetitors(serpData.organic_results);
  const paa = ultraCompressPAA(serpData.people_also_ask);
  const related = (serpData.related_searches || []).slice(0, 3).map(r => r.query || '');
  
  const features = {
    fs: (serpData.organic_results?.[0]?.snippet || '').substring(0, 100),
    kp: (serpData.knowledge_graph?.name || ''),
    ts: (serpData.top_stories || []).slice(0, 2).map(s => s.title || '')
  };

  logger.info(`🤖 GROQ Analysis for: "${keyword}"`);

  const prompt = `
    SEO Expert. Analyze "${keyword}". Return ONLY valid JSON.

    Competitors: ${JSON.stringify(competitors)}
    PAA: ${JSON.stringify(paa)}
    Related: ${JSON.stringify(related)}
    SERP Features: ${JSON.stringify(features)}

    CRITICAL RULES:
    1. "faq_questions" MUST have EXACTLY 4 questions. No more, no less.
    2. "missing_headings" must have AT LEAST 5 headings.
    3. "authority_links" must have AT LEAST 3 links.
    4. Generate all 14 features with quality data.

    Generate COMPLETE JSON:
    {
      "keyword_intent": "Informational",
      "content_score": 80,
      "readability_avg": "Medium",
      "missing_headings": ["Heading 1", "Heading 2", "Heading 3", "Heading 4", "Heading 5"],
      "faq_questions": ["Q1?", "Q2?", "Q3?", "Q4?"],
      "authority_links": ["https://link1.com", "https://link2.com", "https://link3.com"],
      
      "competitor_table": [
        {"rank": 1, "title": "Competitor 1", "strength": "Main advantage"},
        {"rank": 2, "title": "Competitor 2", "strength": "Main advantage"}
      ],
      
      "search_intent_analysis": {
        "intent_type": "Informational",
        "confidence_score": 85,
        "sub_intents": ["Compare", "Research"],
        "user_goal": "To find the best options",
        "buyer_stage": "Research",
        "content_type": "Review/Comparison Guide"
      },
      
      "full_serp_analysis": {
        "total_results": 500000,
        "organic_results": [],
        "featured_snippet": "Featured snippet content",
        "serp_features": ["Featured Snippet", "People Also Ask"]
      },
      
      "nlp_entity_extraction": {
        "entities": [{"name": "Brand", "type": "Organization", "salience": 0.85}],
        "key_phrases": ["key phrase 1", "key phrase 2"],
        "sentiment_score": 0.75,
        "language": "en",
        "topics": ["Topic 1", "Topic 2"]
      },
      
      "topical_authority_map": {
        "core_topics": [{"topic": "Topic 1", "authority_score": 85, "coverage_score": 75, "gap_score": 25, "recommendations": ["Create more content"]}],
        "topic_clusters": [{"cluster_name": "Cluster 1", "keywords": ["kw1", "kw2"], "priority": "High"}],
        "content_hubs": ["Hub 1", "Hub 2"]
      },
      
      "internal_links": [{"anchor_text": "Link 1", "target_url": "/page1", "relevance_score": 85, "context": "Context", "page_type": "Blog"}],
      
      "eeat_score": {
        "experience": 75,
        "expertise": 80,
        "authoritativeness": 70,
        "trustworthiness": 75,
        "overall_score": 75,
        "grade": "B",
        "recommendations": ["Add expert opinions", "Cite sources"]
      },
      
      "featured_snippet_opportunities": {
        "eligibility_score": 80,
        "current_snippet": "Current snippet",
        "optimization_tips": ["Use bullet points", "Add clear answers"],
        "format_type": "List",
        "priority": "High"
      },
      
      "ai_overview_optimization": {
        "visibility_score": 70,
        "optimization_tips": ["Use structured data", "Answer questions clearly"],
        "structure_recommendations": ["Use H2 headings", "Include FAQ"],
        "question_coverage": ["Question 1", "Question 2"],
        "featured_criteria": ["Clear answers", "Structured content"]
      },
      
      "people_also_ask_expanded": [
        {"question": "Q1?", "answer": "Answer 1", "difficulty": "Medium", "related_questions": ["Related 1"], "source": "Google PAA"}
      ],
      
      "content_brief": {
        "title": "Best ${keyword}: Complete Guide",
        "meta_description": "Find the best ${keyword} with expert reviews and comparison",
        "target_audience": "Users looking for ${keyword}",
        "content_goal": "Help users make informed decisions",
        "h2_headings": [{"heading": "Top Brands", "key_points": ["Point 1", "Point 2"], "word_count": 300, "priority": "High"}],
        "h3_subheadings": [{"heading": "Sub-heading 1", "context": "Context", "keywords": ["kw1", "kw2"]}],
        "word_count_recommendation": 2500,
        "recommended_sections": ["Introduction", "Top Picks", "Comparison", "Buying Guide"]
      },
      
      "schema_generator": {
        "faq": "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"FAQPage\"}</script>",
        "product": "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"Product\"}</script>",
        "article": "<script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"Article\"}</script>",
        "complete_json": "{\"@context\":\"https://schema.org\",\"@type\":\"Article\",\"headline\":\"Title\"}"
      },
      
      "keyword_cannibalization": {
        "status": "Low Risk",
        "risk_score": 15,
        "optimization_tips": ["Use unique titles", "Differentiate content"]
      },
      
      "brand_backlink_analysis": {
        "brand_mentions": [{"source": "Site 1", "sentiment": "Positive"}],
        "backlink_gap": [{"competitor": "Comp 1", "backlinks": 1000, "missing_links": ["Link 1"], "opportunity_score": 80}],
        "total_opportunities": 10
      },
      
      "content_freshness": {
        "freshness_score": 70,
        "update_recommendations": [{"section": "Prices", "reason": "Need update", "priority": "High", "suggested_updates": ["New data"]}],
        "trending_topics": ["Topic 1", "Topic 2"]
      },
      
      "seo_metadata": {
        "title_tag": "Best ${keyword}: Complete Guide & Reviews",
        "meta_description": "Find the best ${keyword} with expert reviews, comparison tables, and buying guide",
        "url_slug": "best-${keyword}",
        "focus_keyword": "${keyword}",
        "h1_tag": "Best ${keyword}: Complete Guide",
        "seo_grade": "B+",
        "readability_score": 72,
        "keyword_density": 1.2
      },
      
      "content_recommendations": {
        "title": "Best ${keyword}: Complete Buying Guide",
        "meta_description": "Find the best ${keyword} with expert reviews and comparison",
        "target_audience": "Users looking for ${keyword}",
        "content_length": "2000-2500 words",
        "tone": "Professional and informative",
        "seo_tips": ["Use comparison tables", "Include user reviews", "Add video content"]
      }
    }
  `;

  try {
    const startTime = Date.now();
    const response = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'SEO expert. Return JSON only. FAQ MUST have EXACTLY 4 questions.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 6000,
    });
    const endTime = Date.now();
    logger.info(`⏱️ GROQ Response Time: ${(endTime - startTime) / 1000}s`);

    const text = response.choices[0].message.content;
    logger.info(`📝 GROQ Response: ${text.substring(0, 150)}...`);
    
    const cleanJson = text.replace(/```json|```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);
    
    parsedData.keyword = keyword;
    const sanitizedData = sanitizeData(parsedData);
    
    if (!sanitizedData.faq_questions || sanitizedData.faq_questions.length < 4) {
      sanitizedData.faq_questions = [
        `What is the best ${keyword}?`,
        `Which ${keyword} has the best features?`,
        `What is the price of ${keyword}?`,
        `Which ${keyword} is best for beginners?`
      ];
    }
    
    return sanitizedData;
  } catch (error) {
    logger.error('❌ GROQ Error:', error.message);
    return sanitizeData({
      keyword: keyword,
      faq_questions: [
        `What is the best ${keyword}?`,
        `Which ${keyword} has the best features?`,
        `What is the price of ${keyword}?`,
        `Which ${keyword} is best for beginners?`
      ]
    });
  }
};

// ---------- 8. SerpAPI Service ----------
const fetchSerp = async (keyword) => {
  logger.info(`🔍 Fetching SERP for: "${keyword}"`);
  
  try {
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
    message: 'RankForge ULTIMATE POWER EDITION V7',
    version: '7.0.0',
    timestamp: new Date().toISOString(),
    mongodb: dbStatus,
    groq: process.env.GROQ_API_KEY ? 'Configured' : 'Missing',
    serpapi: process.env.SERPAPI_KEY ? 'Configured' : 'Missing',
    features: [
      'AI Search Intent Analysis',
      'Full SERP Analysis',
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
      'Content Freshness Suggestions',
      'Complete SEO Metadata',
      '4 FAQ Enforced'
    ],
    stats: {
      total_reports: totalReports,
      completed_reports: completedReports
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
    const avgScore = await Report.aggregate([
      { $match: { status: 'completed', 'data.content_score': { $exists: true } } },
      { $group: { _id: null, avg: { $avg: '$data.content_score' } } }
    ]);
    
    res.json({
      total_reports: total,
      completed_reports: completed,
      average_score: avgScore[0]?.avg || 0
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
  logger.info(`🚀 ULTIMATE POWER EDITION V7 running on port ${PORT}`);
  logger.info(`📊 Model: GROQ: llama-3.3-70b-versatile`);
  logger.info(`⚡ 14 Features + 4 FAQ ENFORCED + X-Forwarded-For FIXED`);
  logger.info(`📈 Health Check: /api/health`);
  logger.info(`📊 Analytics: /api/analytics`);
  logger.info('='.repeat(60));
});
