CREATE TYPE task_status AS ENUM ('pending', 'completed');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');

CREATE TABLE tasks (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  status      task_status NOT NULL DEFAULT 'pending',
  priority    task_priority NOT NULL DEFAULT 'medium',
  due_date    DATE,
  tags        TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
