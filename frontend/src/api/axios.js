import axios from 'axios';

/**
 * Automatically determine the API Base URL:
 * - When running in browser on localhost / 127.0.0.1 -> targets local backend http://localhost:5000/api/v1
 * - When deployed on Render / remote domain -> targets Render backend https://backend-z5xa.onrender.com/api/v1
 * - Allows explicit override via VITE_API_URL environment variable
 */
export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    const isLocalLan = /^192\.168\./.test(hostname) || /^10\./.test(hostname) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) || hostname.endsWith('.local');

    if (isLocalhost) {
      if (envUrl && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
        return envUrl;
      }
      return 'http://localhost:5000/api/v1';
    } else if (isLocalLan) {
      if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
        return envUrl;
      }
      return `http://${hostname}:5000/api/v1`;
    } else {
      if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
        return envUrl;
      }
      return 'https://billflow-backend-ehym.onrender.com/api/v1';
    }
  }

  return envUrl || 'http://localhost:5000/api/v1';
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach token to every request if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
