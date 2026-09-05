function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) {
    console.error(err);
  }
  const message = err.status ? err.message : 'Internal server error';
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
