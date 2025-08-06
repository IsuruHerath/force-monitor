import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const apiService = {
  // Authentication endpoints
  async login(email: string, password: string) {
    const response = await api.post('/api/users/login', { email, password });
    return response.data;
  },

  async register(email: string, password: string, firstName?: string, lastName?: string) {
    const response = await api.post('/api/users/register', { 
      email, 
      password, 
      firstName, 
      lastName 
    });
    return response.data;
  },

  async validateToken() {
    const response = await api.get('/api/users/validate-token');
    return response.data;
  },

  async getUserProfile() {
    const response = await api.get('/api/users/profile');
    return response.data;
  },

  async updateUserProfile(data: { firstName?: string; lastName?: string; password?: string }) {
    const response = await api.put('/api/users/profile', data);
    return response.data;
  },

  // Organization endpoints
  async getOrganizations() {
    const response = await api.get('/api/organizations');
    return response.data;
  },

  async connectOrganization(code: string, state: string, name: string) {
    const response = await api.post('/api/organizations/connect', { code, state, name });
    return response.data;
  },

  async getOrganization(orgId: string) {
    const response = await api.get(`/api/organizations/${orgId}`);
    return response.data;
  },

  async updateOrganization(orgId: string, data: { name?: string; isActive?: boolean }) {
    const response = await api.put(`/api/organizations/${orgId}`, data);
    return response.data;
  },

  async deleteOrganization(orgId: string) {
    const response = await api.delete(`/api/organizations/${orgId}`);
    return response.data;
  },

  async getOrganizationLimits(orgId: string) {
    const response = await api.get(`/api/organizations/${orgId}/limits`);
    return response.data;
  },

  async refreshOrganizationToken(orgId: string) {
    const response = await api.post(`/api/organizations/${orgId}/refresh`);
    return response.data;
  },

  async initiateOrgConnection(environment: 'production' | 'sandbox' = 'production') {
    const response = await api.get(`/auth/connect-org?environment=${environment}`);
    return response.data;
  },

  // Legacy Phase 1 endpoints (backwards compatibility)
  async initiateOAuth(environment: 'production' | 'sandbox' = 'production') {
    const response = await api.get(`/auth/salesforce?environment=${environment}`);
    return response.data;
  },

  async getOrgLimits(sessionId?: string, orgId?: string) {
    let url = '/api/limits';
    const params = new URLSearchParams();
    
    if (sessionId) params.append('session', sessionId);
    if (orgId) params.append('orgId', orgId);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    const response = await api.get(url);
    return response.data;
  },

  async validateSession(sessionId: string) {
    const response = await api.get(`/api/session/validate?session=${sessionId}`);
    return response.data;
  }
};