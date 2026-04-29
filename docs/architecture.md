# 시스템 아키텍처

> 시니봇(SeniBot) On-Premise 단계의 시스템 아키텍처 상세 문서.

---

## 1. 4-Layer 구조

수업 가이드라인의 IoT 4-Layer 모델에 매핑한 구조입니다.

| Layer | 컴포넌트 | 책임 |
|-------|----------|------|
| 수집 (Sensing)     | DHT11 + GPIO, FitbitSimulator                | 물리 세계의 환경/생체 데이터를 디지털 신호로 변환 |
| 처리 (Processing)  | mqtt-handler, fitbit-publisher, alert-engine | 수집된 데이터를 정규화·평가하고 상황 판단 |
| 저장 (Storage)     | SQLite + StorageAdapter                       | 시계열 데이터/알림/시뮬레이터 상태 영속화 |
| 서비스 (Service)   | Express RESTful API + 보호자 대시보드         | 보호자가 어르신 상태를 원격 조회 |

---

## 2. 데이터 경로

본 시스템은 **두 개의 독립된 데이터 경로**를 가집니다.

### 경로 A — Fitbit 건강 데이터 (1분 주기, Pull 방식)

```
[Fitbit Charge 5 실측값을 시드로]
        │
        ▼
FitbitSimulator.getCurrentSnapshot()
  · 시드 ± 자연 변동
  · 시뮬레이터 트리거 적용 (시연용)
        │
        ▼
fitbit-publisher.js (1분 주기 setInterval)
        │
        ├─► storage.saveFitbitData(snapshot)   →  SQLite [fitbit_data]
        │
        └─► alert-engine.evaluateFitbitAlerts(storage, snapshot)
              · HR_HIGH / HR_LOW / LOW_ACTIVITY
              · 디바운싱 통과 시 storage.saveAlert(...)
```

- **별도 프로세스**로 실행 (`npm run fitbit`).
- 서버 프로세스(`server.js`)와 분리해 한쪽 장애가 다른 쪽 가용성에 영향을 주지 않게 함.
- Fitbit 시뮬레이션 사유는 README의 §7 참조.

### 경로 B — DHT11 환경 센서 (10초 주기, Push 방식)

```
DHT11 (GPIO 4)
        │  sensor.read(11, 4, ...)
        ▼
sensor-publisher.js  (10초 주기, sudo)
        │  mqtt.publish('senibot/sensor/dht11', JSON)
        ▼
Mosquitto (localhost:1883)
        │
        ▼
mqtt-handler.js  (server.js 내부, 구독자)
        │
        ├─► storage.saveSensorData(data)       →  SQLite [sensor_data]
        │
        └─► alert-engine.evaluateEnvironmentAlerts(storage, data)
              · TEMP_HIGH/LOW (WARNING)
              · HUMID_HIGH/LOW (INFO)
              · 디바운싱 통과 시 storage.saveAlert(...)
```

- 센서 발행자는 **별도 프로세스 + sudo** (GPIO 권한).
- MQTT를 매개로 발행/구독을 분리해 향후 다중 센서 추가 시 핸들러 코드 변경 최소화.

---

## 3. 컴포넌트별 책임

| 컴포넌트 | 파일 | 책임 |
|----------|------|------|
| **sensor-publisher** | `sensor-publisher.js` | DHT11 10초 주기 측정 → MQTT 발행. 측정 실패해도 프로세스 유지. SIGINT 안전 종료. |
| **mqtt-handler** | `services/mqtt-handler.js` | `senibot/sensor/dht11` 구독, JSON 파싱, `saveSensorData` + `evaluateEnvironmentAlerts`. 파싱/저장/평가 각각 try/catch로 격리. |
| **fitbit-publisher** | `fitbit-publisher.js` | 1분 주기로 시뮬레이터 호출, `saveFitbitData` + `evaluateFitbitAlerts`. 저장 실패 시 평가 건너뜀. |
| **fitbit-simulator** | `services/fitbit-simulator.js` | 시드 기반 자연 변동(HR ±5, steps 누적, SpO₂ ±1.0). 시뮬레이터 트리거 활성 시 강제 오버라이드(HR=105, steps=시드×0.2). |
| **simulator-trigger** | `services/simulator-trigger.js` | 트리거 함수 3종(`triggerHeartRateHigh`, `triggerLowActivity`, `resetTriggers`). `simulator_state` 테이블에 만료 시각과 함께 upsert. |
| **alert-engine** | `services/alert-engine.js` | Rule-based 임계값 평가(환경 4종 + Fitbit 3종). 모듈 스코프 메모리 캐시로 디바운싱(`ALERT_DEBOUNCE_SEC`, 기본 5분). 보호자 친화 한국어 메시지. |
| **Express 라우트** | `routes/*.js` | `(storage) => router` 패턴. 데이터 조회 + 알림 acknowledge + 시뮬레이터 트리거 노출. |
| **대시보드** | `public/index.html` | 5초 자동 갱신, `Promise.allSettled`로 부분 실패 격리, `lastAlertsKey`로 알림 깜빡임 방지. |

