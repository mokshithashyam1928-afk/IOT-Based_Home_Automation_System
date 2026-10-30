import { Request, Response } from 'express';
import { executeSql, queryAll, queryOne } from '../config/database.ts';
import { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { broadcastEvent } from '../websocket/socketServer.ts';
import { evaluateAutomationRules } from '../services/automationService.ts';
import { mqttService } from '../mqtt/mqttService.ts';
import { executeAllSqaTests, executeSqaTestCase } from '../services/sqaTestService.ts';

// ======================== AUTOMATION RULES ========================
export const getAutomationRules = (_req: Request, res: Response) => {
  try {
    const rules = queryAll(
      `SELECT ar.*, d.name as target_device_name, d.type as target_device_type, d.status as target_device_status
       FROM automation_rules ar
       LEFT JOIN devices d ON ar.target_device_id = d.id
       ORDER BY ar.id ASC;`
    );
    return res.json(rules);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unable to load automation rules.' });
  }
};

export const createAutomationRule = (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, sensor_type, condition_operator, threshold_value, target_device_id, target_action } = req.body;
    if (!name || !sensor_type || !condition_operator || threshold_value === undefined || !target_device_id || !target_action) {
      return res.status(400).json({ error: 'All rule parameters are required.' });
    }

    const nowSql = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const { lastInsertRowid } = executeSql(
      `INSERT INTO automation_rules (name, description, sensor_type, condition_operator, threshold_value, target_device_id, target_action, is_active, execution_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?);`,
      [
        String(name).trim(),
        description ? String(description).trim() : '',
        String(sensor_type).toUpperCase(),
        String(condition_operator),
        Number(threshold_value),
        Number(target_device_id),
        String(target_action).toUpperCase() === 'ON' ? 'ON' : 'OFF',
        nowSql,
        nowSql
      ]
    );

    const created = queryOne(
      `SELECT ar.*, d.name as target_device_name, d.type as target_device_type
       FROM automation_rules ar
       LEFT JOIN devices d ON ar.target_device_id = d.id
       WHERE ar.id = ?;`,
      [lastInsertRowid]
    );

    executeSql(
      `INSERT INTO activity_logs (actor, action_type, entity_type, entity_id, details, protocol, latency_ms)
       VALUES (?, 'RULE_CREATED', 'RULE', ?, ?, 'REST/SQL', 10);`,
      [req.user?.email || 'ADMIN', lastInsertRowid, `Created automation rule "${name}" (${sensor_type} ${condition_operator} ${threshold_value})`]
    );

    broadcastEvent('rule:updated', created);
    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create automation rule.' });
  }
};

export const updateAutomationRule = (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = queryOne<any>('SELECT * FROM automation_rules WHERE id = ?;', [id]);
    if (!existing) return res.status(404).json({ error: 'Automation rule not found' });

    const { name, description, sensor_type, condition_operator, threshold_value, target_device_id, target_action, is_active } = req.body;
    const nowSql = new Date().toISOString().replace('T', ' ').substring(0, 19);

    executeSql(
      `UPDATE automation_rules
       SET name = ?, description = ?, sensor_type = ?, condition_operator = ?, threshold_value = ?, target_device_id = ?, target_action = ?, is_active = ?, updated_at = ?
       WHERE id = ?;`,
      [
        name !== undefined ? String(name).trim() : existing.name,
        description !== undefined ? String(description).trim() : existing.description,
        sensor_type !== undefined ? String(sensor_type).toUpperCase() : existing.sensor_type,
        condition_operator !== undefined ? String(condition_operator) : existing.condition_operator,
        threshold_value !== undefined ? Number(threshold_value) : existing.threshold_value,
        target_device_id !== undefined ? Number(target_device_id) : existing.target_device_id,
        target_action !== undefined ? (String(target_action).toUpperCase() === 'ON' ? 'ON' : 'OFF') : existing.target_action,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        nowSql,
        id
      ]
    );

    const updated = queryOne(
      `SELECT ar.*, d.name as target_device_name, d.type as target_device_type
       FROM automation_rules ar
       LEFT JOIN devices d ON ar.target_device_id = d.id
       WHERE ar.id = ?;`,
      [id]
    );

    broadcastEvent('rule:updated', updated);
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update automation rule.' });
  }
};

