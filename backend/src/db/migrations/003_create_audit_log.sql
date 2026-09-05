CREATE TABLE audit_log (
  id                 SERIAL PRIMARY KEY,
  source             TEXT NOT NULL DEFAULT 'chat',
  message            TEXT NOT NULL,
  tool_called        TEXT,
  tool_args          JSONB,
  result             JSONB,
  confirmation_token TEXT UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
