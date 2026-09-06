const pool = require('../db/pool');
const boardMembersService = require('./boardMembers.service');
const boardColumnsService = require('./boardColumns.service');

// Assignees come back as an array on every card, ordered by name so the UI
// renders them consistently. COALESCE keeps it an empty array rather than
// [null] for a card nobody is on.
const ASSIGNEES_SUBQUERY = `
  COALESCE((
    SELECT json_agg(json_build_object('user_id', u.id, 'name', u.name) ORDER BY u.name)
    FROM board_task_assignees bta
    JOIN users u ON u.id = bta.user_id
    WHERE bta.task_id = bt.id
  ), '[]'::json) AS assignees
`;

async function assertAssigneesAreBoardMembers(boardId, assigneeIds) {
  if (!assigneeIds || assigneeIds.length === 0) return;
  const { rows } = await pool.query(
    'SELECT user_id FROM board_members WHERE board_id = $1 AND user_id = ANY($2::int[])',
    [boardId, assigneeIds]
  );
  const members = new Set(rows.map((r) => r.user_id));
  const outsider = assigneeIds.find((id) => !members.has(id));
  if (outsider !== undefined) {
    const err = new Error('every assignee must be a member of this board');
    err.status = 400;
    throw err;
  }
}

// Replaces the whole assignee set for a card in one statement pair, so a card
// never briefly has nobody on it while an update is in flight.
async function replaceAssignees(client, taskId, assigneeIds) {
  await client.query('DELETE FROM board_task_assignees WHERE task_id = $1', [taskId]);
  if (assigneeIds.length > 0) {
    await client.query(
      'INSERT INTO board_task_assignees (task_id, user_id) SELECT $1, unnest($2::int[])',
      [taskId, assigneeIds]
    );
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
    `SELECT bt.*, bc.name AS column_name, ${ASSIGNEES_SUBQUERY}
     FROM board_tasks bt
     JOIN board_columns bc ON bc.id = bt.column_id
     WHERE bt.board_id = $1
     ORDER BY bc.position, bc.id, bt.position, bt.created_at`,
    [boardId]
  );
  return rows;
}

async function getBoardTask(boardId, id) {
  const { rows } = await pool.query(
    `SELECT bt.*, ${ASSIGNEES_SUBQUERY} FROM board_tasks bt WHERE bt.id = $1 AND bt.board_id = $2`,
    [id, boardId]
  );
  return rows[0] || null;
}

async function createBoardTask(boardId, { title, description, due_date, priority, tags, status, assignee_ids, column_id, labels }) {
  const assignees = assignee_ids || [];
  await assertAssigneesAreBoardMembers(boardId, assignees);
  const columnId = await resolveColumnId(boardId, column_id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO board_tasks (board_id, title, description, due_date, priority, tags, status, column_id, labels, position)
       VALUES (
         $1, $2, $3, $4, COALESCE($5::task_priority, 'medium'), COALESCE($6::text[], '{}'), COALESCE($7::task_status, 'pending'), $8,
         COALESCE($9::text[], '{}'),
         (SELECT COALESCE(MAX(position), -10) + 10 FROM board_tasks WHERE column_id = $8)
       )
       RETURNING id`,
      [boardId, title, description || null, due_date || null, priority || null, tags || null, status || null, columnId, labels || null]
    );
    await replaceAssignees(client, rows[0].id, assignees);
    await client.query('COMMIT');
    return getBoardTask(boardId, rows[0].id);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Every card one person is on, across all the boards they belong to. The
// board_members join matters: being removed from a board must stop its cards
// showing up here, even if the assignment row was left behind.
async function listTasksAssignedTo(userId) {
  const { rows } = await pool.query(
    `SELECT bt.*, b.name AS board_name, bc.name AS column_name, ${ASSIGNEES_SUBQUERY}
     FROM board_tasks bt
     JOIN boards b ON b.id = bt.board_id
     JOIN board_columns bc ON bc.id = bt.column_id
     JOIN board_members bm ON bm.board_id = bt.board_id AND bm.user_id = $1
     JOIN board_task_assignees mine ON mine.task_id = bt.id AND mine.user_id = $1
     ORDER BY b.name, bc.position, bt.position`,
    [userId]
  );
  return rows;
}

async function updateBoardTask(boardId, id, fields) {
  const columnFields = ['title', 'description', 'status', 'priority', 'due_date', 'tags', 'position', 'column_id', 'labels'];
  const keys = Object.keys(fields).filter((k) => columnFields.includes(k));
  const changingAssignees = Object.prototype.hasOwnProperty.call(fields, 'assignee_ids');
  if (keys.length === 0 && !changingAssignees) return getBoardTask(boardId, id);

  const assignees = changingAssignees ? fields.assignee_ids || [] : null;
  if (changingAssignees) {
    await assertAssigneesAreBoardMembers(boardId, assignees);
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (keys.length > 0) {
      const setClauses = keys.map((key, i) => `${key} = $${i + 3}`);
      setClauses.push('updated_at = now()');
      const values = keys.map((key) => resolved[key]);
      const { rows } = await client.query(
        `UPDATE board_tasks SET ${setClauses.join(', ')} WHERE id = $1 AND board_id = $2 RETURNING id`,
        [id, boardId, ...values]
      );
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
    } else {
      const { rows } = await client.query('SELECT id FROM board_tasks WHERE id = $1 AND board_id = $2', [id, boardId]);
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query('UPDATE board_tasks SET updated_at = now() WHERE id = $1', [id]);
    }

    if (changingAssignees) {
      await replaceAssignees(client, id, assignees);
    }

    await client.query('COMMIT');
    return getBoardTask(boardId, id);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function deleteBoardTask(boardId, id) {
  const { rowCount } = await pool.query('DELETE FROM board_tasks WHERE id = $1 AND board_id = $2', [id, boardId]);
  return rowCount > 0;
}

module.exports = { listBoardTasks, listTasksAssignedTo, createBoardTask, getBoardTask, updateBoardTask, deleteBoardTask };
