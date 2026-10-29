import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        setUser(res.data.data.user);
        setBusiness(res.data.data.business);
      } catch {
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const register = async (formData) => {
    const res = await api.post('/auth/register', formData);
    const { token, user: userData, business: bizData } = res.data.data;
    localStorage.setItem('token', token);
    setUser(userData);
    setBusiness(bizData);
    return res.data;
  };

  const login = async (formData) => {
    const res = await api.post('/auth/login', formData);
    const { token, user: userData, business: bizData } = res.data.data;
    localStorage.setItem('token', token);
    setUser(userData);
    setBusiness(bizData);
    return res.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Logout is best-effort
    }
    localStorage.removeItem('token');
    setUser(null);
    setBusiness(null);
  };

  return (
    <AuthContext.Provider value={{ user, business, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
