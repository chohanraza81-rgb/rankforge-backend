import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generatePremiumInsights = async (serpData, keyword) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // Pro model for better reasoning

  const competitors = serpData.organic_results.slice(0, 5).map((r, i) => ({
    rank: i + 1,
    title: r.title,
    link: r.link,
    snippet: r.snippet
  }));

  const prompt = `
    You are an expert SEO auditor. Analyze the SERP data for keyword: "${keyword}".
    **RULE: Return ONLY valid JSON. DO NOT WRITE ARTICLES.**
    
    Generate a detailed JSON with these exact keys:
    1. "keyword_intent": (String) "Commercial", "Informational", "Navigational", or "Transactional".
    2. "content_score": (Number) Out of 100, how well does the top 3 results satisfy the user query?
    3. "missing_headings": (Array of 6 strings) Sub-topics the top pages cover but a fresh page might miss.
    4. "faq_questions": (Array of 6 strings) High-volume questions from "People Also Ask".
    5. "authority_links": (Array of 5 strings) High DA (gov/edu) links to cite.
    6. "readability_avg": (String) "Easy", "Medium", or "Hard" based on the average snippet complexity.
    7. "competitor_table": (Array of objects) with keys: "rank", "title", "word_count_est" (estimated number), "strength" (1-line).

    Competitor Data:
    ${JSON.stringify(competitors, null, 2)}
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    // Remove markdown if AI wraps it
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Gemini Parse Error:', error);
    throw new Error('AI analysis failed');
  }
};
