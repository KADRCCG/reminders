import express from 'express';
import MessageTemplate from '../models/MessageTemplate.js';
import { protect } from '../middleware/auth.js';
import {
  DEFAULT_TEMPLATES,
  ensureMessageTemplates,
  renderTemplate,
} from '../utils/messageTemplates.js';

const router = express.Router();
router.use(protect);

router.get('/', async (_req, res) => {
  await ensureMessageTemplates();
  const templates = await MessageTemplate.find().sort({ name: 1 });
  res.json(templates);
});

router.get('/:key', async (req, res) => {
  await ensureMessageTemplates();
  const template = await MessageTemplate.findOne({ key: req.params.key });
  if (!template) return res.status(404).json({ message: 'Template not found' });
  res.json(template);
});

router.put('/:key', async (req, res) => {
  try {
    await ensureMessageTemplates();
    const template = await MessageTemplate.findOne({ key: req.params.key });
    if (!template) return res.status(404).json({ message: 'Template not found' });

    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ message: 'Message body is required' });

    if (req.body.name != null) template.name = String(req.body.name).trim() || template.name;
    if (req.body.description != null) template.description = String(req.body.description).trim();
    template.body = body;
    await template.save();
    res.json(template);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:key/reset', async (req, res) => {
  await ensureMessageTemplates();
  const defaults = DEFAULT_TEMPLATES.find((t) => t.key === req.params.key);
  if (!defaults) return res.status(404).json({ message: 'Template not found' });

  const template = await MessageTemplate.findOneAndUpdate(
    { key: req.params.key },
    {
      name: defaults.name,
      channel: defaults.channel,
      description: defaults.description,
      placeholders: defaults.placeholders,
      body: defaults.body,
    },
    { new: true, upsert: true }
  );
  res.json(template);
});

router.post('/:key/preview', async (req, res) => {
  await ensureMessageTemplates();
  const template = await MessageTemplate.findOne({ key: req.params.key });
  if (!template) return res.status(404).json({ message: 'Template not found' });

  const sample = {
    name: 'Ada Okonkwo',
    names: 'Grace & Samuel',
    department: 'Sunday School',
    date: 'Sunday, August 16, 2026',
    date_label: '16 August',
    assignment: 'Teach',
    notes_line: 'Notes: Lesson — Faith.',
    years_line: ' Celebrating 5 years of marriage.',
    ...(req.body?.vars || {}),
  };

  const body = req.body?.body != null ? String(req.body.body) : template.body;
  res.json({ preview: renderTemplate(body, sample) });
});

export default router;
