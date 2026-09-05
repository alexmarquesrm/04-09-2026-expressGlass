const pool = require('../db/pool');

async function listTasks(filter) {
  if (filter === 'pending' || filter === 'completed') {
    const { rows } = await pool.query('SELECT * FROM tasks WHERE status = $1 ORDER BY created_at DESC', [filter]);
    return rows;
  }
  const { rows } = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
  return rows;
}

async function createTask({ title, description, due_date, priority, tags }) {
  const { rows } = await pool.query(
    `INSERT INTO tasks (title, description, due_date, priority, tags)
     VALUES ($1, $2, $3, COALESCE($4::task_priority, 'medium'), COALESCE($5::text[], '{}'))
     RETURNING *`,
    [title, description || null, due_date || null, priority || null, tags || null]
  );
  return rows[0];
}

async function getTask(id) {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  return rows[0] || null;
}

async function updateTask(id, fields) {
  const allowed = ['title', 'description', 'status', 'priority', 'due_date', 'tags'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return getTask(id);

  const setClauses = keys.map((key, i) => `${key} = $${i + 2}`);
  setClauses.push('updated_at = now()');
  const values = keys.map((key) => fields[key]);

  const { rows } = await pool.query(
    `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return rows[0] || null;
}

async function deleteTask(id) {
  const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
  return rowCount > 0;
}

module.exports = { listTasks, createTask, getTask, updateTask, deleteTask };
