import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import Assignment from '../models/Assignment.js';
import Department from '../models/Department.js';
import Member from '../models/Member.js';
import { protect } from '../middleware/auth.js';
import { ensureAssignmentLabel } from '../utils/assignmentLabels.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
router.use(protect);

function parseDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(12, 0, 0, 0);
  return d;
}

router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.department) filter.department = req.query.department;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = parseDate(req.query.from);
    if (req.query.to) filter.date.$lte = parseDate(req.query.to);
  }

  const assignments = await Assignment.find(filter)
    .populate('member', 'name email phone')
    .populate('department', 'name reminderDaysBefore')
    .sort({ date: 1 });
  res.json(assignments);
});

router.post('/', async (req, res) => {
  try {
    const { department, member, date, roleLabel, notes } = req.body;
    const parsed = parseDate(date);
    if (!parsed) return res.status(400).json({ message: 'Invalid date' });

    const label = await ensureAssignmentLabel(roleLabel || 'Serve');
    const assignment = await Assignment.create({
      department,
      member,
      date: parsed,
      roleLabel: label?.name || roleLabel || 'Serve',
      notes,
    });
    const populated = await Assignment.findById(assignment._id)
      .populate('member', 'name email phone')
      .populate('department', 'name reminderDaysBefore');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
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
      const date = parseDate(row.date || row.Date);
      const departmentName = row.department || row.Department;
      const memberEmail = (row.email || row.Email || row.memberEmail || '').toLowerCase();
      const memberName = row.member || row.Member || row.name || row.Name;
      const roleLabel =
        row.assignment ||
        row.Assignment ||
        row.role ||
        row.Role ||
        row.roleLabel ||
        'Serve';
      const notes = row.notes || row.Notes || '';

      if (!date || !departmentName || (!memberEmail && !memberName)) {
        errors.push(`Line ${line}: need date, department, and member email or name`);
        continue;
      }

      let department = await Department.findOne({
        name: new RegExp(`^${departmentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      });
      if (!department) {
        department = await Department.create({ name: departmentName });
      }

      let member = null;
      if (memberEmail) {
        member = await Member.findOne({ email: memberEmail });
      }
      if (!member && memberName) {
        member = await Member.findOne({
          name: new RegExp(`^${memberName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        });
      }
      if (!member) {
        if (!memberEmail) {
          errors.push(`Line ${line}: member not found and no email to create`);
          continue;
        }
        member = await Member.create({
          name: memberName || memberEmail.split('@')[0],
          email: memberEmail,
          department: department._id,
          phone: row.phone || row.Phone || '',
        });
      } else if (!member.department) {
        member.department = department._id;
        await member.save();
      }

      const label = await ensureAssignmentLabel(roleLabel);
      const assignment = await Assignment.create({
        department: department._id,
        member: member._id,
        date,
        roleLabel: label?.name || roleLabel,
        notes,
      });
      created.push(assignment._id);
    }

    const assignments = await Assignment.find({ _id: { $in: created } })
      .populate('member', 'name email phone')
      .populate('department', 'name reminderDaysBefore')
      .sort({ date: 1 });

    res.status(201).json({
      created: assignments.length,
      errors,
      assignments,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { department, member, date, roleLabel, notes } = req.body;
    const parsed = parseDate(date);
    if (!parsed) return res.status(400).json({ message: 'Invalid date' });

    const label = await ensureAssignmentLabel(roleLabel || 'Serve');
    const assignment = await Assignment.findByIdAndUpdate(
      req.params.id,
      {
        department,
        member,
        date: parsed,
        roleLabel: label?.name || roleLabel || 'Serve',
        notes,
      },
      { new: true, runValidators: true }
    )
      .populate('member', 'name email phone')
      .populate('department', 'name reminderDaysBefore');

    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    res.json(assignment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const assignment = await Assignment.findByIdAndDelete(req.params.id);
  if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
  res.json({ message: 'Assignment deleted' });
});

export default router;
