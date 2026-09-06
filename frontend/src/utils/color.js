const PALETTE = [
  ['#0c66e4', '#0a4ea8'],
  ['#5b45e0', '#3d2fa8'],
  ['#d9822b', '#a8611f'],
  ['#4bad5c', '#2f7a3c'],
  ['#c9372c', '#932a22'],
  ['#06b6d4', '#0e7490'],
  ['#d5548c', '#a13866'],
  ['#1f9e8e', '#15746a'],
];

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function gradientFor(seed) {
  const [from, to] = PALETTE[hashString(String(seed)) % PALETTE.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}
