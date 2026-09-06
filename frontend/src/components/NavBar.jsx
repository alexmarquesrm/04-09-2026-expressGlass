import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const linkStyle = ({ isActive }) => ({
  padding: '6px 14px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
  textDecoration: 'none',
  color: isActive ? '#ffffff' : 'var(--color-muted)',
  background: isActive ? 'var(--color-accent)' : 'transparent',
});

export default function NavBar() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
      <nav style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 999, width: 'fit-content' }}>
        <NavLink to="/" end style={linkStyle}>
          Tarefas
        </NavLink>
        <NavLink to="/assistant" style={linkStyle}>
          Assistente
        </NavLink>
        <NavLink to="/boards" style={linkStyle}>
          Quadros
        </NavLink>
      </nav>

      {!loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          {user ? (
            <>
              <span style={{ color: 'var(--color-muted)' }}>Olá, {user.name}</span>
              <button type="button" className="btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={handleLogout}>
                Sair
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" style={linkStyle}>
                Iniciar sessão
              </NavLink>
              <NavLink to="/register" style={linkStyle}>
                Criar conta
              </NavLink>
            </>
          )}
        </div>
      )}
    </div>
  );
}
