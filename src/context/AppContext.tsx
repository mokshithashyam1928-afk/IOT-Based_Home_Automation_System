import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  authService,
  dashboardService,
  deviceService,
  sensorService,
  automationService,
  scheduleService,
  alertService,
  setAuthToken
} from '../services/api.ts';

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  created_at?: string;
}

export interface ToastNotice {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

interface AppContextType {
  user: UserProfile | null;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: 'ADMIN' | 'USER') => Promise<void>;
  logout: () => void;
  updateUserProfile: (name: string, role?: 'ADMIN' | 'USER') => Promise<void>;

  // Dynamic SERN State
  summary: any;
  devices: any[];
  rooms: any[];
  sensors: any[];
  sensorHistory: any[];
  energyData: any;
  rules: any[];
  schedules: any[];
  alerts: any[];
  logs: any[];
  mqttPackets: any[];
  socketConnected: boolean;

  // Loading & Error States
  loadingState: {
    dashboard: boolean;
    devices: boolean;
    sensors: boolean;
    rules: boolean;
    schedules: boolean;
    alerts: boolean;
  };
  errorState: {
    dashboard: string | null;
    devices: string | null;
    sensors: string | null;
  };

  // Actions
  refreshAllData: () => Promise<void>;
  toggleDeviceState: (deviceId: number, status?: 'ON' | 'OFF', targetValue?: number | null) => Promise<void>;
  toasts: ToastNotice[];
  addToast: (title: string, message: string, type?: ToastNotice['type']) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);

  const [summary, setSummary] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [sensors, setSensors] = useState<any[]>([]);
  const [sensorHistory, setSensorHistory] = useState<any[]>([]);
  const [energyData, setEnergyData] = useState<any>(null);
  const [rules, setRules] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [mqttPackets, setMqttPackets] = useState<any[]>([]);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  const [loadingState, setLoadingState] = useState({
    dashboard: true,
    devices: true,
    sensors: true,
    rules: true,
    schedules: true,
    alerts: true
  });

  const [errorState, setErrorState] = useState<{
    dashboard: string | null;
    devices: string | null;
    sensors: string | null;
  }>({
    dashboard: null,
    devices: null,
    sensors: null
  });

  const addToast = useCallback((title: string, message: string, type: ToastNotice['type'] = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [{ id, title, message, type }, ...prev.slice(0, 3)]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Auto-authenticate default Lead SQA Architect session on boot so user can immediately explore or switch accounts
  useEffect(() => {
    async function initAuthSession() {
      try {
        const res = await authService.login('admin@nexushome.io', 'admin123');
        setAuthToken(res.token);
        setUser(res.user);
      } catch (err) {
        console.error('Initial auto-login failed:', err);
      } finally {
        setAuthLoading(false);
      }
    }
    initAuthSession();
  }, []);

  const refreshAllData = useCallback(async () => {
    if (!user) return;
    setErrorState({ dashboard: null, devices: null, sensors: null });
    try {
      const [
        summaryRes,
        devicesRes,
        roomsRes,
        sensorsRes,
        historyRes,
        energyRes,
        rulesRes,
        schedulesRes,
        alertsRes,
        logsRes
      ] = await Promise.all([
        dashboardService.getSummary(),
        deviceService.getAll(),
        deviceService.getRooms(),
        sensorService.getSummary(),
        sensorService.getHistory({ limit: 18 }),
        dashboardService.getEnergy(),
        automationService.getAll(),
        scheduleService.getAll(),
        alertService.getAll(),
        alertService.getLogs(40)
      ]);

      setSummary(summaryRes);
      setDevices(devicesRes);
      setRooms(roomsRes);
      setSensors(sensorsRes);
      setSensorHistory(historyRes);
      setEnergyData(energyRes);
      setRules(rulesRes);
      setSchedules(schedulesRes);
      setAlerts(alertsRes);
      setLogs(logsRes);
      if (summaryRes?.mqttStatus?.recentPackets) {
        setMqttPackets(summaryRes.mqttStatus.recentPackets);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Unable to load system telemetry from Express API.';
      setErrorState({
        dashboard: msg,
        devices: msg,
        sensors: msg
      });
    } finally {
      setLoadingState({
        dashboard: false,
        devices: false,
        sensors: false,
        rules: false,
        schedules: false,
        alerts: false
      });
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshAllData();
    }
  }, [user, refreshAllData]);

  // Connect Socket.IO client for real-time server-authoritative events
  useEffect(() => {
    if (!user) return;

    const socket: Socket = io(window.location.origin, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('device:status', (updatedDevice: any) => {
      setDevices((prev) => {
        const exists = prev.some((d) => d.id === updatedDevice.id);
        const next = exists ? prev.map((d) => (d.id === updatedDevice.id ? updatedDevice : d)) : [...prev, updatedDevice];
        const onlineCount = next.filter((d) => d.is_online === 1).length;
        const offlineCount = next.length - onlineCount;
        const activeOn = next.filter((d) => d.status === 'ON' && d.is_online === 1).length;
        setSummary((s: any) =>
          s
            ? {
                ...s,
                totalDevices: next.length,
                onlineDevices: onlineCount,
                offlineDevices: offlineCount,
                activeDevicesOn: activeOn
              }
            : s
        );
        return next;
      });
    });

    socket.on('device:created', (newDevice: any) => {
      setDevices((prev) => {
        if (prev.some((d) => d.id === newDevice.id)) return prev;
        return [...prev, newDevice];
      });
      dashboardService.getSummary().then(setSummary).catch(() => {});
    });

    socket.on('device:deleted', ({ id }: { id: number }) => {
      setDevices((prev) => prev.filter((d) => d.id !== id));
      dashboardService.getSummary().then(setSummary).catch(() => {});
    });

    socket.on('sensor:update', (reading: any) => {
      // Update live summary values
      setSummary((prev: any) => {
        if (!prev) return prev;
        const next = { ...prev };
        if (reading.sensor_type === 'TEMPERATURE') next.temperature = Number(reading.value);
        if (reading.sensor_type === 'HUMIDITY') next.humidity = Number(reading.value);
        if (reading.sensor_type === 'LIGHT') next.lightLevel = Number(reading.value);
        if (reading.sensor_type === 'MOTION') next.motion = Number(reading.value) >= 1;
        if (reading.sensor_type === 'ENERGY') next.energyWatts = Number(reading.value);
        return next;
      });

      // Update sensor cards
      setSensors((prev) =>
        prev.map((s) => {
          if (s.sensorType !== reading.sensor_type) return s;
          const val = Number(reading.value);
          return {
            ...s,
            previousReading: s.currentReading,
            currentReading: val,
            delta: Number((val - s.currentReading).toFixed(2)),
            minimum: Math.min(s.minimum, val),
            maximum: Math.max(s.maximum, val),
            latencyMs: reading.latency_ms,
            recordedAt: reading.recorded_at
          };
        })
      );

      // Update historical chart time series when ENERGY or TEMPERATURE arrives
      if (reading.sensor_type === 'ENERGY') {
        sensorService.getHistory({ limit: 18 }).then(setSensorHistory).catch(() => {});
        dashboardService.getEnergy().then(setEnergyData).catch(() => {});
      }
    });

    socket.on('automation:executed', (payload: any) => {
      if (payload.rule) {
        setRules((prev) => prev.map((r) => (r.id === payload.rule.id ? payload.rule : r)));
      }
      if (payload.log) {
        setLogs((prev) => [payload.log, ...prev.slice(0, 49)]);
      }
    });

    socket.on('alert:new', (newAlert: any) => {
      setAlerts((prev) => {
        if (prev.some((a) => a.id === newAlert.id)) return prev;
        return [newAlert, ...prev];
      });
      addToast(newAlert.title, newAlert.message, newAlert.severity === 'CRITICAL' ? 'error' : 'success');
    });

    socket.on('alert:resolved', (resolvedAlert: any) => {
      if (!resolvedAlert) return;
      setAlerts((prev) => prev.map((a) => (a.id === resolvedAlert.id ? resolvedAlert : a)));
    });

    socket.on('mqtt:packet', (pkt: any) => {
      setMqttPackets((prev) => [pkt, ...prev.slice(0, 24)]);
    });

    return () => {
      socket.disconnect();
    };
  }, [user, addToast]);

  const login = async (email: string, password: string) => {
    const res = await authService.login(email, password);
    setAuthToken(res.token);
    setUser(res.user);
    addToast('Authenticated', `Signed in as ${res.user.name} (${res.user.role})`, 'success');
  };

  const register = async (name: string, email: string, password: string, role: 'ADMIN' | 'USER') => {
    const res = await authService.register(name, email, password, role);
    setAuthToken(res.token);
    setUser(res.user);
    addToast('Account Created', `Welcome ${res.user.name}`, 'success');
  };

  const logout = () => {
    setAuthToken(null);
    setUser(null);
    addToast('Signed Out', 'Your JWT session has been terminated.', 'info');
  };

  const updateUserProfile = async (name: string, role?: 'ADMIN' | 'USER') => {
    const res = await authService.updateProfile({ name, role });
    if (res.token) setAuthToken(res.token);
    setUser(res.user);
    addToast('Profile Saved', 'SQL user record and JWT claims updated.', 'success');
  };

  const toggleDeviceState = async (deviceId: number, status?: 'ON' | 'OFF', targetValue?: number | null) => {
    // Optimistic UI update
    const targetDevice = devices.find((d) => d.id === deviceId);
    const nextStatus = status || (targetDevice?.status === 'ON' ? 'OFF' : 'ON');

    setDevices((prev) =>
      prev.map((d) => (d.id === deviceId ? { ...d, status: nextStatus, is_online: 1 } : d))
    );

    try {
      const res = await deviceService.control(deviceId, {
        status: nextStatus,
        targetValue,
        bringOnline: true
      });
      if (res.device) {
        setDevices((prev) => prev.map((d) => (d.id === deviceId ? res.device : d)));
      }
      addToast(
        `${res.device?.name || 'Device'} → ${nextStatus}`,
        `MQTT ${res.mqtt?.topic} acknowledged in ${res.mqtt?.latencyMs}ms`,
        'success'
      );
    } catch (err: any) {
      // Rollback on failure
      if (targetDevice) {
        setDevices((prev) => prev.map((d) => (d.id === deviceId ? targetDevice : d)));
      }
      addToast('Control Failed', err?.response?.data?.error || 'MQTT command failed', 'error');
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        authLoading,
        login,
        register,
        logout,
        updateUserProfile,
        summary,
        devices,
        rooms,
        sensors,
        sensorHistory,
        energyData,
        rules,
        schedules,
        alerts,
        logs,
        mqttPackets,
        socketConnected,
        loadingState,
        errorState,
        refreshAllData,
        toggleDeviceState,
        toasts,
        addToast,
        dismissToast
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

// Required Reusable Custom Hooks (#12)
export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

export function useAuth() {
  const { user, authLoading, login, register, logout, updateUserProfile } = useAppContext();
  return { user, authLoading, login, register, logout, updateUserProfile };
}

export function useDashboard() {
  const { summary, energyData, loadingState, errorState, refreshAllData, socketConnected, mqttPackets } = useAppContext();
  return {
    summary,
    energyData,
    loading: loadingState.dashboard,
    error: errorState.dashboard,
    refreshAllData,
    socketConnected,
    mqttPackets
  };
}

export function useDevices() {
  const { devices, rooms, loadingState, errorState, toggleDeviceState, refreshAllData } = useAppContext();
  return {
    devices,
    rooms,
    loading: loadingState.devices,
    error: errorState.devices,
    toggleDeviceState,
    refreshDevices: refreshAllData
  };
}

export function useSensors() {
  const { sensors, sensorHistory, loadingState, errorState, refreshAllData } = useAppContext();
  return {
    sensors,
    sensorHistory,
    loading: loadingState.sensors,
    error: errorState.sensors,
    refreshSensors: refreshAllData
  };
}

export function useAutomation() {
  const { rules, loadingState, refreshAllData } = useAppContext();
  return { rules, loading: loadingState.rules, refreshRules: refreshAllData };
}

export function useSchedules() {
  const { schedules, loadingState, refreshAllData } = useAppContext();
  return { schedules, loading: loadingState.schedules, refreshSchedules: refreshAllData };
}

export function useAlerts() {
  const { alerts, logs, loadingState, refreshAllData } = useAppContext();
  return { alerts, logs, loading: loadingState.alerts, refreshAlerts: refreshAllData };
}
