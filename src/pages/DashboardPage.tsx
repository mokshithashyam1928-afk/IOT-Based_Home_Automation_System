import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAlerts,
  useDashboard,
  useDevices,
  useSensors,
  useAppContext
} from '../context/AppContext.tsx';
import {
  AlertCard,
  DashboardCard,
  DeviceControl,
  EmptyState,
  ErrorMessage,
  LoadingSpinner,
  SensorCard
} from '../components/ReusableUI.tsx';
import { EnergyChart, SensorChart } from '../components/Charts.tsx';
import { alertService, sensorService } from '../services/api.ts';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { summary, energyData, loading, error, refreshAllData, mqttPackets } = useDashboard();
  const { devices, toggleDeviceState } = useDevices();
  const { sensors, sensorHistory } = useSensors();
  const { alerts, refreshAlerts } = useAlerts();
  const { addToast } = useAppContext();

  if (loading && !summary) {
    return <LoadingSpinner label="Loading dashboard..." />;
  }

  if (error && !summary) {
    return <ErrorMessage message={error} onRetry={refreshAllData} />;
  }

  const handleResolveAlert = async (id: number) => {
    try {
      await alertService.resolve(id);
      await refreshAlerts();
      addToast('Alert Acknowledged', `Alert #${id} marked resolved in SQL database.`, 'success');
    } catch {
      addToast('Error', 'Unable to acknowledge alert.', 'error');
    }
  };

  const handleSimulateHighTemp = async () => {
    try {
      await sensorService.injectReading({
        sensorType: 'TEMPERATURE',
        value: 29.3,
        deviceId: 2,
        roomId: 1
      });
      addToast(
        'MQTT Sensor Injected',
        'Published 29.3°C to home/sensor/temperature -> Automation Rule #1 evaluated.',
        'info'
      );
    } catch {
      addToast('Error', 'Failed to inject MQTT reading.', 'error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header & Quick SQA / IoT Telemetry Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Smart Home Dashboard
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1 font-mono tabular-nums">
            <span>SQL + Express + React + Node.js</span>
            <span aria-hidden="true">·</span>
            <span>Avg MQTT Latency {summary?.avgLatencyMs ?? 11.5}ms</span>
            <span aria-hidden="true">·</span>
            <span>Power Load {summary?.energyWatts ?? 1380}W</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSimulateHighTemp}
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors whitespace-nowrap"
          >
            Test Thermal Rule (&gt;28°C)
          </button>
          <button
            onClick={() => navigate('/devices')}
            className="px-3.5 py-2 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap"
          >
            Manage All Devices
          </button>
        </div>
      </div>

      {/* Section 1: Summary KPI Grid (Total Devices, Online, Offline, Active Rules) */}
      <section aria-label="System Summary Metrics">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardCard
            title="Total Devices"
            value={summary?.totalDevices ?? devices.length}
            subtitle={`${summary?.activeDevicesOn ?? 0} currently active (ON)`}
          />
          <DashboardCard
            title="Online Devices"
            value={summary?.onlineDevices ?? 0}
            subtitle="Active MQTT keep-alive"
            accentColor="emerald"
          />
          <DashboardCard
            title="Offline Devices"
            value={summary?.offlineDevices ?? 0}
            subtitle="Heartbeat attention required"
            accentColor={(summary?.offlineDevices ?? 0) > 0 ? 'amber' : 'slate'}
          />
          <DashboardCard
            title="Active Rules"
            value={summary?.activeRules ?? 0}
            subtitle={`${summary?.activeSchedules ?? 0} scheduled tasks enabled`}
            accentColor="emerald"
          />
        </div>
      </section>

      {/* Section 2: Sensor Monitoring */}
      <section aria-label="Sensor Monitoring" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">
            01. Real-Time Sensor Monitoring
          </h2>
          <button
            onClick={() => navigate('/sensors')}
            className="text-xs text-slate-400 hover:text-emerald-400 transition-colors"
          >
            View Full Telemetry →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {sensors.length > 0 ? (
            sensors.slice(0, 4).map((s) => (
              <SensorCard
                key={s.sensorType}
                title={s.sensorType}
                value={
                  s.sensorType === 'MOTION'
                    ? Number(s.currentReading) >= 1
                      ? 'Detected'
                      : 'Clear'
                    : s.currentReading
                }
                unit={s.unit}
                min={s.minimum}
                max={s.maximum}
                avg={s.average}
                delta={s.sensorType === 'MOTION' ? undefined : s.delta}
                topic={s.mqttTopic}
              />
            ))
          ) : (
            <>
              <SensorCard title="TEMPERATURE" value={summary?.temperature ?? 27.5} unit="°C" topic="home/sensor/temperature" />
              <SensorCard title="HUMIDITY" value={summary?.humidity ?? 62} unit="%" topic="home/sensor/humidity" />
              <SensorCard title="LIGHT" value={summary?.lightLevel ?? 450} unit="lux" topic="home/sensor/light" />
              <SensorCard title="MOTION" value={summary?.motion ? 'Detected' : 'Clear'} unit="boolean" topic="home/sensor/motion" />
            </>
          )}
        </div>
      </section>

      {/* Section 3: Device Control */}
      <section aria-label="Device Control" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-100">
            02. Live Device Control
          </h2>
          <span className="text-xs text-slate-400 font-mono tabular-nums">
            Showing {Math.min(8, devices.length)} of {devices.length} SQL-registered devices
          </span>
        </div>

        {devices.length === 0 ? (
          <EmptyState
            title="No devices have been registered yet."
            description="Add your first smart device to begin controlling relays via MQTT."
            actionLabel="Add Smart Device"
            onAction={() => navigate('/devices')}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {devices.slice(0, 8).map((device) => (
              <DeviceControl
                key={device.id}
                device={device}
                onToggle={toggleDeviceState}
                onSelect={(id) => navigate(`/devices/${id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section 4: Dynamic Sensor & Energy Historical Charts */}
      <section aria-label="Sensor and Energy Charts" className="space-y-6">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                03. Environmental Telemetry Trends
              </h2>
              <p className="text-xs text-slate-400">
                Historical SQL sensor readings streamed from ESP32 nodes over MQTT
              </p>
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              Samples: {sensorHistory.length} intervals
            </div>
          </div>
          <SensorChart data={sensorHistory} />
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                04. Real-Time Energy Demand & Room Load Distribution
              </h2>
              <p className="text-xs text-slate-400">
                Cumulative Consumption: {energyData?.totals?.totalKwh ?? 0} kWh · Est. Cost: ${energyData?.totals?.totalCostUsd ?? 0} · Peak: {energyData?.totals?.peakWatts ?? 0}W
              </p>
            </div>
          </div>
          <EnergyChart data={sensorHistory} byRoom={energyData?.byRoom} />
        </div>
      </section>

      {/* Section 5: Recent Alerts & Live MQTT Bus Stream */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-100">
              05. Recent System Alerts
            </h2>
            <button
              onClick={() => navigate('/alerts')}
              className="text-xs text-slate-400 hover:text-emerald-400"
            >
              All Alerts →
            </button>
          </div>
          <div className="space-y-2.5">
            {alerts.length === 0 ? (
              <EmptyState
                title="No active alerts"
                description="All environmental sensors and smart devices are operating within nominal parameters."
              />
            ) : (
              alerts.slice(0, 4).map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onResolve={handleResolveAlert}
                />
              ))
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-100">
              06. Live MQTT Broker Frame Inspector
            </h2>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              QoS 1 · Low-Latency Stream
            </span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900">
                    <th className="py-2.5 px-3 font-medium">Direction</th>
                    <th className="py-2.5 px-3 font-medium">MQTT Topic</th>
                    <th className="py-2.5 px-3 font-medium">Payload</th>
                    <th className="py-2.5 px-3 font-medium text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                  {mqttPackets.slice(0, 6).map((pkt) => (
                    <tr key={pkt.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3">
                        <span className={pkt.direction === 'OUTBOUND' ? 'text-amber-400' : 'text-emerald-400'}>
                          {pkt.direction}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-200">{pkt.topic}</td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-[200px] truncate">
                        {JSON.stringify(pkt.payload)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{pkt.latencyMs}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
