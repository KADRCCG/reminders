import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: null },
    phone: { type: String, default: '', trim: true },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    birthdayMonth: { type: Number, min: 1, max: 12, default: null },
    birthdayDay: { type: Number, min: 1, max: 31, default: null },
    birthdayYear: { type: Number, min: 1900, max: 2100, default: null },
    spouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      default: null,
    },
    anniversaryMonth: { type: Number, min: 1, max: 12, default: null },
    anniversaryDay: { type: Number, min: 1, max: 31, default: null },
    anniversaryYear: { type: Number, min: 1900, max: 2100, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

memberSchema.index({ email: 1 }, { unique: true, sparse: true });

export default mongoose.model('Member', memberSchema);
