import { BrowserRouter, Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import TasksPage from './pages/TasksPage.jsx';
import AssistantPage from './pages/AssistantPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '56px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <NavBar />
        <Routes>
          <Route path="/" element={<TasksPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
