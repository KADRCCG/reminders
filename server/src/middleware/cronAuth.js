export function cronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(503).json({
      message: 'Automatic jobs are not configured. Set CRON_SECRET on the server.',
    });
  }

  const provided = req.headers['x-cron-secret'] || req.query.secret;
  if (provided !== secret) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  next();
}