export const deleteAutomationRule = (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    executeSql('DELETE FROM automation_rules WHERE id = ?;', [id]);
    executeSql(
      `INSERT INTO activity_logs (actor, action_type, entity_type, entity_id, details, protocol, latency_ms)
       VALUES (?, 'RULE_DELETED', 'RULE', ?, 'Deleted automation rule #' || ?, 'REST/SQL', 8);`,
      [req.user?.email || 'ADMIN', id, id]
    );
    return res.json({ message: 'Rule deleted', id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete automation rule.' });
  }
};

export const evaluateRuleNow = (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const rule = queryOne<any>('SELECT * FROM automation_rules WHERE id = ?;', [id]);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });

    // Simulate a sensor reading that satisfies the condition to test the rule end-to-end
    let testVal = Number(rule.threshold_value);
    if (rule.condition_operator === '>') testVal += 1.5;
    if (rule.condition_operator === '<') testVal = Math.max(0, testVal - 25);

    const triggered = evaluateAutomationRules(rule.sensor_type, testVal);
    return res.json({
      message: `Evaluated rule "${rule.name}" with simulated ${rule.sensor_type}=${testVal}`,
      triggered
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to evaluate rule.' });
  }
};

// ======================== SCHEDULES ========================
export const getSchedules = (_req: Request, res: Response) => {
  try {
    const schedules = queryAll(
      `SELECT s.*, d.name as device_name, d.type as device_type, d.status as device_status, r.name as room_name
       FROM schedules s
       LEFT JOIN devices d ON s.device_id = d.id
       LEFT JOIN rooms r ON d.room_id = r.id
       ORDER BY s.cron_time ASC;`
    );
    return res.json(schedules);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unable to load schedules.' });
  }
};

export const createSchedule = (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, device_id, action, cron_time, days_of_week } = req.body;
    if (!name || !device_id || !action || !cron_time) {
      return res.status(400).json({ error: 'Schedule name, device, action, and time are required.' });
    }
    const nowSql = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const { lastInsertRowid } = executeSql(
      `INSERT INTO schedules (name, device_id, action, cron_time, days_of_week, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?);`,
      [
        String(name).trim(),
        Number(device_id),
        String(action).toUpperCase() === 'ON' ? 'ON' : 'OFF',
        String(cron_time),
        days_of_week || 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
        nowSql,
        nowSql
      ]
    );

    const created = queryOne(
      `SELECT s.*, d.name as device_name, d.type as device_type
       FROM schedules s
       LEFT JOIN devices d ON s.device_id = d.id
       WHERE s.id = ?;`,
      [lastInsertRowid]
    );

    executeSql(
      `INSERT INTO activity_logs (actor, action_type, entity_type, entity_id, details, protocol, latency_ms)
       VALUES (?, 'SCHEDULE_CREATED', 'SCHEDULE', ?, ?, 'REST/SQL', 9);`,
      [req.user?.email || 'USER', lastInsertRowid, `Created schedule "${name}" at ${cron_time}`]
    );

    return res.status(201).json(created);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create schedule.' });
  }
};

export const updateSchedule = (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = queryOne<any>('SELECT * FROM schedules WHERE id = ?;', [id]);
    if (!existing) return res.status(404).json({ error: 'Schedule not found' });

    const { name, device_id, action, cron_time, days_of_week, is_active } = req.body;
    const nowSql = new Date().toISOString().replace('T', ' ').substring(0, 19);

    executeSql(
      `UPDATE schedules
       SET name = ?, device_id = ?, action = ?, cron_time = ?, days_of_week = ?, is_active = ?, updated_at = ?
       WHERE id = ?;`,
      [
        name !== undefined ? String(name).trim() : existing.name,
        device_id !== undefined ? Number(device_id) : existing.device_id,
        action !== undefined ? (String(action).toUpperCase() === 'ON' ? 'ON' : 'OFF') : existing.action,
        cron_time !== undefined ? String(cron_time) : existing.cron_time,
        days_of_week !== undefined ? String(days_of_week) : existing.days_of_week,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        nowSql,
        id
      ]
    );

    const updated = queryOne(
      `SELECT s.*, d.name as device_name, d.type as device_type
       FROM schedules s
       LEFT JOIN devices d ON s.device_id = d.id
       WHERE s.id = ?;`,
      [id]
    );
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update schedule.' });
  }
};

