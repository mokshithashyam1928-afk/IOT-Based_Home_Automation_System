import { Request, Response } from 'express';
import { executeSql, queryAll, queryOne } from '../config/database.ts';
import { mqttService } from '../mqtt/mqttService.ts';
import { broadcastEvent } from '../websocket/socketServer.ts';
import { AuthenticatedRequest } from '../middleware/authMiddleware.ts';

export const getDevices = (req: Request, res: Response) => {
  try {
    const { roomId, type, status, search } = req.query;
    let sql = `
      SELECT d.*, r.name as room_name, r.floor as room_floor
      FROM devices d
      LEFT JOIN rooms r ON d.room_id = r.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (roomId && roomId !== 'ALL') {
      sql += ' AND d.room_id = ?';
      params.push(Number(roomId));
    }
    if (type && type !== 'ALL') {
      sql += ' AND d.type = ?';
      params.push(String(type));
    }
    if (status && status !== 'ALL') {
      sql += ' AND d.status = ?';
      params.push(String(status));
    }
    if (search) {
      sql += ' AND (LOWER(d.name) LIKE ? OR LOWER(d.device_uid) LIKE ? OR LOWER(r.name) LIKE ?)';
      const term = `%${String(search).toLowerCase()}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY d.id ASC;';
    const devices = queryAll(sql, params);
    return res.json(devices);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unable to load device data.' });
  }
};

export const getDeviceById = (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const device = queryOne(
      `SELECT d.*, r.name as room_name, r.floor as room_floor
       FROM devices d
       LEFT JOIN rooms r ON d.room_id = r.id
       WHERE d.id = ?;`,
      [id]
    );
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const recentReadings = queryAll(
      `SELECT * FROM sensor_readings WHERE device_id = ? ORDER BY id DESC LIMIT 20;`,
      [id]
    );
    const recentLogs = queryAll(
      `SELECT * FROM activity_logs WHERE entity_type = 'DEVICE' AND entity_id = ? ORDER BY id DESC LIMIT 15;`,
      [id]
    );

    return res.json({
      ...device,
      recentReadings,
      recentLogs
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unable to load device details.' });
  }
};

export const createDevice = (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, type, room_id, power_watts, target_value, ip_address, firmware_version } = req.body;
    if (!name || !type || !room_id) {
      return res.status(400).json({ error: 'Device name, type, and room_id are required.' });
    }

    const uid = `esp32-${String(type).toLowerCase().substring(0, 4)}-${Date.now().toString().slice(-4)}`;
    const nowSql = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const { lastInsertRowid } = executeSql(
      `INSERT INTO devices (device_uid, name, type, room_id, status, is_online, power_watts, target_value, mqtt_topic, firmware_version, ip_address, last_latency_ms, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'OFF', 1, ?, ?, ?, ?, ?, 10, ?, ?);`,
      [
        uid,
        String(name).trim(),
        String(type).toUpperCase(),
        Number(room_id),
        Number(power_watts || 25),
        target_value !== undefined && target_value !== '' ? Number(target_value) : null,
        `home/device/temp/status`,
        firmware_version || 'v2.4.2-esp32s3',
        ip_address || `192.168.1.${110 + Math.floor(Math.random() * 80)}`,
        nowSql,
        nowSql
      ]
    );

    const mqttTopic = `home/device/${lastInsertRowid}/status`;
    executeSql('UPDATE devices SET mqtt_topic = ? WHERE id = ?;', [mqttTopic, lastInsertRowid]);

    const newDevice = queryOne(
      `SELECT d.*, r.name as room_name, r.floor as room_floor
       FROM devices d
       LEFT JOIN rooms r ON d.room_id = r.id
       WHERE d.id = ?;`,
      [lastInsertRowid]
    );

    executeSql(
      `INSERT INTO activity_logs (actor, action_type, entity_type, entity_id, details, protocol, latency_ms)
       VALUES (?, 'DEVICE_CREATED', 'DEVICE', ?, ?, 'REST/SQL', 11);`,
      [req.user?.email || 'ADMIN', lastInsertRowid, `Provisioned device "${name}" (${uid}) on topic ${mqttTopic}`]
    );

    broadcastEvent('device:created', newDevice);
    return res.status(201).json(newDevice);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create device.' });
  }
};

