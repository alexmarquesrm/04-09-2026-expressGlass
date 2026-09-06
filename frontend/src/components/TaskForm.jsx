import { useState } from 'react';

export default function TaskForm({ onCreate }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onCreate({ title: title.trim(), description: description.trim() || undefined, priority, due_date: dueDate || undefined });
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
    } catch {
      // o erro é mostrado através do estado do componente pai; mantém-se o rascunho para tentar novamente
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Nova tarefa
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="field"
          style={{ flex: '1 1 220px', minWidth: 180 }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="O que precisa de ser feito?"
        />
        <select className="field" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">Prioridade baixa</option>
          <option value="medium">Prioridade média</option>
          <option value="high">Prioridade alta</option>
        </select>
        <input
          className="field"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={submitting}>
          Adicionar tarefa
        </button>
      </form>
      <input
        className="field"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Notas (opcional)"
      />
    </div>
  );
}
