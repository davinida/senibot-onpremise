// SQLiteStorage: StorageAdapter의 SQLite 구현체
// 콜백 기반 sqlite3 API를 Promise로 감싸 async/await로 사용 가능하게 한다.

const sqlite3 = require('sqlite3');
const StorageAdapter = require('./storage');

class SQLiteStorage extends StorageAdapter {
  constructor(dbPath) {
    super();
    // .env의 DB_PATH 우선, 인자가 들어오면 덮어쓰기
    this.dbPath = dbPath || process.env.DB_PATH || './senibot.db';
    this.db = null;
  }

  // DB 연결 (lazy). 동일 인스턴스 안에서는 커넥션 재사용.
  _connect() {
    if (this.db) return this.db;
    this.db = new sqlite3.Database(this.dbPath);
    return this.db;
  }

  // 명시적 종료가 필요한 경우 사용 (테스트/스크립트용)
  close() {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      this.db.close((err) => {
        if (err) return reject(err);
        this.db = null;
        resolve();
      });
    });
  }

  // ─── sqlite3 콜백을 Promise로 감싸는 헬퍼들 ────────────────────

  _run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this._connect().run(sql, params, function (err) {
        // function 키워드 사용: this.lastID / this.changes 접근
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  _all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this._connect().all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  _get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this._connect().get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  // ─── 저장(Write) ──────────────────────────────────────────────

  async saveFitbitData(data) {
    const {
      user_id = 'senior_001',
      timestamp,
      heart_rate,
      steps,
      sleep_score,
      spo2,
    } = data;
    return this._run(
      `INSERT INTO fitbit_data (user_id, timestamp, heart_rate, steps, sleep_score, spo2)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, timestamp, heart_rate, steps, sleep_score, spo2]
    );
  }

  async saveSensorData(data) {
    const { timestamp, sensor_type, temperature, humidity } = data;
    return this._run(
      `INSERT INTO sensor_data (timestamp, sensor_type, temperature, humidity)
       VALUES (?, ?, ?, ?)`,
      [timestamp, sensor_type, temperature, humidity]
    );
  }

  async saveAlert(alert) {
    const { timestamp, alert_type, level, message, data } = alert;
    // data 필드는 객체일 경우 JSON 문자열로 직렬화하여 저장
    const dataStr =
      data === undefined || data === null
        ? null
        : typeof data === 'string'
        ? data
        : JSON.stringify(data);
    return this._run(
      `INSERT INTO alerts (timestamp, alert_type, level, message, data)
       VALUES (?, ?, ?, ?, ?)`,
      [timestamp, alert_type, level, message, dataStr]
    );
  }

  // ─── 조회(Read) ───────────────────────────────────────────────

  // 최신 limit개를 가져온 뒤 다시 오름차순으로 정렬해서 반환 (그래프용)
  async getRecentSensorData(limit = 50) {
    return this._all(
      `SELECT * FROM (
         SELECT * FROM sensor_data ORDER BY id DESC LIMIT ?
       ) AS recent
       ORDER BY id ASC`,
      [limit]
    );
  }

  async getRecentFitbitData(limit = 10) {
    return this._all(
      `SELECT * FROM (
         SELECT * FROM fitbit_data ORDER BY id DESC LIMIT ?
       ) AS recent
       ORDER BY id ASC`,
      [limit]
    );
  }

  // 알림은 최신 → 오래된 것 순서 (목록 표시용)
  async getRecentAlerts(limit = 30) {
    return this._all(
      `SELECT * FROM alerts ORDER BY id DESC LIMIT ?`,
      [limit]
    );
  }

  async getDashboardSummary() {
    const fitbit = await this._get(
      `SELECT heart_rate, steps, sleep_score, spo2, timestamp
       FROM fitbit_data
       ORDER BY id DESC LIMIT 1`
    );

    const sensor = await this._get(
      `SELECT temperature, humidity, timestamp
       FROM sensor_data
       ORDER BY id DESC LIMIT 1`
    );

    const unacknowledged_alerts = await this._all(
      `SELECT id, alert_type, level, message, timestamp
       FROM alerts
       WHERE acknowledged = 0
       ORDER BY id DESC`
    );

    return {
      fitbit: fitbit || null,
      sensor: sensor || null,
      unacknowledged_alerts,
    };
  }

  // ─── 시뮬레이터 트리거 상태 (Phase 4 시연용) ────────────────────

  // upsert: 같은 key가 있으면 덮어쓰기
  async setSimulatorState(key, value, expiresAt) {
    const valueStr =
      typeof value === 'string' ? value : JSON.stringify(value);
    return this._run(
      `INSERT INTO simulator_state (key, value, expires_at, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         expires_at = excluded.expires_at,
         updated_at = CURRENT_TIMESTAMP`,
      [key, valueStr, expiresAt]
    );
  }

  // 만료되었으면 null 반환. 만료되지 않았으면 JSON 파싱 시도.
  async getSimulatorState(key) {
    const row = await this._get(
      `SELECT value, expires_at FROM simulator_state WHERE key = ?`,
      [key]
    );
    if (!row) return null;
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return null;
    }
    try {
      return JSON.parse(row.value);
    } catch (e) {
      // JSON 형태가 아니면 원본 문자열 그대로 반환
      return row.value;
    }
  }
}

module.exports = SQLiteStorage;
