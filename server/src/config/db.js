import mongoose from 'mongoose';
import Member from '../models/Member.js';

export async function connectDB(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  try {
    await Member.collection.dropIndex('email_1_department_1');
  } catch {
    // Index may already be gone on fresh databases
  }
  await Member.syncIndexes();
  console.log('MongoDB connected');
}
