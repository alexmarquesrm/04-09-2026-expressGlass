const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export async function fetchBoards() {
  const res = await fetch(`${API_BASE}/api/boards`);
  if (!res.ok) throw new Error('Não foi possível obter os quadros');
  return res.json();
}

export async function createBoard(name) {
  const res = await fetch(`${API_BASE}/api/boards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Não foi possível criar o quadro');
  return res.json();
}

export async function fetchBoard(id) {
  const res = await fetch(`${API_BASE}/api/boards/${id}`);
  if (!res.ok) throw new Error('Não foi possível obter o quadro');
  return res.json();
}

export async function deleteBoard(id) {
  const res = await fetch(`${API_BASE}/api/boards/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Não foi possível eliminar o quadro');
}

export async function fetchBoardTasks(boardId) {
  const res = await fetch(`${API_BASE}/api/boards/${boardId}/tasks`);
  if (!res.ok) throw new Error('Não foi possível obter as tarefas do quadro');
  return res.json();
}

export async function createBoardTask(boardId, task) {
  const res = await fetch(`${API_BASE}/api/boards/${boardId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Não foi possível criar a tarefa');
  return res.json();
}

export async function updateBoardTask(boardId, id, fields) {
  const res = await fetch(`${API_BASE}/api/boards/${boardId}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error('Não foi possível atualizar a tarefa');
  return res.json();
}

export async function deleteBoardTask(boardId, id) {
  const res = await fetch(`${API_BASE}/api/boards/${boardId}/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Não foi possível eliminar a tarefa');
}
