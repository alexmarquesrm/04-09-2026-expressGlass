import { useEffect, useState } from 'react';
import { fetchTasks, createTask, updateTask, deleteTask } from '../api/tasks';
import TaskForm from '../components/TaskForm.jsx';
import TaskList from '../components/TaskList.jsx';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState(null);

  async function loadTasks() {
    try {
      setTasks(await fetchTasks());
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  async function handleCreate(task) {
    try {
      await createTask(task);
      await loadTasks();
      setError(null);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  async function handleToggleStatus(task) {
    try {
      const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
      await updateTask(task.id, { status: nextStatus });
      await loadTasks();
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdate(id, fields) {
    try {
      await updateTask(id, fields);
      await loadTasks();
      setError(null);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  async function handleDelete(id) {
    try {
      await deleteTask(id);
      await loadTasks();
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' }}>ExpressGlass Tasks</h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--color-muted)' }}>Track what needs doing — add a task and check it off.</p>
      </div>
      {error && <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p>}
      <TaskForm onCreate={handleCreate} />
      <TaskList tasks={tasks} onToggleStatus={handleToggleStatus} onUpdate={handleUpdate} onDelete={handleDelete} />
    </div>
  );
}
