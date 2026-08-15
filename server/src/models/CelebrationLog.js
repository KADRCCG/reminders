import mongoose from 'mongoose';

const celebrationLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['birthday', 'wedding_anniversary'],
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member',
        required: true,
      },
    ],
    year: { type: Number, required: true },
    occurrenceDate: { type: Date, required: true },
    channel: { type: String, enum: ['whatsapp', 'console'], default: 'whatsapp' },
    status: { type: String, enum: ['sent', 'failed'], required: true },
    message: { type: String, default: '' },
    error: { type: String, default: '' },
  },
  { timestamps: true }
);

celebrationLogSchema.index({ type: 1, year: 1, members: 1 });

export default mongoose.model('CelebrationLog', celebrationLogSchema);
