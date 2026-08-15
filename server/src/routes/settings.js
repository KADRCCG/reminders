import express from 'express';
import { protect, loadUser } from '../middleware/auth.js';
import {
  getCelebrationAdminContacts,
  setCelebrationAdminContacts,
} from '../utils/appSettings.js';

const router = express.Router();
router.use(protect, loadUser);

router.get('/', async (_req, res) => {
  const adminContacts = await getCelebrationAdminContacts();
  res.json({
    adminContacts,
    adminContactsConfigured: adminContacts.length > 0,
    adminContactCount: adminContacts.length,
  });
});

router.put('/admin-contacts', async (req, res) => {
  try {
    const contacts = await setCelebrationAdminContacts(req.body.adminContacts);
    res.json({
      adminContacts: contacts,
      adminContactsConfigured: contacts.length > 0,
      adminContactCount: contacts.length,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
