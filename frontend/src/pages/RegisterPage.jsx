import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register({ name, email, password });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 360, margin: '0 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
        <span className="app-brand-mark" style={{ width: 40, height: 40, borderRadius: 12, fontSize: 18 }}>
          E
        </span>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' }}>Criar conta</h1>
      </div>

      {error && (
        <div className="card" style={{ padding: 14, color: 'var(--color-priority-high-text)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="field-label" htmlFor="register-name">
            Nome
          </label>
          <input
            id="register-name"
            className="field"
            style={{ width: '100%' }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="register-email">
            Email
          </label>
          <input
            id="register-email"
            className="field"
            style={{ width: '100%' }}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="register-password">
            Palavra-passe
          </label>
          <input
            id="register-password"
            className="field"
            style={{ width: '100%' }}
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn-primary" type="submit" disabled={submitting}>
          Criar conta
        </button>
      </form>

      <p style={{ fontSize: 13, color: 'var(--color-muted)', textAlign: 'center', margin: 0 }}>
        Já tens conta? <Link to="/login" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>Iniciar sessão</Link>
      </p>
    </div>
  );
}
