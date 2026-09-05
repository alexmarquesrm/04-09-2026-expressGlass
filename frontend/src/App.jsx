import { useEffect, useState } from 'react';
import { fetchTasks, createTask } from './api/tasks';
import TaskForm from './components/TaskForm.jsx';
import TaskList from './components/TaskList.jsx';

export default function App() {
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
    await createTask(task);
    await loadTasks();
  }

  return (
    <main style={{ maxWidth: 480, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>ExpressGlass Tasks</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <TaskForm onCreate={handleCreate} />
      <TaskList tasks={tasks} />
    </main>
  );
}
