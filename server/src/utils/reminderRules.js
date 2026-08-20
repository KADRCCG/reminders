const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function defaultReminderDaysBefore() {
  const configured = Number(process.env.DEFAULT_REMINDER_DAYS);
  return Number.isFinite(configured) ? configured : 2;
}

function normalizeDaysBefore(values) {
  if (values == null) return null;
  const list = (Array.isArray(values) ? values : [values])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 30);
  return [...new Set(list)].sort((a, b) => b - a);
}

function normalizeWeekdays(values) {
  if (values == null) return null;
  const list = (Array.isArray(values) ? values : [values])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  return [...new Set(list)].sort((a, b) => a - b);
}

export function getScheduleReminderRules(schedule) {
  const daysBefore = normalizeDaysBefore(schedule?.reminderDaysBefore);
  const weekdays = normalizeWeekdays(schedule?.reminderWeekdays) ?? [];

  if (daysBefore?.length) {
    return { daysBefore, weekdays };
  }

  const legacyDays =
    schedule?.departments?.[0]?.reminderDaysBefore ?? schedule?.department?.reminderDaysBefore;
  if (legacyDays != null) {
    const normalized = normalizeDaysBefore(legacyDays);
    if (normalized?.length) return { daysBefore: normalized, weekdays };
  }

  return { daysBefore: [defaultReminderDaysBefore()], weekdays };
}

export function parseReminderRulesInput(body, existing, department) {
  const hasDays = body?.reminderDaysBefore !== undefined;
  const hasWeekdays = body?.reminderWeekdays !== undefined;

  let daysBefore = hasDays
    ? normalizeDaysBefore(body.reminderDaysBefore)
    : normalizeDaysBefore(existing?.reminderDaysBefore);

  let weekdays = hasWeekdays
    ? normalizeWeekdays(body.reminderWeekdays)
    : normalizeWeekdays(existing?.reminderWeekdays) ?? [];

  if (!daysBefore?.length && !weekdays.length) {
    if (department?.reminderDaysBefore != null) {
      daysBefore = normalizeDaysBefore(department.reminderDaysBefore);
    }
    if (!daysBefore?.length) {
      daysBefore = [defaultReminderDaysBefore()];
    }
  }

  return {
    reminderDaysBefore: daysBefore ?? [],
    reminderWeekdays: weekdays,
  };
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, amount) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + amount);
  return d;
}

function sameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function reminderWindowStart(serviceDay, rules) {
  const service = startOfDay(serviceDay);
  const { daysBefore, weekdays } = rules;

  if (daysBefore.length) {
    const maxOffset = Math.max(...daysBefore);
    return addDays(service, -maxOffset);
  }

  if (weekdays.length) {
    return addDays(service, -30);
  }

  return addDays(service, -defaultReminderDaysBefore());
}

export function isReminderDueToday(referenceDate, serviceDate, rules) {
  const today = startOfDay(referenceDate);
  const serviceDay = startOfDay(serviceDate);

  if (today.getTime() > serviceDay.getTime()) return false;

  const windowStart = reminderWindowStart(serviceDay, rules);
  if (today.getTime() < windowStart.getTime()) return false;

  const { daysBefore, weekdays } = rules;

  if (daysBefore.some((offset) => sameDay(today, addDays(serviceDay, -offset)))) {
    return true;
  }

  if (weekdays.includes(today.getDay())) {
    return true;
  }

  return false;
}

export function formatReminderRules(rules) {
  const parts = [];

  if (rules.daysBefore?.length) {
    const labels = [...rules.daysBefore]
      .sort((a, b) => b - a)
      .map((days) => (days === 0 ? 'day of service' : `${days}d before`));
    parts.push(labels.join(', '));
  }

  if (rules.weekdays?.length) {
    const labels = rules.weekdays.map((day) => WEEKDAY_LABELS[day]);
    parts.push(labels.join(', '));
  }

  return parts.join(' · ') || `${defaultReminderDaysBefore()}d before`;
}

export { WEEKDAY_LABELS };
