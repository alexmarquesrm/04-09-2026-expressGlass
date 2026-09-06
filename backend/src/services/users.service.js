const pool = require('../db/pool');

// Deliberately no email: this list populates assignment/membership pickers, and
// handing out every registered user's email address is not needed for that.
async function listUsers() {
  const { rows } = await pool.query('SELECT id, name FROM users ORDER BY name');
  return rows;
}

async function getUser(id) {
  const { rows } = await pool.query('SELECT id, name FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

module.exports = { listUsers, getUser };
