import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import NavBar from './components/NavBar.jsx';
import TasksPage from './pages/TasksPage.jsx';
import AssistantPage from './pages/AssistantPage.jsx';
import BoardsPage from './pages/BoardsPage.jsx';
import BoardDetailPage from './pages/BoardDetailPage.jsx';

function Layout() {
  const location = useLocation();
  const isBoards = location.pathname.startsWith('/boards');

  return (
    <main style={{ maxWidth: isBoards ? 1100 : 720, margin: '0 auto', padding: '56px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <NavBar />
      <Routes>
        <Route path="/" element={<TasksPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/boards" element={<BoardsPage />} />
        <Route path="/boards/:id" element={<BoardDetailPage />} />
      </Routes>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
