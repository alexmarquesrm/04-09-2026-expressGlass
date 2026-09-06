const authService = require('../services/auth.service');

async function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) {
    const err = new Error('authentication required');
    err.status = 401;
    return next(err);
  }

  try {
    const payload = authService.verifyToken(token);
    const user = await authService.findUserById(payload.sub);
    if (!user) {
      const err = new Error('authentication required');
      err.status = 401;
      return next(err);
    }
    req.user = user;
    next();
  } catch {
    const err = new Error('authentication required');
    err.status = 401;
    next(err);
  }
}

module.exports = requireAuth;
