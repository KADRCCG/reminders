import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import Schedule from '../models/Schedule.js';
import ScheduleEntry from '../models/ScheduleEntry.js';
import Department from '../models/Department.js';
import Member from '../models/Member.js';
import MessageTemplate from '../models/MessageTemplate.js';
import { protect } from '../middleware/auth.js';
import { ensureAssignmentLabel } from '../utils/assignmentLabels.js';
import { friendlyErrorMessage } from '../utils/errors.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
router.use(protect);

function parseDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(12, 0, 0, 0);
  return d;
}

function normalizeChannel(value) {
  return value === 'whatsapp' ? 'whatsapp' : 'sms';
}

function normalizeChannels(body, existing) {
  if (Array.isArray(body?.channels)) {
    const channels = [...new Set(body.channels.filter((c) => c === 'sms' || c === 'whatsapp'))];
    if (!channels.length) throw new Error('Select at least one delivery channel (SMS or WhatsApp)');
    return channels;
  }
  if (body?.channel != null) {
    return [normalizeChannel(body.channel)];
  }
  if (existing?.channels?.length) return existing.channels;
  if (existing?.channel === 'whatsapp') return ['whatsapp'];
  return ['sms'];
}

function isScheduleTemplate(tpl) {
  return (
    tpl?.placeholders?.includes('schedule') ||
    String(tpl?.key || '').startsWith('schedule_') ||
    tpl?.kind === 'custom'
  );
}

async function resolveTemplate(messageTemplateId, { messageMode, messageBody } = {}) {
  const body = String(messageBody || '').trim();
  if (!body) throw new Error('Message text is required');

  if (messageMode === 'custom') {
    return null;
  }

  if (!messageTemplateId) {
    throw new Error('Choose a message template');
  }

  const tpl = await MessageTemplate.findById(messageTemplateId);
  if (!tpl) throw new Error('Message template not found');
  if (!isScheduleTemplate(tpl)) {
    throw new Error('Choose a schedule reminder template from Message Hub');
  }
  return tpl._id;
}

async function createEntry(scheduleId, payload) {
  const parsed = parseDate(payload.date);
  if (!parsed) throw new Error('Invalid date');

  const label = await ensureAssignmentLabel(payload.roleLabel || 'Serve');
  return ScheduleEntry.create({
    schedule: scheduleId,
    member: payload.member,
    date: parsed,
    roleLabel: label?.name || payload.roleLabel || 'Serve',
    notes: payload.notes || '',
  });
}

const schedulePopulate = [
  { path: 'department', select: 'name reminderDaysBefore active' },
  { path: 'messageTemplate', select: 'name kind key' },
];

const entryPopulate = [
  { path: 'member', select: 'name email phone active' },
  { path: 'schedule', select: 'name', populate: { path: 'department', select: 'name' } },
];

