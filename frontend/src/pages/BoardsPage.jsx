import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchBoards, createBoard, deleteBoard } from '../api/boards.js';
import { useAuth } from '../context/AuthContext.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

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

      <form onSubmit={handleCreate} className="card" style={{ padding: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          className="field"
          style={{ flex: 1 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do novo quadro"
        />
        <button className="btn-primary" type="submit" disabled={submitting || !name.trim()}>
          Criar quadro
        </button>
      </form>

      {boards.length === 0 ? (
        <div className="card" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 14 }}>
          Ainda não há quadros. Cria o primeiro acima.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {boards.map((board) => (
            <div key={board.id} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Link to={`/boards/${board.id}`} style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', textDecoration: 'none' }}>
                {board.name}
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {board.my_role === 'member' && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>Membro</span>
                )}
                {board.my_role === 'owner' && (
                  <button type="button" className="icon-btn danger" aria-label="Eliminar quadro" onClick={() => setPendingDelete(board)}>
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
