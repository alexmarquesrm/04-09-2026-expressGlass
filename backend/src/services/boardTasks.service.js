const pool = require('../db/pool');
const boardMembersService = require('./boardMembers.service');
const boardColumnsService = require('./boardColumns.service');

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

// A card's column is what places it on the board, so it must belong to the
// same board - otherwise a caller could park a card in someone else's column.
async function resolveColumnId(boardId, columnId) {
  if (columnId === undefined || columnId === null) {
    const fallback = await boardColumnsService.firstColumnId(boardId);
    if (!fallback) {
      const err = new Error('this board has no columns to put a task in');
      err.status = 400;
      throw err;
    }
    return fallback;
  }

  const column = await boardColumnsService.getColumn(boardId, columnId);
  if (!column) {
    const err = new Error('column_id must be a column of this board');
    err.status = 400;
    throw err;
  }
  return column.id;
}

async function listBoardTasks(boardId) {
  const { rows } = await pool.query(
    `SELECT bt.*, u.name AS assignee_name, bc.name AS column_name
     FROM board_tasks bt
     LEFT JOIN users u ON u.id = bt.assignee_id
     JOIN board_columns bc ON bc.id = bt.column_id
     WHERE bt.board_id = $1
     ORDER BY bc.position, bc.id, bt.position, bt.created_at`,
    [boardId]
  );
  return rows;
}

async function createBoardTask(boardId, { title, description, due_date, priority, tags, status, assignee_id, column_id }) {
  await assertAssigneeIsBoardMember(boardId, assignee_id);
  const columnId = await resolveColumnId(boardId, column_id);
  try {
    const { rows } = await pool.query(
      `INSERT INTO board_tasks (board_id, title, description, due_date, priority, tags, status, assignee_id, column_id, position)
       VALUES (
         $1, $2, $3, $4, COALESCE($5::task_priority, 'medium'), COALESCE($6::text[], '{}'), COALESCE($7::task_status, 'pending'), $8, $9,
         (SELECT COALESCE(MAX(position), -10) + 10 FROM board_tasks WHERE column_id = $9)
       )
       RETURNING id`,
      [boardId, title, description || null, due_date || null, priority || null, tags || null, status || null, assignee_id || null, columnId]
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
  const allowed = ['title', 'description', 'status', 'priority', 'due_date', 'tags', 'position', 'assignee_id', 'column_id'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return getBoardTask(boardId, id);

  if (keys.includes('assignee_id')) {
    await assertAssigneeIsBoardMember(boardId, fields.assignee_id);
  }

  // Resolve rather than only validate, so column_id can never be written back
  // as NULL (the column is NOT NULL - a card always lives somewhere).
  const resolved = { ...fields };
  if (keys.includes('column_id')) {
    resolved.column_id = await resolveColumnId(boardId, fields.column_id);

    // A move with no explicit position would otherwise keep the position it had
    // in its old column, colliding with whatever is already sitting there. The
    // web UI always sends positions; the assistant moves by column alone.
    if (!keys.includes('position')) {
      const existing = await getBoardTask(boardId, id);
      if (existing && existing.column_id !== resolved.column_id) {
        const { rows } = await pool.query(
          'SELECT COALESCE(MAX(position), -10) + 10 AS next FROM board_tasks WHERE column_id = $1',
          [resolved.column_id]
        );
        keys.push('position');
        resolved.position = rows[0].next;
      }
    }
  }

  const setClauses = keys.map((key, i) => `${key} = $${i + 3}`);
  setClauses.push('updated_at = now()');
  const values = keys.map((key) => resolved[key]);

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
