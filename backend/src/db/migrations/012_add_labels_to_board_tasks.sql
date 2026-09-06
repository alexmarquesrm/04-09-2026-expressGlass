-- Colour flags on a card, Trello-style. Stored as an array of palette keys
-- (not free text and not hex): the UI owns what each key looks like, so the
-- palette can be restyled without rewriting stored data.
ALTER TABLE board_tasks
  ADD COLUMN labels TEXT[] NOT NULL DEFAULT '{}';