export const updateDevice = (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = queryOne<any>('SELECT * FROM devices WHERE id = ?;', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const { name, type, room_id, is_online, power_watts, target_value, ip_address, firmware_version } = req.body;
    const nowSql = new Date().toISOString().replace('T', ' ').substring(0, 19);

    executeSql(
      `UPDATE devices
       SET name = ?, type = ?, room_id = ?, is_online = ?, power_watts = ?, target_value = ?, ip_address = ?, firmware_version = ?, updated_at = ?
       WHERE id = ?;`,
      [
        name !== undefined ? String(name).trim() : existing.name,
        type !== undefined ? String(type).toUpperCase() : existing.type,
        room_id !== undefined ? Number(room_id) : existing.room_id,
        is_online !== undefined ? (is_online ? 1 : 0) : existing.is_online,
        power_watts !== undefined ? Number(power_watts) : existing.power_watts,
        target_value !== undefined ? (target_value === null ? null : Number(target_value)) : existing.target_value,
        ip_address !== undefined ? String(ip_address) : existing.ip_address,
        firmware_version !== undefined ? String(firmware_version) : existing.firmware_version,
        nowSql,
        id
      ]
    );

    const updated = queryOne(
      `SELECT d.*, r.name as room_name, r.floor as room_floor
       FROM devices d
       LEFT JOIN rooms r ON d.room_id = r.id
       WHERE d.id = ?;`,
      [id]
    );

    executeSql(
      `INSERT INTO activity_logs (actor, action_type, entity_type, entity_id, details, protocol, latency_ms)
       VALUES (?, 'DEVICE_UPDATED', 'DEVICE', ?, ?, 'REST/SQL', 10);`,
      [req.user?.email || 'USER', id, `Updated configuration for "${updated?.name}"`]
    );

    broadcastEvent('device:status', updated);
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update device.' });
  }
};

export const deleteDevice = (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = queryOne<{ id: number; name: string }>('SELECT id, name FROM devices WHERE id = ?;', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Device not found' });
    }

    executeSql('DELETE FROM devices WHERE id = ?;', [id]);
    executeSql(
      `INSERT INTO activity_logs (actor, action_type, entity_type, entity_id, details, protocol, latency_ms)
       VALUES (?, 'DEVICE_DELETED', 'DEVICE', ?, ?, 'REST/SQL', 9);`,
      [req.user?.email || 'ADMIN', id, `Removed device "${existing.name}" from SQL registry`]
    );

    broadcastEvent('device:deleted', { id });
    return res.json({ message: 'Device deleted successfully', id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete device.' });
  }
};

/**
 * POST /api/devices/:id/control
 * Implements the full real-time pipeline:
 * React -> Express API -> Node.js -> MQTT (`home/device/{id}/command`) ->
 * IoT Device / Simulator -> MQTT status message (`home/device/{id}/status`) ->
 * SQL Update -> Socket.IO (`device:status`) -> React Dashboard
 */
export const controlDevice = (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = queryOne<{ id: number; name: string; status: 'ON' | 'OFF'; is_online: number; target_value: number | null }>(
      'SELECT * FROM devices WHERE id = ?;',
      [id]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const desiredStatus: 'ON' | 'OFF' = req.body.status
      ? (String(req.body.status).toUpperCase() === 'ON' ? 'ON' : 'OFF')
      : (existing.status === 'ON' ? 'OFF' : 'ON');

    const targetValue = req.body.targetValue !== undefined ? Number(req.body.targetValue) : existing.target_value;

    // If device was marked offline and user reconnects/controls it, bring it online
    if (req.body.bringOnline) {
      executeSql('UPDATE devices SET is_online = 1 WHERE id = ?;', [id]);
    }

    const dispatch = mqttService.publishCommand(id, {
      status: desiredStatus,
      targetValue,
      actor: req.user?.email || 'DASHBOARD_OPERATOR'
    });

    const updatedDevice = queryOne(
      `SELECT d.*, r.name as room_name, r.floor as room_floor
       FROM devices d
       LEFT JOIN rooms r ON d.room_id = r.id
       WHERE d.id = ?;`,
      [id]
    );

    executeSql(
      `INSERT INTO activity_logs (actor, action_type, entity_type, entity_id, details, protocol, latency_ms)
       VALUES (?, 'DEVICE_CONTROL', 'DEVICE', ?, ?, 'MQTT+WS', ?);`,
      [
        req.user?.email || 'OPERATOR',
        id,
        `Toggled "${existing.name}" -> ${desiredStatus}${targetValue !== null ? ` (Target: ${targetValue})` : ''} via ${dispatch.topic}`,
        dispatch.latencyMs
      ]
    );

    return res.json({
      device: updatedDevice,
      mqtt: dispatch
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Device control command failed.' });
  }
};

export const getRooms = (_req: Request, res: Response) => {
  const rooms = queryAll(
    `SELECT r.*, COUNT(d.id) as device_count
     FROM rooms r
     LEFT JOIN devices d ON r.id = d.room_id
     GROUP BY r.id
     ORDER BY r.id ASC;`
  );
  return res.json(rooms);
};
