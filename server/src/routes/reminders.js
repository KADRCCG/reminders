import express from 'express';
import ReminderLog from '../models/ReminderLog.js';
import { protect } from '../middleware/auth.js';
import {
  getDashboardStats,
  getUpcomingAssignments,
  processReminders,
} from '../services/reminderService.js';

const router = express.Router();
router.use(protect);

router.get('/dashboard', async (_req, res) => {
  const [stats, upcoming, recentLogs] = await Promise.all([
    getDashboardStats(),
    getUpcomingAssignments(12),
    ReminderLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('member', 'name email')
      .populate({
        path: 'scheduleEntry',
        populate: [
          { path: 'schedule', select: 'name', populate: { path: 'departments', select: 'name' } },
        ],
      }),
  ]);

  res.json({ stats, upcoming, recentLogs });
});

router.post('/run', async (_req, res) => {
  try {
    const results = await processReminders();
    res.json({ message: 'Reminder run complete', results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/logs', async (_req, res) => {
  const logs = await ReminderLog.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('member', 'name email')
    .populate({
      path: 'scheduleEntry',
      populate: [
        { path: 'schedule', select: 'name', populate: { path: 'departments', select: 'name' } },
      ],
    });
  res.json(logs);
});

export default router;
