import axios from 'axios';

const API_URL = import.meta.env.PROD ? '/api' : 'http://localhost:8000/api';
const TOKEN_KEY = 'crictracker_token';

const api = axios.create({
  baseURL: API_URL,
});

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    api.defaults.headers.common.Authorization = `Token ${token}`;
  } else {
    localStorage.removeItem(TOKEN_KEY);
    delete api.defaults.headers.common.Authorization;
  }
};

const initialToken = getStoredToken();
if (initialToken) {
  setAuthToken(initialToken);
}

export const authApi = {
  register: (data) => api.post('/auth/register/', data),
  login: (data) => api.post('/auth/login/', data),
  logout: () => api.post('/auth/logout/'),
  me: () => api.get('/auth/me/'),
};

export const tournamentApi = {
  list: () => api.get('/tournaments/'),
  get: (id) => api.get(`/tournaments/${id}/`),
  create: (data) => api.post('/tournaments/', data),
};

export const matchApi = {
  list: (params = {}) => api.get('/matches/', { params }),
  get: (id) => api.get(`/matches/${id}/`),
  create: (data) => api.post('/matches/quick/', data),
  getLive: (id) => api.get(`/matches/${id}/live/`),
  startInnings: (id, data) => api.post(`/matches/${id}/start-innings/`, data),
  delete: (id) => api.delete(`/matches/${id}/`),
};

export const inningsApi = {
  recordBall: (id, data) => api.post(`/innings/${id}/ball/`, data),
  undoBall: (id) => api.post(`/innings/${id}/undo/`),
  nextBatsman: (id, data) => api.post(`/innings/${id}/next-batsman/`, data),
  nextBowler: (id, data) => api.post(`/innings/${id}/next-bowler/`, data),
};

export const scorekeeperRequestApi = {
  list: () => api.get('/scorekeeper-requests/'),
  create: (data) => api.post('/scorekeeper-requests/', data),
  approve: (id, data = {}) => api.post(`/scorekeeper-requests/${id}/approve/`, data),
  reject: (id, data = {}) => api.post(`/scorekeeper-requests/${id}/reject/`, data),
};

export default api;
