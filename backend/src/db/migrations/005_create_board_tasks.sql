-- Reuses the task_status/task_priority enums created in 001_create_tasks.sql
-- so board cards use the same vocabulary as the core task list, without
-- touching the original `tasks` table at all.
CREATE TABLE board_tasks (
  id          SERIAL PRIMARY KEY,
  board_id    INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  status      task_status NOT NULL DEFAULT 'pending',
  priority    task_priority NOT NULL DEFAULT 'medium',
  due_date    DATE,
  tags        TEXT[] DEFAULT '{}',
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX board_tasks_board_id_idx ON board_tasks(board_id);
