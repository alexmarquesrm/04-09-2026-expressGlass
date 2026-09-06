const pool = require('../db/pool');
const boardMembersService = require('./boardMembers.service');

const SELECT_WITH_ASSIGNEE = `
  SELECT bt.*, u.name AS assignee_name
  FROM board_tasks bt
  LEFT JOIN users u ON u.id = bt.assignee_id
`;

function throwIfInvalidAssignee(err) {
  if (err.code === '23503' && err.constraint && err.constraint.includes('assignee_id')) {
    const badRef = new Error('assignee_id does not reference an existing user');
    badRef.status = 400;
    throw badRef;
  }
  throw err;
}

async function assertAssigneeIsBoardMember(boardId, assigneeId) {
  if (!assigneeId) return;
  const membership = await boardMembersService.getMembership(boardId, assigneeId);
  if (!membership) {
    const err = new Error('assignee_id must be a member of this board');
    err.status = 400;
    throw err;
  }
}

async function listBoardTasks(boardId) {
  const { rows } = await pool.query(
    `${SELECT_WITH_ASSIGNEE} WHERE bt.board_id = $1 ORDER BY bt.status, bt.position, bt.created_at`,
    [boardId]
  );
  return rows;
}

async function createBoardTask(boardId, { title, description, due_date, priority, tags, status, assignee_id }) {
  await assertAssigneeIsBoardMember(boardId, assignee_id);
  try {
    const { rows } = await pool.query(
      `INSERT INTO board_tasks (board_id, title, description, due_date, priority, tags, status, assignee_id, position)
       VALUES (
         $1, $2, $3, $4, COALESCE($5::task_priority, 'medium'), COALESCE($6::text[], '{}'), COALESCE($7::task_status, 'pending'), $8,
         (SELECT COALESCE(MAX(position), -10) + 10 FROM board_tasks WHERE board_id = $1 AND status = COALESCE($7::task_status, 'pending'))
       )
       RETURNING id`,
      [boardId, title, description || null, due_date || null, priority || null, tags || null, status || null, assignee_id || null]
    );
    return getBoardTask(boardId, rows[0].id);
  } catch (err) {
    throwIfInvalidAssignee(err);
  }
}

async function getBoardTask(boardId, id) {
  const { rows } = await pool.query(`${SELECT_WITH_ASSIGNEE} WHERE bt.id = $1 AND bt.board_id = $2`, [id, boardId]);
  return rows[0] || null;
}

async function updateBoardTask(boardId, id, fields) {
  const allowed = ['title', 'description', 'status', 'priority', 'due_date', 'tags', 'position', 'assignee_id'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return getBoardTask(boardId, id);

  if (keys.includes('assignee_id')) {
    await assertAssigneeIsBoardMember(boardId, fields.assignee_id);
  }

  const setClauses = keys.map((key, i) => `${key} = $${i + 3}`);
  setClauses.push('updated_at = now()');
  const values = keys.map((key) => fields[key]);

  try {
    const { rows } = await pool.query(
      `UPDATE board_tasks SET ${setClauses.join(', ')} WHERE id = $1 AND board_id = $2 RETURNING id`,
      [id, boardId, ...values]
    );
    if (rows.length === 0) return null;
    return getBoardTask(boardId, id);
  } catch (err) {
    throwIfInvalidAssignee(err);
  }
}

async function deleteBoardTask(boardId, id) {
  const { rowCount } = await pool.query('DELETE FROM board_tasks WHERE id = $1 AND board_id = $2', [id, boardId]);
  return rowCount > 0;
}

module.exports = { listBoardTasks, createBoardTask, getBoardTask, updateBoardTask, deleteBoardTask };
