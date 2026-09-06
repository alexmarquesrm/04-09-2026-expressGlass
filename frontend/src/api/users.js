const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export async function fetchUsers() {
  const res = await fetch(`${API_BASE}/api/users`, { credentials: 'include' });
  if (!res.ok) throw new Error('Não foi possível obter os utilizadores');
  return res.json();
}
