import ScheduleEntry from '../models/ScheduleEntry.js';
import ReminderLog from '../models/ReminderLog.js';
import { sendSms, sendWhatsApp } from './messagingService.js';
import { getRenderedTemplateById, renderTemplate } from '../utils/messageTemplates.js';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatShortDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getScheduleChannels(schedule) {
  if (schedule?.channels?.length) return schedule.channels;
  return schedule?.channel === 'whatsapp' ? ['whatsapp'] : ['sms'];
}

function channelLabel(channel) {
  return channel === 'whatsapp' ? 'WhatsApp' : 'SMS';
}

function templateIdForSchedule(schedule) {
  return schedule.messageTemplate?._id || schedule.messageTemplate;
}

async function getSentChannels(entryId) {
  const logs = await ReminderLog.find({ scheduleEntry: entryId, status: 'sent' });
  return new Set(logs.map((log) => log.channel).filter((c) => c === 'sms' || c === 'whatsapp'));
}

export async function processReminders(referenceDate = new Date()) {
  const today = startOfDay(referenceDate);
  const entries = await ScheduleEntry.find({
    reminderSentAt: null,
    date: { $gte: today },
  })
    .populate('member')
    .populate({
      path: 'schedule',
      populate: [
        { path: 'department', select: 'name reminderDaysBefore active' },
        { path: 'messageTemplate', select: 'body name' },
      ],
    });

  const results = {
    checked: entries.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    reasons: [],
  };

  for (const entry of entries) {
    const person = entry.member?.name || 'Unknown';
    const schedule = entry.schedule;
    const dept = schedule?.department?.name || 'Department';
    const channels = getScheduleChannels(schedule);

    if (!schedule?.active || !entry.member?.active || !schedule?.department?.active) {
      results.skipped += 1;
      results.reasons.push(`${person}: inactive schedule, member, or department`);
      continue;
    }

    const daysBefore = schedule.department.reminderDaysBefore ?? 2;
    const serviceDay = startOfDay(entry.date);
    const remindOn = startOfDay(entry.date);
    remindOn.setDate(remindOn.getDate() - daysBefore);

    if (today.getTime() < remindOn.getTime()) {
      results.skipped += 1;
      results.reasons.push(
        `${person} (${dept}): not due yet — reminder sends from ${formatShortDate(remindOn)} (${daysBefore}d before)`
      );
      continue;
    }

    if (today.getTime() > serviceDay.getTime()) {
      results.skipped += 1;
      results.reasons.push(`${person} (${dept}): service day already passed`);
      continue;
    }

    const sentChannels = await getSentChannels(entry._id);
    const pendingChannels = channels.filter((ch) => !sentChannels.has(ch));

    if (!pendingChannels.length) {
      entry.reminderSentAt = new Date();
      await entry.save();
      results.skipped += 1;
      results.reasons.push(`${person}: reminder already sent on all channels`);
      continue;
    }

    if (!entry.member.phone) {
      for (const ch of pendingChannels) {
        await ReminderLog.create({
          scheduleEntry: entry._id,
          member: entry.member._id,
          channel: ch,
          status: 'failed',
          message: '',
          error: 'No phone number on member record',
        });
      }
      results.failed += pendingChannels.length;
      results.reasons.push(`${person}: no phone number`);
      continue;
    }

    const templateId = templateIdForSchedule(schedule);
    const templateVars = {
      name: entry.member.name,
      schedule: schedule.name,
      department: schedule.department.name,
      date: formatDate(entry.date),
      assignment: entry.roleLabel || 'Serve',
      notes_line: entry.notes ? `Notes: ${entry.notes}.` : '',
    };

    const scheduleBody = String(schedule.messageBody || '').trim();
    let text;
    if (scheduleBody) {
      text = renderTemplate(scheduleBody, templateVars);
    } else if (templateId) {
      text = await getRenderedTemplateById(templateId, templateVars);
    } else {
      for (const ch of pendingChannels) {
        await ReminderLog.create({
          scheduleEntry: entry._id,
          member: entry.member._id,
          channel: ch,
          status: 'failed',
          message: '',
          error: 'No message configured for this schedule',
        });
        results.failed += 1;
      }
      results.reasons.push(`${person}: no message configured`);
      continue;
    }

    for (const ch of pendingChannels) {
      const label = channelLabel(ch);

      try {
        const delivery =
          ch === 'whatsapp'
            ? await sendWhatsApp({ to: entry.member.phone, body: text })
            : await sendSms({ to: entry.member.phone, body: text });

        const logChannel = delivery.channel === 'console' ? 'console' : ch;

        await ReminderLog.create({
          scheduleEntry: entry._id,
          member: entry.member._id,
          channel: logChannel,
          status: 'sent',
          message: text,
        });

        sentChannels.add(ch);
        results.sent += 1;

        if (delivery.channel === 'console') {
          results.reasons.push(`${person}: ${label} saved to server log (not configured yet)`);
        } else if (delivery.state === 'Pending' || delivery.state === 'Processed') {
          results.reasons.push(`${person}: ${label} handed to your phone to send`);
        } else if (delivery.state === 'Delivered') {
          results.reasons.push(`${person}: ${label} delivered`);
        } else {
          results.reasons.push(`${person}: ${label} sent`);
        }
      } catch (err) {
        await ReminderLog.create({
          scheduleEntry: entry._id,
          member: entry.member._id,
          channel: ch,
          status: 'failed',
          message: text,
          error: err.message,
        });
        results.failed += 1;
        results.reasons.push(`${person} (${label}): ${err.message}`);
      }
    }

    if (channels.every((ch) => sentChannels.has(ch))) {
      entry.reminderSentAt = new Date();
      await entry.save();
    }
  }

  return results;
}

export async function getUpcomingAssignments(limit = 20) {
  const today = startOfDay(new Date());
  return ScheduleEntry.find({ date: { $gte: today } })
    .sort({ date: 1 })
    .limit(limit)
    .populate('member', 'name email phone')
    .populate({
      path: 'schedule',
      select: 'name',
      populate: { path: 'department', select: 'name reminderDaysBefore' },
    });
}

export async function getDashboardStats() {
  const today = startOfDay(new Date());
  const inSeven = endOfDay(new Date());
  inSeven.setDate(inSeven.getDate() + 7);

  const [upcomingWeek, totalUpcoming, remindersSent, pendingReminders] = await Promise.all([
    ScheduleEntry.countDocuments({ date: { $gte: today, $lte: inSeven } }),
    ScheduleEntry.countDocuments({ date: { $gte: today } }),
    ReminderLog.countDocuments({ status: 'sent' }),
    ScheduleEntry.countDocuments({ date: { $gte: today }, reminderSentAt: null }),
  ]);

  return { upcomingWeek, totalUpcoming, remindersSent, pendingReminders };
}