router.get('/', async (_req, res) => {
  const schedules = await Schedule.find()
    .populate(schedulePopulate)
    .sort({ updatedAt: -1 });

  const counts = await ScheduleEntry.aggregate([
    { $group: { _id: '$schedule', count: { $sum: 1 }, minDate: { $min: '$date' }, maxDate: { $max: '$date' } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c]));

  res.json(
    schedules.map((s) => {
      const stats = countMap[String(s._id)] || {};
      return {
        ...s.toObject(),
        entryCount: stats.count || 0,
        dateFrom: stats.minDate || null,
        dateTo: stats.maxDate || null,
      };
    })
  );
});

router.post('/', async (req, res) => {
  try {
    const { name, department, notes, entries = [] } = req.body;
    if (!name || !department) {
      return res.status(400).json({ message: 'Name and department are required' });
    }

    const dept = await Department.findById(department);
    if (!dept) return res.status(400).json({ message: 'Department not found' });

    const channels = normalizeChannels(req.body);
    const messageMode = req.body.messageMode === 'custom' ? 'custom' : 'template';
    const messageBody = String(req.body.messageBody || '').trim();
    const templateId =
      messageMode === 'custom'
        ? null
        : req.body.messageTemplateId || req.body.smsTemplateId || req.body.whatsappTemplateId;
    const messageTemplate = await resolveTemplate(templateId, { messageMode, messageBody });

    const schedule = await Schedule.create({
      name: String(name).trim(),
      department,
      channels,
      messageTemplate,
      messageBody,
      notes: notes || '',
    });

    for (const entry of entries) {
      if (!entry.member || !entry.date) continue;
      await createEntry(schedule._id, entry);
    }

    const populated = await Schedule.findById(schedule._id).populate(schedulePopulate);
    const scheduleEntries = await ScheduleEntry.find({ schedule: schedule._id })
      .populate('member', 'name email phone')
      .sort({ date: 1 });

    res.status(201).json({ ...populated.toObject(), entries: scheduleEntries });
  } catch (err) {
    res.status(400).json({ message: friendlyErrorMessage(err) });
  }
});

router.get('/:id', async (req, res) => {
  const schedule = await Schedule.findById(req.params.id).populate(schedulePopulate);
  if (!schedule) return res.status(404).json({ message: 'Schedule not found' });

  const entries = await ScheduleEntry.find({ schedule: schedule._id })
    .populate('member', 'name email phone active')
    .sort({ date: 1 });

  res.json({ ...schedule.toObject(), entries });
});

router.put('/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });

    if (req.body.name != null) schedule.name = String(req.body.name).trim();
    if (req.body.notes != null) schedule.notes = String(req.body.notes).trim();
    if (req.body.active != null) schedule.active = Boolean(req.body.active);

    if (req.body.department) {
      const dept = await Department.findById(req.body.department);
      if (!dept) return res.status(400).json({ message: 'Department not found' });
      schedule.department = req.body.department;
    }

    const channels = normalizeChannels(req.body, schedule);
    schedule.channels = channels;

    if (req.body.messageBody != null || req.body.messageMode != null || req.body.messageTemplateId != null) {
      const messageMode =
        req.body.messageMode === 'custom' ? 'custom' : req.body.messageMode === 'template' ? 'template' : schedule.messageTemplate ? 'template' : 'custom';
      const messageBody =
        req.body.messageBody != null ? String(req.body.messageBody).trim() : schedule.messageBody;
      const templateId =
        messageMode === 'custom'
          ? null
          : req.body.messageTemplateId ||
            req.body.smsTemplateId ||
            req.body.whatsappTemplateId ||
            schedule.messageTemplate;

      schedule.messageBody = messageBody;
      schedule.messageTemplate = await resolveTemplate(templateId, { messageMode, messageBody });
    } else if (!schedule.messageTemplate && !String(schedule.messageBody || '').trim()) {
      const fallback = await MessageTemplate.findOne({ key: 'schedule_reminder' });
      if (fallback) schedule.messageTemplate = fallback._id;
    }

    await schedule.save();
    const populated = await Schedule.findById(schedule._id).populate(schedulePopulate);
    res.json(populated);
  } catch (err) {
    res.status(400).json({ message: friendlyErrorMessage(err) });
  }
});

router.delete('/:id', async (req, res) => {
  const schedule = await Schedule.findById(req.params.id);
  if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
  await ScheduleEntry.deleteMany({ schedule: schedule._id });
  await schedule.deleteOne();
  res.json({ message: 'Schedule deleted' });
});

router.post('/:id/entries', async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });

    const rows = Array.isArray(req.body) ? req.body : [req.body];
    const created = [];

    for (const row of rows) {
      if (!row.member || !row.date) {
        return res.status(400).json({ message: 'Each entry needs member and date' });
      }
      created.push(await createEntry(schedule._id, row));
    }

    const entries = await ScheduleEntry.find({ _id: { $in: created.map((e) => e._id) } })
      .populate('member', 'name email phone')
      .sort({ date: 1 });

    res.status(201).json(entries);
  } catch (err) {
    res.status(400).json({ message: friendlyErrorMessage(err) });
  }
});