export const executeScheduleNow = (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const sched = queryOne<any>(
      `SELECT s.*, d.name as device_name FROM schedules s LEFT JOIN devices d ON s.device_id = d.id WHERE s.id = ?;`,
      [id]
    );
    if (!sched) return res.status(404).json({ error: 'Schedule not found' });

    const nowSql = new Date().toISOString().replace('T', ' ').substring(0, 19);
    executeSql('UPDATE schedules SET last_run_at = ?, updated_at = ? WHERE id = ?;', [nowSql, nowSql, id]);

    const dispatch = mqttService.publishCommand(sched.device_id, {
      status: sched.action,
      actor: `SCHEDULE:${sched.name}`
    });

    executeSql(
      `INSERT INTO activity_logs (actor, action_type, entity_type, entity_id, details, protocol, latency_ms)
       VALUES ('SCHEDULER_DAEMON', 'SCHEDULE_EXECUTED', 'SCHEDULE', ?, ?, 'MQTT/QoS1', ?);`,
      [id, `Executed schedule "${sched.name}" -> ${sched.device_name} ${sched.action}`, dispatch.latencyMs]
    );

    const updated = queryOne(
      `SELECT s.*, d.name as device_name, d.type as device_type FROM schedules s LEFT JOIN devices d ON s.device_id = d.id WHERE s.id = ?;`,
      [id]
    );
    return res.json({ schedule: updated, mqtt: dispatch });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to run schedule.' });
  }
};

export const deleteSchedule = (_req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(_req.params.id);
    executeSql('DELETE FROM schedules WHERE id = ?;', [id]);
    return res.json({ message: 'Schedule deleted', id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete schedule.' });
  }
};

// ======================== ALERTS & LOGS ========================
export const getAlerts = (req: Request, res: Response) => {
  try {
    const severity = req.query.severity ? String(req.query.severity).toUpperCase() : null;
    let sql = `
      SELECT a.*, d.name as device_name
      FROM alerts a
      LEFT JOIN devices d ON a.device_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (severity && severity !== 'ALL') {
      sql += ' AND a.severity = ?';
      params.push(severity);
    }
    sql += ' ORDER BY a.id DESC LIMIT 50;';
    return res.json(queryAll(sql, params));
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unable to load alerts.' });
  }
};

export const resolveAlert = (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    executeSql('UPDATE alerts SET is_resolved = 1 WHERE id = ?;', [id]);
    const updated = queryOne(
      `SELECT a.*, d.name as device_name FROM alerts a LEFT JOIN devices d ON a.device_id = d.id WHERE a.id = ?;`,
      [id]
    );
    broadcastEvent('alert:resolved', updated);
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to resolve alert.' });
  }
};

export const deleteAlert = (_req: AuthenticatedRequest, res: Response) => {
  try {
    const id = Number(_req.params.id);
    executeSql('DELETE FROM alerts WHERE id = ?;', [id]);
    return res.json({ message: 'Alert deleted', id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete alert.' });
  }
};

export const getActivityLogs = (req: Request, res: Response) => {
  try {
    const limit = Math.min(100, Number(req.query.limit || 50));
    const logs = queryAll('SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?;', [limit]);
    return res.json(logs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unable to load activity logs.' });
  }
};

// ======================== SQA TEST CASES ========================
export const getSqaTestCases = (_req: Request, res: Response) => {
  try {
    const testCases = queryAll('SELECT * FROM sqa_test_cases ORDER BY id ASC;');
    return res.json(testCases);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unable to load SQA test cases.' });
  }
};

export const runSingleSqaTest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { testCode } = req.params;
    const updated = await executeSqaTestCase(String(testCode));
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to execute SQA test.' });
  }
};

export const runAllSqaTestSuite = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const results = await executeAllSqaTests();
    return res.json(results);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to execute SQA test suite.' });
  }
};
