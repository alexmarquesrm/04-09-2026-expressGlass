-- Default users, boards, memberships and board tasks so a fresh
-- `docker compose up` has something real to click through instead of
-- an empty app. Every user below shares the password "password123"
-- (bcrypt hash generated once with the app's own bcryptjs, cost 10) —
-- see README for the full login list.
WITH u_ana AS (
  INSERT INTO users (name, email, password_hash) VALUES
    ('Ana Ferreira', 'ana@expressglass.dev', '$2a$10$YhmBaO/tgThchHalWn7NPuGG2STjnRBdtIh145IFPalf2m1vOpkI2')
  RETURNING id
),
u_bruno AS (
  INSERT INTO users (name, email, password_hash) VALUES
    ('Bruno Santos', 'bruno@expressglass.dev', '$2a$10$YhmBaO/tgThchHalWn7NPuGG2STjnRBdtIh145IFPalf2m1vOpkI2')
  RETURNING id
),
u_carla AS (
  INSERT INTO users (name, email, password_hash) VALUES
    ('Carla Mendes', 'carla@expressglass.dev', '$2a$10$YhmBaO/tgThchHalWn7NPuGG2STjnRBdtIh145IFPalf2m1vOpkI2')
  RETURNING id
),
u_diogo AS (
  INSERT INTO users (name, email, password_hash) VALUES
    ('Diogo Costa', 'diogo@expressglass.dev', '$2a$10$YhmBaO/tgThchHalWn7NPuGG2STjnRBdtIh145IFPalf2m1vOpkI2')
  RETURNING id
),
b_website AS (
  INSERT INTO boards (name) VALUES ('Website ExpressGlass') RETURNING id
),
b_marketing AS (
  INSERT INTO boards (name) VALUES ('Sprint de Marketing') RETURNING id
),
b_pessoal AS (
  INSERT INTO boards (name) VALUES ('Backlog Pessoal') RETURNING id
),
members AS (
  INSERT INTO board_members (board_id, user_id, role)
  SELECT b_website.id, u_ana.id, 'owner'::board_role FROM b_website, u_ana
  UNION ALL
  SELECT b_website.id, u_bruno.id, 'member'::board_role FROM b_website, u_bruno
  UNION ALL
  SELECT b_website.id, u_carla.id, 'member'::board_role FROM b_website, u_carla
  UNION ALL
  SELECT b_marketing.id, u_bruno.id, 'owner'::board_role FROM b_marketing, u_bruno
  UNION ALL
  SELECT b_marketing.id, u_ana.id, 'member'::board_role FROM b_marketing, u_ana
  UNION ALL
  SELECT b_marketing.id, u_diogo.id, 'member'::board_role FROM b_marketing, u_diogo
  UNION ALL
  SELECT b_pessoal.id, u_carla.id, 'owner'::board_role FROM b_pessoal, u_carla
  RETURNING 1
)
INSERT INTO board_tasks (board_id, title, description, status, priority, due_date, tags, position, assignee_id)
SELECT b_website.id, 'Rever wireframes da homepage', 'Validar layout com a equipa de design.', 'pending'::task_status, 'high'::task_priority, '2026-09-10'::date, '{design}'::text[], 0, u_ana.id FROM b_website, u_ana
UNION ALL
SELECT b_website.id, 'Configurar pipeline de deploy', NULL, 'pending'::task_status, 'medium'::task_priority, '2026-09-14'::date, '{devops}'::text[], 10, u_bruno.id FROM b_website, u_bruno
UNION ALL
SELECT b_website.id, 'Escrever testes de aceitação', NULL, 'completed'::task_status, 'medium'::task_priority, NULL::date, '{qa}'::text[], 20, u_carla.id FROM b_website, u_carla
UNION ALL
SELECT b_marketing.id, 'Preparar calendário de publicações', NULL, 'pending'::task_status, 'medium'::task_priority, '2026-09-11'::date, '{social}'::text[], 0, u_bruno.id FROM b_marketing, u_bruno
UNION ALL
SELECT b_marketing.id, 'Rever orçamento de anúncios', NULL, 'pending'::task_status, 'high'::task_priority, '2026-09-09'::date, '{ads}'::text[], 10, u_ana.id FROM b_marketing, u_ana
UNION ALL
SELECT b_marketing.id, 'Enviar newsletter mensal', NULL, 'completed'::task_status, 'low'::task_priority, NULL::date, '{email}'::text[], 20, u_diogo.id FROM b_marketing, u_diogo
UNION ALL
SELECT b_pessoal.id, 'Organizar notas da reunião', NULL, 'pending'::task_status, 'low'::task_priority, NULL::date, '{}'::text[], 0, u_carla.id FROM b_pessoal, u_carla
UNION ALL
SELECT b_pessoal.id, 'Marcar consulta', NULL, 'pending'::task_status, 'medium'::task_priority, '2026-09-20'::date, '{}'::text[], 10, NULL FROM b_pessoal;
