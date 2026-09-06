import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import NavBar from './components/NavBar.jsx';
import ChatWidget from './components/ChatWidget.jsx';
import TasksPage from './pages/TasksPage.jsx';
import BoardsPage from './pages/BoardsPage.jsx';
import BoardDetailPage from './pages/BoardDetailPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';

function Layout() {
  const location = useLocation();
  const isBoards = location.pathname.startsWith('/boards');

  return (
    <>
      {/* Boards need room for a row of fixed-width columns plus the add-column
          tile; everything else stays a comfortable reading width. */}
      <main style={{ maxWidth: isBoards ? 1240 : 720, margin: '0 auto', padding: '56px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <NavBar />
        <Routes>
          <Route path="/" element={<TasksPage />} />
          <Route path="/boards" element={<BoardsPage />} />
          <Route path="/boards/:id" element={<BoardDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </main>
      <ChatWidget />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout />
      </AuthProvider>
    </BrowserRouter>
  );
}
