import ScheduleEntry from '../models/ScheduleEntry.js';
import ReminderLog from '../models/ReminderLog.js';
import { sendSms, sendWhatsApp } from './messagingService.js';
import { getRenderedTemplateById, renderTemplate } from '../utils/messageTemplates.js';
import {
  getScheduleReminderRules,
  isReminderDueToday,
} from '../utils/reminderRules.js';
import {
  getScheduleDepartmentDocs,
} from '../utils/scheduleDepartments.js';
import {
  getMemberDepartmentDocs,
  memberDepartmentsLabel,
} from '../utils/memberDepartments.js';

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

async function getSentChannelsToday(entryId, referenceDate) {
  const dayStart = startOfDay(referenceDate);
  const dayEnd = endOfDay(referenceDate);
  const logs = await ReminderLog.find({
    scheduleEntry: entryId,
    status: 'sent',
    createdAt: { $gte: dayStart, $lte: dayEnd },
  });
  return new Set(logs.map((log) => log.channel).filter((c) => c === 'sms' || c === 'whatsapp'));
}

function scheduleDepartmentName(schedule, member) {
  const scheduleDepts = getScheduleDepartmentDocs(schedule);
  const memberDepts = getMemberDepartmentDocs(member);

  if (memberDepts.length && scheduleDepts.length) {
    const overlap = scheduleDepts.filter((scheduleDept) =>
      memberDepts.some(
        (memberDept) => String(memberDept._id || memberDept) === String(scheduleDept._id || scheduleDept)
      )
    );
    if (overlap.length) {
      return overlap.map((dept) => dept.name).filter(Boolean).join(', ');
    }
  }

  const memberLabel = memberDepartmentsLabel(member);
  if (memberLabel) return memberLabel;

  if (scheduleDepts.length) {
    return scheduleDepts.map((dept) => dept.name).filter(Boolean).join(', ');
  }

  return '';
}

export async function processReminders(referenceDate = new Date()) {
  const today = startOfDay(referenceDate);
  const entries = await ScheduleEntry.find({
    reminderSentAt: null,
    date: { $gte: today },
  })
    .populate({
      path: 'member',
      populate: { path: 'departments', select: 'name' },
    })
    .populate({
      path: 'schedule',
      select: 'name reminderDaysBefore reminderWeekdays channels active messageBody messageTemplate',
      populate: [
        { path: 'departments', select: 'name active reminderDaysBefore' },
        { path: 'messageTemplate', select: 'body name' },
      ],
    });

  const results = {
    checked: entries.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    notDueToday: 0,
    reasons: [],
  };

  for (const entry of entries) {
    const person = entry.member?.name || 'Unknown';
    const schedule = entry.schedule;
    const deptLabel = scheduleDepartmentName(schedule, entry.member) || 'Schedule';
    const channels = getScheduleChannels(schedule);

    if (!schedule?.active || !entry.member?.active) {
      results.skipped += 1;
      results.reasons.push(`${person}: inactive schedule or member`);
      continue;
    }

    const scheduleDepts = getScheduleDepartmentDocs(schedule);
    if (scheduleDepts.length && scheduleDepts.every((dept) => !dept.active)) {
      results.skipped += 1;
      results.reasons.push(`${person}: inactive department`);
      continue;
    }

    const rules = getScheduleReminderRules(schedule);
    const serviceDay = startOfDay(entry.date);

    if (today.getTime() > serviceDay.getTime()) {
      if (!entry.reminderSentAt) {
        entry.reminderSentAt = new Date();
        await entry.save();
      }
      results.skipped += 1;
      results.reasons.push(`${person} (${deptLabel}): service day already passed`);
      continue;
    }

    if (!isReminderDueToday(today, serviceDay, rules)) {
      results.skipped += 1;
      results.notDueToday += 1;
      continue;
    }

    const sentChannels = await getSentChannelsToday(entry._id, today);
    const pendingChannels = channels.filter((ch) => !sentChannels.has(ch));

    if (!pendingChannels.length) {
      results.skipped += 1;
      results.reasons.push(`${person}: reminder already sent today on all channels`);
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
      department: scheduleDepartmentName(schedule, entry.member),
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

  }

  if (results.notDueToday > 0) {
    results.reasons.unshift(
      `${results.notDueToday} assignment${results.notDueToday === 1 ? '' : 's'} not due today`
    );
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
      select: 'name reminderDaysBefore reminderWeekdays',
      populate: { path: 'departments', select: 'name reminderDaysBefore' },
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
