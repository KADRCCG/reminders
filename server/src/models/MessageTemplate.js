import mongoose from 'mongoose';

const messageTemplateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    kind: { type: String, enum: ['system', 'custom'], default: 'custom' },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    body: { type: String, required: true },
    placeholders: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.model('MessageTemplate', messageTemplateSchema);
