import { useState } from 'react';

export default function TaskForm({ onCreate }) {
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onCreate({ title });
      setTitle('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="New task title"
      />
      <button type="submit" disabled={submitting}>
        Add
      </button>
    </form>
  );
}
