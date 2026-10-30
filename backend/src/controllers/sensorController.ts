import { Request, Response } from 'express';
import { queryAll, queryOne } from '../config/database.ts';
import { mqttService } from '../mqtt/mqttService.ts';
import { iotSimulator } from '../../../iot-simulator/simulator.ts';

const SENSOR_TYPES = ['TEMPERATURE', 'HUMIDITY', 'LIGHT', 'MOTION', 'ENERGY'] as const;

export const getSensorsSummary = (_req: Request, res: Response) => {
  try {
    const metrics = SENSOR_TYPES.map((type) => {
      const latestTwo = queryAll<{ value: number; unit: string; recorded_at: string; mqtt_topic: string; latency_ms: number }>(
        `SELECT value, unit, recorded_at, mqtt_topic, latency_ms
         FROM sensor_readings
         WHERE sensor_type = ?
         ORDER BY id DESC
         LIMIT 2;`,
        [type]
      );

      const stats = queryOne<{ min_val: number; max_val: number; avg_val: number; total_samples: number }>(
        `SELECT MIN(value) as min_val, MAX(value) as max_val, ROUND(AVG(value), 2) as avg_val, COUNT(*) as total_samples
         FROM sensor_readings
         WHERE sensor_type = ?;`,
        [type]
      );

      const current = latestTwo[0]?.value ?? 0;
      const previous = latestTwo[1]?.value ?? current;
      const delta = Number((current - previous).toFixed(2));

      return {
        sensorType: type,
        unit: latestTwo[0]?.unit || (type === 'TEMPERATURE' ? '°C' : type === 'HUMIDITY' ? '%' : type === 'LIGHT' ? 'lux' : type === 'ENERGY' ? 'W' : 'boolean'),
        currentReading: current,
        previousReading: previous,
        delta,
        minimum: stats?.min_val ?? current,
        maximum: stats?.max_val ?? current,
        average: stats?.avg_val ?? current,
        totalSamples: stats?.total_samples ?? 0,
        mqttTopic: latestTwo[0]?.mqtt_topic || `home/sensor/${type.toLowerCase()}`,
        latencyMs: latestTwo[0]?.latency_ms || 10,
        recordedAt: latestTwo[0]?.recorded_at || new Date().toISOString()
      };
    });

    return res.json(metrics);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unable to load sensor metrics.' });
  }
};

export const getSensorHistory = (req: Request, res: Response) => {
  try {
    const limit = Math.min(60, Number(req.query.limit || 20));
    const sensorType = req.query.type ? String(req.query.type).toUpperCase() : null;

    if (sensorType && SENSOR_TYPES.includes(sensorType as any)) {
      const rows = queryAll(
        `SELECT sr.*, d.name as device_name, r.name as room_name
         FROM sensor_readings sr
         LEFT JOIN devices d ON sr.device_id = d.id
         LEFT JOIN rooms r ON sr.room_id = r.id
         WHERE sr.sensor_type = ?
         ORDER BY sr.id DESC
         LIMIT ?;`,
        [sensorType, limit]
      ).reverse();
      return res.json(rows);
    }

    // Build combined time-series frames for Recharts
    const tempRows = queryAll<{ value: number; recorded_at: string }>(
      `SELECT value, recorded_at FROM sensor_readings WHERE sensor_type = 'TEMPERATURE' ORDER BY id DESC LIMIT ?;`,
      [limit]
    ).reverse();
    const humRows = queryAll<{ value: number }>(
      `SELECT value FROM sensor_readings WHERE sensor_type = 'HUMIDITY' ORDER BY id DESC LIMIT ?;`,
      [limit]
    ).reverse();
    const lightRows = queryAll<{ value: number }>(
      `SELECT value FROM sensor_readings WHERE sensor_type = 'LIGHT' ORDER BY id DESC LIMIT ?;`,
      [limit]
    ).reverse();
    const motionRows = queryAll<{ value: number }>(
      `SELECT value FROM sensor_readings WHERE sensor_type = 'MOTION' ORDER BY id DESC LIMIT ?;`,
      [limit]
    ).reverse();
    const energyRows = queryAll<{ value: number }>(
      `SELECT value FROM sensor_readings WHERE sensor_type = 'ENERGY' ORDER BY id DESC LIMIT ?;`,
      [limit]
    ).reverse();

    const series = tempRows.map((row, idx) => {
      const timeLabel = row.recorded_at ? row.recorded_at.substring(11, 19) : `T-${idx}`;
      return {
        time: timeLabel,
        recordedAt: row.recorded_at,
        temperature: Number(row.value),
        humidity: Number(humRows[idx]?.value ?? 60),
        light: Number(lightRows[idx]?.value ?? 400),
        motion: Number(motionRows[idx]?.value ?? 0),
        energy: Number(energyRows[idx]?.value ?? 1350)
      };
    });

    return res.json(series);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unable to load sensor history.' });
  }
};

export const getSensorsByDevice = (req: Request, res: Response) => {
  try {
    const deviceId = Number(req.params.deviceId);
    const rows = queryAll(
      `SELECT * FROM sensor_readings WHERE device_id = ? ORDER BY id DESC LIMIT 30;`,
      [deviceId]
    );
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unable to load device sensor readings.' });
  }
};

export const injectSensorReading = (req: Request, res: Response) => {
  try {
    const { sensorType, value, deviceId, roomId } = req.body;
    if (!sensorType || value === undefined) {
      return res.status(400).json({ error: 'sensorType and value are required.' });
    }
    const topic = `home/sensor/${String(sensorType).toLowerCase()}`;
    const record = mqttService.handleIncomingMqttMessage(topic, {
      value: Number(value),
      deviceId: Number(deviceId || 2),
      roomId: Number(roomId || 1),
      latencyMs: 8
    });
    return res.status(201).json(record);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to publish MQTT sensor reading.' });
  }
};

export const triggerSimulatorPulse = (req: Request, res: Response) => {
  try {
    const readings = iotSimulator.emitTelemetryCycle(req.body);
    return res.json({
      status: 'PUBLISHED',
      simulator: iotSimulator.getStatus(),
      readings
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to trigger IoT simulator.' });
  }
};
