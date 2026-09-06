const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

async function parseError(res, fallback) {
  try {
    const body = await res.json();
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchMembers(boardId) {
  const res = await fetch(`${API_BASE}/api/boards/${boardId}/members`, { credentials: 'include' });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível obter os membros'));
  return res.json();
}

export async function addMember(boardId, userId, role) {
  const res = await fetch(`${API_BASE}/api/boards/${boardId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ user_id: userId, role }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível adicionar o membro'));
  return res.json();
}

export async function removeMember(boardId, userId) {
  const res = await fetch(`${API_BASE}/api/boards/${boardId}/members/${userId}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível remover o membro'));
}
