import { Router } from 'express';
import { getAllUsers, getCurrentUser, loginUser, registerUser, updateProfile } from '../controllers/authController.ts';
import {
  controlDevice,
  createDevice,
  deleteDevice,
  getDeviceById,
  getDevices,
  getRooms,
  updateDevice
} from '../controllers/deviceController.ts';
import {
  getSensorHistory,
  getSensorsByDevice,
  getSensorsSummary,
  injectSensorReading,
  triggerSimulatorPulse
} from '../controllers/sensorController.ts';
import {
  getDashboardActivity,
  getDashboardAlerts,
  getDashboardDevices,
  getDashboardEnergy,
  getDashboardSummary
} from '../controllers/dashboardController.ts';
import {
  createAutomationRule,
  createSchedule,
  deleteAlert,
  deleteAutomationRule,
  deleteSchedule,
  evaluateRuleNow,
  executeScheduleNow,
  getActivityLogs,
  getAlerts,
  getAutomationRules,
  getSchedules,
  getSqaTestCases,
  resolveAlert,
  runAllSqaTestSuite,
  runSingleSqaTest,
  updateAutomationRule,
  updateSchedule
} from '../controllers/operationsController.ts';
import { authenticateJWT, requireRole } from '../middleware/authMiddleware.ts';

export const apiRouter = Router();

// Authentication & User Routes
apiRouter.post('/auth/register', registerUser);
apiRouter.post('/auth/login', loginUser);
apiRouter.get('/auth/me', authenticateJWT, getCurrentUser);
apiRouter.put('/auth/profile', authenticateJWT, updateProfile);
apiRouter.get('/users', authenticateJWT, requireRole(['ADMIN', 'USER']), getAllUsers);

// Dashboard APIs
apiRouter.get('/dashboard/summary', authenticateJWT, getDashboardSummary);
apiRouter.get('/dashboard/devices', authenticateJWT, getDashboardDevices);
apiRouter.get('/dashboard/sensors', authenticateJWT, getSensorsSummary);
apiRouter.get('/dashboard/alerts', authenticateJWT, getDashboardAlerts);
apiRouter.get('/dashboard/energy', authenticateJWT, getDashboardEnergy);
apiRouter.get('/dashboard/activity', authenticateJWT, getDashboardActivity);

// Rooms & Devices APIs
apiRouter.get('/rooms', authenticateJWT, getRooms);
apiRouter.get('/devices', authenticateJWT, getDevices);
apiRouter.get('/devices/:id', authenticateJWT, getDeviceById);
apiRouter.post('/devices', authenticateJWT, createDevice);
apiRouter.put('/devices/:id', authenticateJWT, updateDevice);
apiRouter.delete('/devices/:id', authenticateJWT, requireRole(['ADMIN', 'USER']), deleteDevice);
apiRouter.post('/devices/:id/control', authenticateJWT, controlDevice);

// Sensors & IoT Simulator APIs
apiRouter.get('/sensors', authenticateJWT, getSensorsSummary);
apiRouter.get('/sensors/history', authenticateJWT, getSensorHistory);
apiRouter.get('/sensors/:deviceId', authenticateJWT, getSensorsByDevice);
apiRouter.post('/sensors/inject', authenticateJWT, injectSensorReading);
apiRouter.post('/simulator/pulse', authenticateJWT, triggerSimulatorPulse);

// Automation Rules APIs
apiRouter.get('/automation', authenticateJWT, getAutomationRules);
apiRouter.post('/automation', authenticateJWT, createAutomationRule);
apiRouter.put('/automation/:id', authenticateJWT, updateAutomationRule);
apiRouter.delete('/automation/:id', authenticateJWT, deleteAutomationRule);
apiRouter.post('/automation/:id/evaluate', authenticateJWT, evaluateRuleNow);

// Schedules APIs
apiRouter.get('/schedules', authenticateJWT, getSchedules);
apiRouter.post('/schedules', authenticateJWT, createSchedule);
apiRouter.put('/schedules/:id', authenticateJWT, updateSchedule);
apiRouter.delete('/schedules/:id', authenticateJWT, deleteSchedule);
apiRouter.post('/schedules/:id/run', authenticateJWT, executeScheduleNow);

// Alerts & Activity Logs APIs
apiRouter.get('/alerts', authenticateJWT, getAlerts);
apiRouter.put('/alerts/:id/resolve', authenticateJWT, resolveAlert);
apiRouter.delete('/alerts/:id', authenticateJWT, deleteAlert);
apiRouter.get('/logs', authenticateJWT, getActivityLogs);

// SQA Verification & Metrics Suite
apiRouter.get('/sqa/tests', authenticateJWT, getSqaTestCases);
apiRouter.post('/sqa/tests/run-all', authenticateJWT, runAllSqaTestSuite);
apiRouter.post('/sqa/tests/:testCode/run', authenticateJWT, runSingleSqaTest);
