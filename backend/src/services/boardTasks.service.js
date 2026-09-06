const pool = require('../db/pool');

async function listBoardTasks(boardId) {
  const { rows } = await pool.query(
    'SELECT * FROM board_tasks WHERE board_id = $1 ORDER BY status, position, created_at',
    [boardId]
  );
  return rows;
}

async function createBoardTask(boardId, { title, description, due_date, priority, tags, status }) {
  const { rows } = await pool.query(
    `INSERT INTO board_tasks (board_id, title, description, due_date, priority, tags, status, position)
     VALUES (
       $1, $2, $3, $4, COALESCE($5::task_priority, 'medium'), COALESCE($6::text[], '{}'), COALESCE($7::task_status, 'pending'),
       (SELECT COALESCE(MAX(position), -10) + 10 FROM board_tasks WHERE board_id = $1 AND status = COALESCE($7::task_status, 'pending'))
     )
     RETURNING *`,
    [boardId, title, description || null, due_date || null, priority || null, tags || null, status || null]
  );
  return rows[0];
}

async function getBoardTask(boardId, id) {
  const { rows } = await pool.query('SELECT * FROM board_tasks WHERE id = $1 AND board_id = $2', [id, boardId]);
  return rows[0] || null;
}

async function updateBoardTask(boardId, id, fields) {
  const allowed = ['title', 'description', 'status', 'priority', 'due_date', 'tags', 'position'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return getBoardTask(boardId, id);

  const setClauses = keys.map((key, i) => `${key} = $${i + 3}`);
  setClauses.push('updated_at = now()');
  const values = keys.map((key) => fields[key]);

  const { rows } = await pool.query(
    `UPDATE board_tasks SET ${setClauses.join(', ')} WHERE id = $1 AND board_id = $2 RETURNING *`,
    [id, boardId, ...values]
  );
  return rows[0] || null;
}

async function deleteBoardTask(boardId, id) {
  const { rowCount } = await pool.query('DELETE FROM board_tasks WHERE id = $1 AND board_id = $2', [id, boardId]);
  return rowCount > 0;
}

module.exports = { listBoardTasks, createBoardTask, getBoardTask, updateBoardTask, deleteBoardTask };
