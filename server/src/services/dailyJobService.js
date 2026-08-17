import AppSettings from '../models/AppSettings.js';
import { processReminders } from './reminderService.js';
import { processCelebrations } from './celebrationService.js';

export function getCronTimezone() {
  return process.env.CRON_TIMEZONE || 'Europe/Dublin';
}

export function getCronExpression() {
  return process.env.REMINDER_CRON || '0 8 * * *';
}

function getScheduledTime() {
  const parts = getCronExpression().trim().split(/\s+/);
  if (parts.length < 2) return { hour: 8, minute: 0 };
  const minute = Number.parseInt(parts[0], 10);
  const hour = Number.parseInt(parts[1], 10);
  return {
    hour: Number.isFinite(hour) ? hour : 8,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

export function getLocalDateKey(date = new Date(), timeZone = getCronTimezone()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

function getLocalTimeParts(date = new Date(), timeZone = getCronTimezone()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  return {
    hour: Number.parseInt(parts.find((part) => part.type === 'hour')?.value || '0', 10),
    minute: Number.parseInt(parts.find((part) => part.type === 'minute')?.value || '0', 10),
  };
}

export function isPastScheduledTime(date = new Date(), timeZone = getCronTimezone()) {
  const { hour, minute } = getScheduledTime();
  const local = getLocalTimeParts(date, timeZone);
  return local.hour > hour || (local.hour === hour && local.minute >= minute);
}

async function getLastDailyJobDate() {
  const doc = await AppSettings.findOne({ key: 'app' }).select('lastDailyJobDate');
  return doc?.lastDailyJobDate || null;
}

async function markDailyJobRan(dateKey) {
  await AppSettings.findOneAndUpdate(
    { key: 'app' },
    { lastDailyJobDate: dateKey },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

export async function shouldRunDailyJobs({ force = false } = {}) {
  if (force) return true;

  const timeZone = getCronTimezone();
  const today = getLocalDateKey(new Date(), timeZone);
  const lastRun = await getLastDailyJobDate();
  if (lastRun === today) return false;

  return isPastScheduledTime(new Date(), timeZone);
}

export async function runDailyJobs({ force = false, source = 'scheduled' } = {}) {
  const timeZone = getCronTimezone();
  const today = getLocalDateKey(new Date(), timeZone);

  if (!(await shouldRunDailyJobs({ force }))) {
    return {
      skipped: true,
      reason: `Daily jobs already ran for ${today} (${timeZone})`,
      source,
    };
  }

  console.log(`[daily-jobs] Running (${source}) at ${new Date().toISOString()}`);

  const reminderResults = await processReminders();
  const celebrationResults = await processCelebrations();

  await markDailyJobRan(today);

  const summary = {
    skipped: false,
    source,
    date: today,
    timeZone,
    reminderResults,
    celebrationResults,
  };

  console.log('[daily-jobs] Complete:', {
    source,
    date: today,
    remindersSent: reminderResults.sent,
    celebrationsSent: celebrationResults.sent,
  });

  return summary;
}

export async function runStartupCatchUp() {
  try {
    const result = await runDailyJobs({ source: 'startup-catchup' });
    if (!result.skipped) {
      console.log('[startup] Ran missed daily jobs:', result.date);
    }
    return result;
  } catch (err) {
    console.error('[startup] Daily job catch-up failed:', err.message);
    return { skipped: true, error: err.message };
  }
}
