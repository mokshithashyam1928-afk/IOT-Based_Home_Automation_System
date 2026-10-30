-- ============================================================================
-- SERN Stack IoT Home Automation System — Initial Relational Seed Data
-- ============================================================================

INSERT INTO rooms (id, name, floor, area_sqm) VALUES
  (1, 'Living Room', 'Ground Floor', 34.5),
  (2, 'Master Bedroom', 'First Floor', 26.0),
  (3, 'Kitchen & Dining', 'Ground Floor', 28.0),
  (4, 'Home Office / Lab', 'First Floor', 19.5),
  (5, 'Garage & Utility', 'Ground Floor', 32.0),
  (6, 'Outdoor Patio', 'Exterior', 40.0);

INSERT INTO devices (id, device_uid, name, type, room_id, status, is_online, power_watts, target_value, mqtt_topic, firmware_version, ip_address, last_latency_ms) VALUES
  (1, 'esp32-lr-light-01', 'Living Room Ceiling Array', 'LIGHT', 1, 'ON', 1, 24.0, 85.0, 'home/device/1/status', 'v2.4.2-esp32s3', '192.168.1.101', 11),
  (2, 'esp32-lr-ac-01', 'Living Room Inverter AC', 'AC', 1, 'ON', 1, 860.0, 22.0, 'home/device/2/status', 'v3.1.0-esp32s3', '192.168.1.102', 14),
  (3, 'esp32-lr-fan-01', 'Living Room Smart Circulation Fan', 'FAN', 1, 'ON', 1, 45.0, 3.0, 'home/device/3/status', 'v2.4.1-esp32', '192.168.1.103', 9),
  (4, 'esp32-mb-light-01', 'Bedroom Ambient Strip', 'LIGHT', 2, 'OFF', 1, 18.0, 60.0, 'home/device/4/status', 'v2.4.2-esp32s3', '192.168.1.104', 12),
  (5, 'esp32-mb-ac-01', 'Master Bedroom Climate Unit', 'AC', 2, 'OFF', 1, 790.0, 21.0, 'home/device/5/status', 'v3.1.0-esp32s3', '192.168.1.105', 15),
  (6, 'esp32-kt-plug-01', 'Kitchen Espresso & Induction Hub', 'SMART_PLUG', 3, 'ON', 1, 320.0, NULL, 'home/device/6/status', 'v2.2.8-esp32', '192.168.1.106', 10),
  (7, 'esp32-kt-fan-01', 'Kitchen Exhaust Hood', 'FAN', 3, 'OFF', 1, 65.0, 2.0, 'home/device/7/status', 'v2.4.1-esp32', '192.168.1.107', 13),
  (8, 'esp32-ho-light-01', 'Office Key Light Rig', 'LIGHT', 4, 'ON', 1, 32.0, 100.0, 'home/device/8/status', 'v2.4.2-esp32s3', '192.168.1.108', 8),
  (9, 'esp32-ho-plug-01', 'Workstation UPS Smart Outlet', 'SMART_PLUG', 4, 'ON', 1, 210.0, NULL, 'home/device/9/status', 'v2.2.8-esp32', '192.168.1.109', 11),
  (10, 'esp32-gr-lock-01', 'Garage Perimeter Smart Deadbolt', 'LOCK', 5, 'ON', 1, 6.5, NULL, 'home/device/10/status', 'v2.5.0-tls', '192.168.1.110', 16),
  (11, 'esp32-gr-sensor-01', 'Utility Subpanel Energy Bridge', 'SENSOR_NODE', 5, 'OFF', 0, 4.0, NULL, 'home/device/11/status', 'v2.1.0-esp32', '192.168.1.111', 0),
  (12, 'esp32-pt-light-01', 'Patio Security Floodlight', 'LIGHT', 6, 'OFF', 0, 50.0, 100.0, 'home/device/12/status', 'v2.3.4-esp32', '192.168.1.112', 0);

INSERT INTO automation_rules (id, name, description, sensor_type, condition_operator, threshold_value, target_device_id, target_action, is_active, execution_count, last_triggered_at) VALUES
  (1, 'High Thermal Load Cooling', 'Automatically activate Living Room Smart Circulation Fan when ambient temperature exceeds 28.0°C', 'TEMPERATURE', '>', 28.0, 3, 'ON', 1, 14, datetime('now', '-25 minutes')),
  (2, 'Low Lux Evening Illumination', 'Turn ON Living Room Ceiling Array when ambient light drops below 300 lux', 'LIGHT', '<', 300.0, 1, 'ON', 1, 9, datetime('now', '-2 hours')),
  (3, 'Humidity Ventilation Boost', 'Engage Kitchen Exhaust Hood when relative humidity rises above 68%', 'HUMIDITY', '>', 68.0, 7, 'ON', 1, 6, datetime('now', '-4 hours')),
  (4, 'Motion Security Floodlight', 'Activate Patio Security Floodlight when exterior motion is detected (value == 1)', 'MOTION', '==', 1.0, 12, 'ON', 1, 19, datetime('now', '-50 minutes')),
  (5, 'Peak Energy Load Shedding', 'Turn OFF Bedroom Climate Unit when instantaneous power demand exceeds 1800 W', 'ENERGY', '>', 1800.0, 5, 'OFF', 1, 3, datetime('now', '-1 day'));

