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

function EmptyIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d6d3d1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"></path>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
    </svg>
  );
}

export default function TaskList({ tasks, onToggleStatus }) {
  if (tasks.length === 0) {
    return (
      <div className="card" style={{ padding: '64px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
        <EmptyIcon />
        <div style={{ fontSize: 15, fontWeight: 600 }}>No tasks yet</div>
        <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>Add your first task above to get started.</div>
      </div>
    );
  }

  return (
    <div className="card">
      {tasks.map((task) => {
        const completed = task.status === 'completed';
        return (
          <div className="task-row" key={task.id}>
            <button
              type="button"
              className={`task-checkbox${completed ? ' completed' : ''}`}
              onClick={() => onToggleStatus(task)}
              aria-label={completed ? 'Mark as pending' : 'Mark as completed'}
            >
              {completed && <CheckIcon />}
            </button>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: completed ? 'var(--color-muted)' : 'var(--color-text)', textDecoration: completed ? 'line-through' : 'none' }}>
                  {task.title}
                </span>
                <span className={`badge-priority ${task.priority}`}>{task.priority}</span>
              </div>
              {(task.due_date || (task.tags && task.tags.length > 0)) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {task.due_date && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-muted)' }}>
                      <CalendarIcon />
                      {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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
          </div>
        );
      })}
    </div>
  );
}
