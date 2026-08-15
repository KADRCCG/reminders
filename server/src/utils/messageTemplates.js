import MessageTemplate from '../models/MessageTemplate.js';

export const DEFAULT_TEMPLATES = [
  {
    key: 'schedule_reminder',
    name: 'Schedule reminder',
    channel: 'sms',
    description: 'Sent by SMS before a scheduled assignment.',
    placeholders: ['name', 'department', 'date', 'assignment', 'notes_line'],
    body: [
      'Hi {{name}}, reminder: you are scheduled for {{department}} on {{date}}.',
      'Assignment: {{assignment}}.',
      '{{notes_line}}',
      'Thank you for serving! — RCCG-KAD',
    ].join(' '),
  },
  {
    key: 'birthday',
    name: 'Birthday (member)',
    channel: 'whatsapp',
    description: 'WhatsApp message to the birthday celebrant.',
    placeholders: ['name'],
    body: 'Happy Birthday, {{name}}! 🎉 The church family is celebrating you today. May God bless your new year of life. — RCCG-KAD',
  },
  {
    key: 'anniversary',
    name: 'Wedding anniversary (couple)',
    channel: 'whatsapp',
    description: 'WhatsApp message to the couple.',
    placeholders: ['names', 'years_line'],
    body: 'Happy Wedding Anniversary, {{names}}! 💍{{years_line}} May God continue to bless your union. — RCCG-KAD',
  },
  {
    key: 'celebration_announce_birthday',
    name: 'Birthday announcement (leaders)',
    channel: 'whatsapp',
    description: 'WhatsApp digest sent to CELEBRATION_WHATSAPP_TO for birthdays.',
    placeholders: ['name', 'date_label', 'years_line'],
    body: [
      "Today's celebration announcement:",
      'Birthday: {{name}}',
      'Date: {{date_label}}',
      '{{years_line}}',
      "Please include this in today's church announcements.",
    ].join('\n'),
  },
  {
    key: 'celebration_announce_anniversary',
    name: 'Anniversary announcement (leaders)',
    channel: 'whatsapp',
    description: 'WhatsApp digest sent to CELEBRATION_WHATSAPP_TO for anniversaries.',
    placeholders: ['names', 'date_label', 'years_line'],
    body: [
      "Today's celebration announcement:",
      'Wedding anniversary: {{names}}',
      'Date: {{date_label}}',
      '{{years_line}}',
      "Please include this in today's church announcements.",
    ].join('\n'),
  },
];

/** Replace {{key}} placeholders. Missing values become empty strings. Collapses leftover spaces. */
export function renderTemplate(body, vars = {}) {
  let text = String(body || '');
  text = text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = vars[key];
    return value == null ? '' : String(value);
  });
  // Tidy whitespace left by optional lines
  text = text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return text;
}

export async function ensureMessageTemplates() {
  for (const tpl of DEFAULT_TEMPLATES) {
    const existing = await MessageTemplate.findOne({ key: tpl.key });
    if (!existing) {
      await MessageTemplate.create(tpl);
    }
  }
}

export async function getRenderedTemplate(key, vars = {}) {
  let tpl = await MessageTemplate.findOne({ key });
  if (!tpl) {
    const fallback = DEFAULT_TEMPLATES.find((t) => t.key === key);
    if (!fallback) throw new Error(`Unknown message template: ${key}`);
    return renderTemplate(fallback.body, vars);
  }
  return renderTemplate(tpl.body, vars);
}
