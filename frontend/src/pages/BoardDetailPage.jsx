import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchBoard, fetchBoardTasks, createBoardTask, updateBoardTask, deleteBoardTask } from '../api/boards.js';
import { fetchMembers, addMember, removeMember } from '../api/boardMembers.js';
import { fetchColumns, createColumn, renameColumn, deleteColumn } from '../api/boardColumns.js';
import { fetchUsers } from '../api/users.js';
import { useAuth } from '../context/AuthContext.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Avatar from '../components/Avatar.jsx';
import TaskModal, { LABELS } from '../components/TaskModal.jsx';
import { gradientFor } from '../utils/color.js';

const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const ROLE_LABELS = { owner: 'Dono', member: 'Membro' };
const COLUMN_DOTS = ['#d9822b', '#5b45e0', '#4bad5c', '#0c66e4', '#c9372c', '#1f9e8e'];

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <circle cx="5" cy="12" r="1"></circle>
      <circle cx="12" cy="12" r="1"></circle>
      <circle cx="19" cy="12" r="1"></circle>
    </svg>
  );
}

export default function BoardDetailPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [board, setBoard] = useState(null);
  const [accessErrorStatus, setAccessErrorStatus] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [columns, setColumns] = useState([]);
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [newMemberId, setNewMemberId] = useState('');
  const [error, setError] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingColumnDelete, setPendingColumnDelete] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [openTaskId, setOpenTaskId] = useState(null);
  const [menuColumnId, setMenuColumnId] = useState(null);
  const [renamingColumnId, setRenamingColumnId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [composerColumnId, setComposerColumnId] = useState(null);
  const [composerTitle, setComposerTitle] = useState('');
  const [composerPriority, setComposerPriority] = useState('medium');
  const [composerAssignee, setComposerAssignee] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    if (!user) return;
    setBoard(null);
    setAccessErrorStatus(null);
    fetchBoard(id)
      .then((b) => {
        setBoard(b);
        fetchColumns(id).then(setColumns).catch((err) => setError(err.message));
        fetchBoardTasks(id).then(setTasks).catch((err) => setError(err.message));
        fetchMembers(id).then(setMembers).catch(() => setMembers([]));
      })
      .catch((err) => {
        setError(err.message);
        setAccessErrorStatus(err.status || 500);
      });
    fetchUsers().then(setUsers).catch(() => setUsers([]));
  }, [id, user]);

  function openComposer(columnId) {
    setComposerColumnId(columnId);
    setComposerTitle('');
    setComposerPriority('medium');
    setComposerAssignee('');
  }

  async function handleCreateTask(e, columnId) {
    e.preventDefault();
    if (!composerTitle.trim()) return;
    try {
      const task = await createBoardTask(id, {
        title: composerTitle.trim(),
        priority: composerPriority,
        assignee_ids: composerAssignee ? [Number(composerAssignee)] : [],
        column_id: columnId,
      });
      setTasks((prev) => [...prev, task]);
      setComposerColumnId(null);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSaveTask(taskId, fields) {
    try {
      const updated = await updateBoardTask(id, taskId, fields);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setOpenTaskId(null);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddColumn(e) {
    e.preventDefault();
    if (!newColumnName.trim()) return;
    try {
      const column = await createColumn(id, newColumnName.trim());
      setColumns((prev) => [...prev, column]);
      setNewColumnName('');
      setAddingColumn(false);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  function startRename(column) {
    setMenuColumnId(null);
    setRenamingColumnId(column.id);
    setRenameValue(column.name);
  }

  async function handleRenameColumn(e, columnId) {
    e.preventDefault();
    const next = renameValue.trim();
    const current = columns.find((c) => c.id === columnId);
    // Closed up front, not in a finally: submitting with Enter also blurs the
    // input, and leaving it open across the await would fire a second, identical
    // PATCH from the blur handler.
    setRenamingColumnId(null);
    if (!next || (current && next === current.name)) return;
    try {
      const updated = await renameColumn(id, columnId, next);
      setColumns((prev) => prev.map((c) => (c.id === columnId ? updated : c)));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteColumn(columnId) {
    try {
      await deleteColumn(id, columnId);
      setColumns((prev) => prev.filter((c) => c.id !== columnId));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setPendingColumnDelete(null);
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

  function sortedColumn(list, columnId, excludeId) {
    return list.filter((t) => t.column_id === columnId && t.id !== excludeId).sort((a, b) => a.position - b.position);
  }

  async function moveTaskTo(taskId, targetColumnId, targetIndex) {
    // Cleared here rather than relying on onDragEnd: moving a card to another
    // column unmounts its DOM node mid-drag, so dragend never fires on it and
    // the re-mounted card would stay stuck at drag opacity until a reload.
    setDraggingId(null);
    const currentTasks = tasksRef.current;
    const dragged = currentTasks.find((t) => t.id === taskId);
    if (!dragged) return;

    let adjustedIndex = targetIndex;
    if (dragged.column_id === targetColumnId) {
      const originalIndex = sortedColumn(currentTasks, targetColumnId).findIndex((t) => t.id === taskId);
      if (originalIndex !== -1 && originalIndex < adjustedIndex) {
        adjustedIndex -= 1;
      }
    }

    const destList = sortedColumn(currentTasks, targetColumnId, taskId);
    const clampedIndex = Math.max(0, Math.min(adjustedIndex, destList.length));
    destList.splice(clampedIndex, 0, { ...dragged, column_id: targetColumnId });
    const destUpdates = destList.map((t, idx) => ({ id: t.id, column_id: targetColumnId, position: idx * 10 }));

    let sourceUpdates = [];
    if (dragged.column_id !== targetColumnId) {
      const sourceList = sortedColumn(currentTasks, dragged.column_id, taskId);
      sourceUpdates = sourceList.map((t, idx) => ({ id: t.id, column_id: dragged.column_id, position: idx * 10 }));
    }

    const allUpdates = [...destUpdates, ...sourceUpdates].filter((u) => {
      const current = currentTasks.find((t) => t.id === u.id);
      return !current || current.column_id !== u.column_id || current.position !== u.position;
    });
    if (allUpdates.length === 0) return;

    setTasks((prev) =>
      prev.map((t) => {
        const u = allUpdates.find((x) => x.id === t.id);
        return u ? { ...t, column_id: u.column_id, position: u.position } : t;
      })
    );

    try {
      await Promise.all(allUpdates.map((u) => updateBoardTask(id, u.id, { column_id: u.column_id, position: u.position })));
      setError(null);
    } catch (err) {
      setError(err.message);
      try {
        // Columns too, not just tasks: the move may have failed precisely
        // because someone else deleted the column we dropped onto, and a stale
        // column would otherwise keep rendering until a full reload.
        const [freshTasks, freshColumns] = await Promise.all([fetchBoardTasks(id), fetchColumns(id)]);
        setTasks(freshTasks);
        setColumns(freshColumns);
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
  const openTask = tasks.find((t) => t.id === openTaskId) || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} onClick={() => setMenuColumnId(null)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link to="/boards" style={{ fontSize: 13, color: 'var(--color-muted)', textDecoration: 'none' }}>
          ← Quadros
        </Link>
        {board ? (
          <div className="board-hero" style={{ background: gradientFor(board.id), justifyContent: 'space-between' }}>
            <h1 className="board-hero-title">{board.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="avatar-stack">
                {members.slice(0, 4).map((m) => (
                  <Avatar key={m.user_id} name={m.name} size={26} />
                ))}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255, 255, 255, 0.85)' }}>
                {members.length} {members.length === 1 ? 'membro' : 'membros'}
              </span>
            </div>
          </div>
        ) : (
          <h1 style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' }}>A carregar...</h1>
        )}
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
              <span key={m.user_id} className="tag-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, paddingLeft: 4 }}>
                <Avatar name={m.name} size={18} />
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
              <select className="field-sm" aria-label="Adicionar membro" value={newMemberId} onChange={(e) => setNewMemberId(e.target.value)}>
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

      <div className="board-columns">
        {columns.map((column, columnIndex) => {
          const columnTasks = sortedColumn(tasks, column.id);
          return (
            <div
              key={column.id}
              className="board-column"
              style={{ position: 'relative', overflow: 'visible' }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = Number(e.dataTransfer.getData('text/plain'));
                if (taskId) moveTaskTo(taskId, column.id, columnTasks.length);
              }}
            >
              <div className="board-column-header">
                <span className="status-dot" style={{ background: COLUMN_DOTS[columnIndex % COLUMN_DOTS.length] }} />
                {renamingColumnId === column.id ? (
                  <form onSubmit={(e) => handleRenameColumn(e, column.id)} style={{ flex: 1 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      className="field-sm"
                      autoFocus
                      style={{ width: '100%' }}
                      aria-label={`Novo nome da coluna ${column.name}`}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={(e) => handleRenameColumn(e, column.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setRenamingColumnId(null);
                      }}
                    />
                  </form>
                ) : (
                  <>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {column.name}
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--color-muted)',
                        background: 'var(--color-bg)',
                        borderRadius: 999,
                        padding: '1px 8px',
                      }}
                    >
                      {columnTasks.length}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Opções da coluna ${column.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuColumnId(menuColumnId === column.id ? null : column.id);
                      }}
                      style={{ width: 24, height: 24 }}
                    >
                      <MoreIcon />
                    </button>
                  </>
                )}
              </div>

              {menuColumnId === column.id && (
                <div className="column-menu" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => startRename(column)}>
                    Mudar o nome
                  </button>
                  {isOwner && (
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        setMenuColumnId(null);
                        setPendingColumnDelete(column);
                      }}
                    >
                      Eliminar coluna
                    </button>
                  )}
                </div>
              )}

              <div className="board-column-body">
                {columnTasks.length === 0 && composerColumnId !== column.id && (
                  <div style={{ fontSize: 13, color: 'var(--color-muted)', padding: '12px 0' }}>Sem tarefas</div>
                )}
                {columnTasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="task-card"
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
                      if (taskId) moveTaskTo(taskId, column.id, index);
                    }}
                    style={{ opacity: draggingId === task.id ? 0.4 : 1 }}
                  >
                    <button type="button" className="task-card-open" onClick={() => setOpenTaskId(task.id)}>
                      {task.labels && task.labels.length > 0 && (
                        <span style={{ display: 'flex', gap: 4 }}>
                          {task.labels.map((key) => {
                            const label = LABELS.find((l) => l.key === key);
                            return label ? <span key={key} className="label-chip" style={{ background: label.color }} /> : null;
                          })}
                        </span>
                      )}
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>{task.title}</span>
                        <span className={`badge-priority ${task.priority}`} style={{ height: 'fit-content', whiteSpace: 'nowrap' }}>
                          {PRIORITY_LABELS[task.priority] || task.priority}
                        </span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        {task.description && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="2" strokeLinecap="round" aria-label="Tem descrição">
                            <line x1="4" y1="7" x2="20" y2="7"></line>
                            <line x1="4" y1="12" x2="20" y2="12"></line>
                            <line x1="4" y1="17" x2="14" y2="17"></line>
                          </svg>
                        )}
                        {task.due_date && (
                          <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                            {new Date(task.due_date).toLocaleDateString('pt-PT', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        {task.assignees && task.assignees.length > 0 && (
                          <span className="avatar-stack" style={{ marginLeft: 'auto' }}>
                            {task.assignees.map((a) => (
                              <Avatar key={a.user_id} name={a.name} size={22} />
                            ))}
                          </span>
                        )}
                      </span>
                    </button>
                  </div>
                ))}

                {composerColumnId === column.id ? (
                  <form
                    onSubmit={(e) => handleCreateTask(e, column.id)}
                    style={{
                      border: '1px solid var(--color-accent)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      boxShadow: '0 0 0 3px var(--color-accent-tint-bg)',
                    }}
                  >
                    <input
                      className="field-sm"
                      autoFocus
                      placeholder="Título do cartão"
                      aria-label="Título do cartão"
                      value={composerTitle}
                      onChange={(e) => setComposerTitle(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select className="field-sm" aria-label="Prioridade" style={{ flex: 1 }} value={composerPriority} onChange={(e) => setComposerPriority(e.target.value)}>
                        <option value="low">Baixa</option>
                        <option value="medium">Média</option>
                        <option value="high">Alta</option>
                      </select>
                      <select className="field-sm" aria-label="Responsável do novo cartão" style={{ flex: 1 }} value={composerAssignee} onChange={(e) => setComposerAssignee(e.target.value)}>
                        <option value="">Sem responsável</option>
                        {members.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button className="btn-primary" type="submit" style={{ padding: '8px 16px', fontSize: 13 }} disabled={!composerTitle.trim()}>
                        Adicionar
                      </button>
                      <button type="button" className="icon-btn" aria-label="Cancelar" onClick={() => setComposerColumnId(null)}>
                        ✕
                      </button>
                    </div>
                  </form>
                ) : (
                  <button type="button" className="add-card-btn" onClick={() => openComposer(column.id)}>
                    <PlusIcon />
                    Adicionar cartão
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {board &&
          (addingColumn ? (
            <form
              onSubmit={handleAddColumn}
              className="card"
              style={{ width: 240, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <input
                className="field-sm"
                autoFocus
                placeholder="Nome da coluna"
                aria-label="Nome da nova coluna"
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn-primary" type="submit" style={{ padding: '8px 16px', fontSize: 13 }} disabled={!newColumnName.trim()}>
                  Adicionar
                </button>
                <button type="button" className="icon-btn" aria-label="Cancelar nova coluna" onClick={() => setAddingColumn(false)}>
                  ✕
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className="board-tile-new" style={{ width: 200, height: 116, gap: 6 }} onClick={() => setAddingColumn(true)}>
              <PlusIcon />
              Adicionar coluna
            </button>
          ))}
      </div>

      {openTask && (
        <TaskModal
          task={openTask}
          columns={columns}
          members={members}
          onSave={(fields) => handleSaveTask(openTask.id, fields)}
          onDelete={(task) => {
            setOpenTaskId(null);
            setPendingDelete(task);
          }}
          onClose={() => setOpenTaskId(null)}
        />
      )}

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

      {pendingColumnDelete && (
        <ConfirmDialog
          title="Eliminar coluna"
          message={`Isto elimina a coluna "${pendingColumnDelete.name}". Só é possível se a coluna já não tiver cartões.`}
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          onConfirm={() => handleDeleteColumn(pendingColumnDelete.id)}
          onCancel={() => setPendingColumnDelete(null)}
        />
      )}
    </div>
  );
}
