import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '', trim: true },
    reminderDaysBefore: {
      type: Number,
      default: Number(process.env.DEFAULT_REMINDER_DAYS || 2),
      min: 0,
      max: 30,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Department', departmentSchema);
