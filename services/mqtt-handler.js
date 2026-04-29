// MQTT 구독 핸들러
// senibot/sensor/dht11 토픽을 구독해서 들어오는 환경 데이터를 storage에 저장한다.
//
// 사용법:
//   const SQLiteStorage = require('./services/sqlite-storage');
//   const { startMqttHandler } = require('./services/mqtt-handler');
//   startMqttHandler(new SQLiteStorage());

require('dotenv').config();
const mqtt = require('mqtt');
const { evaluateEnvironmentAlerts } = require('./alert-engine');

const BROKER = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
const TOPIC = 'senibot/sensor/dht11';

// storage: services/storage.js의 StorageAdapter 인터페이스를 구현한 객체.
// 이 핸들러는 storage.saveSensorData(data)만 사용한다.
function startMqttHandler(storage) {
  const client = mqtt.connect(BROKER);

  client.on('connect', () => {
    console.log('[MQTT] 브로커 연결됨');
    client.subscribe(TOPIC, (err) => {
      if (err) {
        console.error('[MQTT] 구독 실패:', err.message || err);
        return;
      }
      console.log(`[MQTT] ${TOPIC} 구독 시작`);
    });
  });

  client.on('error', (err) => {
    console.error('[MQTT] 연결 에러:', err.message || err);
  });

  client.on('reconnect', () => {
    console.log('[MQTT] 재연결 시도 중...');
  });

  client.on('close', () => {
    console.log('[MQTT] 연결 종료됨');
  });

  // 메시지 수신: JSON 파싱 → 저장. 어느 단계가 실패해도 프로세스는 살려둔다.
  client.on('message', async (topic, message) => {
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch (parseErr) {
      console.error('[MQTT] JSON 파싱 실패:', parseErr.message);
      return;
    }

    console.log(
      `[MQTT] 메시지 수신: ${data.temperature}°C, ${data.humidity}%`
    );

    try {
      await storage.saveSensorData(data);
    } catch (saveErr) {
      console.error('[MQTT] 저장 실패:', saveErr.message || saveErr);
    }

    // 알림 엔진 평가는 저장과 분리된 try/catch로 (한쪽 실패가 다른 쪽 막지 않게)
    try {
      await evaluateEnvironmentAlerts(storage, data);
    } catch (alertErr) {
      console.error('[MQTT] 알림 평가 실패:', alertErr.message || alertErr);
    }
  });

  return client;
}

module.exports = { startMqttHandler };