INSERT INTO schedules (id, name, device_id, action, cron_time, days_of_week, is_active, last_run_at) VALUES
  (1, 'Morning Espresso Warmup', 6, 'ON', '06:30', 'Mon,Tue,Wed,Thu,Fri', 1, datetime('now', '-4 hours')),
  (2, 'Office Daylight Shutdown', 8, 'OFF', '18:30', 'Mon,Tue,Wed,Thu,Fri', 1, datetime('now', '-16 hours')),
  (3, 'Nighttime Perimeter Lock Check', 10, 'ON', '22:00', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 1, datetime('now', '-12 hours')),
  (4, 'Midnight Bedroom AC Eco Cutoff', 5, 'OFF', '01:00', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 0, datetime('now', '-2 days'));

INSERT INTO alerts (id, title, message, severity, source, device_id, is_resolved, created_at) VALUES
  (1, 'High Temperature Threshold Approaching', 'Living Room thermal sensor recorded 27.8°C (Rule #1 threshold: 28.0°C).', 'WARNING', 'SENSOR_MONITOR', 2, 0, datetime('now', '-12 minutes')),
  (2, 'Automation Rule #1 Executed', 'High Thermal Load Cooling verified Living Room Smart Circulation Fan state ON via MQTT QoS 1.', 'SUCCESS', 'AUTOMATION_ENGINE', 3, 1, datetime('now', '-25 minutes')),
  (3, 'Device Heartbeat Timeout', 'Patio Security Floodlight (esp32-pt-light-01) missed 3 consecutive MQTT keep-alive pings.', 'CRITICAL', 'MQTT_BROKER', 12, 0, datetime('now', '-42 minutes')),
  (4, 'Subpanel Bridge Offline', 'Utility Subpanel Energy Bridge (esp32-gr-sensor-01) disconnected from local gateway.', 'WARNING', 'MQTT_BROKER', 11, 0, datetime('now', '-1 hour'));

INSERT INTO sqa_test_cases (test_code, category, title, requirement_ref, expected_result, actual_result, status) VALUES
  ('TC-UNIT-01', 'Unit Testing', 'SQL Schema Foreign Key & Constraint Validation', 'REQ-SQL-04', 'All 9 core SQL tables exist with PK, FK, NOT NULL, and CHECK constraints enforced', 'NOT EXECUTED', 'NOT EXECUTED'),
  ('TC-API-02', 'API Testing', 'GET /api/dashboard/summary Dynamic SQL Aggregation', 'REQ-DASH-10', 'Returns real-time SQL counts for totalDevices, onlineDevices, offlineDevices, activeRules, and latest sensor telemetry', 'NOT EXECUTED', 'NOT EXECUTED'),
  ('TC-API-03', 'API Testing', 'POST /api/devices/:id/control State Persistence & MQTT Publish', 'REQ-DEV-08', 'Toggles device state in SQL database, publishes JSON payload to home/device/{id}/command, and logs latency < 50ms', 'NOT EXECUTED', 'NOT EXECUTED'),
  ('TC-IOT-04', 'Integration Testing', 'MQTT Sensor Telemetry Ingestion & Automation Rule Evaluation', 'REQ-AUTO-19', 'Incoming home/sensor/* payload persists to sensor_readings, evaluates active rules, and records execution in activity_logs', 'NOT EXECUTED', 'NOT EXECUTED'),
  ('TC-SEC-05', 'Security Testing', 'JWT Protected Route & Role-Based Authorization Guard', 'REQ-AUTH-13', 'Rejects unauthenticated or forged Bearer tokens with HTTP 401 and enforces ADMIN/USER role claims', 'NOT EXECUTED', 'NOT EXECUTED'),
  ('TC-PERF-06', 'Performance Testing', 'Concurrent SQL Telemetry & Command Dispatch Latency', 'REQ-PERF-20', 'Executes 25 sequential SQL + MQTT state cycles with average round-trip latency under 25ms', 'NOT EXECUTED', 'NOT EXECUTED');
