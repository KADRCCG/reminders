import mongoose from 'mongoose';

const messageTemplateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      enum: [
        'schedule_reminder',
        'birthday',
        'anniversary',
        'celebration_announce_birthday',
        'celebration_announce_anniversary',
      ],
    },
    name: { type: String, required: true, trim: true },
    channel: { type: String, enum: ['sms', 'whatsapp'], required: true },
    description: { type: String, default: '', trim: true },
    body: { type: String, required: true },
    placeholders: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.model('MessageTemplate', messageTemplateSchema);
