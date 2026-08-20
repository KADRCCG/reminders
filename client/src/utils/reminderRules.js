const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

export function reminderRulesFromSchedule(schedule) {
  const daysBefore = Array.isArray(schedule?.reminderDaysBefore)
    ? schedule.reminderDaysBefore
    : schedule?.reminderDaysBefore != null
      ? [schedule.reminderDaysBefore]
      : schedule?.departments?.[0]?.reminderDaysBefore != null
        ? [schedule.departments[0].reminderDaysBefore]
      : schedule?.department?.reminderDaysBefore != null
        ? [schedule.department.reminderDaysBefore]
        : [2];

  const weekdays = Array.isArray(schedule?.reminderWeekdays) ? schedule.reminderWeekdays : [];

  return {
    reminderDaysBefore: daysBefore,
    reminderWeekdays: weekdays,
  };
}

export function formatReminderRulesLabel(scheduleOrRules) {
  const rules =
    scheduleOrRules?.reminderDaysBefore || scheduleOrRules?.reminderWeekdays
      ? scheduleOrRules
      : reminderRulesFromSchedule(scheduleOrRules);

  const parts = [];
  const { reminderDaysBefore = [], reminderWeekdays = [] } = rules;

  if (reminderDaysBefore.length) {
    const labels = [...reminderDaysBefore]
      .sort((a, b) => b - a)
      .map((days) => (days === 0 ? 'day of service' : `${days} day${days === 1 ? '' : 's'} before`));
    parts.push(labels.join(', '));
  }

  if (reminderWeekdays.length) {
    const labels = reminderWeekdays
      .slice()
      .sort((a, b) => a - b)
      .map((day) => WEEKDAYS.find((item) => item.value === day)?.label || day);
    parts.push(labels.join(', '));
  }

  return parts.join(' · ') || '2 days before';
}

export const DEFAULT_REMINDER_DAYS = [2];
