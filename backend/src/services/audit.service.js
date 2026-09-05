const { randomUUID } = require('crypto');
const pool = require('../db/pool');

async function logPendingToolCall({ message, tool, args }) {
  const { rows } = await pool.query(
    `INSERT INTO audit_log (message, tool_called, tool_args, confirmation_token) VALUES ($1, $2, $3, $4) RETURNING *`,
    [message, tool, JSON.stringify(args), randomUUID()]
  );
  return rows[0];
}

async function logToolCall({ message, tool, args, result }) {
  const { rows } = await pool.query(
    `INSERT INTO audit_log (message, tool_called, tool_args, result) VALUES ($1, $2, $3, $4) RETURNING *`,
    [message, tool, JSON.stringify(args), JSON.stringify(result)]
  );
  return rows[0];
}

async function getPending(confirmationToken) {
  const { rows } = await pool.query(
    'SELECT * FROM audit_log WHERE confirmation_token = $1 AND result IS NULL',
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

module.exports = { logPendingToolCall, logToolCall, getPending, resolve };
