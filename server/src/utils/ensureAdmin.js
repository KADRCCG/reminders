import User from '../models/User.js';

export function getAdminCredentialsFromEnv() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  const name = String(process.env.ADMIN_NAME || 'Admin').trim() || 'Admin';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in server/.env');
  }
  if (password.length < 6) {
    throw new Error('ADMIN_PASSWORD must be at least 6 characters');
  }

  return { name, email, password };
}

/**
 * Create or update the single admin account from .env credentials.
 */
export async function ensureAdminFromEnv() {
  const { name, email, password } = getAdminCredentialsFromEnv();

  let user = await User.findOne({ email });
  if (!user) {
    // Prefer updating the only existing admin if email changed in .env
    const count = await User.countDocuments();
    if (count === 1) {
      user = await User.findOne();
    }
  }

  if (!user) {
    user = await User.create({
      name,
      email,
      password,
      role: 'admin',
    });
    return { user, created: true };
  }

  user.name = name;
  user.email = email;
  user.password = password;
  user.role = user.role || 'admin';
  await user.save();
  return { user, created: false };
}
