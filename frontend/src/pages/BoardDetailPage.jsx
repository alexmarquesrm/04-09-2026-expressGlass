import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchBoard, fetchBoardTasks, createBoardTask, updateBoardTask, deleteBoardTask } from '../api/boards.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const COLUMNS = [
  { status: 'pending', label: 'Pendente' },
  { status: 'completed', label: 'Concluída' },
];

export default function BoardDetailPage() {
  const { id } = useParams();
  const [board, setBoard] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [error, setError] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    setBoard(null);
    setNotFound(false);
    fetchBoard(id)
      .then(setBoard)
      .catch((err) => {
        setError(err.message);
        setNotFound(true);
      });
    fetchBoardTasks(id).then(setTasks).catch((err) => setError(err.message));
  }, [id]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const task = await createBoardTask(id, { title: title.trim(), priority });
      setTasks((prev) => [...prev, task]);
      setTitle('');
      setPriority('medium');
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  function sortedColumn(list, status, excludeId) {
    return list.filter((t) => t.status === status && t.id !== excludeId).sort((a, b) => a.position - b.position);
  }

  async function moveTaskTo(taskId, targetStatus, targetIndex) {
    const currentTasks = tasksRef.current;
    const dragged = currentTasks.find((t) => t.id === taskId);
    if (!dragged) return;

    let adjustedIndex = targetIndex;
    if (dragged.status === targetStatus) {
      const originalIndex = sortedColumn(currentTasks, targetStatus).findIndex((t) => t.id === taskId);
      if (originalIndex !== -1 && originalIndex < adjustedIndex) {
        adjustedIndex -= 1;
      }
    }

    const destList = sortedColumn(currentTasks, targetStatus, taskId);
    const clampedIndex = Math.max(0, Math.min(adjustedIndex, destList.length));
    destList.splice(clampedIndex, 0, { ...dragged, status: targetStatus });
    const destUpdates = destList.map((t, idx) => ({ id: t.id, status: targetStatus, position: idx * 10 }));

    let sourceUpdates = [];
    if (dragged.status !== targetStatus) {
      const sourceList = sortedColumn(currentTasks, dragged.status, taskId);
      sourceUpdates = sourceList.map((t, idx) => ({ id: t.id, status: dragged.status, position: idx * 10 }));
    }

    const allUpdates = [...destUpdates, ...sourceUpdates].filter((u) => {
      const current = currentTasks.find((t) => t.id === u.id);
      return !current || current.status !== u.status || current.position !== u.position;
    });
    if (allUpdates.length === 0) return;

    setTasks((prev) =>
      prev.map((t) => {
        const u = allUpdates.find((x) => x.id === t.id);
        return u ? { ...t, status: u.status, position: u.position } : t;
      })
    );

    try {
      await Promise.all(allUpdates.map((u) => updateBoardTask(id, u.id, { status: u.status, position: u.position })));
      setError(null);
    } catch (err) {
      setError(err.message);
      try {
        const fresh = await fetchBoardTasks(id);
        setTasks(fresh);
      } catch {
        // keep the optimistic state if reconciliation also fails; the error banner already reflects the problem
      }
    }
  }

  async function handleDelete(taskId) {
    try {
      await deleteBoardTask(id, taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Link to="/boards" style={{ fontSize: 13, color: 'var(--color-muted)', textDecoration: 'none' }}>
          ← Quadros
        </Link>
        <h1 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' }}>
          {board ? board.name : notFound ? 'Quadro não encontrado' : 'A carregar...'}
        </h1>
      </div>

      {error && (
        <div className="card" style={{ padding: 14, color: 'var(--color-priority-high-text)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="card" style={{ padding: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="field"
          style={{ flex: '1 1 220px' }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nova tarefa neste quadro"
        />
        <select className="field" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">Prioridade baixa</option>
          <option value="medium">Prioridade média</option>
          <option value="high">Prioridade alta</option>
        </select>
        <button className="btn-primary" type="submit" disabled={!title.trim()}>
          Adicionar
        </button>
      </form>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {COLUMNS.map((column) => {
          const columnTasks = sortedColumn(tasks, column.status);
          return (
            <div
              key={column.status}
              className="card"
              style={{ flex: '1 1 320px', minWidth: 280, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = Number(e.dataTransfer.getData('text/plain'));
                if (taskId) moveTaskTo(taskId, column.status, columnTasks.length);
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {column.label} · {columnTasks.length}
              </div>
              {columnTasks.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--color-muted)', padding: '12px 0' }}>Sem tarefas</div>
              )}
              {columnTasks.map((task, index) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(task.id));
                    setDraggingId(task.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const taskId = Number(e.dataTransfer.getData('text/plain'));
                    if (taskId) moveTaskTo(taskId, column.status, index);
                  }}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    cursor: 'grab',
                    opacity: draggingId === task.id ? 0.4 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{task.title}</span>
                    <span className={`badge-priority ${task.priority}`}>{PRIORITY_LABELS[task.priority] || task.priority}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => {
                        const nextStatus = column.status === 'pending' ? 'completed' : 'pending';
                        moveTaskTo(task.id, nextStatus, Infinity);
                      }}
                    >
                      Mover para {column.status === 'pending' ? 'Concluída' : 'Pendente'}
                    </button>
                    <button type="button" className="icon-btn danger" aria-label="Eliminar tarefa" onClick={() => setPendingDelete(task)}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Eliminar tarefa"
          message={`Isto elimina permanentemente "${pendingDelete.title}". Não pode ser desfeito.`}
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          onConfirm={() => handleDelete(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
