import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Cpu,
  Activity,
  Zap,
  CalendarClock,
  Bell,
  ScrollText,
  UserCheck,
  Settings,
  Menu,
  X,
  LogOut,
  Radio
} from 'lucide-react';
import { useAuth, useDashboard } from '../context/AppContext.tsx';
import { sensorService } from '../services/api.ts';
import { ToastContainer } from '../components/ReusableUI.tsx';

export const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { socketConnected, refreshAllData } = useDashboard();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pulsing, setPulsing] = useState(false);

  const handleSimulatePulse = async () => {
    setPulsing(true);
    try {
      await sensorService.triggerSimulatorPulse();
    } finally {
      setTimeout(() => setPulsing(false), 350);
    }
  };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/devices', label: 'Devices', icon: Cpu },
    { to: '/sensors', label: 'Sensors', icon: Activity },
    { to: '/automation', label: 'Automation', icon: Zap },
    { to: '/schedules', label: 'Schedules', icon: CalendarClock },
    { to: '/alerts', label: 'Alerts', icon: Bell },
    { to: '/logs', label: 'Activity Logs', icon: ScrollText },
    { to: '/settings', label: 'SQA & Settings', icon: Settings },
    { to: '/profile', label: 'Profile', icon: UserCheck }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar Contract: Zone 1 (Single wordmark) — Zone 2 (5 clean nav links) — Zone 3 (1-2 primary actions) */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        {/* Zone 1: Single text element wordmark */}
        <NavLink to="/dashboard" className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap">
          NexusHome
        </NavLink>

        {/* Zone 2: 5 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `hover:text-slate-100 transition-colors whitespace-nowrap ${isActive ? 'text-emerald-400 underline underline-offset-8' : ''}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/devices"
            className={({ isActive }) =>
              `hover:text-slate-100 transition-colors whitespace-nowrap ${isActive ? 'text-emerald-400 underline underline-offset-8' : ''}`
            }
          >
            Devices
          </NavLink>
          <NavLink
            to="/sensors"
            className={({ isActive }) =>
              `hover:text-slate-100 transition-colors whitespace-nowrap ${isActive ? 'text-emerald-400 underline underline-offset-8' : ''}`
            }
          >
            Sensors
          </NavLink>
          <NavLink
            to="/automation"
            className={({ isActive }) =>
              `hover:text-slate-100 transition-colors whitespace-nowrap ${isActive ? 'text-emerald-400 underline underline-offset-8' : ''}`
            }
          >
            Automation
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `hover:text-slate-100 transition-colors whitespace-nowrap ${isActive ? 'text-emerald-400 underline underline-offset-8' : ''}`
            }
          >
            SQA Validation
          </NavLink>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSimulatePulse}
            disabled={pulsing}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors whitespace-nowrap flex items-center gap-1.5"
          >
            <Radio className={`w-3.5 h-3.5 ${pulsing ? 'animate-ping' : ''}`} />
            Emit MQTT Telemetry
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-slate-400 hover:text-slate-100 rounded-lg"
            aria-label="Toggle Sidebar Navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Responsive Sidebar (256px on desktop, slide-over on mobile) */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-40 w-64 border-r border-slate-800 bg-slate-950 flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-4 space-y-1 overflow-y-auto">
            <div className="px-3 py-2 text-xs text-slate-500 font-medium">
              SERN IoT Control Plane
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </div>

          {/* Account & Live Socket Status Footer inside Sidebar */}
          <div className="p-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
              <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>{socketConnected ? 'Socket.IO Connected' : 'Reconnecting WS'}</span>
              <span aria-hidden="true">·</span>
              <button
                onClick={refreshAllData}
                className="text-slate-300 hover:text-emerald-400 underline"
              >
                Sync
              </button>
            </div>

            {user && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-200 truncate">{user.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {user.role} · {user.email}
                  </div>
                </div>
                <button
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-400 rounded-md transition-colors shrink-0"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Viewport Canvas */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>

      <ToastContainer />
    </div>
  );
};