router.put('/:id/entries/:entryId', async (req, res) => {
  try {
    const entry = await ScheduleEntry.findOne({
      _id: req.params.entryId,
      schedule: req.params.id,
    });
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    if (req.body.member) entry.member = req.body.member;
    if (req.body.notes != null) entry.notes = req.body.notes;
    if (req.body.date) {
      const parsed = parseDate(req.body.date);
      if (!parsed) return res.status(400).json({ message: 'Invalid date' });
      entry.date = parsed;
    }
    if (req.body.roleLabel != null) {
      const label = await ensureAssignmentLabel(req.body.roleLabel || 'Serve');
      entry.roleLabel = label?.name || req.body.roleLabel || 'Serve';
    }

    await entry.save();
    const populated = await ScheduleEntry.findById(entry._id).populate('member', 'name email phone');
    res.json(populated);
  } catch (err) {
    res.status(400).json({ message: friendlyErrorMessage(err) });
  }
});

router.delete('/:id/entries/:entryId', async (req, res) => {
  const entry = await ScheduleEntry.findOneAndDelete({
    _id: req.params.entryId,
    schedule: req.params.id,
  });
  if (!entry) return res.status(404).json({ message: 'Entry not found' });
  res.json({ message: 'Entry removed' });
});

router.post('/:id/entries/upload', upload.single('file'), async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id).populate('department');
    if (!schedule) return res.status(404).json({ message: 'Schedule not found' });
    if (!req.file) return res.status(400).json({ message: 'CSV file is required' });

    const text = req.file.buffer.toString('utf8');
    const rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    if (!rows.length) return res.status(400).json({ message: 'CSV is empty' });

    const created = [];
    const errors = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const line = i + 2;
      try {
        const date = parseDate(row.date || row.Date);
        const memberEmail = (row.email || row.Email || '').toLowerCase();
        const memberName = row.member || row.Member || row.name || row.Name;
        const roleLabel =
          row.assignment || row.Assignment || row.role || row.Role || row.roleLabel || 'Serve';
        const notes = row.notes || row.Notes || '';

        if (!memberEmail && !memberName) {
          errors.push(`Row ${line}: Missing person — each row needs a name or email.`);
          continue;
        }

        if (!date) {
          const rawDate = row.date || row.Date || '';
          errors.push(
            rawDate
              ? `Row ${line}: “${rawDate}” is not a valid date — use YYYY-MM-DD (e.g. 2026-08-15).`
              : `Row ${line}: Missing date — each row needs a service date.`
          );
          continue;
        }

        let member = null;
        if (memberEmail) member = await Member.findOne({ email: memberEmail });
        if (!member && memberName) {
          member = await Member.findOne({
            name: new RegExp(`^${memberName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
          });
        }
        if (!member) {
          if (!memberEmail) {
            errors.push(
              `Row ${line}: “${memberName}” is not in People — add them under People first, or include their email in the CSV.`
            );
            continue;
          }
          member = await Member.create({
            name: memberName || memberEmail.split('@')[0],
            email: memberEmail,
            department: schedule.department._id,
            phone: row.phone || row.Phone || '',
          });
        }

        const entry = await createEntry(schedule._id, {
          member: member._id,
          date,
          roleLabel,
          notes,
        });
        created.push(entry._id);
      } catch (err) {
        errors.push(`Row ${line}: ${friendlyErrorMessage(err)}`);
      }
    }

    const entries = await ScheduleEntry.find({ _id: { $in: created } })
      .populate('member', 'name email phone')
      .sort({ date: 1 });

    res.status(201).json({ created: entries.length, errors, entries });
  } catch (err) {
    res.status(400).json({ message: friendlyErrorMessage(err) });
  }
});

export default router;
