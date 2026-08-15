import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import Member from '../models/Member.js';
import Department from '../models/Department.js';
import { protect } from '../middleware/auth.js';
import {
  clearSpouseOnDelete,
  normalizeMemberPayload,
  syncSpouseLink,
} from '../utils/memberLinks.js';
import { friendlyErrorMessage } from '../utils/errors.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
router.use(protect);

const populateFields = [
  { path: 'department', select: 'name' },
  {
    path: 'spouse',
    select:
      'name email phone birthdayMonth birthdayDay birthdayYear anniversaryMonth anniversaryDay anniversaryYear',
  },
];

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return String(row[key]).trim();
    }
  }
  return '';
}

async function findOrCreateDepartment(name) {
  if (!name) return null;
  let department = await Department.findOne({
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  });
  if (!department) {
    department = await Department.create({ name });
  }
  return department;
}

router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.department) filter.department = req.query.department;
  const members = await Member.find(filter).populate(populateFields).sort({ name: 1 });
  res.json(members);
});

router.post('/', async (req, res) => {
  try {
    const payload = normalizeMemberPayload(req.body);
    if (!payload.name || !payload.email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    const spouseId = payload.spouse;
    payload.spouse = null;

    let member = await Member.create(payload);
    if (spouseId) {
      member.spouse = spouseId;
      member.anniversaryMonth = payload.anniversaryMonth;
      member.anniversaryDay = payload.anniversaryDay;
      member.anniversaryYear = payload.anniversaryYear;
      member = await syncSpouseLink(member, null);
    }

    const populated = await Member.findById(member._id).populate(populateFields);
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: friendlyErrorMessage(err) });
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

    const pendingSpouses = [];
    const createdIds = [];
    const updatedIds = [];
    const errors = [];

    // Pass 1: create/update people (spouse linked in pass 2)
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const line = i + 2;

      try {
        const name = pick(row, ['name', 'Name']);
        const email = pick(row, ['email', 'Email']).toLowerCase();
        const phone = pick(row, ['phone', 'Phone']);
        const departmentName = pick(row, ['department', 'Department']);
        const spouseEmail = pick(row, ['spouseEmail', 'SpouseEmail', 'spouse', 'Spouse']).toLowerCase();

        if (!name || !email || !phone) {
          errors.push(`Line ${line}: name, email, and phone are required`);
          continue;
        }

        const department = await findOrCreateDepartment(departmentName);

        const payload = normalizeMemberPayload({
          name,
          email,
          phone,
          department: department?._id || null,
          birthdayMonth: pick(row, ['birthdayMonth', 'BirthdayMonth']),
          birthdayDay: pick(row, ['birthdayDay', 'BirthdayDay']),
          birthdayYear: pick(row, ['birthdayYear', 'BirthdayYear']),
          birthday: pick(row, ['birthday', 'Birthday']),
          anniversaryMonth: pick(row, ['anniversaryMonth', 'AnniversaryMonth']),
          anniversaryDay: pick(row, ['anniversaryDay', 'AnniversaryDay']),
          anniversaryYear: pick(row, ['anniversaryYear', 'AnniversaryYear']),
          weddingAnniversary: pick(row, ['anniversary', 'Anniversary', 'weddingAnniversary']),
        });

        let member = await Member.findOne({ email });
        if (member) {
          const previousSpouseId = member.spouse;
          member.name = payload.name;
          member.phone = payload.phone;
          member.department = payload.department;
          member.birthdayMonth = payload.birthdayMonth;
          member.birthdayDay = payload.birthdayDay;
          member.birthdayYear = payload.birthdayYear;
          member.anniversaryMonth = payload.anniversaryMonth;
          member.anniversaryDay = payload.anniversaryDay;
          member.anniversaryYear = payload.anniversaryYear;
          // Keep existing spouse unless pass 2 changes it
          await member.save();
          if (!spouseEmail && previousSpouseId) {
            // leave spouse as-is when CSV omits spouseEmail
          }
          updatedIds.push(member._id);
        } else {
          member = await Member.create({
            ...payload,
            spouse: null,
          });
          createdIds.push(member._id);
        }

        if (spouseEmail) {
          pendingSpouses.push({
            memberId: member._id,
            spouseEmail,
            anniversaryMonth: payload.anniversaryMonth,
            anniversaryDay: payload.anniversaryDay,
            anniversaryYear: payload.anniversaryYear,
            line,
          });
        }
      } catch (err) {
        errors.push(`Line ${line}: ${friendlyErrorMessage(err)}`);
      }
    }

    // Pass 2: link spouses by email
    for (const item of pendingSpouses) {
      try {
        if (item.spouseEmail.includes('@') === false && !item.spouseEmail.includes('.')) {
          // allow spouse name lookup as fallback
        }

        let spouse = null;
        if (item.spouseEmail.includes('@')) {
          spouse = await Member.findOne({ email: item.spouseEmail });
        } else {
          spouse = await Member.findOne({
            name: new RegExp(
              `^${item.spouseEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
              'i'
            ),
          });
        }

        if (!spouse) {
          errors.push(`Line ${item.line}: spouse not found (${item.spouseEmail})`);
          continue;
        }

        const member = await Member.findById(item.memberId);
        if (!member) continue;

        const previousSpouseId = member.spouse;
        member.spouse = spouse._id;
        member.anniversaryMonth = item.anniversaryMonth ?? member.anniversaryMonth;
        member.anniversaryDay = item.anniversaryDay ?? member.anniversaryDay;
        member.anniversaryYear = item.anniversaryYear ?? member.anniversaryYear;
        await syncSpouseLink(member, previousSpouseId);
      } catch (err) {
        errors.push(`Line ${item.line}: spouse link failed — ${friendlyErrorMessage(err)}`);
      }
    }

    const members = await Member.find({
      _id: { $in: [...createdIds, ...updatedIds] },
    })
      .populate(populateFields)
      .sort({ name: 1 });

    res.status(201).json({
      created: createdIds.length,
      updated: updatedIds.length,
      errors,
      members,
    });
  } catch (err) {
    res.status(400).json({ message: friendlyErrorMessage(err) });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await Member.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Member not found' });

    const previousSpouseId = existing.spouse;
    const payload = normalizeMemberPayload(req.body);

    existing.name = payload.name ?? existing.name;
    existing.email = payload.email ?? existing.email;
    existing.phone = payload.phone ?? existing.phone;
    existing.department = payload.department;
    existing.birthdayMonth = payload.birthdayMonth;
    existing.birthdayDay = payload.birthdayDay;
    existing.birthdayYear = payload.birthdayYear;
    existing.anniversaryMonth = payload.anniversaryMonth;
    existing.anniversaryDay = payload.anniversaryDay;
    existing.anniversaryYear = payload.anniversaryYear;
    if (payload.active !== undefined) existing.active = payload.active;
    existing.spouse = payload.spouse;

    const member = await syncSpouseLink(existing, previousSpouseId);
    const populated = await Member.findById(member._id).populate(populateFields);
    res.json(populated);
  } catch (err) {
    res.status(400).json({ message: friendlyErrorMessage(err) });
  }
});

router.delete('/:id', async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) return res.status(404).json({ message: 'Member not found' });
  await clearSpouseOnDelete(member);
  await member.deleteOne();
  res.json({ message: 'Member deleted' });
});

export default router;