---

## 4. 추상화 레이어

다음 두 인터페이스를 통해 **클라우드 전환 시 구현체만 교체**할 수 있도록 설계했습니다.

### 4.1. `StorageAdapter` — 저장소 추상화

| 메서드 | 설명 |
|--------|------|
| `saveFitbitData(data)`    | Fitbit 시계열 한 건 저장 |
| `saveSensorData(data)`    | 환경 센서 한 건 저장 |
| `saveAlert(alert)`        | 알림 한 건 저장 (`{ timestamp, alert_type, level, message, data? }`) |
| `acknowledgeAlert(id)`    | 알림 확인 처리, `{ changes }` 반환 |
| `getRecentSensorData(limit)`  | 최근 limit개, **시간 오름차순** (그래프용) |
| `getRecentFitbitData(limit)`  | 최근 limit개, **시간 오름차순** |
| `getRecentAlerts(limit)`      | 최근 limit개, **시간 내림차순** (목록 표시용) |
| `getDashboardSummary()`       | 대시보드용 통합 응답 |
| `setSimulatorState(key, value, expiresAt)` | 시뮬레이터 상태 upsert |
| `getSimulatorState(key)`      | 만료 시 `null` 반환, 유효하면 JSON 파싱 객체 |

- **현재 구현체**: `SQLiteStorage` (sqlite3 콜백을 Promise로 래핑)
- **클라우드 단계**: `AWSStorage`(예: RDS/DynamoDB)로 교체

### 4.2. `HealthDataSource` — 건강 데이터 출처 추상화

| 메서드 | 설명 |
|--------|------|
| `getCurrentSnapshot()` | 현재 시점 스냅샷 1건 (`{ timestamp, heart_rate, steps, sleep_score, spo2 }`) |

- **현재 구현체**: `FitbitSimulator` (시드 기반 합성 데이터 + 트리거 오버라이드)
- **클라우드 단계**: `GoogleHealthAPIClient`로 교체

### 4.3. 의존성 주입 방식

- `server.js`가 `new SQLiteStorage()` 한 인스턴스를 만들고
- `startMqttHandler(storage)`, `require('./routes/*.js')(storage)`로 주입
- 라우트와 핸들러는 인터페이스만 알고 구현체는 모름 → 테스트/교체 용이

---

## 5. 알림 디바운싱

- `alert-engine.js`의 모듈 스코프 객체 `lastAlertTime[alert_type]`에 마지막 발화 시각 저장.
- 같은 `alert_type`이 `ALERT_DEBOUNCE_SEC`(기본 300초) 안에 다시 발화되려 하면 **skip**.
- 서버 재시작 시 캐시 초기화 — 의도된 단순화 (영속화 불필요).
- 콘솔에 `[Alert] 디바운싱: TEMP_HIGH skip (XX초 전 발화)` 로그.

---

## 6. 확장 / 미래 작업

- **다중 어르신**: 현재 `user_id` 컬럼이 있으나 단일(`senior_001`) 가정. 라우트에 `:userId` 파라미터 추가 + 알림 캐시도 사용자별로 분리하면 됨.
- **실시간 푸시**: 클라우드 단계에서 SNS / SES 또는 Firebase로 보호자에게 즉시 알림 발송.
- **수면·낙상 등 추가 센서**: MQTT 토픽만 추가하고 `mqtt-handler` 구독 + 알림 룰 확장.
- **인증**: 현 단계는 LAN 가정으로 무인증. 클라우드 단계에서 JWT/Cognito 도입 예정.
