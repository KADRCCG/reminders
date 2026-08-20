import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    departments: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
      default: () => [],
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
    reminderDaysBefore: {
      type: [Number],
      default: undefined,
      validate: {
        validator(values) {
          if (values == null || !values.length) return true;
          return values.every((value) => Number.isInteger(value) && value >= 0 && value <= 30);
        },
        message: 'Reminder days must be between 0 and 30',
      },
    },
    reminderWeekdays: {
      type: [Number],
      default: () => [],
      validate: {
        validator(values) {
          if (!values?.length) return true;
          return values.every((value) => Number.isInteger(value) && value >= 0 && value <= 6);
        },
        message: 'Weekdays must be 0 (Sun) through 6 (Sat)',
      },
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

scheduleSchema.index({ departments: 1, active: 1 });

export default mongoose.model('Schedule', scheduleSchema);
