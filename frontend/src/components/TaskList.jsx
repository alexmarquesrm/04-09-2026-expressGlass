import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';

const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d6d3d1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"></path>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
    </svg>
  );
}

function EditRow({ task, onSave, onCancel }) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.slice(0, 10) : '');
  const [tagsText, setTagsText] = useState((task.tags || []).join(', '));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave(task.id, {
        title,
        priority,
        due_date: dueDate || null,
        tags: tagsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="task-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="field-sm" style={{ flex: '1 1 180px' }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" />
        <select className="field-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
        </select>
        <input className="field-sm" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
      <input className="field-sm" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="Etiquetas, separadas por vírgula" />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={handleSave} disabled={saving}>
          Guardar
        </button>
        <button type="button" className="field-sm" style={{ background: 'transparent', cursor: 'pointer' }} onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function TaskList({ tasks, onToggleStatus, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  if (tasks.length === 0) {
    return (
      <div className="card" style={{ padding: '64px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
        <EmptyIcon />
        <div style={{ fontSize: 15, fontWeight: 600 }}>Ainda não há tarefas</div>
        <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>Adicione a primeira tarefa acima para começar.</div>
      </div>
    );
  }

  async function handleSaveEdit(id, fields) {
    await onUpdate(id, fields);
    setEditingId(null);
  }

  function handleConfirmDelete() {
    onDelete(pendingDelete.id);
    setPendingDelete(null);
  }

  return (
    <div className="card">
      {pendingDelete && (
        <ConfirmDialog
          title="Eliminar tarefa?"
          message={`"${pendingDelete.title}" será eliminada permanentemente. Esta ação não pode ser revertida.`}
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      {tasks.map((task) => {
        if (editingId === task.id) {
          return <EditRow key={task.id} task={task} onSave={handleSaveEdit} onCancel={() => setEditingId(null)} />;
        }

        const completed = task.status === 'completed';
        return (
          <div className="task-row" key={task.id}>
            <button
              type="button"
              className={`task-checkbox${completed ? ' completed' : ''}`}
              onClick={() => onToggleStatus(task)}
              aria-label={completed ? 'Marcar como pendente' : 'Marcar como concluída'}
            >
              {completed && <CheckIcon />}
            </button>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: completed ? 'var(--color-muted)' : 'var(--color-text)', textDecoration: completed ? 'line-through' : 'none' }}>
                  {task.title}
                </span>
                <span className={`badge-priority ${task.priority}`}>{PRIORITY_LABELS[task.priority] || task.priority}</span>
              </div>
              {(task.due_date || (task.tags && task.tags.length > 0)) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {task.due_date && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-muted)' }}>
                      <CalendarIcon />
                      {new Date(task.due_date).toLocaleDateString('pt-PT', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  {(task.tags || []).map((tag) => (
                    <span className="tag-pill" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="task-actions">
              <button type="button" className="icon-btn" aria-label="Editar tarefa" onClick={() => setEditingId(task.id)}>
                <PencilIcon />
              </button>
              <button type="button" className="icon-btn danger" aria-label="Eliminar tarefa" onClick={() => setPendingDelete(task)}>
                <TrashIcon />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
