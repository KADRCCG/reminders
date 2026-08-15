/** Replace {{key}} placeholders — mirrors server renderTemplate. */
export function renderTemplate(body, vars = {}) {
  let text = String(body || '');
  text = text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = vars[key];
    return value == null ? '' : String(value);
  });
  text = text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return text;
}

export const SCHEDULE_MESSAGE_PLACEHOLDERS = [
  'name',
  'schedule',
  'department',
  'date',
  'assignment',
  'notes_line',
];

export const SCHEDULE_SAMPLE_VARS = {
  name: 'Ada Okonkwo',
  schedule: 'Q3 Sunday School',
  department: 'Sunday School',
  date: 'Sunday, August 16, 2026',
  assignment: 'Teach',
  notes_line: 'Notes: Lesson — Faith.',
};
