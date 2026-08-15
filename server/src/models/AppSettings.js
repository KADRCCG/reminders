import mongoose from 'mongoose';

const appSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'app', unique: true },
    celebrationAdminContacts: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model('AppSettings', appSettingsSchema);
