import { useEffect, useRef, useState } from 'react';
import { sendMessage, confirmAction } from '../api/chat.js';
import { useAuth } from '../context/AuthContext.jsx';

let nextId = 1;

function makeMessage(role, text, extra) {
  return { id: nextId++, role, text, ...extra };
}

const GREETING =
  'Olá! Posso criar tarefas, quadros e colunas, e atribuir trabalho a pessoas do quadro. ' +
  'Ações que mudam ou apagam alguma coisa pedem sempre a tua confirmação antes de acontecerem.';

function ChatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"></line>
      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
  );
}

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([makeMessage('assistant', GREETING)]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const windowRef = useRef(null);

  useEffect(() => {
    if (open && windowRef.current) {
      windowRef.current.scrollTop = windowRef.current.scrollHeight;
    }
  }, [messages, open]);

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
      // Put the buttons back: a failed confirm (network blip) shouldn't leave
      // the pending action stranded with no way to answer it.
      setMessages((prev) => [
        ...prev.map((m) => (m.id === messageId ? { ...m, pending } : m)),
        makeMessage('error', err.message),
      ]);
    } finally {
      setSending(false);
    }
  }

  // The assistant acts as the logged-in user, so there is nothing it can
  // usefully do before login.
  if (!user) return null;

  if (!open) {
    return (
      <button type="button" className="chat-fab" aria-label="Abrir o assistente" onClick={() => setOpen(true)}>
        <ChatIcon />
      </button>
    );
  }

  return (
    <div className="chat-panel" role="dialog" aria-label="Assistente">
      <div className="chat-panel-header">
        <span className="app-brand-mark" style={{ width: 32, height: 32 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em' }}>Assistente</span>
          <span style={{ fontSize: 11.5, color: 'var(--color-muted)' }}>Tarefas, quadros, colunas e pessoas</span>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Fechar o assistente"
          onClick={() => setOpen(false)}
          style={{ marginLeft: 'auto' }}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="chat-panel-body" ref={windowRef}>
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div className={`chat-bubble ${m.role}`}>{m.text}</div>
            {m.pending && (
              <div className="chat-confirm-actions">
                <button className="btn-danger" style={{ padding: '8px 16px', fontSize: 13 }} disabled={sending} onClick={() => handleConfirm(m.id, m.pending, true)}>
                  Confirmar
                </button>
                <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }} disabled={sending} onClick={() => handleConfirm(m.id, m.pending, false)}>
                  Cancelar
                </button>
              </div>
            )}
          </div>
        ))}
        {sending && <div className="chat-bubble assistant">A pensar...</div>}
      </div>

      <form onSubmit={handleSubmit} className="chat-panel-input">
        <input
          className="field"
          style={{ flex: 1, padding: '9px 12px', fontSize: 13.5 }}
          placeholder="Escreve o que precisas..."
          aria-label="Mensagem para o assistente"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
        />
        <button className="chat-send" type="submit" aria-label="Enviar" disabled={sending || !input.trim()}>
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
