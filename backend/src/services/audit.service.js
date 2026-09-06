const { randomUUID } = require('crypto');
const pool = require('../db/pool');

async function logPendingToolCall({ message, tool, args, userId }) {
  const { rows } = await pool.query(
    `INSERT INTO audit_log (message, tool_called, tool_args, confirmation_token, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [message, tool, JSON.stringify(args), randomUUID(), userId || null]
  );
  return rows[0];
}

async function logToolCall({ message, tool, args, result, userId }) {
  const { rows } = await pool.query(
    `INSERT INTO audit_log (message, tool_called, tool_args, result, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [message, tool, JSON.stringify(args), JSON.stringify(result), userId || null]
  );
  return rows[0];
}

const PENDING_TTL = '15 minutes';

async function getPending(confirmationToken) {
  const { rows } = await pool.query(
    `SELECT * FROM audit_log
     WHERE confirmation_token = $1 AND result IS NULL AND created_at > now() - interval '${PENDING_TTL}'`,
    [confirmationToken]
  );
  return rows[0] || null;
}

// Claims a pending action so it can only ever execute once: two concurrent
// confirms of the same token both read the row, but only one wins this UPDATE.
async function claimPending(confirmationToken) {
  const { rows } = await pool.query(
    `UPDATE audit_log
     SET result = '{"status":"in_progress"}'::jsonb
     WHERE confirmation_token = $1 AND result IS NULL AND created_at > now() - interval '${PENDING_TTL}'
     RETURNING *`,
    [confirmationToken]
  );
  return rows[0] || null;
}

async function resolve(confirmationToken, result) {
  await pool.query('UPDATE audit_log SET result = $1 WHERE confirmation_token = $2', [
    JSON.stringify(result),
    confirmationToken,
  ]);
}

module.exports = { logPendingToolCall, logToolCall, getPending, claimPending, resolve };
