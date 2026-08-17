import express from 'express';
import { cronSecret } from '../middleware/cronAuth.js';
import { runDailyJobs, getCronExpression, getCronTimezone } from '../services/dailyJobService.js';

const router = express.Router();

router.get('/status', cronSecret, async (_req, res) => {
  res.json({
    ok: true,
    schedule: getCronExpression(),
    timeZone: getCronTimezone(),
    hint: 'POST /api/cron/daily to run reminders and celebrations once.',
  });
});

router.post('/daily', cronSecret, async (req, res) => {
  try {
    const force = req.query.force === 'true' || req.body?.force === true;
    const results = await runDailyJobs({ force, source: 'external-cron' });
    res.json({ message: results.skipped ? 'Skipped — already ran today' : 'Daily jobs complete', results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
