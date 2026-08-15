import Member from '../models/Member.js';
import CelebrationLog from '../models/CelebrationLog.js';
import { sendSms, sendWhatsApp } from './messagingService.js';
import {
  birthdayAge,
  birthdayMatches,
  formatBirthdayLabel,
} from '../utils/birthday.js';
import {
  anniversaryMatches,
  anniversaryYears,
  formatAnniversaryLabel,
} from '../utils/anniversary.js';
import { getCelebrationAdminContacts } from '../utils/appSettings.js';
import { getRenderedTemplate } from '../utils/messageTemplates.js';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthDay(date) {
  const d = new Date(date);
  return { month: d.getMonth() + 1, day: d.getDate() };
}

function memberKey(ids) {
  return [...ids].map(String).sort().join(':');
}

async function alreadyAnnounced(type, year, memberIds) {
  const logs = await CelebrationLog.find({ type, year, status: 'sent' });
  const key = memberKey(memberIds);
  return logs.some((log) => memberKey(log.members) === key);
}

function getCelebrationChannels() {
  const raw = process.env.CELEBRATION_CHANNELS || 'sms,whatsapp';
  const channels = [
    ...new Set(raw.split(',').map((s) => s.trim()).filter((c) => c === 'sms' || c === 'whatsapp')),
  ];
  return channels.length ? channels : ['sms', 'whatsapp'];
}

export async function getCelebrationSettings() {
  const channels = getCelebrationChannels();
  const adminContacts = await getCelebrationAdminContacts();
  return {
    channels,
    sendSms: channels.includes('sms'),
    sendWhatsApp: channels.includes('whatsapp'),
    adminContacts,
    adminContactsConfigured: adminContacts.length > 0,
    adminContactCount: adminContacts.length,
  };
}

async function sendOnChannels({ to, body, channels }) {
  let lastChannel = 'console';
  for (const ch of channels) {
    const delivery =
      ch === 'whatsapp' ? await sendWhatsApp({ to, body }) : await sendSms({ to, body });
    lastChannel = delivery.channel === 'console' ? 'console' : ch;
  }
  return lastChannel;
}

async function getAnnouncementRecipients() {
  return getCelebrationAdminContacts();
}

export async function getTodaysCelebrations(referenceDate = new Date()) {
  const { month, day } = monthDay(referenceDate);
  const members = await Member.find({ active: true })
    .populate('spouse', 'name email phone')
    .populate('department', 'name')
    .sort({ name: 1 });

  const birthdays = members
    .filter((m) => birthdayMatches(m, month, day))
    .map((m) => ({
      type: 'birthday',
      members: [m],
      label: `${m.name}'s birthday`,
      dateLabel: formatBirthdayLabel(m),
      years: birthdayAge(m, referenceDate),
    }));

  const seenCouples = new Set();
  const anniversaries = [];

  for (const m of members) {
    if (!anniversaryMatches(m, month, day) || !m.spouse) continue;
    const key = memberKey([m._id, m.spouse._id || m.spouse]);
    if (seenCouples.has(key)) continue;
    seenCouples.add(key);

    const spouse =
      typeof m.spouse === 'object' && m.spouse?.name
        ? m.spouse
        : members.find((x) => x._id.toString() === String(m.spouse));

    if (!spouse) continue;

    anniversaries.push({
      type: 'wedding_anniversary',
      members: [m, spouse],
      label: `${m.name} & ${spouse.name}'s anniversary`,
      dateLabel: formatAnniversaryLabel(m),
      years: anniversaryYears(m, referenceDate),
    });
  }

  return { birthdays, anniversaries, date: startOfDay(referenceDate) };
}

