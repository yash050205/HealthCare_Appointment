// Centralized error handler so unexpected failures never crash the process
// and always return a consistent JSON shape.
function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err);

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'A record with these details already exists' });
  }
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
}

module.exports = errorHandler;
