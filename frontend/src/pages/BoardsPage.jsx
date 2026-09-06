import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchBoards, createBoard, deleteBoard } from '../api/boards.js';
import { useAuth } from '../context/AuthContext.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { gradientFor } from '../utils/color.js';

export default function BoardsPage() {
  const { user, loading: authLoading } = useAuth();
  const [boards, setBoards] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    if (!user) return;
    fetchBoards().then(setBoards).catch((err) => setError(err.message));
  }, [user]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const board = await createBoard(name.trim());
      setBoards((prev) => [board, ...prev]);
      setName('');
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteBoard(id);
      setBoards((prev) => prev.filter((b) => b.id !== id));
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
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' }}>Quadros</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--color-muted)' }}>
            Organiza tarefas por projeto, em colunas por estado.
          </p>
        </div>
        <div className="card" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 14 }}>
          Inicia sessão para ver e criar os teus quadros.{' '}
          <Link to="/login" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>
            Iniciar sessão
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' }}>Quadros</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--color-muted)' }}>
          Organiza tarefas por projeto, em colunas por estado.
        </p>
      </div>

      {error && (
        <div className="card" style={{ padding: 14, color: 'var(--color-priority-high-text)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="board-grid">
        {boards.map((board) => (
          <div key={board.id} style={{ position: 'relative' }}>
            <Link to={`/boards/${board.id}`} className="board-tile">
              <div className="board-tile-banner" style={{ background: gradientFor(board.id) }} />
              <div className="board-tile-body">
                <span className="board-tile-name">{board.name}</span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--color-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    flexShrink: 0,
                  }}
                >
                  {board.my_role === 'owner' ? 'Dono' : 'Membro'}
                </span>
              </div>
            </Link>
            {board.my_role === 'owner' && (
              <button
                type="button"
                className="icon-btn danger"
                aria-label="Eliminar quadro"
                onClick={() => setPendingDelete(board)}
                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(255,255,255,0.85)' }}
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <form onSubmit={handleCreate} className="board-tile-new" style={{ flexDirection: 'column', gap: 8, padding: 14 }}>
          <input
            className="field-sm"
            style={{ width: '100%', textAlign: 'center' }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do quadro"
          />
          <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} type="submit" disabled={submitting || !name.trim()}>
            + Criar quadro
          </button>
        </form>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Eliminar quadro"
          message={`Isto elimina permanentemente "${pendingDelete.name}" e todas as suas tarefas. Não pode ser desfeito.`}
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          onConfirm={() => handleDelete(pendingDelete.id)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
