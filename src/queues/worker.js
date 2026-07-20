import { Worker } from 'bullmq';
import Redis from 'ioredis';
import mongoose from 'mongoose';
import Report from '../models/Report.js';
import { fetchSerpData } from '../services/serpService.js';
import { generatePremiumInsights } from '../services/geminiService.js';

const connection = new Redis(process.env.REDIS_URL);

export const worker = new Worker('premium-report', async (job) => {
  const { keyword, reportId } = job.data;

  const updateProgress = async (pct) => {
    await Report.findByIdAndUpdate(reportId, { progress: pct });
  };

  try {
    await updateProgress(10);
    const serpData = await fetchSerpData(keyword);
    
    await updateProgress(40);
    const insights = await generatePremiumInsights(serpData, keyword);
    
    await updateProgress(90);
    await Report.findByIdAndUpdate(reportId, {
      status: 'completed',
      progress: 100,
      data: insights,
      rawSerp: serpData.organic_results // Store raw for history
    });

  } catch (error) {
    await Report.findByIdAndUpdate(reportId, { 
      status: 'failed', 
      error: error.message 
    });
    throw error; // BullMQ retry automatically
  }
}, { 
  connection,
  settings: { 
    retries: 3, // 3 bar try karega agar fail ho
    backoff: { type: 'exponential', delay: 5000 } // 5s, 10s, 20s
  }
});
