import Member from '../models/Member.js';

/** Allow many people without email — sparse unique index only applies when email is set. */
export async function ensureMemberEmailIndex() {
  await Member.updateMany(
    { $or: [{ email: '' }, { email: null }] },
    { $unset: { email: '' } }
  );

  try {
    await Member.collection.dropIndex('email_1');
  } catch {
    // Old index name or already dropped
  }

  await Member.syncIndexes();
}
