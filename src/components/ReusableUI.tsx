import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Power,
  RefreshCw,
  X,
  Inbox
} from 'lucide-react';
import { useAppContext } from '../context/AppContext.tsx';

// ======================== LoadingSpinner & SkeletonLoader ========================
export const LoadingSpinner: React.FC<{ label?: string }> = ({ label = 'Loading data...' }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-slate-400">
    <Loader2 className="w-7 h-7 animate-spin text-emerald-400 mb-3" />
    <p className="text-sm font-medium">{label}</p>
  </div>
);

export const SkeletonLoader: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="space-y-3 py-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className="h-12 w-full rounded-lg bg-slate-900/90 border border-slate-800/80 animate-pulse"
      />
    ))}
  </div>
);

// ======================== ErrorMessage ========================
export const ErrorMessage: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="rounded-lg border border-red-900/60 bg-red-950/20 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
    <div className="flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <div>
        <h4 className="text-sm font-semibold text-red-200">Unable to load data</h4>
        <p className="text-xs text-red-300/80 mt-0.5">{message} Please try again.</p>
      </div>
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-red-900/50 hover:bg-red-800/60 text-red-100 border border-red-700/50 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Retry Request
      </button>
    )}
  </div>
);

// ======================== EmptyState ========================
export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-10 text-center flex flex-col items-center justify-center">
    <Inbox className="w-8 h-8 text-slate-500 mb-3" />
    <h4 className="text-base font-semibold text-slate-200">{title}</h4>
    <p className="text-sm text-slate-400 max-w-md mt-1">{description}</p>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

// ======================== StatusBadge (Zero-Pill Clean Unboxed Text with Indicator) ========================
export const StatusBadge: React.FC<{
  status: string;
  isOnline?: boolean | number;
  latencyMs?: number;
}> = ({ status, isOnline = true, latencyMs }) => {
  const online = Boolean(isOnline);
  const isOn = status === 'ON';

  return (
    <div className="inline-flex items-center gap-2 text-xs text-slate-300 font-mono tabular-nums">
      <span
        className={`w-2 h-2 rounded-full ${
          !online ? 'bg-red-500' : isOn ? 'bg-emerald-400' : 'bg-slate-500'
        }`}
        aria-hidden="true"
      />
      <span className={!online ? 'text-red-400 font-medium' : isOn ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
        {!online ? 'Offline' : isOn ? 'ON' : 'OFF'}
      </span>
      {latencyMs !== undefined && online && (
        <>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-400">{latencyMs}ms</span>
        </>
      )}
    </div>
  );
};

// ======================== ToggleSwitch ========================
export const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}> = ({ checked, onChange, disabled = false, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label || 'Toggle device state'}
    disabled={disabled}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
      checked ? 'bg-emerald-600' : 'bg-slate-700'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-150 ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

// ======================== DashboardCard ========================
export const DashboardCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  accentColor?: 'emerald' | 'amber' | 'red' | 'slate';
}> = ({ title, value, subtitle, accentColor = 'slate' }) => {
  const accentText =
    accentColor === 'emerald'
      ? 'text-emerald-400'
      : accentColor === 'amber'
      ? 'text-amber-400'
      : accentColor === 'red'
      ? 'text-red-400'
      : 'text-slate-100';

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 flex flex-col justify-between">
      <span className="text-xs font-medium text-slate-400">{title}</span>
      <div className={`text-2xl font-semibold font-mono tabular-nums mt-2 ${accentText}`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-slate-500 mt-1.5 font-mono tabular-nums">
          {subtitle}
        </div>
      )}
    </div>
  );
};

