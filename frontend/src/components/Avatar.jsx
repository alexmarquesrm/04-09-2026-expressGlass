import { gradientFor, initials } from '../utils/color.js';

export default function Avatar({ name, size = 26, title }) {
  return (
    <span
      title={title || name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: gradientFor(name || '?'),
        color: '#ffffff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(10, size * 0.4),
        fontWeight: 700,
        flexShrink: 0,
        border: '2px solid var(--color-surface)',
        boxShadow: '0 0 0 1px rgba(28, 25, 23, 0.06)',
      }}
    >
      {initials(name)}
    </span>
  );
}
