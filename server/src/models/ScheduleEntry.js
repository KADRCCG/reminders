import mongoose from 'mongoose';

const scheduleEntrySchema = new mongoose.Schema(
  {
    schedule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Schedule',
      required: true,
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
    },
    date: { type: Date, required: true },
    roleLabel: { type: String, default: 'Serve', trim: true },
    notes: { type: String, default: '', trim: true },
    reminderSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

scheduleEntrySchema.index({ schedule: 1, date: 1 });
scheduleEntrySchema.index({ date: 1, reminderSentAt: 1 });
scheduleEntrySchema.index({ member: 1, date: 1 });

export default mongoose.model('ScheduleEntry', scheduleEntrySchema);