// ======================== SensorCard ========================
export const SensorCard: React.FC<{
  title: string;
  value: string | number;
  unit: string;
  min?: number;
  max?: number;
  avg?: number;
  delta?: number;
  topic?: string;
}> = ({ title, value, unit, min, max, avg, delta, topic }) => (
  <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 flex flex-col justify-between">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-slate-400">{title}</span>
      {delta !== undefined && (
        <span className={`text-xs font-mono tabular-nums ${delta > 0 ? 'text-amber-400' : delta < 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
          {delta > 0 ? `+${delta}` : delta}{unit === 'boolean' ? '' : unit}
        </span>
      )}
    </div>
    <div className="mt-2 flex items-baseline gap-1.5">
      <span className="text-2xl font-semibold font-mono tabular-nums text-slate-100">
        {value}
      </span>
      {unit !== 'boolean' && (
        <span className="text-xs font-mono text-slate-400">{unit}</span>
      )}
    </div>
    {(min !== undefined || max !== undefined) && (
      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
        <span>Min {min}{unit === 'boolean' ? '' : unit}</span>
        <span aria-hidden="true">·</span>
        <span>Avg {avg}{unit === 'boolean' ? '' : unit}</span>
        <span aria-hidden="true">·</span>
        <span>Max {max}{unit === 'boolean' ? '' : unit}</span>
      </div>
    )}
    {topic && (
      <div className="mt-1 text-[11px] text-slate-500 font-mono truncate">
        {topic}
      </div>
    )}
  </div>
);

// ======================== DeviceControl & DeviceCard ========================
export const DeviceControl: React.FC<{
  device: any;
  onToggle: (id: number, status?: 'ON' | 'OFF', targetValue?: number | null) => void;
  onSelect?: (id: number) => void;
}> = ({ device, onToggle, onSelect }) => {
  const isOn = device.status === 'ON';
  const isOnline = Boolean(device.is_online);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 flex flex-col justify-between gap-3 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onSelect && onSelect(device.id)}
            className="text-sm font-semibold text-slate-100 hover:text-emerald-400 transition-colors text-left truncate block w-full"
          >
            {device.name}
          </button>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
            <span>{device.room_name || `Room #${device.room_id}`}</span>
            <span aria-hidden="true">·</span>
            <span>{device.type}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{device.power_watts}W</span>
          </div>
        </div>
        <ToggleSwitch
          checked={isOn}
          onChange={() => onToggle(device.id, isOn ? 'OFF' : 'ON', device.target_value)}
          label={`Toggle ${device.name}`}
        />
      </div>

      <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <StatusBadge status={device.status} isOnline={isOnline} latencyMs={device.last_latency_ms} />
        <button
          type="button"
          onClick={() => onToggle(device.id, isOn ? 'OFF' : 'ON', device.target_value)}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 whitespace-nowrap ${
            isOn
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/60'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Power className="w-3 h-3" />
          {isOn ? 'Turn OFF' : 'Turn ON'}
        </button>
      </div>
    </div>
  );
};

// ======================== AlertCard & AlertList ========================
export const AlertCard: React.FC<{
  alert: any;
  onResolve?: (id: number) => void;
  onDelete?: (id: number) => void;
}> = ({ alert, onResolve, onDelete }) => {
  const severityTone =
    alert.severity === 'CRITICAL'
      ? 'text-red-400'
      : alert.severity === 'WARNING'
      ? 'text-amber-400'
      : alert.severity === 'SUCCESS'
      ? 'text-emerald-400'
      : 'text-sky-400';

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3.5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className={`font-semibold ${severityTone}`}>{alert.severity}</span>
          <span aria-hidden="true">·</span>
          <span>{alert.source}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{alert.created_at}</span>
          {alert.is_resolved === 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400">Resolved</span>
            </>
          )}
        </div>
        <h4 className="text-sm font-semibold text-slate-100 mt-1">{alert.title}</h4>
        <p className="text-xs text-slate-400 mt-0.5">{alert.message}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onResolve && alert.is_resolved === 0 && (
          <button
            onClick={() => onResolve(alert.id)}
            className="px-2.5 py-1 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors whitespace-nowrap"
          >
            Acknowledge
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(alert.id)}
            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
            title="Delete alert"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// ======================== Modal ========================
export const Modal: React.FC<{
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ isOpen, title, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};

// ======================== Toast Container ========================
export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useAppContext();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto rounded-lg border border-slate-700 bg-slate-900/95 p-3.5 shadow-xl flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            {t.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : t.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-100">{t.title}</div>
              <div className="text-xs text-slate-400 mt-0.5 break-words">{t.message}</div>
            </div>
          </div>
          <button
            onClick={() => dismissToast(t.id)}
            className="text-slate-500 hover:text-slate-300 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
