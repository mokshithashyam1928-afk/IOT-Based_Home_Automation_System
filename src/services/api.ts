import axios from 'axios';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

let memoryJwtToken: string | null = null;

export function setAuthToken(token: string | null) {
  memoryJwtToken = token;
}

export function getAuthToken(): string | null {
  return memoryJwtToken;
}

apiClient.interceptors.request.use((config) => {
  if (memoryJwtToken && config.headers) {
    config.headers.Authorization = `Bearer ${memoryJwtToken}`;
  }
  return config;
});

// ======================== SERVICE MODULES ========================

export const authService = {
  login: async (email: string, password: string) => {
    const { data } = await apiClient.post('/auth/login', { email, password });
    return data;
  },
  register: async (name: string, email: string, password: string, role: 'ADMIN' | 'USER' = 'USER') => {
    const { data } = await apiClient.post('/auth/register', { name, email, password, role });
    return data;
  },
  me: async () => {
    const { data } = await apiClient.get('/auth/me');
    return data;
  },
  updateProfile: async (payload: { name: string; role?: 'ADMIN' | 'USER' }) => {
    const { data } = await apiClient.put('/auth/profile', payload);
    return data;
  },
  getUsers: async () => {
    const { data } = await apiClient.get('/users');
    return data;
  }
};

export const dashboardService = {
  getSummary: async () => {
    const { data } = await apiClient.get('/dashboard/summary');
    return data;
  },
  getDevices: async () => {
    const { data } = await apiClient.get('/dashboard/devices');
    return data;
  },
  getSensors: async () => {
    const { data } = await apiClient.get('/dashboard/sensors');
    return data;
  },
  getAlerts: async () => {
    const { data } = await apiClient.get('/dashboard/alerts');
    return data;
  },
  getEnergy: async () => {
    const { data } = await apiClient.get('/dashboard/energy');
    return data;
  },
  getActivity: async () => {
    const { data } = await apiClient.get('/dashboard/activity');
    return data;
  }
};

export const deviceService = {
  getAll: async (params?: { roomId?: string; type?: string; status?: string; search?: string }) => {
    const { data } = await apiClient.get('/devices', { params });
    return data;
  },
  getById: async (id: number | string) => {
    const { data } = await apiClient.get(`/devices/${id}`);
    return data;
  },
  create: async (payload: any) => {
    const { data } = await apiClient.post('/devices', payload);
    return data;
  },
  update: async (id: number | string, payload: any) => {
    const { data } = await apiClient.put(`/devices/${id}`, payload);
    return data;
  },
  remove: async (id: number | string) => {
    const { data } = await apiClient.delete(`/devices/${id}`);
    return data;
  },
  control: async (id: number | string, payload?: { status?: 'ON' | 'OFF'; targetValue?: number | null; bringOnline?: boolean }) => {
    const { data } = await apiClient.post(`/devices/${id}/control`, payload || {});
    return data;
  },
  getRooms: async () => {
    const { data } = await apiClient.get('/rooms');
    return data;
  }
};

export const sensorService = {
  getSummary: async () => {
    const { data } = await apiClient.get('/sensors');
    return data;
  },
  getHistory: async (params?: { limit?: number; type?: string }) => {
    const { data } = await apiClient.get('/sensors/history', { params });
    return data;
  },
  getByDevice: async (deviceId: number | string) => {
    const { data } = await apiClient.get(`/sensors/${deviceId}`);
    return data;
  },
  injectReading: async (payload: { sensorType: string; value: number; deviceId?: number; roomId?: number }) => {
    const { data } = await apiClient.post('/sensors/inject', payload);
    return data;
  },
  triggerSimulatorPulse: async (overrides?: any) => {
    const { data } = await apiClient.post('/simulator/pulse', overrides || {});
    return data;
  }
};

export const automationService = {
  getAll: async () => {
    const { data } = await apiClient.get('/automation');
    return data;
  },
  create: async (payload: any) => {
    const { data } = await apiClient.post('/automation', payload);
    return data;
  },
  update: async (id: number, payload: any) => {
    const { data } = await apiClient.put(`/automation/${id}`, payload);
    return data;
  },
  remove: async (id: number) => {
    const { data } = await apiClient.delete(`/automation/${id}`);
    return data;
  },
  evaluateNow: async (id: number) => {
    const { data } = await apiClient.post(`/automation/${id}/evaluate`);
    return data;
  }
};

export const scheduleService = {
  getAll: async () => {
    const { data } = await apiClient.get('/schedules');
    return data;
  },
  create: async (payload: any) => {
    const { data } = await apiClient.post('/schedules', payload);
    return data;
  },
  update: async (id: number, payload: any) => {
    const { data } = await apiClient.put(`/schedules/${id}`, payload);
    return data;
  },
  remove: async (id: number) => {
    const { data } = await apiClient.delete(`/schedules/${id}`);
    return data;
  },
  runNow: async (id: number) => {
    const { data } = await apiClient.post(`/schedules/${id}/run`);
    return data;
  }
};

export const alertService = {
  getAll: async (severity?: string) => {
    const { data } = await apiClient.get('/alerts', { params: { severity } });
    return data;
  },
  resolve: async (id: number) => {
    const { data } = await apiClient.put(`/alerts/${id}/resolve`);
    return data;
  },
  remove: async (id: number) => {
    const { data } = await apiClient.delete(`/alerts/${id}`);
    return data;
  },
  getLogs: async (limit = 50) => {
    const { data } = await apiClient.get('/logs', { params: { limit } });
    return data;
  }
};

export const sqaService = {
  getTests: async () => {
    const { data } = await apiClient.get('/sqa/tests');
    return data;
  },
  runSingleTest: async (testCode: string) => {
    const { data } = await apiClient.post(`/sqa/tests/${testCode}/run`);
    return data;
  },
  runAllTests: async () => {
    const { data } = await apiClient.post('/sqa/tests/run-all');
    return data;
  }
};
