import { executeSql, queryAll, queryOne } from '../config/database.ts';
import { broadcastEvent } from '../websocket/socketServer.ts';
import { mqttService } from '../mqtt/mqttService.ts';

export interface AutomationRuleRow {
  id: number;
  name: string;
  description: string;
  sensor_type: string;
  condition_operator: '>' | '<' | '>=' | '<=' | '==';
  threshold_value: number;
  target_device_id: number;
  target_action: 'ON' | 'OFF';
  is_active: number;
  execution_count: number;
  last_triggered_at: string | null;
  device_name?: string;
}

export function checkCondition(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>':
      return value > threshold;
    case '<':
      return value < threshold;
    case '>=':
      return value >= threshold;
    case '<=':
      return value <= threshold;
    case '==':
      return Math.abs(value - threshold) < 0.001;
    default:
      return false;
  }
}

/**
 * Evaluates active automation rules against incoming sensor readings:
 * Sensor Reading -> Automation Service -> Evaluate Rules -> Condition TRUE? ->
 * Publish MQTT Command -> Device -> Receive Status -> Update Database -> Socket.IO Event -> React Dashboard
 */
export function evaluateAutomationRules(sensorType: string, readingValue: number) {
  const activeRules = queryAll<AutomationRuleRow>(
    `SELECT ar.*, d.name as device_name, d.status as current_device_status
     FROM automation_rules ar
     LEFT JOIN devices d ON ar.target_device_id = d.id
     WHERE ar.is_active = 1 AND ar.sensor_type = ?;`,
    [sensorType]
  );

  const triggeredRules: any[] = [];

  for (const rule of activeRules) {
    const isConditionMet = checkCondition(readingValue, rule.condition_operator, Number(rule.threshold_value));
    if (!isConditionMet) continue;

    const nowSql = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Update rule execution count & timestamp in SQL
    executeSql(
      `UPDATE automation_rules
       SET execution_count = execution_count + 1,
           last_triggered_at = ?,
           updated_at = ?
       WHERE id = ?;`,
      [nowSql, nowSql, rule.id]
    );

    // Publish MQTT command to target device
    const mqttDispatch = mqttService.publishCommand(rule.target_device_id, {
      status: rule.target_action,
      actor: `RULE_${rule.id}:${rule.name}`
    });

    // Record every automation execution in activity_logs
    const details = `Rule "${rule.name}" (${sensorType} ${readingValue} ${rule.condition_operator} ${rule.threshold_value}) -> Set ${rule.device_name || 'Device #' + rule.target_device_id} to ${rule.target_action}`;
    const logInsert = executeSql(
      `INSERT INTO activity_logs (actor, action_type, entity_type, entity_id, details, protocol, latency_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      ['AUTOMATION_ENGINE', 'AUTOMATION_EXECUTED', 'RULE', rule.id, details, 'MQTT/QoS1', mqttDispatch.latencyMs, nowSql]
    );

    // Also create a real-time alert notification if the device actually changed state or if critical threshold
    const currentDevice = queryOne<{ status: string; name: string }>('SELECT status, name FROM devices WHERE id = ?;', [rule.target_device_id]);
    if (!currentDevice || currentDevice.status !== rule.target_action) {
      const alertInsert = executeSql(
        `INSERT INTO alerts (title, message, severity, source, device_id, is_resolved, created_at)
         VALUES (?, ?, 'SUCCESS', 'AUTOMATION_ENGINE', ?, 0, ?);`,
        [
          `Automation Executed: ${rule.name}`,
          `${details} (${mqttDispatch.latencyMs}ms via MQTT)`,
          rule.target_device_id,
          nowSql
        ]
      );

      const newAlert = queryOne('SELECT * FROM alerts WHERE id = ?;', [alertInsert.lastInsertRowid]);
      if (newAlert) {
        broadcastEvent('alert:new', newAlert);
      }
    }

    const updatedRule = queryOne(
      `SELECT ar.*, d.name as target_device_name, d.type as target_device_type
       FROM automation_rules ar
       LEFT JOIN devices d ON ar.target_device_id = d.id
       WHERE ar.id = ?;`,
      [rule.id]
    );

    const newLog = queryOne('SELECT * FROM activity_logs WHERE id = ?;', [logInsert.lastInsertRowid]);

    broadcastEvent('automation:executed', {
      rule: updatedRule,
      log: newLog,
      sensorType,
      readingValue
    });

    triggeredRules.push(updatedRule);
  }

  return triggeredRules;
}
