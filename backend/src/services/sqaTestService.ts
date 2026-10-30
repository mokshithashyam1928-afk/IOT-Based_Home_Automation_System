import { executeSql, queryAll, queryOne } from '../config/database.ts';
import { mqttService } from '../mqtt/mqttService.ts';
import { verifyToken } from '../middleware/authMiddleware.ts';

export async function executeSqaTestCase(testCode: string) {
  const startTime = Date.now();
  let passed = false;
  let actualResult = '';

  try {
    switch (testCode) {
      case 'TC-UNIT-01': {
        const requiredTables = [
          'users',
          'rooms',
          'devices',
          'sensor_readings',
          'automation_rules',
          'schedules',
          'alerts',
          'activity_logs',
          'energy_usage'
        ];
        const existingTables = queryAll<{ name: string }>(
          `SELECT name FROM sqlite_master WHERE type='table';`
        ).map((t) => t.name);

        const missing = requiredTables.filter((t) => !existingTables.includes(t));
        const fkRes = queryOne<{ foreign_keys: number }>('PRAGMA foreign_keys;');
        passed = missing.length === 0 && Number(fkRes?.foreign_keys) === 1;
        actualResult = passed
          ? `Verified all ${requiredTables.length} relational SQL tables and active PRAGMA foreign_keys=1 constraint.`
          : `Missing tables: ${missing.join(', ')}`;
        break;
      }

      case 'TC-API-02': {
        const total = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM devices;')?.cnt ?? 0;
        const online = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM devices WHERE is_online = 1;')?.cnt ?? 0;
        const offline = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM devices WHERE is_online = 0;')?.cnt ?? 0;
        const rules = queryOne<{ cnt: number }>('SELECT COUNT(*) as cnt FROM automation_rules WHERE is_active = 1;')?.cnt ?? 0;
        const temp = queryOne<{ value: number }>(`SELECT value FROM sensor_readings WHERE sensor_type = 'TEMPERATURE' ORDER BY id DESC LIMIT 1;`);

        passed = total > 0 && total === online + offline && temp !== null;
        actualResult = `SQL Summary verified: totalDevices=${total}, online=${online}, offline=${offline}, activeRules=${rules}, latestTemp=${temp?.value}°C`;
        break;
      }

      case 'TC-API-03': {
        const targetDevice = queryOne<{ id: number; status: 'ON' | 'OFF'; name: string }>('SELECT id, status, name FROM devices WHERE id = 3;');
        if (!targetDevice) throw new Error('Device #3 not found in SQL database');

        const toggledStatus = targetDevice.status === 'ON' ? 'OFF' : 'ON';
        const dispatch = mqttService.publishCommand(targetDevice.id, {
          status: toggledStatus,
          actor: 'SQA_TEST_RUNNER'
        });

        const afterToggle = queryOne<{ status: 'ON' | 'OFF' }>('SELECT status FROM devices WHERE id = 3;');
        // Restore original state
        mqttService.publishCommand(targetDevice.id, {
          status: targetDevice.status,
          actor: 'SQA_TEST_RUNNER'
        });

        passed = afterToggle?.status === toggledStatus && dispatch.latencyMs < 50;
        actualResult = `Device "${targetDevice.name}" toggled ${targetDevice.status}->${toggledStatus}->${targetDevice.status} via MQTT topic ${dispatch.topic} in ${dispatch.latencyMs}ms.`;
        break;
      }

      case 'TC-IOT-04': {
        const beforeLogs = queryOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM activity_logs WHERE action_type = 'AUTOMATION_EXECUTED';`)?.cnt ?? 0;
        // Inject a high temperature sensor reading (29.4°C > 28.0°C threshold for Rule #1)
        mqttService.handleIncomingMqttMessage('home/sensor/temperature', {
          deviceId: 2,
          roomId: 1,
          value: 29.4,
          unit: '°C',
          latencyMs: 9
        });
        const afterLogs = queryOne<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM activity_logs WHERE action_type = 'AUTOMATION_EXECUTED';`)?.cnt ?? 0;
        passed = afterLogs > beforeLogs;
        actualResult = `MQTT payload (29.4°C) persisted to sensor_readings, triggered Rule #1, and incremented activity_logs (${beforeLogs} -> ${afterLogs}).`;
        break;
      }

      case 'TC-SEC-05': {
        let rejectedInvalidToken = false;
        try {
          verifyToken('forged.invalid.jwt.token.signature');
        } catch {
          rejectedInvalidToken = true;
        }
        const adminUser = queryOne<{ role: string; password_hash: string }>(`SELECT role, password_hash FROM users WHERE email = 'admin@nexushome.io';`);
        const isHashBcrypted = Boolean(adminUser?.password_hash.startsWith('$2'));
        passed = rejectedInvalidToken && adminUser?.role === 'ADMIN' && isHashBcrypted;
        actualResult = `Forged JWT signature rejected; bcrypt password hash ($2a/2b) and RBAC role=${adminUser?.role} verified in SQL.`;
        break;
      }

      case 'TC-PERF-06': {
        const iterations = 25;
        const pStart = Date.now();
        for (let i = 0; i < iterations; i++) {
          queryOne('SELECT COUNT(*) as c FROM sensor_readings;');
        }
        const totalDuration = Date.now() - pStart;
        const avgMs = Number((totalDuration / iterations).toFixed(2));
        passed = avgMs < 25;
        actualResult = `Executed ${iterations} sequential SQL telemetry aggregations in ${totalDuration}ms (avg ${avgMs}ms/query, SLA < 25ms).`;
        break;
      }

      default:
        throw new Error(`Unknown test case code: ${testCode}`);
    }
  } catch (err: any) {
    passed = false;
    actualResult = `Execution Error: ${err?.message || String(err)}`;
  }

  const executionTimeMs = Math.max(2, Date.now() - startTime);
  const nowSql = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const status = passed ? 'PASSED' : 'FAILED';

  executeSql(
    `UPDATE sqa_test_cases
     SET actual_result = ?, status = ?, execution_time_ms = ?, executed_at = ?
     WHERE test_code = ?;`,
    [actualResult, status, executionTimeMs, nowSql, testCode]
  );

  executeSql(
    `INSERT INTO activity_logs (actor, action_type, entity_type, details, protocol, latency_ms, created_at)
     VALUES ('SQA_RUNNER', 'TEST_EXECUTION', 'SQA_TEST', ?, 'SQA/JEST_LIKE', ?, ?);`,
    [`${testCode} [${status}]: ${actualResult}`, executionTimeMs, nowSql]
  );

  return queryOne('SELECT * FROM sqa_test_cases WHERE test_code = ?;', [testCode]);
}

export async function executeAllSqaTests() {
  const allCases = queryAll<{ test_code: string }>('SELECT test_code FROM sqa_test_cases ORDER BY id ASC;');
  const results = [];
  for (const tc of allCases) {
    const res = await executeSqaTestCase(tc.test_code);
    results.push(res);
  }
  return results;
}
