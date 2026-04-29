// SQLite 테이블 초기화 스크립트
// 직접 실행:  node db/init.js
// 모듈 사용:  const { initDB } = require('./db/init');

require('dotenv').config();
const sqlite3 = require('sqlite3');

const DB_PATH = process.env.DB_PATH || './senibot.db';

// 4개 테이블 정의. CREATE TABLE IF NOT EXISTS로 재실행 안전.
const SCHEMAS = [
  // 1) Fitbit 시계열 데이터
  `CREATE TABLE IF NOT EXISTS fitbit_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'senior_001',
    timestamp TEXT NOT NULL,
    heart_rate INTEGER,        -- 안정 시 심박수 (bpm)
    steps INTEGER,             -- 누적 걸음수
    sleep_score INTEGER,       -- 어젯밤 수면 점수 (0~100)
    spo2 REAL,                 -- 평균 SpO2 (%)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 2) DHT11 환경 센서 시계열
  `CREATE TABLE IF NOT EXISTS sensor_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    sensor_type TEXT NOT NULL, -- 'DHT11'
    temperature REAL,          -- 섭씨
    humidity REAL,             -- %
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 3) 알림 기록
  `CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    alert_type TEXT NOT NULL,  -- 'TEMP_HIGH', 'HR_HIGH' 등
    level TEXT NOT NULL,       -- 'INFO' | 'WARNING' | 'EMERGENCY'
    message TEXT,              -- 보호자 친화적 메시지
    data TEXT,                 -- 원본 데이터(JSON 문자열)
    acknowledged INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 4) 시뮬레이터 트리거 상태 (Phase 4 시연용)
  `CREATE TABLE IF NOT EXISTS simulator_state (
    key TEXT PRIMARY KEY,
    value TEXT,                -- JSON 문자열로 상태 저장
    expires_at TEXT,           -- ISO 시각, 이후엔 무시
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
];

function initDB(dbPath = DB_PATH) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (openErr) => {
      if (openErr) return reject(openErr);
    });

    // serialize: 안에 등록한 명령들을 순차 실행
    db.serialize(() => {
      let pending = SCHEMAS.length;
      let errored = false;

      SCHEMAS.forEach((sql) => {
        db.run(sql, (err) => {
          if (errored) return;
          if (err) {
            errored = true;
            return reject(err);
          }
          pending -= 1;
          if (pending === 0) {
            db.close((closeErr) => {
              if (closeErr) return reject(closeErr);
              resolve();
            });
          }
        });
      });
    });
  });
}

// 직접 실행되었을 때만 자동 수행
if (require.main === module) {
  initDB()
    .then(() => {
      console.log(`[DB] 테이블 4개 초기화 완료 (${DB_PATH})`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[DB] 초기화 실패:', err);
      process.exit(1);
    });
}

module.exports = { initDB, SCHEMAS, DB_PATH };
