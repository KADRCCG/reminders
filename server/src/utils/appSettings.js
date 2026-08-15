import AppSettings from '../models/AppSettings.js';
import { normalizePhone } from './phone.js';

function contactsFromEnv() {
  return (process.env.CELEBRATION_WHATSAPP_TO || process.env.CELEBRATION_ANNOUNCE_TO || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((phone) => normalizePhone(phone))
    .filter(Boolean);
}

function dedupeContacts(contacts) {
  return [...new Set(contacts.map(String))];
}

export async function getAppSettingsDoc() {
  let doc = await AppSettings.findOne({ key: 'app' });
  if (!doc) {
    const fromEnv = contactsFromEnv();
    doc = await AppSettings.create({
      key: 'app',
      celebrationAdminContacts: dedupeContacts(fromEnv),
    });
  }
  return doc;
}

export async function getCelebrationAdminContacts() {
  const doc = await getAppSettingsDoc();
  return dedupeContacts(doc.celebrationAdminContacts || []);
}

export async function setCelebrationAdminContacts(rawContacts) {
  if (!Array.isArray(rawContacts)) {
    throw new Error('Admin contacts must be a list of phone numbers');
  }

  const normalized = [];
  for (const raw of rawContacts) {
    const phone = normalizePhone(String(raw || '').trim());
    if (!phone) {
      throw new Error(`Invalid phone number: ${raw}`);
    }
    normalized.push(phone);
  }

  const contacts = dedupeContacts(normalized);
  const doc = await AppSettings.findOneAndUpdate(
    { key: 'app' },
    { celebrationAdminContacts: contacts },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return doc.celebrationAdminContacts;
}
