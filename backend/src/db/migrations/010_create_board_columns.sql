-- Board columns become real rows instead of the two hardcoded statuses
-- (Pendente/Concluída) the board UI has grouped by until now, so each board
-- can define its own workflow. `board_tasks.status` is deliberately left
-- alone: it stays a per-task done/not-done marker and keeps the existing
-- API contract, while `column_id` becomes what actually places a card.
CREATE TABLE board_columns (
  id         SERIAL PRIMARY KEY,
  board_id   INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX board_columns_board_id_idx ON board_columns(board_id);

ALTER TABLE board_tasks
  ADD COLUMN column_id INTEGER REFERENCES board_columns(id) ON DELETE CASCADE;

CREATE INDEX board_tasks_column_id_idx ON board_tasks(column_id);

-- Every board that already exists gets the three default columns.
INSERT INTO board_columns (board_id, name, position)
SELECT b.id, c.name, c.position
FROM boards b
CROSS JOIN (VALUES ('A fazer', 0), ('Em curso', 10), ('Concluído', 20)) AS c(name, position);

-- Existing cards keep their meaning: completed ones land in "Concluído",
-- everything else in "A fazer".
UPDATE board_tasks bt
SET column_id = bc.id
FROM board_columns bc
WHERE bc.board_id = bt.board_id
  AND bc.name = CASE WHEN bt.status = 'completed' THEN 'Concluído' ELSE 'A fazer' END;

-- Now that every row has one, a board task without a column is not a valid state.
ALTER TABLE board_tasks
  ALTER COLUMN column_id SET NOT NULL;
