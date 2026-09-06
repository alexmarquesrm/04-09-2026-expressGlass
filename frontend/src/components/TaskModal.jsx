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
  const [assigneeIds, setAssigneeIds] = useState((task.assignees || []).map((a) => a.user_id));
  const [columnId, setColumnId] = useState(task.column_id);
  const [priority, setPriority] = useState(task.priority);
  const [labels, setLabels] = useState(task.labels || []);
  const [pickerOpen, setPickerOpen] = useState(false);
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

  function toggleAssignee(userId) {
    setAssigneeIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        assignee_ids: assigneeIds,
        column_id: Number(columnId),
        priority,
        labels,
      });
    } finally {
      setSaving(false);
    }
  }

  // Ordered by the board's member list so the chips don't jump around as people
  // are added and removed.
  const assigned = members.filter((m) => assigneeIds.includes(m.user_id));

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Detalhes do cartão" onClick={onClose}>
      <form
        className="task-modal"
        onClick={(e) => {
          e.stopPropagation();
          setPickerOpen(false);
        }}
        onSubmit={handleSave}
      >
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

          <div>
            <span className="field-label">Responsáveis</span>
            {members.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>Este quadro ainda não tem membros.</p>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', position: 'relative' }}>
                {assigned.map((m) => (
                  <span key={m.user_id} className="assignee-chip active">
                    <Avatar name={m.name} size={22} />
                    {m.name}
                    <button
                      type="button"
                      aria-label={`Remover ${m.name} do cartão`}
                      onClick={() => toggleAssignee(m.user_id)}
                      style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 12 }}
                    >
                      ✕
                    </button>
                  </span>
                ))}

                <button
                  type="button"
                  className="assignee-add"
                  aria-label="Adicionar responsável"
                  aria-expanded={pickerOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPickerOpen((open) => !open);
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>

                {pickerOpen && (
                  <div className="assignee-picker" onClick={(e) => e.stopPropagation()}>
                    {members.map((m) => {
                      const active = assigneeIds.includes(m.user_id);
                      return (
                        <button
                          key={m.user_id}
                          type="button"
                          aria-label={`Responsável ${m.name}`}
                          aria-pressed={active}
                          onClick={() => toggleAssignee(m.user_id)}
                        >
                          <Avatar name={m.name} size={22} />
                          <span style={{ flex: 1, textAlign: 'left' }}>{m.name}</span>
                          {active && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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
