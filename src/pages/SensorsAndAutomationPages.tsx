import React, { useState } from 'react';
import { Play, Plus, Trash2, Zap, CalendarClock, Radio } from 'lucide-react';
import {
  useAutomation,
  useDevices,
  useSchedules,
  useSensors,
  useDashboard,
  useAppContext
} from '../context/AppContext.tsx';
import {
  sensorService,
  automationService,
  scheduleService
} from '../services/api.ts';
import {
  EmptyState,
  ErrorMessage,
  LoadingSpinner,
  Modal,
  SensorCard,
  ToggleSwitch
} from '../components/ReusableUI.tsx';
import { EnergyChart, SensorChart } from '../components/Charts.tsx';

// ======================== SENSORS PAGE (/sensors) ========================
export const SensorsPage: React.FC = () => {
  const { sensors, sensorHistory, loading, error, refreshSensors } = useSensors();
  const { energyData } = useDashboard();
  const { addToast } = useAppContext();

  const [injectType, setInjectType] = useState('TEMPERATURE');
  const [injectValue, setInjectValue] = useState('28.6');

  if (loading && sensors.length === 0) {
    return <LoadingSpinner label="Loading sensor data..." />;
  }

  if (error && sensors.length === 0) {
    return <ErrorMessage message="Unable to load sensor telemetry." onRetry={refreshSensors} />;
  }

  const handleManualInject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sensorService.injectReading({
        sensorType: injectType,
        value: Number(injectValue)
      });
      addToast(
        'MQTT Sensor Published',
        `Published ${injectValue} to home/sensor/${injectType.toLowerCase()} (evaluated against SQL rules).`,
        'success'
      );
      await refreshSensors();
    } catch (err: any) {
      addToast('Publish Failed', err?.response?.data?.error || 'Could not publish sensor payload', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Environmental & Energy Sensor Telemetry
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time MQTT sensor topics (Current, Previous, Min, Max, Average, and SQL historical trends)
          </p>
        </div>

        {/* Interactive ESP32 Sensor Simulator Injector */}
        <form onSubmit={handleManualInject} className="flex flex-wrap items-center gap-2">
          <select
            value={injectType}
            onChange={(e) => {
              const t = e.target.value;
              setInjectType(t);
              if (t === 'TEMPERATURE') setInjectValue('29.2');
              if (t === 'HUMIDITY') setInjectValue('72');
              if (t === 'LIGHT') setInjectValue('240');
              if (t === 'MOTION') setInjectValue('1');
              if (t === 'ENERGY') setInjectValue('1920');
            }}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-800 bg-slate-900 text-slate-200"
          >
            <option value="TEMPERATURE">TEMPERATURE (°C)</option>
            <option value="HUMIDITY">HUMIDITY (%)</option>
            <option value="LIGHT">LIGHT (lux)</option>
            <option value="MOTION">MOTION (0/1)</option>
            <option value="ENERGY">ENERGY (W)</option>
          </select>
          <input
            type="number"
            step="0.1"
            value={injectValue}
            onChange={(e) => setInjectValue(e.target.value)}
            className="w-24 px-3 py-1.5 text-xs rounded-lg border border-slate-800 bg-slate-900 text-slate-100 font-mono"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 whitespace-nowrap"
          >
            <Radio className="w-3.5 h-3.5" />
            Inject MQTT Payload
          </button>
        </form>
      </div>

      {/* Sensor Statistical Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {sensors.map((s) => (
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
        ))}
      </div>

      {/* Detailed Statistical Comparison Table */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">
            SQL Sensor Statistical Summary (Current vs Previous, Min, Max, Average)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-900">
                <th className="py-2.5 px-3 font-medium">Sensor Type</th>
                <th className="py-2.5 px-3 font-medium">MQTT Topic</th>
                <th className="py-2.5 px-3 font-medium text-right">Current</th>
                <th className="py-2.5 px-3 font-medium text-right">Previous</th>
                <th className="py-2.5 px-3 font-medium text-right">Minimum</th>
                <th className="py-2.5 px-3 font-medium text-right">Maximum</th>
                <th className="py-2.5 px-3 font-medium text-right">Average</th>
                <th className="py-2.5 px-3 font-medium text-right">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
              {sensors.map((s) => (
                <tr key={s.sensorType} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-sans font-semibold text-slate-100">{s.sensorType}</td>
                  <td className="py-2.5 px-3 text-emerald-400">{s.mqttTopic}</td>
                  <td className="py-2.5 px-3 text-right text-slate-100 font-semibold">
                    {s.currentReading} {s.unit === 'boolean' ? '' : s.unit}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400">
                    {s.previousReading} {s.unit === 'boolean' ? '' : s.unit}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-300">{s.minimum}</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">{s.maximum}</td>
                  <td className="py-2.5 px-3 text-right text-slate-300">{s.average}</td>
                  <td className="py-2.5 px-3 text-right text-slate-400">{s.latencyMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-Axis Environmental & Energy Charts */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <h2 className="text-base font-semibold text-slate-100">
          Multi-Sensor Historical Time Series (Temperature, Humidity, Light)
        </h2>
        <SensorChart data={sensorHistory} />
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5 space-y-4">
        <h2 className="text-base font-semibold text-slate-100">
          Power Consumption & Room Load Analysis
        </h2>
        <EnergyChart data={sensorHistory} byRoom={energyData?.byRoom} />
      </div>
    </div>
  );
};

// ======================== AUTOMATION PAGE (/automation) ========================
export const AutomationPage: React.FC = () => {
  const { rules, loading, refreshRules } = useAutomation();
  const { devices } = useDevices();
  const { addToast } = useAppContext();

  const [modalOpen, setModalOpen] = useState(false);
  const [formState, setFormState] = useState({
    name: '',
    description: '',
    sensor_type: 'TEMPERATURE',
    condition_operator: '>',
    threshold_value: '28.0',
    target_device_id: '3',
    target_action: 'ON'
  });

  if (loading && rules.length === 0) {
    return <LoadingSpinner label="Loading automation rules..." />;
  }

  const handleToggleRule = async (rule: any) => {
    try {
      await automationService.update(rule.id, { is_active: rule.is_active ? 0 : 1 });
      await refreshRules();
      addToast(
        'Rule Updated',
        `Rule "${rule.name}" is now ${rule.is_active ? 'Paused' : 'Active'}.`,
        'info'
      );
    } catch {
      addToast('Error', 'Failed to update rule state', 'error');
    }
  };

  const handleEvaluateRule = async (rule: any) => {
    try {
      const res = await automationService.evaluateNow(rule.id);
      await refreshRules();
      addToast('Automation Triggered', res.message, 'success');
    } catch {
      addToast('Error', 'Failed to evaluate rule', 'error');
    }
  };

  const handleDeleteRule = async (id: number) => {
    try {
      await automationService.remove(id);
      await refreshRules();
      addToast('Rule Deleted', `Removed rule #${id} from SQL database.`, 'info');
    } catch {
      addToast('Error', 'Failed to delete rule', 'error');
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await automationService.create({
        ...formState,
        threshold_value: Number(formState.threshold_value),
        target_device_id: Number(formState.target_device_id)
      });
      setModalOpen(false);
      await refreshRules();
      addToast('Rule Created', `Automation rule "${formState.name}" saved to SQL.`, 'success');
    } catch (err: any) {
      addToast('Error', err?.response?.data?.error || 'Could not create rule', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Node.js Automation Rule Engine
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Sensor Reading → Evaluate SQL Rules → Publish MQTT Command → Update Device → Emit Socket.IO Event
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          New Automation Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          title="No automation rules configured."
          description="Create an IF-THEN sensor rule to automate your smart home devices."
          actionLabel="Create First Rule"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="rounded-lg border border-slate-800 bg-slate-900/70 p-5 flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
                    <span className={rule.is_active ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                      {rule.is_active ? 'ACTIVE' : 'PAUSED'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Executions: {rule.execution_count}</span>
                    {rule.last_triggered_at && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Last: {rule.last_triggered_at}</span>
                      </>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-slate-100 mt-1">{rule.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">{rule.description}</p>
                </div>
                <ToggleSwitch
                  checked={Boolean(rule.is_active)}
                  onChange={() => handleToggleRule(rule)}
                />
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-mono text-slate-300">
                  IF <span className="text-emerald-400">{rule.sensor_type}</span> {rule.condition_operator}{' '}
                  <span className="text-amber-400">{rule.threshold_value}</span> → SET{' '}
                  <span className="text-slate-100">{rule.target_device_name || `Device #${rule.target_device_id}`}</span>{' '}
                  TO <span className="text-emerald-400 font-semibold">{rule.target_action}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEvaluateRule(rule)}
                    className="px-2.5 py-1 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 whitespace-nowrap"
                  >
                    <Play className="w-3 h-3 text-emerald-400" />
                    Simulate Trigger
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400"
                    title="Delete Rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} title="Create Automation Rule" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleCreateRule} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Rule Name</label>
            <input
              type="text"
              required
              value={formState.name}
              onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              placeholder="e.g., High Heat AC Trigger"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
            <input
              type="text"
              value={formState.description}
              onChange={(e) => setFormState({ ...formState, description: e.target.value })}
              placeholder="Explain what this automation rule accomplishes"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Sensor</label>
              <select
                value={formState.sensor_type}
                onChange={(e) => setFormState({ ...formState, sensor_type: e.target.value })}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100"
              >
                <option value="TEMPERATURE">TEMPERATURE</option>
                <option value="HUMIDITY">HUMIDITY</option>
                <option value="LIGHT">LIGHT</option>
                <option value="MOTION">MOTION</option>
                <option value="ENERGY">ENERGY</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Operator</label>
              <select
                value={formState.condition_operator}
                onChange={(e) => setFormState({ ...formState, condition_operator: e.target.value })}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100 font-mono"
              >
                <option value=">">&gt; (Greater than)</option>
                <option value="<">&lt; (Less than)</option>
                <option value=">=">&gt;= (Greater/Equal)</option>
                <option value="<=">&lt;= (Less/Equal)</option>
                <option value="==">== (Equals)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Threshold</label>
              <input
                type="number"
                step="0.1"
                required
                value={formState.threshold_value}
                onChange={(e) => setFormState({ ...formState, threshold_value: e.target.value })}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Smart Device</label>
              <select
                value={formState.target_device_id}
                onChange={(e) => setFormState({ ...formState, target_device_id: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100"
              >
                {devices.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name} ({d.room_name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target MQTT Command</label>
              <select
                value={formState.target_action}
                onChange={(e) => setFormState({ ...formState, target_action: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100 font-mono"
              >
                <option value="ON">TURN ON</option>
                <option value="OFF">TURN OFF</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-800 text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
            >
              Save Rule
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ======================== SCHEDULES PAGE (/schedules) ========================
export const SchedulesPage: React.FC = () => {
  const { schedules, loading, refreshSchedules } = useSchedules();
  const { devices } = useDevices();
  const { addToast } = useAppContext();

  const [modalOpen, setModalOpen] = useState(false);
  const [formState, setFormState] = useState({
    name: '',
    device_id: '1',
    action: 'ON',
    cron_time: '07:00',
    days_of_week: 'Mon,Tue,Wed,Thu,Fri'
  });

  if (loading && schedules.length === 0) {
    return <LoadingSpinner label="Loading schedules..." />;
  }

  const handleToggleSchedule = async (sched: any) => {
    await scheduleService.update(sched.id, { is_active: sched.is_active ? 0 : 1 });
    await refreshSchedules();
    addToast('Schedule Updated', `"${sched.name}" ${sched.is_active ? 'disabled' : 'enabled'}.`, 'info');
  };

  const handleRunNow = async (sched: any) => {
    const res = await scheduleService.runNow(sched.id);
    await refreshSchedules();
    addToast(
      'Schedule Executed',
      `Dispatched ${sched.action} to ${sched.device_name} via MQTT (${res.mqtt?.latencyMs}ms).`,
      'success'
    );
  };

  const handleDeleteSchedule = async (id: number) => {
    await scheduleService.remove(id);
    await refreshSchedules();
    addToast('Schedule Removed', `Deleted schedule #${id}.`, 'info');
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    await scheduleService.create({
      ...formState,
      device_id: Number(formState.device_id)
    });
    setModalOpen(false);
    await refreshSchedules();
    addToast('Schedule Created', `Saved "${formState.name}" at ${formState.cron_time}.`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Automated Device Schedules
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Time-based cron triggers persisted in SQL and executed by the Node.js scheduler service
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Schedule
        </button>
      </div>

      {schedules.length === 0 ? (
        <EmptyState
          title="No device schedules configured."
          description="Create a recurring daily or weekday schedule for your smart devices."
          actionLabel="Add Schedule"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schedules.map((s) => (
            <div
              key={s.id}
              className="rounded-lg border border-slate-800 bg-slate-900/70 p-5 flex flex-col justify-between gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
                    <span className="text-lg font-bold text-emerald-400">{s.cron_time}</span>
                    <span aria-hidden="true">·</span>
                    <span>{s.days_of_week}</span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-100 mt-1">{s.name}</h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Target: <span className="text-slate-200">{s.device_name}</span> → Action:{' '}
                    <span className="font-mono text-emerald-400 font-semibold">{s.action}</span>
                  </div>
                </div>
                <ToggleSwitch checked={Boolean(s.is_active)} onChange={() => handleToggleSchedule(s)} />
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono tabular-nums">
                  Last run: {s.last_run_at || 'Not run yet'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRunNow(s)}
                    className="px-2.5 py-1 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 text-emerald-400" />
                    Execute Now
                  </button>
                  <button
                    onClick={() => handleDeleteSchedule(s.id)}
                    className="p-1 text-slate-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} title="Create Device Schedule" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleCreateSchedule} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Schedule Name</label>
            <input
              type="text"
              required
              value={formState.name}
              onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              placeholder="e.g., Evening Patio Lighting"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Device</label>
              <select
                value={formState.device_id}
                onChange={(e) => setFormState({ ...formState, device_id: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100"
              >
                {devices.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Action</label>
              <select
                value={formState.action}
                onChange={(e) => setFormState({ ...formState, action: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100 font-mono"
              >
                <option value="ON">ON</option>
                <option value="OFF">OFF</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Execution Time (24h)</label>
              <input
                type="time"
                required
                value={formState.cron_time}
                onChange={(e) => setFormState({ ...formState, cron_time: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Days of Week</label>
              <input
                type="text"
                value={formState.days_of_week}
                onChange={(e) => setFormState({ ...formState, days_of_week: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-800 text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
            >
              Save Schedule
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
