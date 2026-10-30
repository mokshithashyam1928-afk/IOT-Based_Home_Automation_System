import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, Trash2, Edit3, ArrowLeft, Wifi, Power } from 'lucide-react';
import { useDevices, useAppContext } from '../context/AppContext.tsx';
import { deviceService } from '../services/api.ts';
import {
  DeviceControl,
  EmptyState,
  ErrorMessage,
  LoadingSpinner,
  Modal,
  StatusBadge,
  ToggleSwitch
} from '../components/ReusableUI.tsx';

export const DevicesPage: React.FC = () => {
  const navigate = useNavigate();
  const { devices, rooms, loading, error, toggleDeviceState, refreshDevices } = useDevices();
  const { addToast } = useAppContext();

  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<any | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    type: 'LIGHT',
    room_id: '1',
    power_watts: '25',
    target_value: '',
    ip_address: '192.168.1.120',
    firmware_version: 'v2.4.2-esp32s3'
  });

  if (loading && devices.length === 0) {
    return <LoadingSpinner label="Loading devices..." />;
  }

  if (error && devices.length === 0) {
    return <ErrorMessage message="Unable to load device data." onRetry={refreshDevices} />;
  }

  const filteredDevices = devices.filter((d) => {
    if (selectedRoom !== 'ALL' && String(d.room_id) !== selectedRoom) return false;
    if (selectedType !== 'ALL' && d.type !== selectedType) return false;
    if (selectedStatus !== 'ALL' && d.status !== selectedStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.device_uid.toLowerCase().includes(q) ||
        (d.room_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openCreateModal = () => {
    setEditingDevice(null);
    setFormState({
      name: '',
      type: 'LIGHT',
      room_id: String(rooms[0]?.id || 1),
      power_watts: '25',
      target_value: '',
      ip_address: `192.168.1.${115 + devices.length}`,
      firmware_version: 'v2.4.2-esp32s3'
    });
    setModalOpen(true);
  };

  const openEditModal = (device: any) => {
    setEditingDevice(device);
    setFormState({
      name: device.name,
      type: device.type,
      room_id: String(device.room_id),
      power_watts: String(device.power_watts),
      target_value: device.target_value !== null && device.target_value !== undefined ? String(device.target_value) : '',
      ip_address: device.ip_address || '192.168.1.110',
      firmware_version: device.firmware_version || 'v2.4.2-esp32s3'
    });
    setModalOpen(true);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formState.name,
        type: formState.type,
        room_id: Number(formState.room_id),
        power_watts: Number(formState.power_watts),
        target_value: formState.target_value !== '' ? Number(formState.target_value) : null,
        ip_address: formState.ip_address,
        firmware_version: formState.firmware_version
      };

      if (editingDevice) {
        await deviceService.update(editingDevice.id, payload);
        addToast('Device Updated', `Updated "${formState.name}" in SQL database.`, 'success');
      } else {
        await deviceService.create(payload);
        addToast('Device Registered', `Provisioned "${formState.name}" with MQTT topic.`, 'success');
      }
      setModalOpen(false);
      await refreshDevices();
    } catch (err: any) {
      addToast('Save Failed', err?.response?.data?.error || 'Could not save device', 'error');
    }
  };

  const handleDeleteDevice = async (id: number, name: string) => {
    try {
      await deviceService.remove(id);
      addToast('Device Deleted', `Removed "${name}" from SQL database.`, 'info');
      await refreshDevices();
    } catch (err: any) {
      addToast('Delete Failed', err?.response?.data?.error || 'Could not delete device', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Smart Device Registry</h1>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic CRUD & real-time MQTT actuation backed by relational SQL storage
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Register Smart Device
        </button>
      </div>

      {/* Interactive Search & Segmented Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, UID, or room..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-800 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <select
          value={selectedRoom}
          onChange={(e) => setSelectedRoom(e.target.value)}
          className="px-3 py-2 text-xs rounded-lg border border-slate-800 bg-slate-900 text-slate-200 focus:outline-none focus:border-emerald-500"
        >
          <option value="ALL">All Rooms ({rooms.length})</option>
          {rooms.map((r) => (
            <option key={r.id} value={String(r.id)}>
              {r.name} ({r.floor})
            </option>
          ))}
        </select>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-3 py-2 text-xs rounded-lg border border-slate-800 bg-slate-900 text-slate-200 focus:outline-none focus:border-emerald-500"
        >
          <option value="ALL">All Device Types</option>
          <option value="LIGHT">LIGHT</option>
          <option value="AC">AC</option>
          <option value="FAN">FAN</option>
          <option value="SMART_PLUG">SMART_PLUG</option>
          <option value="LOCK">LOCK</option>
          <option value="SENSOR_NODE">SENSOR_NODE</option>
        </select>

        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          {(['ALL', 'ON', 'OFF'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`flex-1 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                selectedStatus === st
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {st === 'ALL' ? 'All States' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Device Grid */}
      {filteredDevices.length === 0 ? (
        <EmptyState
          title="No matching smart devices found."
          description="Try clearing your search filters or register a new ESP32 smart device."
          actionLabel="Register Smart Device"
          onAction={openCreateModal}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((d) => (
            <DeviceControl
              key={d.id}
              device={d}
              onToggle={toggleDeviceState}
              onSelect={(id) => navigate(`/devices/${id}`)}
            />
          ))}
        </div>
      )}

      {/* High-Density Data Table */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">
            SQL Device Inventory & Network Table
          </h2>
          <span className="text-xs text-slate-400 font-mono tabular-nums">
            {filteredDevices.length} records
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/90">
                <th className="py-2.5 px-3 font-medium">ID / UID</th>
                <th className="py-2.5 px-3 font-medium">Device Name</th>
                <th className="py-2.5 px-3 font-medium">Room</th>
                <th className="py-2.5 px-3 font-medium">MQTT Topic</th>
                <th className="py-2.5 px-3 font-medium text-right">Power</th>
                <th className="py-2.5 px-3 font-medium">State</th>
                <th className="py-2.5 px-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredDevices.map((d) => (
                <tr key={d.id} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-mono tabular-nums text-slate-400">
                    #{d.id} · {d.device_uid}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-100">
                    <button
                      onClick={() => navigate(`/devices/${d.id}`)}
                      className="hover:text-emerald-400 text-left"
                    >
                      {d.name}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">{d.room_name}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">{d.mqtt_topic}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                    {d.power_watts}W
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusBadge status={d.status} isOnline={d.is_online} latencyMs={d.last_latency_ms} />
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(d)}
                        className="p-1 text-slate-400 hover:text-slate-100"
                        title="Edit Device"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteDevice(d.id, d.name)}
                        className="p-1 text-slate-400 hover:text-red-400"
                        title="Delete Device"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        title={editingDevice ? `Edit Device: ${editingDevice.name}` : 'Register New Smart Device'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSaveDevice} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Device Name</label>
            <input
              type="text"
              required
              value={formState.name}
              onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              placeholder="e.g., Study Desk Lamp"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Device Type</label>
              <select
                value={formState.type}
                onChange={(e) => setFormState({ ...formState, type: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100"
              >
                <option value="LIGHT">LIGHT</option>
                <option value="AC">AC</option>
                <option value="FAN">FAN</option>
                <option value="SMART_PLUG">SMART_PLUG</option>
                <option value="LOCK">LOCK</option>
                <option value="SENSOR_NODE">SENSOR_NODE</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Room Assignment</label>
              <select
                value={formState.room_id}
                onChange={(e) => setFormState({ ...formState, room_id: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Rated Power (Watts)</label>
              <input
                type="number"
                step="0.5"
                required
                value={formState.power_watts}
                onChange={(e) => setFormState({ ...formState, power_watts: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Setpoint / Level (Optional)</label>
              <input
                type="number"
                step="1"
                value={formState.target_value}
                onChange={(e) => setFormState({ ...formState, target_value: e.target.value })}
                placeholder="e.g. 22°C or 80%"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">IPv4 Address</label>
              <input
                type="text"
                value={formState.ip_address}
                onChange={(e) => setFormState({ ...formState, ip_address: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">ESP32 Firmware</label>
              <input
                type="text"
                value={formState.firmware_version}
                onChange={(e) => setFormState({ ...formState, firmware_version: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-700 bg-slate-950 text-slate-100 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {editingDevice ? 'Update SQL Record' : 'Create Device'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ======================== Device Detail Page (/devices/:id) ========================
export const DeviceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toggleDeviceState, refreshDevices } = useDevices();
  const { addToast } = useAppContext();
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetVal, setTargetVal] = useState<string>('');

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await deviceService.getById(id);
      setDetail(data);
      setTargetVal(data.target_value !== null && data.target_value !== undefined ? String(data.target_value) : '');
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchDetail();
  }, [id]);

  if (loading) return <LoadingSpinner label="Loading device telemetry..." />;
  if (!detail) return <ErrorMessage message="Device not found in SQL database." onRetry={() => navigate('/devices')} />;

  const handleToggle = async () => {
    await toggleDeviceState(detail.id, detail.status === 'ON' ? 'OFF' : 'ON', targetVal !== '' ? Number(targetVal) : null);
    await fetchDetail();
  };

  const handleApplySetpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    await toggleDeviceState(detail.id, detail.status, targetVal !== '' ? Number(targetVal) : null);
    await fetchDetail();
  };

  const handleBringOnline = async () => {
    await deviceService.update(detail.id, { is_online: 1 });
    await refreshDevices();
    await fetchDetail();
    addToast('Device Reconnected', `${detail.name} is now online on MQTT broker.`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/devices')}
            className="p-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-100">{detail.name}</h1>
            <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
              UID: {detail.device_uid} · Room: {detail.room_name} · IP: {detail.ip_address}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!detail.is_online && (
            <button
              onClick={handleBringOnline}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5"
            >
              <Wifi className="w-3.5 h-3.5" />
              Reconnect Node
            </button>
          )}
          <ToggleSwitch checked={detail.status === 'ON'} onChange={handleToggle} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 space-y-2">
          <span className="text-xs text-slate-400">Current Relay State</span>
          <div className="pt-1">
            <StatusBadge status={detail.status} isOnline={detail.is_online} latencyMs={detail.last_latency_ms} />
          </div>
          <div className="text-xs text-slate-500 font-mono pt-1">
            Command Topic: home/device/{detail.id}/command
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 space-y-2">
          <span className="text-xs text-slate-400">Power & Firmware</span>
          <div className="text-xl font-semibold font-mono tabular-nums text-slate-100">
            {detail.power_watts} W
          </div>
          <div className="text-xs text-slate-500 font-mono">
            Firmware: {detail.firmware_version}
          </div>
        </div>

        <form onSubmit={handleApplySetpoint} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 space-y-2">
          <span className="text-xs text-slate-400">Target Setpoint / Level</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={targetVal}
              onChange={(e) => setTargetVal(e.target.value)}
              placeholder="Setpoint"
              className="w-full px-3 py-1.5 text-xs rounded border border-slate-700 bg-slate-950 text-slate-100 font-mono"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-500 text-white whitespace-nowrap"
            >
              Publish MQTT
            </button>
          </div>
        </form>
      </div>

      {/* Recent Device Activity Logs */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">Device Command & Audit History</h2>
        <div className="divide-y divide-slate-800 text-xs">
          {(detail.recentLogs || []).length === 0 ? (
            <div className="py-4 text-slate-500">No recent command logs for this device.</div>
          ) : (
            detail.recentLogs.map((log: any) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <span className="font-mono text-emerald-400">{log.action_type}</span>
                  <span className="mx-2 text-slate-600">·</span>
                  <span className="text-slate-300">{log.details}</span>
                </div>
                <div className="font-mono tabular-nums text-slate-500 shrink-0">
                  {log.latency_ms}ms · {log.created_at}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
