const pool = require('../db/pool');

async function listUsers() {
  const { rows } = await pool.query('SELECT id, name FROM users ORDER BY name');
  return rows;
}

module.exports = { listUsers };
