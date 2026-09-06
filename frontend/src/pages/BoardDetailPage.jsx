import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchBoard, fetchBoardTasks, createBoardTask, updateBoardTask, deleteBoardTask } from '../api/boards.js';
import { fetchMembers, addMember, removeMember } from '../api/boardMembers.js';
import { fetchUsers } from '../api/users.js';
import { useAuth } from '../context/AuthContext.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const ROLE_LABELS = { owner: 'Dono', member: 'Membro' };
const COLUMNS = [
  { status: 'pending', label: 'Pendente' },
  { status: 'completed', label: 'Concluída' },
];

export default function BoardDetailPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [board, setBoard] = useState(null);
  const [accessErrorStatus, setAccessErrorStatus] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [newMemberId, setNewMemberId] = useState('');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [error, setError] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    if (!user) return;
    setBoard(null);
    setAccessErrorStatus(null);
    fetchBoard(id)
      .then((b) => {
        setBoard(b);
        fetchBoardTasks(id).then(setTasks).catch((err) => setError(err.message));
        fetchMembers(id).then(setMembers).catch(() => setMembers([]));
      })
      .catch((err) => {
        setError(err.message);
        setAccessErrorStatus(err.status || 500);
      });
    fetchUsers().then(setUsers).catch(() => setUsers([]));
  }, [id, user]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const task = await createBoardTask(id, { title: title.trim(), priority, assignee_id: assigneeId ? Number(assigneeId) : null });
      setTasks((prev) => [...prev, task]);
      setTitle('');
      setPriority('medium');
      setAssigneeId('');
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReassign(taskId, rawValue) {
    const nextAssigneeId = rawValue ? Number(rawValue) : null;
    try {
      const updated = await updateBoardTask(id, taskId, { assignee_id: nextAssigneeId });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    if (!newMemberId) return;
    try {
      await addMember(id, Number(newMemberId));
      const fresh = await fetchMembers(id);
      setMembers(fresh);
      setNewMemberId('');
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemoveMember(userId) {
    try {
      await removeMember(id, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
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

  if (authLoading) return null;

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Link to="/boards" style={{ fontSize: 13, color: 'var(--color-muted)', textDecoration: 'none' }}>
          ← Quadros
        </Link>
        <div className="card" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 14 }}>
          Inicia sessão para ver este quadro.{' '}
          <Link to="/login" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>
            Iniciar sessão
          </Link>
        </div>
      </div>
    );
  }

  if (accessErrorStatus) {
    const message =
      accessErrorStatus === 404
        ? 'Quadro não encontrado.'
        : accessErrorStatus === 403
        ? 'Não tens acesso a este quadro.'
        : 'Não foi possível obter o quadro.';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Link to="/boards" style={{ fontSize: 13, color: 'var(--color-muted)', textDecoration: 'none' }}>
          ← Quadros
        </Link>
        <div className="card" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 14 }}>
          {message}
        </div>
      </div>
    );
  }

  const isOwner = board && board.my_role === 'owner';
  const memberIds = new Set(members.map((m) => m.user_id));
  const addableUsers = users.filter((u) => !memberIds.has(u.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Link to="/boards" style={{ fontSize: 13, color: 'var(--color-muted)', textDecoration: 'none' }}>
          ← Quadros
        </Link>
        <h1 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' }}>
          {board ? board.name : 'A carregar...'}
        </h1>
      </div>

      {error && (
        <div className="card" style={{ padding: 14, color: 'var(--color-priority-high-text)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {board && (
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Membros
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {members.map((m) => (
              <span
                key={m.user_id}
                className="tag-pill"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {m.name} · {ROLE_LABELS[m.role] || m.role}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.user_id)}
                    style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 12 }}
                    aria-label={`Remover ${m.name}`}
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
          </div>
          {isOwner && addableUsers.length > 0 && (
            <form onSubmit={handleAddMember} style={{ display: 'flex', gap: 8 }}>
              <select
                className="field-sm"
                aria-label="Adicionar membro"
                value={newMemberId}
                onChange={(e) => setNewMemberId(e.target.value)}
              >
                <option value="">Adicionar membro...</option>
                {addableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} type="submit" disabled={!newMemberId}>
                Adicionar membro
              </button>
            </form>
          )}
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
        <select className="field" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Sem atribuição</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
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
                  <select
                    className="field-sm"
                    value={task.assignee_id || ''}
                    onChange={(e) => handleReassign(task.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="">Sem atribuição</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
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
