import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema(
  {
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
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

assignmentSchema.index({ date: 1, department: 1 });
assignmentSchema.index({ member: 1, date: 1 });

export default mongoose.model('Assignment', assignmentSchema);
