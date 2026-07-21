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
  validate: { 
    trustProxy: false,
    xForwardedForHeader: false
  },
});
app.use('/api/', limiter);

// ---------- 3. Startup Logging ----------
logger.info('='.repeat(60));
logger.info('🚀 RankForge ULTIMATE POWER EDITION V7 - REAL COMPETITORS');
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

// ---------- 5. MongoDB Schema ----------
const ReportSchema = new mongoose.Schema({
  keyword: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  errorMessage: { type: String, default: '' },
  processingTime: { type: Number, default: 0 },
  data: {
    keyword_intent: { type: String, default: '' },
    content_score: { type: Number, default: 0 },
    readability_avg: { type: String, default: '' },
    missing_headings: { type: [String], default: [] },
    faq_questions: { type: [String], default: [] },
    authority_links: { type: [String], default: [] },
    competitor_table: { type: [Object], default: [] },
    
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
    
    content_recommendations: {
      title: { type: String, default: '' },
      meta_description: { type: String, default: '' },
      target_audience: { type: String, default: '' },
      content_length: { type: String, default: '' },
      tone: { type: String, default: '' },
      seo_tips: { type: [String], default: [] }
    },
    
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

// ---------- 6. DATA SANITIZER ----------
const sanitizeData = (rawData) => {
  const keyword = rawData.keyword || 'this product';
  
  const defaultData = {
    keyword_intent: 'Informational',
    content_score: 75,
    readability_avg: 'Medium',
    missing_headings: ['Top Brands in 2026', 'Best Value for Money', 'Features Comparison', 'User Reviews', 'Buying Guide'],
    faq_questions: [],
    authority_links: ['https://www.techradar.com', 'https://www.cnet.com', 'https://www.pcmag.com'],
    competitor_table: [],
    
    search_intent_analysis: { 
      intent_type: 'Informational', 
      confidence_score: 75, 
      sub_intents: ['Compare', 'Research'], 
      user_goal: `To find the best ${keyword}`, 
      buyer_stage: 'Research', 
      content_type: 'Review/Guide' 
    },
    
    full_serp_analysis: { 
      total_results: 0, 
      organic_results: [], 
      featured_snippet: `Find the best ${keyword} with expert reviews`, 
      knowledge_panel: '', 
      top_stories: [], 
      videos: [], 
      images: [], 
      people_also_ask: [], 
      related_searches: [], 
      paid_ads: 0, 
      serp_features: ['Featured Snippet'] 
    },
    
    nlp_entity_extraction: { 
      entities: [], 
      key_phrases: [`best ${keyword}`, `affordable ${keyword}`], 
      sentiment_score: 0.75, 
      language: 'en', 
      topics: ['Reviews', 'Buying Guide'] 
    },
    
    topical_authority_map: { 
      core_topics: [{ topic: `${keyword} Reviews`, authority_score: 75, coverage_score: 70, gap_score: 30, recommendations: ['Create more content'] }], 
      topic_clusters: [{ cluster_name: 'Product Reviews', keywords: [`${keyword}`, 'buying guide', 'comparison'], priority: 'High' }], 
      content_hubs: ['Expert Reviews', 'Buying Guides'] 
    },
    
    internal_links: [{ anchor_text: 'Best Products 2026', target_url: '/best-products-2026', relevance_score: 85, context: 'Product guide', page_type: 'Blog' }],
    
    eeat_score: { 
      experience: 70, 
      expertise: 75, 
      authoritativeness: 68, 
      trustworthiness: 72, 
      overall_score: 71, 
      grade: 'B-', 
      recommendations: ['Add expert opinions', 'Cite reliable sources'] 
    },
    
    featured_snippet_opportunities: { 
      eligibility_score: 75, 
      current_snippet: `Top ${keyword} in 2026`, 
      competitor_snippets: [], 
      optimization_tips: ['Use bullet points', 'Add price ranges'], 
      format_type: 'List', 
      priority: 'High' 
    },
    
    ai_overview_optimization: { 
      visibility_score: 70, 
      optimization_tips: ['Use structured data', 'Answer questions clearly'], 
      structure_recommendations: ['Use H2 headings', 'Include FAQ'], 
      question_coverage: [`What is the best ${keyword}?`, `Which ${keyword} is affordable?`], 
      featured_criteria: ['Clear answers', 'Structured content'] 
    },
    
    people_also_ask_expanded: [{ 
      question: `What is the best ${keyword}?`, 
      answer: `The best ${keyword} depends on your needs and budget.`, 
      difficulty: 'Medium', 
      related_questions: [`Which ${keyword} has good value?`], 
      source: 'Google PAA' 
    }],
    
    content_brief: { 
      title: `Best ${keyword}: Complete Guide 2026`, 
      meta_description: `Find the best ${keyword} with expert reviews, comparison, and buying guide.`, 
      target_audience: `Users looking for ${keyword}`, 
      content_goal: `Help users choose the right ${keyword}`, 
      h2_headings: [{ heading: 'Top Brands', key_points: ['Brand 1', 'Brand 2', 'Brand 3'], word_count: 300, priority: 'High' }], 
      h3_subheadings: [{ heading: 'Key Features', context: 'Features overview', keywords: ['features', 'specifications'] }], 
      word_count_recommendation: 2500, 
      recommended_sections: ['Introduction', 'Top Picks', 'Comparison', 'Buying Guide'] 
    },
    
    schema_generator: { 
      faq: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage"}</script>`, 
      product: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product"}</script>`, 
      article: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>`, 
      complete_json: `{"@context":"https://schema.org","@type":"Article","headline":"Best ${keyword} 2026"}` 
    },
    
    keyword_cannibalization: { 
      status: 'Low Risk', 
      risk_score: 15, 
      cannibalizing_keywords: [], 
      optimization_tips: ['Use unique titles', 'Differentiate content'] 
    },
    
    brand_backlink_analysis: { 
      brand_mentions: [], 
      backlink_gap: [], 
      total_opportunities: 10 
    },
    
    content_freshness: { 
      freshness_score: 70, 
      last_updated: '2026-01-01', 
      outdated_sections: ['Prices'], 
      update_recommendations: [{ section: 'Prices', reason: 'Need latest prices', priority: 'High', suggested_updates: ['Add current prices'] }], 
      trending_topics: ['New Models', 'Best Value'] 
    },
    
    seo_metadata: { 
      title_tag: `Best ${keyword}: Complete Guide & Reviews 2026`, 
      meta_description: `Find the best ${keyword} with expert reviews, comparison tables, and buying guide.`, 
      url_slug: `best-${keyword.toLowerCase().replace(/\\s+/g, '-')}`, 
      focus_keyword: keyword, 
      h1_tag: `Best ${keyword}: Complete Buying Guide`, 
      seo_grade: 'B', 
      readability_score: 70, 
      keyword_density: 1.2 
    },
    
    content_recommendations: { 
      title: `Best ${keyword}: Complete Buying Guide 2026`, 
      meta_description: `Find the best ${keyword} with expert reviews and comparison.`, 
      target_audience: `Users looking for the best ${keyword}`, 
      content_length: '2000-2500 words', 
      tone: 'Professional and informative', 
      seo_tips: ['Use comparison tables', 'Include user reviews', 'Add video content'] 
    },
    
    readability_score: { 
      flesch_kincaid: 65, 
      grade_level: '8th Grade', 
      sentence_length: 18, 
      word_complexity: 'Medium', 
      recommendations: ['Use shorter sentences', 'Simplify vocabulary'] 
    },
    
    trend_forecast: { 
      growth: '15%', 
      seasonality: 'Peak in Q3 and Q4', 
      peak_months: ['August', 'September', 'December'], 
      strategy: 'Create content before peak season' 
    },
    
    pricing_intelligence: { 
      average_price: '$200 - $400', 
      price_range: '$100 - $600', 
      value_for_money: 'Mid-range offers best value' 
    },
    
    content_requirements: { 
      recommended_words: 2500, 
      min_words: 1800, 
      max_words: 3500, 
      images_needed: 8, 
      media_format: 'HD Images + Videos', 
      video_suggestions: ['Unboxing video', 'Comparison video'] 
    },
    
    keyword_metrics: { 
      search_volume: 1500, 
      difficulty: 45, 
      cpc: 1.5, 
      competition: 'Medium', 
      related_keywords: [`best ${keyword}`, `affordable ${keyword}`, `${keyword} review`] 
    },
    
    backlink_gap: { 
      competitor_backlinks: [], 
      backlink_opportunities: ['Guest post on relevant blogs', 'Resource page on authority sites'], 
      backlink_strategy: 'Create high-quality content and reach out', 
      cost: '10 hours + outreach', 
      impact: '15-25 points', 
      opportunities: 8 
    }
  };

  const sanitized = { ...defaultData };

  for (const key of Object.keys(rawData)) {
    if (rawData[key] !== undefined && rawData[key] !== null) {
      if (key === 'faq_questions') {
        if (Array.isArray(rawData[key])) {
          const existing = rawData[key].filter(q => typeof q === 'string' && q.trim().length > 0);
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
        }
        continue;
      }

      if (key === 'competitor_table' && Array.isArray(rawData[key]) && rawData[key].length > 0) {
        sanitized.competitor_table = rawData[key].filter(c => c && typeof c === 'object');
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

      if (key === 'content_recommendations' && typeof rawData[key] === 'object') {
        sanitized.content_recommendations = { ...defaultData.content_recommendations, ...rawData[key] };
        continue;
      }

      if (key === 'full_serp_analysis' && typeof rawData[key] === 'object') {
        sanitized.full_serp_analysis = { ...defaultData.full_serp_analysis, ...rawData[key] };
        continue;
      }

      if (key === 'nlp_entity_extraction' && typeof rawData[key] === 'object') {
        sanitized.nlp_entity_extraction = { ...defaultData.nlp_entity_extraction, ...rawData[key] };
        continue;
      }

      if (key === 'topical_authority_map' && typeof rawData[key] === 'object') {
        sanitized.topical_authority_map = { ...defaultData.topical_authority_map, ...rawData[key] };
        continue;
      }

      if (key === 'eeat_score' && typeof rawData[key] === 'object') {
        sanitized.eeat_score = { ...defaultData.eeat_score, ...rawData[key] };
        continue;
      }

      if (typeof rawData[key] === 'object' && rawData[key] !== null && !Array.isArray(rawData[key])) {
        sanitized[key] = { ...defaultData[key], ...rawData[key] };
      } else if (Array.isArray(rawData[key]) && rawData[key].length > 0) {
        sanitized[key] = rawData[key];
      } else if (typeof rawData[key] === 'string' && rawData[key].trim().length > 0) {
        sanitized[key] = rawData[key];
      } else if (typeof rawData[key] === 'number') {
        sanitized[key] = rawData[key];
      }
    }
  }

  if (!sanitized.faq_questions || sanitized.faq_questions.length < 4) {
    sanitized.faq_questions = [
      `What is the best ${keyword}?`,
      `Which ${keyword} has the best features?`,
      `What is the price of ${keyword}?`,
      `Which ${keyword} is best for beginners?`
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

const generateUltimateInsights = async (keyword, serpData) => {
  // Extract REAL competitors from SERP data
  const realCompetitors = (serpData.organic_results || []).slice(0, 5).map((r, i) => ({
    rank: i + 1,
    title: (r.title || 'N/A').substring(0, 80),
    snippet: (r.snippet || '').substring(0, 150),
    link: r.link || '#',
    domain: r.link ? new URL(r.link).hostname.replace('www.', '') : ''
  }));

  // Extract People Also Ask
  const paa = (serpData.people_also_ask || []).slice(0, 4).map(p => ({
    question: p.question || '',
    answer: (p.snippet || '').substring(0, 150)
  }));

  // Extract Related Searches
  const relatedSearches = (serpData.related_searches || []).slice(0, 5).map(r => r.query || '');

  // Extract SERP features
  const serpFeatures = {
    featured_snippet: serpData.organic_results?.[0]?.snippet || '',
    knowledge_panel: serpData.knowledge_graph?.name || '',
    top_stories: (serpData.top_stories || []).slice(0, 3).map(s => s.title || ''),
    videos: (serpData.video_results || []).slice(0, 3).map(v => v.title || ''),
    images: (serpData.images_results || []).slice(0, 3).map(i => i.title || ''),
  };

  logger.info(`🤖 GROQ Analysis for: "${keyword}"`);
  logger.info(`📊 ${realCompetitors.length} Real Competitors Found`);

  const prompt = `
    You are an SEO Expert. Analyze keyword: "${keyword}" using the REAL SERP data provided.

    **REAL COMPETITORS FROM SERP (Top 5):**
    ${JSON.stringify(realCompetitors, null, 2)}

    **PEOPLE ALSO ASK:**
    ${JSON.stringify(paa, null, 2)}

    **RELATED SEARCHES:**
    ${JSON.stringify(relatedSearches, null, 2)}

    **SERP FEATURES:**
    ${JSON.stringify(serpFeatures, null, 2)}

    **CRITICAL RULES:**
    1. Use the REAL competitors from the data above to populate "competitor_table".
    2. "faq_questions" MUST have EXACTLY 4 questions.
    3. "missing_headings" must have AT LEAST 5 headings.
    4. "authority_links" must have AT LEAST 3 links from the competitors or known authority sites.
    5. Generate all 14 features with quality data based on the REAL SERP data.

    Generate COMPLETE JSON with all fields based on the real SERP data provided above.
  `;

  try {
    const startTime = Date.now();
    const response = await groq.chat.completions.create({
      messages: [
        { 
          role: 'system', 
          content: 'You are a Senior SEO Expert. Use the REAL SERP data provided. Return ONLY valid JSON. No markdown. FAQ MUST have EXACTLY 4 questions.' 
        },
        { 
          role: 'user', 
          content: prompt 
        }
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
    
    // Ensure competitor_table has real data
    if (!parsedData.competitor_table || parsedData.competitor_table.length === 0) {
      parsedData.competitor_table = realCompetitors.map(c => ({
        rank: c.rank,
        title: c.title,
        strength: c.snippet || 'N/A'
      }));
    }

    parsedData.keyword = keyword;
    
    // Pass real competitors for sanitization
    parsedData._realCompetitors = realCompetitors;
    
    const sanitizedData = sanitizeData(parsedData);
    
    // Ensure competitor_table has real data
    if (!sanitizedData.competitor_table || sanitizedData.competitor_table.length === 0) {
      sanitizedData.competitor_table = realCompetitors.map(c => ({
        rank: c.rank,
        title: c.title.substring(0, 60),
        strength: c.snippet ? c.snippet.substring(0, 80) : 'N/A'
      }));
    }

    return sanitizedData;
  } catch (error) {
    logger.error('❌ GROQ Error:', error.message);
    // Return with real competitors even if GROQ fails
    const fallbackData = {
      keyword: keyword,
      competitor_table: realCompetitors.map(c => ({
        rank: c.rank,
        title: c.title.substring(0, 60),
        strength: c.snippet ? c.snippet.substring(0, 80) : 'N/A'
      })),
      faq_questions: [
        `What is the best ${keyword}?`,
        `Which ${keyword} has the best features?`,
        `What is the price of ${keyword}?`,
        `Which ${keyword} is best for beginners?`
      ]
    };
    return sanitizeData(fallbackData);
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

app.get('/api/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
  const totalReports = await Report.countDocuments();
  const completedReports = await Report.countDocuments({ status: 'completed' });
  
  res.json({
    status: 'OK',
    message: 'RankForge ULTIMATE POWER EDITION V7 - REAL COMPETITORS',
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
      'REAL Competitors from SERP'
    ],
    stats: {
      total_reports: totalReports,
      completed_reports: completedReports
    }
  });
});

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

app.get('/api/report/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
  logger.info(`⚡ REAL Competitors from SERP | 4 FAQ ENFORCED | Complete SEO Metadata`);
  logger.info(`📈 Health Check: /api/health`);
  logger.info(`📊 Analytics: /api/analytics`);
  logger.info('='.repeat(60));
});
