const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export async function fetchTasks() {
  const res = await fetch(`${API_BASE}/api/tasks`);
  if (!res.ok) throw new Error('Não foi possível obter as tarefas');
  return res.json();
}

export async function createTask(task) {
  const res = await fetch(`${API_BASE}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Não foi possível criar a tarefa');
  return res.json();
}

export async function updateTask(id, fields) {
  const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error('Não foi possível atualizar a tarefa');
  return res.json();
}

export async function deleteTask(id) {
  const res = await fetch(`${API_BASE}/api/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Não foi possível eliminar a tarefa');
}
