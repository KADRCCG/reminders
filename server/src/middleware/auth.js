import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export function protect(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }
}

export async function loadUser(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.currentUser = user;
    next();
  } catch {
    return res.status(500).json({ message: 'Failed to load user' });
  }
}
