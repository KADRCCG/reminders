import 'dotenv/config';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Member from '../models/Member.js';
import Schedule from '../models/Schedule.js';
import ScheduleEntry from '../models/ScheduleEntry.js';
import AssignmentLabel from '../models/AssignmentLabel.js';
import ReminderLog from '../models/ReminderLog.js';
import CelebrationLog from '../models/CelebrationLog.js';
import MessageTemplate from '../models/MessageTemplate.js';
import { syncSpouseLink } from './memberLinks.js';
import { ensureAssignmentLabel } from './assignmentLabels.js';
import { ensureAdminFromEnv, getAdminCredentialsFromEnv } from './ensureAdmin.js';
import { ensureMessageTemplates } from './messageTemplates.js';

function atNoon(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

async function seed() {
  await connectDB(process.env.MONGODB_URI);

  await Promise.all([
    User.deleteMany({}),
    Department.deleteMany({}),
    Member.deleteMany({}),
    ScheduleEntry.deleteMany({}),
    Schedule.deleteMany({}),
    AssignmentLabel.deleteMany({}),
    ReminderLog.deleteMany({}),
    CelebrationLog.deleteMany({}),
    MessageTemplate.deleteMany({}),
  ]);

  await ensureMessageTemplates();

  const { email } = getAdminCredentialsFromEnv();
  const { user: pastor } = await ensureAdminFromEnv();

  const sundaySchool = await Department.create({
    name: 'Sunday School',
    description: 'Children and adult Bible class teachers',
    reminderDaysBefore: 2,
  });
  const ushers = await Department.create({
    name: 'Ushers',
    description: 'Greeting and seating ministry',
    reminderDaysBefore: 1,
  });
  const choir = await Department.create({
    name: 'Choir',
    description: 'Worship team and choir',
    reminderDaysBefore: 2,
  });

  const today = atNoon(new Date());

  const ada = await Member.create({
    name: 'Ada Okonkwo',
    email: 'ada@example.com',
    phone: '08030000001',
    departments: [sundaySchool._id],
    birthdayMonth: today.getMonth() + 1,
    birthdayDay: today.getDate(),
    birthdayYear: null,
  });

  const chidi = await Member.create({
    name: 'Chidi Nwosu',
    email: 'chidi@example.com',
    phone: '08030000002',
    departments: [sundaySchool._id],
    birthdayMonth: 3,
    birthdayDay: 12,
    birthdayYear: 1990,
  });

  const grace = await Member.create({
    name: 'Grace Bello',
    email: 'grace@example.com',
    phone: '08030000003',
    departments: [ushers._id],
    birthdayMonth: 11,
    birthdayDay: 2,
    birthdayYear: null,
  });

  const samuel = await Member.create({
    name: 'Samuel Ade',
    email: 'samuel@example.com',
    phone: '08030000004',
    departments: [choir._id],
    birthdayMonth: 7,
    birthdayDay: 19,
    birthdayYear: 1988,
  });

  grace.spouse = samuel._id;
  grace.anniversaryMonth = today.getMonth() + 1;
  grace.anniversaryDay = today.getDate();
  grace.anniversaryYear = null;
  await syncSpouseLink(grace, null);

  const nextSunday = new Date();
  nextSunday.setDate(nextSunday.getDate() + ((7 - nextSunday.getDay()) % 7 || 7));
  nextSunday.setHours(12, 0, 0, 0);

  const inTwoDays = new Date();
  inTwoDays.setDate(inTwoDays.getDate() + 2);
  inTwoDays.setHours(12, 0, 0, 0);

  await Promise.all([
    ensureAssignmentLabel('Teach'),
    ensureAssignmentLabel('Lead Usher'),
    ensureAssignmentLabel('Lead Vocal'),
    ensureAssignmentLabel('Serve'),
  ]);

  const defaultTemplate = await MessageTemplate.findOne({ key: 'schedule_reminder' });

  const ssSchedule = await Schedule.create({
    name: 'Q3 Sunday School',
    departments: [sundaySchool._id],
    messageTemplate: defaultTemplate._id,
    notes: 'Quarterly teacher roster',
  });

  const usherSchedule = await Schedule.create({
    name: 'August Ushers',
    departments: [ushers._id],
    messageTemplate: defaultTemplate._id,
  });

  const choirSchedule = await Schedule.create({
    name: 'August Choir',
    departments: [choir._id],
    messageTemplate: defaultTemplate._id,
  });

  await ScheduleEntry.insertMany([
    {
      schedule: ssSchedule._id,
      member: ada._id,
      date: inTwoDays,
      roleLabel: 'Teach',
      notes: 'Lesson: The Good Samaritan',
    },
    {
      schedule: ssSchedule._id,
      member: chidi._id,
      date: nextSunday,
      roleLabel: 'Teach',
      notes: 'Lesson: Faith and Works',
    },
    {
      schedule: usherSchedule._id,
      member: grace._id,
      date: nextSunday,
      roleLabel: 'Lead Usher',
    },
    {
      schedule: choirSchedule._id,
      member: samuel._id,
      date: nextSunday,
      roleLabel: 'Lead Vocal',
    },
  ]);

  console.log('Seed complete');
  console.log(`Login: ${email} (password from ADMIN_PASSWORD in .env)`);
  console.log(`Admin id: ${pastor._id}`);
  console.log(`Today's demo birthday: ${ada.name}`);
  console.log(`Today's demo anniversary: ${grace.name} & ${samuel.name}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
