import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ email, password });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 360, margin: '0 auto' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' }}>Iniciar sessão</h1>
      </div>

      {error && (
        <div className="card" style={{ padding: 14, color: 'var(--color-priority-high-text)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="field-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="field"
            style={{ width: '100%' }}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="login-password">
            Palavra-passe
          </label>
          <input
            id="login-password"
            className="field"
            style={{ width: '100%' }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn-primary" type="submit" disabled={submitting}>
          Entrar
        </button>
      </form>

      <p style={{ fontSize: 13, color: 'var(--color-muted)', textAlign: 'center', margin: 0 }}>
        Ainda não tens conta? <Link to="/register" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>Criar conta</Link>
      </p>
    </div>
  );
}
