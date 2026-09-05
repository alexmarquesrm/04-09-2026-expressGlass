import { useEffect, useRef, useState } from 'react';
import { sendMessage, confirmAction } from '../api/chat.js';

let nextId = 1;

function makeMessage(role, text, extra) {
  return { id: nextId++, role, text, ...extra };
}

export default function AssistantPage() {
  const [messages, setMessages] = useState([
    makeMessage(
      'assistant',
      'Olá! Posso ajudar-te a gerir as tuas tarefas — pede-me para listar, criar, atualizar ou eliminar. ' +
        'Ações que mudam ou apagam uma tarefa pedem sempre a tua confirmação antes de acontecerem.'
    ),
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const windowRef = useRef(null);

  useEffect(() => {
    if (windowRef.current) {
      windowRef.current.scrollTop = windowRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, makeMessage('user', text)]);
    setInput('');
    setSending(true);

    try {
      const result = await sendMessage(text);
      setMessages((prev) => [
        ...prev,
        makeMessage('assistant', result.reply, { pending: result.requires_confirmation || null }),
      ]);
    } catch (err) {
      setMessages((prev) => [...prev, makeMessage('error', err.message)]);
    } finally {
      setSending(false);
    }
  }

  async function handleConfirm(messageId, pending, confirmed) {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, pending: null } : m)));
    setSending(true);
    try {
      const result = await confirmAction(pending.confirmation_token, confirmed);
      setMessages((prev) => [...prev, makeMessage('assistant', result.reply)]);
    } catch (err) {
      setMessages((prev) => [...prev, makeMessage('error', err.message)]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.01em' }}>Assistente de conversa</h1>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>
          Fala com o assistente para gerir as tuas tarefas em linguagem natural.
        </p>
      </div>

      <div className="chat-window" ref={windowRef}>
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div className={`chat-bubble ${m.role}`}>{m.text}</div>
            {m.pending && (
              <div className="chat-confirm-actions">
                <button className="btn-danger" disabled={sending} onClick={() => handleConfirm(m.id, m.pending, true)}>
                  Confirmar
                </button>
                <button className="btn-secondary" disabled={sending} onClick={() => handleConfirm(m.id, m.pending, false)}>
                  Cancelar
                </button>
              </div>
            )}
          </div>
        ))}
        {sending && <div className="chat-bubble assistant">A pensar...</div>}
      </div>

      <form onSubmit={handleSubmit} className="chat-input-row">
        <input
          className="field"
          placeholder="Ex.: cria uma tarefa para rever o relatório amanhã"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button className="btn-primary" type="submit" disabled={sending || !input.trim()}>
          Enviar
        </button>
      </form>
    </div>
  );
}
