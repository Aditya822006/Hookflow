import axios from 'axios';

const API_BASE = '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Dashboard
  getStats: async () => {
    const res = await apiClient.get('/dashboard/stats');
    return res.data;
  },
  getRecentActivity: async (limit = 10) => {
    const res = await apiClient.get(`/dashboard/recent?limit=${limit}`);
    return res.data;
  },

  // Endpoints
  getEndpoints: async (activeOnly = false) => {
    const res = await apiClient.get(`/endpoints?active_only=${activeOnly}`);
    return res.data;
  },
  getEndpoint: async (id) => {
    const res = await apiClient.get(`/endpoints/${id}`);
    return res.data;
  },
  createEndpoint: async (data) => {
    const res = await apiClient.post('/endpoints', data);
    return res.data;
  },
  updateEndpoint: async (id, data) => {
    const res = await apiClient.patch(`/endpoints/${id}`, data);
    return res.data;
  },
  toggleEndpoint: async (id) => {
    const res = await apiClient.post(`/endpoints/${id}/toggle`);
    return res.data;
  },
  deleteEndpoint: async (id) => {
    const res = await apiClient.delete(`/endpoints/${id}`);
    return res.data;
  },

  // Events
  getEvents: async (params = {}) => {
    const res = await apiClient.get('/events', { params });
    return res.data;
  },
  getEvent: async (id) => {
    const res = await apiClient.get(`/events/${id}`);
    return res.data;
  },
  submitEvent: async (data) => {
    const res = await apiClient.post('/events', data);
    return res.data;
  },
  retryEvent: async (id) => {
    const res = await apiClient.post(`/events/${id}/retry`);
    return res.data;
  },

  // Delivery Logs
  getDeliveryLogs: async (params = {}) => {
    const res = await apiClient.get('/deliveries', { params });
    return res.data;
  },

  // Sample Receiver
  getReceiverConfig: async () => {
    const res = await apiClient.get('/receiver/config');
    return res.data;
  },
  updateReceiverConfig: async (data) => {
    const res = await apiClient.post('/receiver/config', data);
    return res.data;
  },
  getReceiverLogs: async (limit = 50) => {
    const res = await apiClient.get(`/receiver/logs?limit=${limit}`);
    return res.data;
  },
  clearReceiverLogs: async () => {
    const res = await apiClient.delete('/receiver/logs');
    return res.data;
  },
};

export default api;
