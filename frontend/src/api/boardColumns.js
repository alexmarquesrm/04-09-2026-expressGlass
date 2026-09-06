const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

async function parseError(res, fallback) {
  try {
    const body = await res.json();
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchColumns(boardId) {
  const res = await fetch(`${API_BASE}/api/boards/${boardId}/columns`, { credentials: 'include' });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível obter as colunas'));
  return res.json();
}

export async function createColumn(boardId, name) {
  const res = await fetch(`${API_BASE}/api/boards/${boardId}/columns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível criar a coluna'));
  return res.json();
}

export async function renameColumn(boardId, columnId, name) {
  const res = await fetch(`${API_BASE}/api/boards/${boardId}/columns/${columnId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível mudar o nome da coluna'));
  return res.json();
}

export async function deleteColumn(boardId, columnId) {
  const res = await fetch(`${API_BASE}/api/boards/${boardId}/columns/${columnId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível eliminar a coluna'));
}
