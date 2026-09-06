const pool = require('../db/pool');
const boardColumnsService = require('./boardColumns.service');

async function createBoard({ name }, ownerId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('INSERT INTO boards (name) VALUES ($1) RETURNING *', [name]);
    const board = rows[0];
    await client.query('INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)', [board.id, ownerId, 'owner']);
    await boardColumnsService.createDefaultColumns(client, board.id);
    await client.query('COMMIT');
    return board;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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

module.exports = { createBoard, getBoard, updateBoard, deleteBoard };
