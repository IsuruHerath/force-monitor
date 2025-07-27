import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const apiService = {
  async initiateOAuth(environment: 'production' | 'sandbox' = 'production') {
    const response = await api.get(`/auth/salesforce?environment=${environment}`);
    return response.data;
  },

  async getOrgLimits(sessionId: string) {
    const response = await api.get(`/api/limits?session=${sessionId}`);
    return response.data;
  },

  async validateSession(sessionId: string) {
    const response = await api.get(`/api/session/validate?session=${sessionId}`);
    return response.data;
  }
};