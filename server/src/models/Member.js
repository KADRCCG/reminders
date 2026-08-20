import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, default: '', trim: true },
    departments: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
      default: () => [],
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

memberSchema.pre('save', function stripEmptyEmail(next) {
  if (!this.email || !String(this.email).trim()) {
    this.email = undefined;
  } else {
    this.email = String(this.email).trim().toLowerCase();
  }
  next();
});

export default mongoose.model('Member', memberSchema);
