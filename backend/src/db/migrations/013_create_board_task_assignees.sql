-- A card can now have several people on it, so the single assignee_id column
-- becomes a join table. The old column is backfilled and then dropped rather
-- than kept alongside: two places holding "who is on this card" would drift the
-- moment anything wrote to only one of them.
CREATE TABLE board_task_assignees (
  task_id    INTEGER NOT NULL REFERENCES board_tasks(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX board_task_assignees_user_id_idx ON board_task_assignees(user_id);

INSERT INTO board_task_assignees (task_id, user_id)
SELECT id, assignee_id FROM board_tasks WHERE assignee_id IS NOT NULL;

ALTER TABLE board_tasks DROP COLUMN assignee_id;
