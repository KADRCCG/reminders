import express from 'express';
import { cronSecret } from '../middleware/cronAuth.js';
import { runDailyJobs, getCronExpression, getCronTimezone } from '../services/dailyJobService.js';

const router = express.Router();

function slimJobResults(results) {
  if (results?.skipped) {
    return results;
  }

  const { reminderResults, celebrationResults, ...meta } = results;
  const { reasons = [], ...reminderCounts } = reminderResults || {};

  return {
    ...meta,
    reminders: {
      ...reminderCounts,
      reasonCount: reasons.length,
      reasonsSample: reasons.slice(0, 5),
    },
    celebrations: celebrationResults || null,
  };
}

router.get('/status', cronSecret, async (_req, res) => {
  res.json({
    ok: true,
    schedule: getCronExpression(),
    timeZone: getCronTimezone(),
    hint: 'GET or POST /api/cron/daily?secret=YOUR_CRON_SECRET to run reminders and celebrations once.',
  });
});

async function handleDaily(req, res) {
  try {
    const force = req.query.force === 'true' || req.body?.force === true;
    const results = await runDailyJobs({ force, source: 'external-cron' });
    res.json({
      message: results.skipped ? 'Skipped — already ran today' : 'Daily jobs complete',
      results: slimJobResults(results),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

router.get('/daily', cronSecret, handleDaily);
router.post('/daily', cronSecret, handleDaily);

export default router;
