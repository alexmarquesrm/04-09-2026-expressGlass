const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const TOKEN_TTL = '7d';
const PASSWORD_SALT_ROUNDS = 10;

async function createUser({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at, updated_at',
      [name, email.toLowerCase(), passwordHash]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      const conflict = new Error('email is already registered');
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  }
}

async function findUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  return rows[0] || null;
}

async function findUserById(id) {
  const { rows } = await pool.query('SELECT id, name, email, created_at, updated_at FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.password_hash);
}

function signToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { createUser, findUserByEmail, findUserById, verifyPassword, signToken, verifyToken };
