import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    channels: {
      type: [{ type: String, enum: ['sms', 'whatsapp'] }],
      default: ['sms'],
    },
    messageTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MessageTemplate',
      default: null,
    },
    messageBody: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

scheduleSchema.index({ department: 1, active: 1 });

export default mongoose.model('Schedule', scheduleSchema);
