import { mqttService } from '../backend/src/mqtt/mqttService.ts';
import { queryAll, queryOne } from '../backend/src/config/database.ts';
import { broadcastEvent } from '../backend/src/websocket/socketServer.ts';

class IoTSimulatorEngine {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private tickCount = 0;

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Listen to outbound MQTT commands (`home/device/{deviceId}/command`)
    // and simulate physical ESP32 actuator state transition + MQTT status publish (`home/device/{deviceId}/status`)
    mqttService.on('mqtt:command', ({ topic, payload, latencyMs }) => {
      const match = topic.match(/^home\/device\/(\d+)\/command$/);
      if (!match) return;
      const deviceId = Number(match[1]);

      // Simulate ESP32 hardware relay actuation and publish confirmation back on MQTT status topic
      const statusTopic = `home/device/${deviceId}/status`;
      mqttService.handleIncomingMqttMessage(statusTopic, {
        deviceId,
        status: payload.command,
        targetValue: payload.targetValue,
        isOnline: true,
        latencyMs: latencyMs || 11,
        firmware: 'v2.4.2-esp32s3',
        timestamp: new Date().toISOString()
      });
    });

    // Periodic live sensor telemetry emission every 6 seconds
    this.intervalId = setInterval(() => {
      if (!this.isRunning) return;
      this.emitTelemetryCycle();
    }, 6000);
  }

  public stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    broadcastEvent('simulator:status', { isRunning: this.isRunning });
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      tickCount: this.tickCount,
      intervalSeconds: 6
    };
  }

  /**
   * Generates realistic environmental & power telemetry based on active devices in SQL
   */
  public emitTelemetryCycle(customOverrides?: Partial<{ temperature: number; humidity: number; light: number; motion: number; energy: number }>) {
    this.tickCount++;

    // Calculate active power load from currently ON devices in SQL
    const activeDevices = queryAll<{ id: number; type: string; status: string; power_watts: number }>(
      `SELECT id, type, status, power_watts FROM devices WHERE status = 'ON' AND is_online = 1;`
    );

    const acRunning = activeDevices.some((d) => d.type === 'AC');
    const fanRunning = activeDevices.some((d) => d.type === 'FAN');
    const lightsOnCount = activeDevices.filter((d) => d.type === 'LIGHT').length;
    const baseWatts = activeDevices.reduce((sum, d) => sum + Number(d.power_watts || 0), 110);

    // Get latest temperature to drift smoothly
    const lastTempRow = queryOne<{ value: number }>(
      `SELECT value FROM sensor_readings WHERE sensor_type = 'TEMPERATURE' ORDER BY id DESC LIMIT 1;`
    );
    const prevTemp = lastTempRow ? Number(lastTempRow.value) : 27.2;

    // If AC/Fan are ON, temperature gently cools; otherwise rises slightly
    const thermalDelta = acRunning ? -0.15 : fanRunning ? -0.05 : 0.22;
    const jitter = (Math.random() - 0.48) * 0.35;
    const nextTemp = customOverrides?.temperature !== undefined
      ? customOverrides.temperature
      : Number(Math.min(32.5, Math.max(19.5, prevTemp + thermalDelta + jitter)).toFixed(1));

    const nextHumidity = customOverrides?.humidity !== undefined
      ? customOverrides.humidity
      : Number(Math.min(82, Math.max(38, 60 + Math.sin(this.tickCount * 0.3) * 6 + (Math.random() - 0.5) * 2)).toFixed(1));

    const nextLight = customOverrides?.light !== undefined
      ? customOverrides.light
      : Math.round(Math.max(80, 220 + lightsOnCount * 115 + (Math.random() - 0.5) * 30));

    const nextMotion = customOverrides?.motion !== undefined
      ? customOverrides.motion
      : (this.tickCount % 4 === 0 ? 1 : 0);

    const nextEnergy = customOverrides?.energy !== undefined
      ? customOverrides.energy
      : Number((baseWatts + (Math.random() - 0.5) * 25).toFixed(1));

    // Publish each reading over the MQTT topic hierarchy
    const readings = [
      mqttService.handleIncomingMqttMessage('home/sensor/temperature', {
        deviceId: 2,
        roomId: 1,
        value: nextTemp,
        unit: '°C',
        latencyMs: 9 + Math.floor(Math.random() * 5)
      }),
      mqttService.handleIncomingMqttMessage('home/sensor/humidity', {
        deviceId: 3,
        roomId: 1,
        value: nextHumidity,
        unit: '%',
        latencyMs: 10 + Math.floor(Math.random() * 4)
      }),
      mqttService.handleIncomingMqttMessage('home/sensor/light', {
        deviceId: 1,
        roomId: 1,
        value: nextLight,
        unit: 'lux',
        latencyMs: 8 + Math.floor(Math.random() * 5)
      }),
      mqttService.handleIncomingMqttMessage('home/sensor/motion', {
        deviceId: 12,
        roomId: 6,
        value: nextMotion,
        unit: 'boolean',
        latencyMs: 11 + Math.floor(Math.random() * 5)
      }),
      mqttService.handleIncomingMqttMessage('home/sensor/energy', {
        deviceId: 6,
        roomId: 3,
        value: nextEnergy,
        unit: 'W',
        latencyMs: 12 + Math.floor(Math.random() * 4)
      })
    ];

    return readings;
  }
}

export const iotSimulator = new IoTSimulatorEngine();
