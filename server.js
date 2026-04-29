// 시니봇 서버 진입점
// 현재 단계(Phase 3)에서는 DB 초기화 + MQTT 핸들러만 시작한다.
// Express HTTP 서버는 Phase 5에서 추가 예정.

require('dotenv').config();

const { initDB } = require('./db/init');
const SQLiteStorage = require('./services/sqlite-storage');
const { startMqttHandler } = require('./services/mqtt-handler');

(async () => {
  try {
    // 1) DB 테이블 보장 (이미 있으면 그대로)
    await initDB();
    console.log('[DB] 테이블 4개 초기화 완료');

    // 2) 저장소 어댑터 (추상화 레이어를 거쳐 SQLite 구현 사용)
    const storage = new SQLiteStorage();

    // 3) MQTT 구독 시작 — 들어오는 센서 데이터를 storage에 저장
    startMqttHandler(storage);

    console.log('[Server] MQTT 핸들러 시작됨. (Express는 Phase 5에서 추가)');
  } catch (err) {
    console.error('[Server] 시작 실패:', err);
    process.exit(1);
  }
})();
