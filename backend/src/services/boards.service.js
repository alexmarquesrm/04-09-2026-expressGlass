const pool = require('../db/pool');

async function listBoards() {
  const { rows } = await pool.query('SELECT * FROM boards ORDER BY created_at DESC');
  return rows;
}

async function createBoard({ name }) {
  const { rows } = await pool.query('INSERT INTO boards (name) VALUES ($1) RETURNING *', [name]);
  return rows[0];
}

async function getBoard(id) {
  const { rows } = await pool.query('SELECT * FROM boards WHERE id = $1', [id]);
  return rows[0] || null;
}

async function updateBoard(id, { name }) {
  if (name === undefined) return getBoard(id);
  const { rows } = await pool.query(
    'UPDATE boards SET name = $2, updated_at = now() WHERE id = $1 RETURNING *',
    [id, name]
  );
  return rows[0] || null;
}

async function deleteBoard(id) {
  const { rowCount } = await pool.query('DELETE FROM boards WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { listBoards, createBoard, getBoard, updateBoard, deleteBoard };
