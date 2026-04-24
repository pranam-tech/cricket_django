import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
});

export const matchApi = {
  list: () => api.get('/matches/'),
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

export default api;
