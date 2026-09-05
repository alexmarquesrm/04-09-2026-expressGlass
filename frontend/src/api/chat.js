const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export async function sendMessage(message) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Não foi possível falar com o assistente');
  return body;
}

export async function confirmAction(confirmationToken, confirm) {
  const res = await fetch(`${API_BASE}/api/chat/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation_token: confirmationToken, confirm }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Não foi possível confirmar a ação');
  return body;
}
