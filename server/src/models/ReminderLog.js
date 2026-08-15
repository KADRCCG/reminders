import mongoose from 'mongoose';

const reminderLogSchema = new mongoose.Schema(
  {
    scheduleEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScheduleEntry',
      default: null,
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      default: null,
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
    },
    channel: { type: String, enum: ['sms', 'whatsapp', 'console'], default: 'sms' },
    status: { type: String, enum: ['sent', 'failed', 'skipped'], required: true },
    message: { type: String, default: '' },
    error: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('ReminderLog', reminderLogSchema);