export async function getUpcomingCelebrations(days = 14, referenceDate = new Date()) {
  const members = await Member.find({ active: true })
    .populate('spouse', 'name email phone')
    .populate('department', 'name')
    .sort({ name: 1 });

  const upcoming = [];
  for (let offset = 0; offset <= days; offset += 1) {
    const dayDate = new Date(referenceDate);
    dayDate.setDate(dayDate.getDate() + offset);
    const { month, day } = monthDay(dayDate);

    for (const m of members) {
      if (birthdayMatches(m, month, day)) {
        upcoming.push({
          type: 'birthday',
          date: startOfDay(dayDate),
          members: [{ _id: m._id, name: m.name, email: m.email, phone: m.phone }],
          label: `${m.name}'s birthday`,
          years: birthdayAge(m, dayDate),
        });
      }
    }

    const seen = new Set();
    for (const m of members) {
      if (!anniversaryMatches(m, month, day) || !m.spouse) continue;
      const spouseId = m.spouse._id || m.spouse;
      const key = memberKey([m._id, spouseId]);
      if (seen.has(key)) continue;
      seen.add(key);
      const spouseName = m.spouse.name || 'Spouse';
      upcoming.push({
        type: 'wedding_anniversary',
        date: startOfDay(dayDate),
        members: [
          { _id: m._id, name: m.name, email: m.email, phone: m.phone },
          {
            _id: spouseId,
            name: spouseName,
            email: m.spouse.email,
            phone: m.spouse.phone,
          },
        ],
        label: `${m.name} & ${spouseName}'s anniversary`,
        years: anniversaryYears(m, dayDate),
      });
    }
  }

  return upcoming.sort((a, b) => a.date - b.date);
}

async function announceEvent(event, year, occurrenceDate) {
  const memberIds = event.members.map((m) => m._id);
  if (await alreadyAnnounced(event.type, year, memberIds)) {
    return { status: 'skipped' };
  }

  const names = event.members.map((m) => m.name).join(' & ');
  const yearsPersonal =
    event.type === 'anniversary' && event.years != null && event.years >= 0
      ? ` Celebrating ${event.years} year${event.years === 1 ? '' : 's'} of marriage.`
      : '';
  const yearsAnnounce =
    event.years != null && event.years >= 0 ? `Years: ${event.years}` : '';

  const personalText =
    event.type === 'birthday'
      ? await getRenderedTemplate('birthday', { name: event.members[0].name })
      : await getRenderedTemplate('anniversary', {
          names,
          years_line: yearsPersonal,
        });

  const announceText =
    event.type === 'birthday'
      ? await getRenderedTemplate('celebration_announce_birthday', {
          name: event.members[0].name,
          date_label: event.dateLabel,
          years_line: yearsAnnounce,
        })
      : await getRenderedTemplate('celebration_announce_anniversary', {
          names,
          date_label: event.dateLabel,
          years_line: yearsAnnounce,
        });

  const channels = getCelebrationChannels();

  try {
    let channel = 'console';
    let delivered = 0;

    for (const person of event.members) {
      if (!person.phone) continue;
      channel = await sendOnChannels({
        to: person.phone,
        body: personalText,
        channels,
      });
      delivered += channels.length;
    }

    const adminRecipients = await getAnnouncementRecipients();
    for (const to of adminRecipients) {
      channel = await sendOnChannels({
        to,
        body: announceText,
        channels,
      });
      delivered += channels.length;
    }

    if (!delivered) {
      throw new Error(
        'No recipients found. Add phone numbers on member records or configure admin contacts for announcements.'
      );
    }

    await CelebrationLog.create({
      type: event.type,
      members: memberIds,
      year,
      occurrenceDate,
      channel,
      status: 'sent',
      message: `${personalText}\n\n${announceText}`,
    });

    return { status: 'sent' };
  } catch (err) {
    await CelebrationLog.create({
      type: event.type,
      members: memberIds,
      year,
      occurrenceDate,
      channel: channels[0] || 'whatsapp',
      status: 'failed',
      message: announceText,
      error: err.message,
    });
    return { status: 'failed', error: err.message };
  }
}

export async function processCelebrations(referenceDate = new Date()) {
  const today = startOfDay(referenceDate);
  const year = today.getFullYear();
  const { birthdays, anniversaries } = await getTodaysCelebrations(referenceDate);
  const events = [...birthdays, ...anniversaries];

  const results = { checked: events.length, sent: 0, skipped: 0, failed: 0 };

  for (const event of events) {
    const outcome = await announceEvent(event, year, today);
    if (outcome.status === 'sent') results.sent += 1;
    else if (outcome.status === 'skipped') results.skipped += 1;
    else results.failed += 1;
  }

  return results;
}
