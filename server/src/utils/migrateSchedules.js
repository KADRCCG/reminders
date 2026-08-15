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
    const deptId = String(a.department?._id || a.department);
    if (!byDept.has(deptId)) byDept.set(deptId, []);
    byDept.get(deptId).push(a);
  }

  let migrated = 0;

  for (const [, rows] of byDept) {
    const dept = rows[0].department;
    const schedule = await Schedule.create({
      name: `Migrated — ${dept?.name || 'Department'}`,
      department: dept._id,
      messageTemplate: defaultTemplate._id,
      notes: 'Auto-migrated from legacy assignments',
    });

    for (const row of rows) {
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

  console.log(`[migrate] Copied ${migrated} assignment(s) into ${byDept.size} schedule(s)`);
  return { migrated, schedules: byDept.size };
}
