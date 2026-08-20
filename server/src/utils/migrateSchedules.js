import Assignment from '../models/Assignment.js';
import Schedule from '../models/Schedule.js';
import ScheduleEntry from '../models/ScheduleEntry.js';
import Department from '../models/Department.js';
import MessageTemplate from '../models/MessageTemplate.js';
import { ensureMessageTemplates } from './messageTemplates.js';

/** One-time migration: copy legacy Assignment rows into Schedule + ScheduleEntry. */
export async function migrateAssignmentsToSchedules() {
  await ensureMessageTemplates();

  const scheduleCount = await Schedule.countDocuments();
  if (scheduleCount > 0) return { migrated: 0, skipped: true };

  const assignmentCount = await Assignment.countDocuments();
  if (assignmentCount === 0) return { migrated: 0, skipped: true };

  const defaultTemplate = await MessageTemplate.findOne({ key: 'schedule_reminder' });
  if (!defaultTemplate) return { migrated: 0, skipped: true };

  const assignments = await Assignment.find().populate('department');
  const byDept = new Map();

  for (const a of assignments) {
    const deptId = a.department?._id || a.department;
    if (!deptId) {
      console.warn(`[migrate] Skipping assignment ${a._id}: missing department`);
      continue;
    }
    const key = String(deptId);
    if (!byDept.has(key)) byDept.set(key, []);
    byDept.get(key).push(a);
  }

  let migrated = 0;
  let schedulesCreated = 0;

  for (const [, rows] of byDept) {
    const dept = rows[0]?.department;
    const deptId = dept?._id || rows[0]?.department;
    if (!deptId) {
      console.warn('[migrate] Skipping assignment group with no department');
      continue;
    }

    const schedule = await Schedule.create({
      name: `Migrated — ${dept?.name || 'Department'}`,
      departments: [deptId],
      messageTemplate: defaultTemplate._id,
      notes: 'Auto-migrated from legacy assignments',
    });
    schedulesCreated += 1;

    for (const row of rows) {
      if (!row.member) {
        console.warn(`[migrate] Skipping assignment ${row._id}: missing member`);
        continue;
      }
      await ScheduleEntry.create({
        schedule: schedule._id,
        member: row.member,
        date: row.date,
        roleLabel: row.roleLabel,
        notes: row.notes,
        reminderSentAt: row.reminderSentAt,
      });
      migrated += 1;
    }
  }

  console.log(
    `[migrate] Copied ${migrated} assignment(s) into ${schedulesCreated} schedule(s)`
  );
  return { migrated, schedules: schedulesCreated };
}
