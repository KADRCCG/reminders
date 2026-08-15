import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import departmentRoutes from './routes/departments.js';
import memberRoutes from './routes/members.js';
import assignmentRoutes from './routes/assignments.js';
import assignmentLabelRoutes from './routes/assignmentLabels.js';
import reminderRoutes from './routes/reminders.js';
import celebrationRoutes from './routes/celebrations.js';
import messageTemplateRoutes from './routes/messageTemplates.js';
import { processReminders } from './services/reminderService.js';
import { processCelebrations } from './services/celebrationService.js';
import { backfillAssignmentLabels } from './utils/assignmentLabels.js';
import { ensureAdminFromEnv } from './utils/ensureAdmin.js';
import { ensureMessageTemplates } from './utils/messageTemplates.js';

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'church-reminders-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/assignment-labels', assignmentLabelRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/celebrations', celebrationRoutes);
app.use('/api/message-templates', messageTemplateRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

const cronExpr = process.env.REMINDER_CRON || '0 8 * * *';

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
  await ensureAdminFromEnv();
  await ensureMessageTemplates();
  await backfillAssignmentLabels();

  if (cron.validate(cronExpr)) {
    cron.schedule(cronExpr, async () => {
      console.log(`[cron] Running daily jobs at ${new Date().toISOString()}`);
      try {
        const reminderResults = await processReminders();
        console.log('[cron] Reminder results:', reminderResults);
      } catch (err) {
        console.error('[cron] Reminder job failed:', err.message);
      }
      try {
        const celebrationResults = await processCelebrations();
        console.log('[cron] Celebration results:', celebrationResults);
      } catch (err) {
        console.error('[cron] Celebration job failed:', err.message);
      }
    });
    console.log(`Daily cron scheduled: ${cronExpr}`);
  } else {
    console.warn(`Invalid REMINDER_CRON "${cronExpr}" — cron not started`);
  }

  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
