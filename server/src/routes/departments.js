import express from 'express';
import Department from '../models/Department.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.get('/', async (_req, res) => {
  const departments = await Department.find().sort({ name: 1 });
  res.json(departments);
});

router.post('/', async (req, res) => {
  try {
    const { name, description, reminderDaysBefore } = req.body;
    const department = await Department.create({
      name,
      description,
      reminderDaysBefore,
    });
    res.status(201).json(department);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const department = await Department.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!department) return res.status(404).json({ message: 'Department not found' });
    res.json(department);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const department = await Department.findByIdAndDelete(req.params.id);
  if (!department) return res.status(404).json({ message: 'Department not found' });
  res.json({ message: 'Department deleted' });
});

export default router;
