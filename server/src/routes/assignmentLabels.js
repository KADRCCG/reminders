import express from 'express';
import AssignmentLabel from '../models/AssignmentLabel.js';
import { protect } from '../middleware/auth.js';
import { ensureAssignmentLabel } from '../utils/assignmentLabels.js';

const router = express.Router();
router.use(protect);

router.get('/', async (_req, res) => {
  const labels = await AssignmentLabel.find().sort({ name: 1 });
  res.json(labels);
});

router.post('/', async (req, res) => {
  try {
    const label = await ensureAssignmentLabel(req.body.name);
    if (!label) return res.status(400).json({ message: 'Assignment name is required' });
    res.status(201).json(label);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
