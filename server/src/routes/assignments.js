import express from 'express';
import Assignment from '../models/Assignment.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

function parseDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(12, 0, 0, 0);
  return d;
}

router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.department) filter.department = req.query.department;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = parseDate(req.query.from);
    if (req.query.to) filter.date.$lte = parseDate(req.query.to);
  }

  const assignments = await Assignment.find(filter)
    .populate('member', 'name email phone')
    .populate('department', 'name reminderDaysBefore')
    .sort({ date: 1 });
  res.json(assignments);
});

// Legacy assignments — read-only. Use /api/schedules for new work.

export default router;
