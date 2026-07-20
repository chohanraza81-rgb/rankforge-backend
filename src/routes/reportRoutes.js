import express from 'express';
import Report from '../models/Report.js';
import { queue } from '../queues/index.js';
const router = express.Router();

// 1. Start Generation
router.post('/generate', async (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return res.status(400).json({ error: 'Keyword required' });

  // Check Cache (7 days)
  const cached = await Report.findOne({ keyword, status: 'completed' }).sort({ createdAt: -1 });
  if (cached) {
    return res.json({ reportId: cached._id, cached: true });
  }

  const newReport = new Report({ keyword, status: 'pending', progress: 0 });
  await newReport.save();

  await queue.add('premium-report', {
    keyword,
    reportId: newReport._id.toString()
  });

  res.json({ reportId: newReport._id, cached: false });
});

// 2. Real-time Stream (SSE)
router.get('/stream/:id', async (req, res) => {
  const { id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendUpdate = async () => {
    const report = await Report.findById(id);
    if (!report) return res.write(`event: error\ndata: Report not found\n\n`);

    // Progress & Data stream karo
    res.write(`event: progress\ndata: ${JSON.stringify({ progress: report.progress, status: report.status })}\n\n`);

    if (report.status === 'completed' || report.status === 'failed') {
      res.write(`event: done\ndata: ${JSON.stringify(report)}\n\n`);
      res.end();
      return;
    }
    // Har 1.5 sec update do
    setTimeout(sendUpdate, 1500);
  };
  sendUpdate();
});

export default router;
