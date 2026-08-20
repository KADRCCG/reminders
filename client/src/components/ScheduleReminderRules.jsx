import { useEffect, useRef, useState } from 'react';
import { formatReminderRulesLabel } from '../utils/reminderRules';

const DAY_OPTIONS = [0, 1, 2, 3, 7, 14, 30];

const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

function normalizeNumbers(values) {
  return [...new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value)))].sort(
    (a, b) => a - b
  );
}

function toggleValue(list, value) {
  const normalized = normalizeNumbers(list);
  return normalized.includes(value)
    ? normalized.filter((item) => item !== value)
    : [...normalized, value].sort((a, b) => a - b);
}

export default function ScheduleReminderRules({ reminderDaysBefore, reminderWeekdays, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const days = normalizeNumbers(reminderDaysBefore || []);
  const weekdays = normalizeNumbers(reminderWeekdays || []);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(event) {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function updateDays(nextDays) {
    onChange({
      reminderDaysBefore: nextDays,
      reminderWeekdays: weekdays,
    });
  }

  function updateWeekdays(nextWeekdays) {
    onChange({
      reminderDaysBefore: days,
      reminderWeekdays: nextWeekdays,
    });
  }

  const summary = formatReminderRulesLabel({ reminderDaysBefore: days, reminderWeekdays: weekdays });
  const hasSelection = days.length || weekdays.length;

  return (
    <div className="reminder-dropdown-wrap" ref={wrapRef}>
      <span className="channel-dropdown-label">Reminder schedule</span>
      <button
        type="button"
        className={`channel-dropdown-trigger${open ? ' open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {hasSelection ? summary : 'Select reminder days'}
      </button>
      {open && (
        <div className="reminder-dropdown-menu" role="listbox">
          <div className="reminder-rules-group">
            <span className="reminder-rules-label">Days before service</span>
            <div className="reminder-rules-options">
              {DAY_OPTIONS.map((value) => (
                <label key={`day-${value}`} className="reminder-rules-option">
                  <input
                    type="checkbox"
                    checked={days.includes(value)}
                    onChange={() => updateDays(toggleValue(days, value))}
                  />
                  {value === 0 ? 'Day of service' : `${value} day${value === 1 ? '' : 's'}`}
                </label>
              ))}
            </div>
          </div>

          <div className="reminder-rules-group">
            <span className="reminder-rules-label">Weekdays</span>
            <div className="reminder-rules-options">
              {WEEKDAYS.map(({ value, label }) => (
                <label key={`weekday-${value}`} className="reminder-rules-option">
                  <input
                    type="checkbox"
                    checked={weekdays.includes(value)}
                    onChange={() => updateWeekdays(toggleValue(weekdays, value))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {!hasSelection && (
            <p className="error small reminder-dropdown-error">Select at least one option.</p>
          )}
        </div>
      )}
      {!open && !hasSelection && (
        <p className="error small">Select at least one day-before option or weekday.</p>
      )}
    </div>
  );
}
