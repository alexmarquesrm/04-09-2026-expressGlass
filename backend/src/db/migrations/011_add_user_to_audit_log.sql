-- The chat assistant can now act on boards, which are permission-scoped, so
-- every logged tool call records who asked for it. Pending confirmations are
-- re-authorized against this on confirm, so one user can never confirm a
-- destructive action another user proposed.
ALTER TABLE audit_log
  ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX audit_log_user_id_idx ON audit_log(user_id);
