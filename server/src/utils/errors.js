/**
 * Turn common Mongo / Mongoose errors into short UI messages.
 */
export function friendlyErrorMessage(err, fallback = 'Something went wrong') {
  if (!err) return fallback;

  // Duplicate key (unique index)
  if (err.code === 11000 || err.code === 11001) {
    const key = Object.keys(err.keyPattern || err.keyValue || {})[0];
    if (key === 'email') {
      const email = err.keyValue?.email;
      return email
        ? `A person with the email “${email}” already exists.`
        : 'A person with this email already exists.';
    }
    if (key === 'name') {
      return 'A record with this name already exists.';
    }
    return 'This record already exists.';
  }

  // Mongoose validation
  if (err.name === 'ValidationError' && err.errors) {
    const first = Object.values(err.errors)[0];
    if (first?.message) return first.message;
  }

  const msg = String(err.message || '');
  if (/E11000|duplicate key/i.test(msg)) {
    if (/email/i.test(msg)) {
      return 'A person with this email already exists.';
    }
    return 'This record already exists.';
  }

  return msg || fallback;
}
