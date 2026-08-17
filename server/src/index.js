import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import departmentRoutes from './routes/departments.js';
import memberRoutes from './routes/members.js';
import assignmentRoutes from './routes/assignments.js';
import scheduleRoutes from './routes/schedules.js';
import assignmentLabelRoutes from './routes/assignmentLabels.js';
import reminderRoutes from './routes/reminders.js';
import celebrationRoutes from './routes/celebrations.js';
import cronRoutes from './routes/cron.js';
import settingsRoutes from './routes/settings.js';
import messageTemplateRoutes from './routes/messageTemplates.js';
import {
  getCronExpression,
  getCronTimezone,
  runDailyJobs,
  runStartupCatchUp,
} from './services/dailyJobService.js';
import { backfillAssignmentLabels } from './utils/assignmentLabels.js';
import { ensureAdminFromEnv } from './utils/ensureAdmin.js';
import { ensureMessageTemplates, migrateUnifiedTemplates, syncSystemTemplateDescriptions } from './utils/messageTemplates.js';
import { migrateAssignmentsToSchedules } from './utils/migrateSchedules.js';
import { ensureMemberEmailIndex } from './utils/memberIndexes.js';

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = String(process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

function originAllowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return true;
  // Allow Vercel production + preview URLs when any configured CLIENT_URL is on vercel.app
  const allowVercel =
    process.env.ALLOW_VERCEL_PREVIEWS === 'true' ||
    allowedOrigins.some((o) => o.includes('vercel.app'));
  if (allowVercel && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (originAllowed(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'RCCG-KAD Workforce Reminders API',
    health: '/api/health',
    hint: 'This is the API only. Open /api/health to verify, and use your frontend URL for the admin UI.',
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'church-reminders-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/assignment-labels', assignmentLabelRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/celebrations', celebrationRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/message-templates', messageTemplateRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

const cronExpr = getCronExpression();
const cronTimezone = getCronTimezone();

async function start() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error(
      'MONGODB_URI is not set. On Render, add an Atlas connection string in Environment (not localhost).'
    );
  }
  if (/127\.0\.0\.1|localhost/i.test(mongoUri) && process.env.NODE_ENV === 'production') {
    throw new Error(
      'MONGODB_URI points to localhost, which does not work on Render. Use a MongoDB Atlas URI.'
    );
  }

  await connectDB(mongoUri);
  try {
    await ensureMemberEmailIndex();
  } catch (err) {
    console.warn('[startup] Member email index setup:', err.message);
  }
  await ensureAdminFromEnv();
  await ensureMessageTemplates();
  await syncSystemTemplateDescriptions();
  await migrateUnifiedTemplates();
  try {
    const migration = await migrateAssignmentsToSchedules();
    if (migration.migrated > 0) {
      console.log('[startup] Assignment migration:', migration);
    }
  } catch (err) {
    console.error('[startup] Assignment migration failed (server will still start):', err.message);
  }
  await backfillAssignmentLabels();
  await runStartupCatchUp();

  if (cron.validate(cronExpr)) {
    cron.schedule(
      cronExpr,
      async () => {
        try {
          const results = await runDailyJobs({ source: 'in-process-cron' });
          if (!results.skipped) {
            console.log('[cron] Daily jobs finished');
          }
        } catch (err) {
          console.error('[cron] Daily jobs failed:', err.message);
        }
      },
      { timezone: cronTimezone }
    );
    console.log(`Daily cron scheduled: ${cronExpr} (${cronTimezone})`);
    if (process.env.RENDER && !process.env.CRON_SECRET) {
      console.warn(
        '[cron] Render free tier sleeps when idle — in-process cron may not fire. Set CRON_SECRET and ping POST /api/cron/daily from an external scheduler (see README).'
      );
    }
  } else {
    console.warn(`Invalid REMINDER_CRON "${cronExpr}" — cron not started`);
  }

  app.listen(port, () => {
    const publicUrl = process.env.RENDER_EXTERNAL_URL;
    if (publicUrl) {
      console.log(`API listening on port ${port}`);
      console.log(`Public URL: ${publicUrl}`);
    } else {
      console.log(`API listening on http://localhost:${port}`);
    }
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
