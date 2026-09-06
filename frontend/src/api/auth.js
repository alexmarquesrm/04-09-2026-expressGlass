const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

async function parseError(res, fallback) {
  try {
    const body = await res.json();
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export async function register({ name, email, password }) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível criar a conta'));
  return res.json();
}

export async function login({ email, password }) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível iniciar sessão'));
  return res.json();
}

export async function logout() {
  await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
}

export async function fetchCurrentUser() {
  const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await parseError(res, 'Não foi possível obter o utilizador'));
  return res.json();
}
