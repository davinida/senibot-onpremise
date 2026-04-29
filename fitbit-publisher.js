// Fitbit 시뮬레이터 → SQLite 백그라운드 publisher
//
// 실행:    node fitbit-publisher.js   (또는 npm run fitbit)
// 주기:    1분 (60000ms)
// 저장:    storage.saveFitbitData(snapshot)
//
// sudo 불필요 (GPIO 안 씀).
// server.js와 동시에 실행되어도 문제없다 (각자 자기 SQLite 커넥션 사용).

require('dotenv').config();

const { initDB } = require('./db/init');
const SQLiteStorage = require('./services/sqlite-storage');
const FitbitSimulator = require('./services/fitbit-simulator');

const INTERVAL_MS = 60_000; // 1분 주기

(async () => {
  // server.js가 이미 호출했을 수도 있지만, 단독 실행도 안전하게 보장
  try {
    await initDB();
  } catch (err) {
    console.warn('[Fitbit] initDB 경고(무시):', err.message || err);
  }

  const storage = new SQLiteStorage();
  const simulator = new FitbitSimulator(storage);

  async function tick() {
    try {
      const snapshot = await simulator.getCurrentSnapshot();
      // user_id는 SQL 디폴트('senior_001') 사용. 명시 생략.
      await storage.saveFitbitData(snapshot);

      const sleepStr = snapshot.sleep_score === null ? 'N/A' : snapshot.sleep_score;
      console.log(
        `[Fitbit] HR=${snapshot.heart_rate} Steps=${snapshot.steps} ` +
          `SpO2=${snapshot.spo2.toFixed(1)}% Sleep=${sleepStr}`
      );
    } catch (err) {
      console.error('[Fitbit] tick 실패:', err.message || err);
    }
  }

  // 시작 시 1회 즉시 + 1분 주기
  await tick();
  const timer = setInterval(tick, INTERVAL_MS);

  // SIGINT 안전 종료
  function shutdown() {
    console.log('\n[Fitbit] 종료 중...');
    clearInterval(timer);
    storage
      .close()
      .catch(() => {})
      .finally(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
