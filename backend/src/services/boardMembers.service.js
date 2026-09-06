const pool = require('../db/pool');

async function addMember(boardId, userId, role = 'member') {
  const { rows } = await pool.query(
    `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING *`,
    [boardId, userId, role]
  );
  return rows[0];
}

async function listMembers(boardId) {
  const { rows } = await pool.query(
    `SELECT bm.board_id, bm.user_id, bm.role, bm.created_at, u.name
     FROM board_members bm
     JOIN users u ON u.id = bm.user_id
     WHERE bm.board_id = $1
     ORDER BY bm.role, u.name`,
    [boardId]
  );
  return rows;
}

async function getMembership(boardId, userId) {
  const { rows } = await pool.query('SELECT * FROM board_members WHERE board_id = $1 AND user_id = $2', [boardId, userId]);
  return rows[0] || null;
}

async function countOwners(boardId) {
  const { rows } = await pool.query(
    "SELECT count(*)::int AS count FROM board_members WHERE board_id = $1 AND role = 'owner'",
    [boardId]
  );
  return rows[0].count;
}

async function removeMember(boardId, userId) {
  const { rowCount } = await pool.query('DELETE FROM board_members WHERE board_id = $1 AND user_id = $2', [boardId, userId]);
  return rowCount > 0;
}

// Locks every membership row for this board before checking/mutating, so two
// concurrent role changes on the same board can't both pass an owner-count
// check before either commits (the TOCTOU a plain check-then-act would allow).
async function withBoardMembersLocked(boardId, run) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT 1 FROM board_members WHERE board_id = $1 FOR UPDATE', [boardId]);
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

async function wouldLeaveNoOwner(client, boardId, userId, targetRole) {
  const { rows } = await client.query('SELECT * FROM board_members WHERE board_id = $1 AND user_id = $2', [boardId, userId]);
  const existing = rows[0] || null;
  if (!existing || existing.role !== 'owner' || targetRole === 'owner') return { existing, wouldOrphan: false };

  const { rows: countRows } = await client.query(
    "SELECT count(*)::int AS count FROM board_members WHERE board_id = $1 AND role = 'owner'",
    [boardId]
  );
  return { existing, wouldOrphan: countRows[0].count <= 1 };
}

async function upsertMemberRoleSafely(boardId, userId, role) {
  return withBoardMembersLocked(boardId, async (client) => {
    const { wouldOrphan } = await wouldLeaveNoOwner(client, boardId, userId, role);
    if (wouldOrphan) return { ok: false, reason: 'last_owner' };

    const { rows } = await client.query(
      `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [boardId, userId, role]
    );
    return { ok: true, member: rows[0] };
  });
}

async function removeMemberSafely(boardId, userId) {
  return withBoardMembersLocked(boardId, async (client) => {
    const { existing, wouldOrphan } = await wouldLeaveNoOwner(client, boardId, userId, 'member');
    if (!existing) return { ok: false, reason: 'not_found' };
    if (wouldOrphan) return { ok: false, reason: 'last_owner' };

    await client.query('DELETE FROM board_members WHERE board_id = $1 AND user_id = $2', [boardId, userId]);
    return { ok: true };
  });
}

async function listBoardsForUser(userId) {
  const { rows } = await pool.query(
    `SELECT b.*, bm.role AS my_role
     FROM boards b
     JOIN board_members bm ON bm.board_id = b.id
     WHERE bm.user_id = $1
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return rows;
}

module.exports = {
  addMember,
  listMembers,
  getMembership,
  countOwners,
  removeMember,
  listBoardsForUser,
  upsertMemberRoleSafely,
  removeMemberSafely,
};
