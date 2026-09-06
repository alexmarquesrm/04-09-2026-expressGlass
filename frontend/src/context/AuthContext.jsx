import { createContext, useContext, useEffect, useState } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout, fetchCurrentUser } from '../api/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(credentials) {
    const loggedInUser = await apiLogin(credentials);
    setUser(loggedInUser);
    return loggedInUser;
  }

  async function register(fields) {
    const newUser = await apiRegister(fields);
    setUser(newUser);
    return newUser;
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
