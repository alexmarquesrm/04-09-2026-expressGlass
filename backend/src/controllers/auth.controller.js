const authService = require('../services/auth.service');
const { validateRegisterFields, validateLoginFields } = require('../utils/validation');

const COOKIE_NAME = 'token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function sanitizeUser(user) {
  return { id: user.id, name: user.name, email: user.email, created_at: user.created_at };
}

async function register(req, res, next) {
  try {
    validateRegisterFields(req.body);
    const existing = await authService.findUserByEmail(req.body.email);
    if (existing) {
      const err = new Error('email is already registered');
      err.status = 409;
      throw err;
    }
    const user = await authService.createUser(req.body);
    const token = authService.signToken(user);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    res.status(201).json(sanitizeUser(user));
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    validateLoginFields(req.body);
    const user = await authService.findUserByEmail(req.body.email);
    const valid = user && (await authService.verifyPassword(user, req.body.password));
    if (!valid) {
      const err = new Error('invalid email or password');
      err.status = 401;
      throw err;
    }
    const token = authService.signToken(user);
    res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
    res.json(sanitizeUser(user));
  } catch (err) {
    next(err);
  }
}

function logout(req, res) {
  const { maxAge, ...clearOptions } = COOKIE_OPTIONS;
  res.clearCookie(COOKIE_NAME, clearOptions);
  res.status(204).send();
}

function me(req, res) {
  res.json(sanitizeUser(req.user));
}

module.exports = { register, login, logout, me };
