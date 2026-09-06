const pool = require('../db/pool');

const DEFAULT_COLUMN_NAMES = ['A fazer', 'Em curso', 'Concluído'];

async function listColumns(boardId) {
  const { rows } = await pool.query(
    'SELECT * FROM board_columns WHERE board_id = $1 ORDER BY position, id',
    [boardId]
  );
  return rows;
}

async function getColumn(boardId, id) {
  const { rows } = await pool.query('SELECT * FROM board_columns WHERE id = $1 AND board_id = $2', [id, boardId]);
  return rows[0] || null;
}

// Used inside createBoard's transaction, so a board is never created without
// somewhere to put a card (board_tasks.column_id is NOT NULL).
async function createDefaultColumns(client, boardId) {
  const { rows } = await client.query(
    `INSERT INTO board_columns (board_id, name, position)
     SELECT $1, name, position
     FROM unnest($2::text[], $3::int[]) AS c(name, position)
     RETURNING *`,
    [boardId, DEFAULT_COLUMN_NAMES, DEFAULT_COLUMN_NAMES.map((_, i) => i * 10)]
  );
  return rows;
}

async function createColumn(boardId, { name, position }) {
  const { rows } = await pool.query(
    `INSERT INTO board_columns (board_id, name, position)
     VALUES ($1, $2, COALESCE($3, (SELECT COALESCE(MAX(position), -10) + 10 FROM board_columns WHERE board_id = $1)))
     RETURNING *`,
    [boardId, name.trim(), position === undefined ? null : position]
  );
  return rows[0];
}

async function updateColumn(boardId, id, fields) {
  const allowed = ['name', 'position'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return getColumn(boardId, id);

  const setClauses = keys.map((key, i) => `${key} = $${i + 3}`);
  setClauses.push('updated_at = now()');
  // Stored trimmed: validation only trims to check emptiness, so without this
  // "  Espaço  " would keep its padding forever.
  const values = keys.map((key) => (key === 'name' ? fields[key].trim() : fields[key]));

  const { rows } = await pool.query(
    `UPDATE board_columns SET ${setClauses.join(', ')} WHERE id = $1 AND board_id = $2 RETURNING *`,
    [id, boardId, ...values]
  );
  return rows[0] || null;
}

// Same locking shape as boardMembers' last-owner guard: check-then-delete on a
// "must keep at least one" invariant is a TOCTOU unless the board's column rows
// are locked for the duration.
async function withBoardColumnsLocked(boardId, run) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT 1 FROM board_columns WHERE board_id = $1 FOR UPDATE', [boardId]);
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function deleteColumnSafely(boardId, id) {
  return withBoardColumnsLocked(boardId, async (client) => {
    const { rows } = await client.query('SELECT 1 FROM board_columns WHERE id = $1 AND board_id = $2', [id, boardId]);
    if (rows.length === 0) return { ok: false, reason: 'not_found' };

    const { rows: columnCount } = await client.query(
      'SELECT count(*)::int AS count FROM board_columns WHERE board_id = $1',
      [boardId]
    );
    if (columnCount[0].count <= 1) return { ok: false, reason: 'last_column' };

    const { rows: taskCount } = await client.query(
      'SELECT count(*)::int AS count FROM board_tasks WHERE column_id = $1',
      [id]
    );
    if (taskCount[0].count > 0) return { ok: false, reason: 'not_empty' };

    await client.query('DELETE FROM board_columns WHERE id = $1', [id]);
    return { ok: true };
  });
}

async function firstColumnId(boardId) {
  const { rows } = await pool.query(
    'SELECT id FROM board_columns WHERE board_id = $1 ORDER BY position, id LIMIT 1',
    [boardId]
  );
  return rows[0] ? rows[0].id : null;
}

module.exports = {
  DEFAULT_COLUMN_NAMES,
  listColumns,
  getColumn,
  createDefaultColumns,
  createColumn,
  updateColumn,
  deleteColumnSafely,
  firstColumnId,
};
