import { useEffect, useState } from 'react';
import Avatar from './Avatar.jsx';

export const LABELS = [
  { key: 'green', color: '#4bad5c' },
  { key: 'yellow', color: '#e2b203' },
  { key: 'orange', color: '#d9822b' },
  { key: 'red', color: '#c9372c' },
  { key: 'purple', color: '#8b5cf6' },
  { key: 'blue', color: '#0c66e4' },
];

const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };

export default function TaskModal({ task, columns, members, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || '');
  const [columnId, setColumnId] = useState(task.column_id);
  const [priority, setPriority] = useState(task.priority);
  const [labels, setLabels] = useState(task.labels || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function toggleLabel(key) {
    setLabels((prev) => (prev.includes(key) ? prev.filter((l) => l !== key) : [...prev, key]));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        assignee_id: assigneeId ? Number(assigneeId) : null,
        column_id: Number(columnId),
        priority,
        labels,
      });
    } finally {
      setSaving(false);
    }
  }

  const assignee = members.find((m) => m.user_id === Number(assigneeId));

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Detalhes do cartão" onClick={onClose}>
      <form className="task-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
        <div className="task-modal-header">
          <div style={{ display: 'flex', gap: 6 }}>
            {labels.map((key) => {
              const label = LABELS.find((l) => l.key === key);
              return label ? <span key={key} className="label-chip" style={{ background: label.color }} /> : null;
            })}
          </div>
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose} style={{ marginLeft: 'auto' }}>
            ✕
          </button>
        </div>

        <div className="task-modal-body">
          <div>
            <label className="field-label" htmlFor="task-title">
              Título
            </label>
            <input
              id="task-title"
              className="field"
              style={{ width: '100%', fontSize: 16, fontWeight: 700 }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="field-label" htmlFor="task-description">
              Descrição
            </label>
            <textarea
              id="task-description"
              className="field"
              style={{ width: '100%', minHeight: 96, resize: 'vertical', lineHeight: 1.5 }}
              placeholder="Acrescenta mais detalhe a este cartão..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <span className="field-label">Etiquetas</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {LABELS.map((label) => {
                const active = labels.includes(label.key);
                return (
                  <button
                    key={label.key}
                    type="button"
                    aria-label={`Etiqueta ${label.key}`}
                    aria-pressed={active}
                    onClick={() => toggleLabel(label.key)}
                    className={`label-swatch${active ? ' active' : ''}`}
                    style={{ background: label.color }}
                  >
                    {active && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 150px' }}>
              <label className="field-label" htmlFor="task-assignee">
                Responsável
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {assignee && <Avatar name={assignee.name} size={26} />}
                <select
                  id="task-assignee"
                  className="field-sm"
                  style={{ flex: 1 }}
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">Sem responsável</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ flex: '1 1 120px' }}>
              <label className="field-label" htmlFor="task-column">
                Coluna
              </label>
              <select id="task-column" className="field-sm" style={{ width: '100%' }} value={columnId} onChange={(e) => setColumnId(e.target.value)}>
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1 1 120px' }}>
              <label className="field-label" htmlFor="task-priority">
                Prioridade
              </label>
              <select id="task-priority" className="field-sm" style={{ width: '100%' }} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="task-modal-footer">
          <button type="button" className="btn-secondary" onClick={() => onDelete(task)} style={{ color: 'var(--color-priority-high-text)' }}>
            Eliminar
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving || !title.trim()}>
              Guardar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
