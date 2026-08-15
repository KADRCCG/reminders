import MessageTemplate from '../models/MessageTemplate.js';
import Schedule from '../models/Schedule.js';

export const DEFAULT_TEMPLATES = [
  {
    key: 'schedule_reminder',
    kind: 'system',
    name: 'Schedule reminder',
    description: 'Reminder for people on a schedule roster.',
    placeholders: ['name', 'schedule', 'department', 'date', 'assignment', 'notes_line'],
    body: [
      'Hi {{name}}, reminder: you are on {{schedule}} for {{department}} on {{date}}.',
      'Assignment: {{assignment}}.',
      '{{notes_line}}',
      'Thank you for serving! — RCCG-KAD',
    ].join(' '),
  },
  {
    key: 'birthday',
    kind: 'system',
    name: 'Birthday (member)',
    description: 'Personal birthday message for the celebrant.',
    placeholders: ['name'],
    body: 'Happy Birthday, {{name}}! 🎉 The church family is celebrating you today. May God bless your new year of life. — RCCG-KAD',
  },
  {
    key: 'anniversary',
    kind: 'system',
    name: 'Wedding anniversary (couple)',
    description: 'Personal anniversary message for the couple.',
    placeholders: ['names', 'years_line'],
    body: 'Happy Wedding Anniversary, {{names}}! 💍{{years_line}} May God continue to bless your union. — RCCG-KAD',
  },
  {
    key: 'celebration_announce_birthday',
    kind: 'system',
    name: 'Birthday announcement (admin)',
    description: 'Daily announcement for admin about birthdays today.',
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
    kind: 'system',
    name: 'Anniversary announcement (admin)',
    description: 'Daily announcement for admin about anniversaries today.',
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

export async function syncSystemTemplateDescriptions() {
  for (const tpl of DEFAULT_TEMPLATES) {
    await MessageTemplate.updateMany(
      { key: tpl.key, kind: 'system' },
      { $set: { name: tpl.name, description: tpl.description } }
    );
    await MessageTemplate.updateMany(
      {
        key: tpl.key,
        $or: [
          { description: { $regex: /CELEBRATION_|digest sent to|WhatsApp message|church leader|Delivered via SMS/i } },
          { name: { $regex: /leader/i } },
        ],
      },
      { $set: { name: tpl.name, description: tpl.description } }
    );
  }
}

export async function migrateUnifiedTemplates() {
  await MessageTemplate.deleteOne({ key: 'schedule_reminder_whatsapp' });

  const col = Schedule.collection;
  const legacy = await col
    .find({ whatsappMessageTemplate: { $exists: true, $ne: null } })
    .toArray();

  for (const doc of legacy) {
    const update = { $unset: { whatsappMessageTemplate: '' } };
    if (!doc.messageTemplate && doc.whatsappMessageTemplate) {
      update.$set = { messageTemplate: doc.whatsappMessageTemplate };
    }
    await col.updateOne({ _id: doc._id }, update);
  }

  const customs = await MessageTemplate.find({ kind: 'custom' });
  for (const tpl of customs) {
    if (!isFriendlyTemplateName(tpl.name)) {
      tpl.name = humanizeCustomTemplateKey(tpl.key);
      await tpl.save();
    }
  }
}

export function slugifyTemplateKey(name) {
  const base = String(name || 'template')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  return `custom_${base || 'template'}_${Date.now().toString(36)}`;
}

export function humanizeCustomTemplateKey(key) {
  let s = String(key || '').replace(/^custom_/, '');
  s = s.replace(/_[a-z0-9]{5,12}$/i, '');
  s = s.replace(/_/g, ' ').trim();
  if (!s) return 'Custom template';
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function isFriendlyTemplateName(name) {
  const n = String(name || '').trim();
  if (!n) return false;
  if (/^custom_[a-z0-9_]+$/i.test(n)) return false;
  if (n.includes(' ')) return true;
  if (n.length >= 10) return true;
  if (/^[A-Z]/.test(n)) return true;
  return false;
}

export async function createCustomTemplate({ name, body, description = '', placeholders }) {
  const trimmedBody = String(body || '').trim();
  const trimmedName = String(name || '').trim();
  if (!trimmedName || !trimmedBody) {
    throw new Error('Template name and body are required');
  }

  const inferred = [...trimmedBody.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]);

  return MessageTemplate.create({
    key: slugifyTemplateKey(trimmedName),
    kind: 'custom',
    name: trimmedName,
    description,
    body: trimmedBody,
    placeholders: placeholders?.length ? placeholders : [...new Set(inferred)],
  });
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

export async function getRenderedTemplateById(templateId, vars = {}) {
  const tpl = await MessageTemplate.findById(templateId);
  if (!tpl) throw new Error('Message template not found');
  return renderTemplate(tpl.body, vars);
}
