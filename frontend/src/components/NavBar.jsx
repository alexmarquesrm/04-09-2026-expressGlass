import { NavLink } from 'react-router-dom';

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
  return (
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
  );
}
