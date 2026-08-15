import mongoose from 'mongoose';

const reminderLogSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
    },
    channel: { type: String, enum: ['sms', 'console'], default: 'sms' },
    status: { type: String, enum: ['sent', 'failed', 'skipped'], required: true },
    message: { type: String, default: '' },
    error: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('ReminderLog', reminderLogSchema);
