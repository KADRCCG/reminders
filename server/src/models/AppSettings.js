import mongoose from 'mongoose';

const appSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'app', unique: true },
    celebrationAdminContacts: { type: [String], default: [] },
    lastDailyJobDate: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model('AppSettings', appSettingsSchema);
