import { Request, Response } from 'express';
import { queryAll, queryOne } from '../config/database.ts';
import { mqttService } from '../mqtt/mqttService.ts';
import { iotSimulator } from '../../../iot-simulator/simulator.ts';

export const getDashboardSummary = (_req: Request, res: Response) => {
  try {
    const totalDevices = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM devices;')?.cnt ?? 0;
    const onlineDevices = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM devices WHERE is_online = 1;')?.cnt ?? 0;
    const offlineDevices = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM devices WHERE is_online = 0;')?.cnt ?? 0;
    const activeDevicesOn = queryOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM devices WHERE status = 'ON' AND is_online = 1;`)?.cnt ?? 0;
    const activeRules = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM automation_rules WHERE is_active = 1;')?.cnt ?? 0;
    const activeSchedules = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM schedules WHERE is_active = 1;')?.cnt ?? 0;
    const unresolvedAlerts = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM alerts WHERE is_resolved = 0;')?.cnt ?? 0;

    const latestTemp = queryOne<{ value: number }>(`SELECT value FROM sensor_readings WHERE sensor_type = 'TEMPERATURE' ORDER BY id DESC LIMIT 1;`)?.value ?? 27.5;
    const latestHumidity = queryOne<{ value: number }>(`SELECT value FROM sensor_readings WHERE sensor_type = 'HUMIDITY' ORDER BY id DESC LIMIT 1;`)?.value ?? 62;
    const latestLight = queryOne<{ value: number }>(`SELECT value FROM sensor_readings WHERE sensor_type = 'LIGHT' ORDER BY id DESC LIMIT 1;`)?.value ?? 450;
    const latestMotionVal = queryOne<{ value: number }>(`SELECT value FROM sensor_readings WHERE sensor_type = 'MOTION' ORDER BY id DESC LIMIT 1;`)?.value ?? 1;
    const latestEnergy = queryOne<{ value: number }>(`SELECT value FROM sensor_readings WHERE sensor_type = 'ENERGY' ORDER BY id DESC LIMIT 1;`)?.value ?? 1380;

    const avgLatency = queryOne<{ avg_lat: number }>('SELECT ROUND(AVG(last_latency_ms), 1) as avg_lat FROM devices WHERE is_online = 1;')?.avg_lat ?? 11.5;

    return res.json({
      totalDevices,
      onlineDevices,
      offlineDevices,
      activeDevicesOn,
      activeRules,
      activeSchedules,
      unresolvedAlerts,
      temperature: Number(latestTemp),
      humidity: Number(latestHumidity),
      lightLevel: Number(latestLight),
      motion: Number(latestMotionVal) >= 1,
      energyWatts: Number(latestEnergy),
      avgLatencyMs: Number(avgLatency),
      mqttStatus: mqttService.getDiagnostics(),
      simulatorStatus: iotSimulator.getStatus()
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unable to load dashboard summary.' });
  }
};

export const getDashboardDevices = (_req: Request, res: Response) => {
  try {
    const devices = queryAll(
      `SELECT d.*, r.name as room_name, r.floor as room_floor
       FROM devices d
       LEFT JOIN rooms r ON d.room_id = r.id
       ORDER BY d.id ASC;`
    );
    return res.json(devices);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unable to load dashboard devices.' });
  }
};

export const getDashboardAlerts = (_req: Request, res: Response) => {
  try {
    const alerts = queryAll(
      `SELECT a.*, d.name as device_name
       FROM alerts a
       LEFT JOIN devices d ON a.device_id = d.id
       ORDER BY a.id DESC
       LIMIT 10;`
    );
    return res.json(alerts);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unable to load dashboard alerts.' });
  }
};

export const getDashboardEnergy = (_req: Request, res: Response) => {
  try {
    const history = queryAll(
      `SELECT eu.*, d.name as device_name, r.name as room_name
       FROM energy_usage eu
       LEFT JOIN devices d ON eu.device_id = d.id
       LEFT JOIN rooms r ON eu.room_id = r.id
       ORDER BY eu.id DESC
       LIMIT 20;`
    ).reverse();

    const byRoom = queryAll(
      `SELECT r.name as room_name,
              ROUND(SUM(CASE WHEN d.status = 'ON' AND d.is_online = 1 THEN d.power_watts ELSE 0 END), 1) as active_watts,
              COUNT(d.id) as device_count
       FROM rooms r
       LEFT JOIN devices d ON r.id = d.room_id
       GROUP BY r.id
       ORDER BY active_watts DESC;`
    );

    const totals = queryOne<{ total_kwh: number; total_cost: number; peak_watts: number }>(
      `SELECT ROUND(SUM(energy_kwh), 2) as total_kwh,
              ROUND(SUM(cost_usd), 2) as total_cost,
              ROUND(MAX(power_watts), 1) as peak_watts
       FROM energy_usage;`
    );

    return res.json({
      history,
      byRoom,
      totals: {
        totalKwh: totals?.total_kwh ?? 0,
        totalCostUsd: totals?.total_cost ?? 0,
        peakWatts: totals?.peak_watts ?? 0
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unable to load dashboard energy data.' });
  }
};

export const getDashboardActivity = (_req: Request, res: Response) => {
  try {
    const logs = queryAll(
      `SELECT * FROM activity_logs ORDER BY id DESC LIMIT 25;`
    );
    return res.json(logs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unable to load activity logs.' });
  }
};
