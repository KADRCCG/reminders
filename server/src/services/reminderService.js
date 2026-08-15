import Assignment from '../models/Assignment.js';
import ReminderLog from '../models/ReminderLog.js';
import { sendSms } from './messagingService.js';
import { getRenderedTemplate } from '../utils/messageTemplates.js';

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

export async function processReminders(referenceDate = new Date()) {
  const today = startOfDay(referenceDate);
  const assignments = await Assignment.find({
    reminderSentAt: null,
    date: { $gte: today },
  })
    .populate('member')
    .populate('department');

  const results = {
    checked: assignments.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    reasons: [],
  };

  for (const assignment of assignments) {
    const person = assignment.member?.name || 'Unknown';
    const dept = assignment.department?.name || 'Department';

    if (!assignment.member?.active || !assignment.department?.active) {
      results.skipped += 1;
      results.reasons.push(`${person}: inactive member or department`);
      continue;
    }

    const daysBefore = assignment.department.reminderDaysBefore ?? 2;
    const serviceDay = startOfDay(assignment.date);
    const remindOn = startOfDay(assignment.date);
    remindOn.setDate(remindOn.getDate() - daysBefore);

    // Send from the remind-on day through the service day (catches missed cron runs).
    if (today.getTime() < remindOn.getTime()) {
      results.skipped += 1;
      results.reasons.push(
        `${person} (${dept}): not due yet — SMS sends from ${formatShortDate(remindOn)} (${daysBefore}d before)`
      );
      continue;
    }

    if (today.getTime() > serviceDay.getTime()) {
      results.skipped += 1;
      results.reasons.push(`${person} (${dept}): service day already passed`);
      continue;
    }

    if (!assignment.member.phone) {
      await ReminderLog.create({
        assignment: assignment._id,
        member: assignment.member._id,
        channel: 'sms',
        status: 'failed',
        message: '',
        error: 'No phone number on member record',
      });
      results.failed += 1;
      results.reasons.push(`${person}: no phone number`);
      continue;
    }

    const text = await getRenderedTemplate('schedule_reminder', {
      name: assignment.member.name,
      department: assignment.department.name,
      date: formatDate(assignment.date),
      assignment: assignment.roleLabel || 'Serve',
      notes_line: assignment.notes ? `Notes: ${assignment.notes}.` : '',
    });

    try {
      const delivery = await sendSms({
        to: assignment.member.phone,
        body: text,
      });

      assignment.reminderSentAt = new Date();
      await assignment.save();

      await ReminderLog.create({
        assignment: assignment._id,
        member: assignment.member._id,
        channel: delivery.channel === 'console' ? 'console' : 'sms',
        status: 'sent',
        message: text,
      });

      results.sent += 1;
      if (delivery.channel === 'console') {
        results.reasons.push(
          `${person}: logged to server console (SMSGate not configured)`
        );
      } else if (delivery.state === 'Pending' || delivery.state === 'Processed') {
        results.reasons.push(
          `${person}: queued on SMSGate (${delivery.state}, id ${delivery.sid}) — open SMSGate on the phone, confirm Cloud is Online, then check the message status there`
        );
      } else {
        results.reasons.push(`${person}: SMS ${delivery.state || 'sent'} (id ${delivery.sid})`);
      }
    } catch (err) {
      await ReminderLog.create({
        assignment: assignment._id,
        member: assignment.member._id,
        channel: 'sms',
        status: 'failed',
        message: text,
        error: err.message,
      });
      results.failed += 1;
      results.reasons.push(`${person}: ${err.message}`);
    }
  }

  return results;
}

export async function getUpcomingAssignments(limit = 20) {
  const today = startOfDay(new Date());
  return Assignment.find({ date: { $gte: today } })
    .sort({ date: 1 })
    .limit(limit)
    .populate('member', 'name email phone')
    .populate('department', 'name reminderDaysBefore');
}

export async function getDashboardStats() {
  const today = startOfDay(new Date());
  const inSeven = endOfDay(new Date());
  inSeven.setDate(inSeven.getDate() + 7);

  const [upcomingWeek, totalUpcoming, remindersSent, pendingReminders] = await Promise.all([
    Assignment.countDocuments({ date: { $gte: today, $lte: inSeven } }),
    Assignment.countDocuments({ date: { $gte: today } }),
    ReminderLog.countDocuments({ status: 'sent' }),
    Assignment.countDocuments({ date: { $gte: today }, reminderSentAt: null }),
  ]);

  return { upcomingWeek, totalUpcoming, remindersSent, pendingReminders };
}
