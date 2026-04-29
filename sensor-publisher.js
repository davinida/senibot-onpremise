// DHT11 센서 → MQTT 발행 (RPi 전용 스탠드얼론 프로세스)
//
// 실행:    sudo node sensor-publisher.js   (또는 npm run sensor)
// 토픽:    senibot/sensor/dht11
// 주기:    10초
//
// 주의: node-dht-sensor는 RPi의 bcm2835 라이브러리를 필요로 한다.
// 맥에서는 컴파일되지 않으므로 이 스크립트를 실행하지 말 것.

require('dotenv').config();
const mqtt = require('mqtt');
const sensor = require('node-dht-sensor');

const BROKER = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
const TOPIC = 'senibot/sensor/dht11';
const INTERVAL_MS = 10_000;       // 10초 주기
const SENSOR_TYPE = 11;           // DHT11
const GPIO_PIN = 4;               // GPIO 4번

// MQTT 클라이언트 연결
const client = mqtt.connect(BROKER);

client.on('connect', () => {
  console.log(`[Sensor] MQTT 브로커 연결됨 (${BROKER})`);
});

client.on('error', (err) => {
  console.error('[Sensor] MQTT 에러:', err.message || err);
});

client.on('reconnect', () => {
  console.log('[Sensor] MQTT 재연결 시도 중...');
});

// DHT11 1회 측정 + MQTT 발행. 실패해도 프로세스는 죽지 않는다.
function readAndPublish() {
  sensor.read(SENSOR_TYPE, GPIO_PIN, (err, temperature, humidity) => {
    if (err) {
      console.error('[Sensor] 읽기 실패:', err.message || err);
      return;
    }

    const payload = {
      timestamp: new Date().toISOString(),
      sensor_type: 'DHT11',
      temperature: Number(temperature.toFixed(1)),
      humidity: Number(humidity.toFixed(1)),
    };

    // 브로커에 아직 연결 전이면 mqtt 라이브러리가 자체 큐에 쌓아 보낸다.
    client.publish(TOPIC, JSON.stringify(payload), { qos: 0 }, (pubErr) => {
      if (pubErr) {
        console.error('[Sensor] 발행 실패:', pubErr.message || pubErr);
        return;
      }
      console.log(`[Sensor] ${payload.temperature}°C, ${payload.humidity}%`);
    });
  });
}

// 시작 시 1회 즉시 측정 후 10초 주기 반복
readAndPublish();
const timer = setInterval(readAndPublish, INTERVAL_MS);

// Ctrl+C 안전 종료 (MQTT 연결 정리 후 exit)
function shutdown() {
  console.log('\n[Sensor] 종료 중...');
  clearInterval(timer);
  client.end(false, () => process.exit(0));
  // 안전망: MQTT 정리가 늦어도 2초 후 강제 종료
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
