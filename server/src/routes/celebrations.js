import express from 'express';
import CelebrationLog from '../models/CelebrationLog.js';
import { protect } from '../middleware/auth.js';
import {
  getCelebrationSettings,
  getTodaysCelebrations,
  getUpcomingCelebrations,
  processCelebrations,
} from '../services/celebrationService.js';

const router = express.Router();
router.use(protect);

router.get('/settings', async (_req, res) => {
  res.json(await getCelebrationSettings());
});

router.get('/today', async (_req, res) => {
  const data = await getTodaysCelebrations();
  res.json(data);
});

router.get('/upcoming', async (req, res) => {
  const days = Number(req.query.days || 14);
  const upcoming = await getUpcomingCelebrations(days);
  res.json(upcoming);
});

router.post('/run', async (_req, res) => {
  try {
    const results = await processCelebrations();
    res.json({ message: 'Celebration announcements complete', results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/logs', async (_req, res) => {
  const logs = await CelebrationLog.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('members', 'name email');
  res.json(logs);
});

export default router;
