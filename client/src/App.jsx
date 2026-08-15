import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Departments from './pages/Departments';
import Members from './pages/Members';
import Schedule from './pages/Schedule';
import Celebrations from './pages/Celebrations';
import MessageHub from './pages/MessageHub';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="boot">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="departments" element={<Departments />} />
        <Route path="members" element={<Members />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="celebrations" element={<Celebrations />} />
        <Route path="messages" element={<MessageHub />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
