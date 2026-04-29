# DB 스키마 정의서

> 엔진: SQLite 3
> 파일 위치: `.env`의 `DB_PATH` (기본 `./senibot.db`)
> 초기화: `node db/init.js` — `CREATE TABLE IF NOT EXISTS`로 재실행 안전.

---

## 테이블 개요

| 테이블 | 용도 | 쓰기 주체 | 읽기 주체 |
|--------|------|-----------|-----------|
| `fitbit_data`     | Fitbit 시계열 (1분 주기)          | `fitbit-publisher.js` (`saveFitbitData`) | `routes/fitbit.js`, `routes/dashboard.js` |
| `sensor_data`     | DHT11 환경 시계열 (10초 주기)     | `services/mqtt-handler.js` (`saveSensorData`) | `routes/environment.js`, `routes/dashboard.js` |
| `alerts`          | 발화된 알림 기록                 | `services/alert-engine.js` (`saveAlert`) / `routes/alerts.js` (`acknowledgeAlert`) | `routes/alerts.js`, `routes/dashboard.js` |
| `simulator_state` | 시연용 트리거 상태 (만료 시각 포함) | `services/simulator-trigger.js` (`setSimulatorState`) | `services/fitbit-simulator.js`, `routes/simulator.js` |

---

## 1. `fitbit_data`

Fitbit 시뮬레이터가 1분 주기로 생성한 건강 스냅샷.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id`           | INTEGER | PRIMARY KEY AUTOINCREMENT | 행 ID |
| `user_id`      | TEXT    | NOT NULL DEFAULT `'senior_001'` | 어르신 식별자 (단일 사용자 가정, 다중 어르신 확장 대비) |
| `timestamp`    | TEXT    | NOT NULL | 측정 시각 (ISO 8601) |
| `heart_rate`   | INTEGER |          | 안정 시 심박수 (bpm) |
| `steps`        | INTEGER |          | 누적 걸음수 |
| `sleep_score`  | INTEGER |          | 어젯밤 수면 점수 (0 ~ 100) |
| `spo2`         | REAL    |          | 평균 SpO₂ (%) |
| `created_at`   | DATETIME | DEFAULT CURRENT_TIMESTAMP | 행 생성 시각 |

**예시 INSERT**
```sql
INSERT INTO fitbit_data (timestamp, heart_rate, steps, sleep_score, spo2)
VALUES ('2026-04-30T15:23:00.000Z', 72, 1923, 78, 97.0);
```

`user_id`는 SQL DEFAULT(`senior_001`)에 의해 호출자가 생략 가능.

---

## 2. `sensor_data`

DHT11 환경 센서 측정값 (10초 주기).

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id`           | INTEGER | PRIMARY KEY AUTOINCREMENT | 행 ID |
| `timestamp`    | TEXT    | NOT NULL | 측정 시각 (ISO 8601) |
| `sensor_type`  | TEXT    | NOT NULL | 센서 종류 (현재는 `'DHT11'`) |
| `temperature`  | REAL    |          | 섭씨 |
| `humidity`     | REAL    |          | 상대 습도 % |
| `created_at`   | DATETIME | DEFAULT CURRENT_TIMESTAMP | 행 생성 시각 |

**예시 INSERT**
```sql
INSERT INTO sensor_data (timestamp, sensor_type, temperature, humidity)
VALUES ('2026-04-30T15:23:45.000Z', 'DHT11', 25.4, 58.0);
```

---

## 3. `alerts`

알림 엔진이 발화한 알림 기록. 보호자 대시보드 미확인 목록의 원천.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id`            | INTEGER | PRIMARY KEY AUTOINCREMENT | 알림 ID |
| `timestamp`     | TEXT    | NOT NULL | 발화 시각 (호출자가 ISO 8601로 채움) |
| `alert_type`    | TEXT    | NOT NULL | `TEMP_HIGH`, `HR_HIGH` 등 (api-spec §6 표) |
| `level`         | TEXT    | NOT NULL | `INFO` \| `WARNING` \| `EMERGENCY` |
| `message`       | TEXT    |          | 보호자 친화 한국어 메시지 |
| `data`          | TEXT    |          | 원본 데이터(JSON 직렬화 문자열) |
| `acknowledged`  | INTEGER | DEFAULT 0 | 확인 처리 여부 (0 미확인, 1 확인) |
| `created_at`    | DATETIME | DEFAULT CURRENT_TIMESTAMP | 행 생성 시각 |

**예시 INSERT** (alert-engine 내부)
```sql
INSERT INTO alerts (timestamp, alert_type, level, message, data)
VALUES (
  '2026-04-30T15:23:00.000Z',
  'HR_HIGH',
  'WARNING',
  '어머니의 안정 시 심박수가 높습니다 (105 bpm). 즉시 안부 확인 권장.',
  '{"heart_rate":105,"threshold":100}'
);
```

**예시 UPDATE** (acknowledge)
```sql
UPDATE alerts SET acknowledged = 1 WHERE id = ?;
```

> `data` 컬럼은 호출자가 객체로 넘기면 `SQLiteStorage.saveAlert`가 `JSON.stringify`로 직렬화하여 저장합니다.

---

## 4. `simulator_state`

시연용 트리거 상태 — 키별 단일 행, 만료 시각과 함께 저장. 만료 후엔 `getSimulatorState`가 `null`을 반환합니다.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `key`         | TEXT    | PRIMARY KEY | `'heart_rate_override'`, `'low_activity_override'` 등 |
| `value`       | TEXT    |             | JSON 직렬화 문자열 |
| `expires_at`  | TEXT    |             | ISO 8601 만료 시각 |
| `updated_at`  | DATETIME | DEFAULT CURRENT_TIMESTAMP | 마지막 갱신 시각 |

**Upsert 패턴 (실제 사용)**
```sql
INSERT INTO simulator_state (key, value, expires_at, updated_at)
VALUES (?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  expires_at = excluded.expires_at,
  updated_at = CURRENT_TIMESTAMP;
```

**리셋 (만료 시각을 과거로)**
```sql
INSERT INTO simulator_state (key, value, expires_at, updated_at)
VALUES ('heart_rate_override', '{"active":false}', '1970-01-01T00:00:00.000Z', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO UPDATE SET
  expires_at = excluded.expires_at,
  updated_at = CURRENT_TIMESTAMP;
```

> 행을 삭제하지 않고 `expires_at`을 과거로 덮어써 **항상 멱등**이고 감사 흔적이 남도록 했습니다.

---

## 5. 인덱스

현 단계에서는 별도 인덱스를 만들지 않습니다. 이유:
- 모든 조회가 `ORDER BY id DESC LIMIT N` 또는 `WHERE id = ?` 형태이며, `id`는 `INTEGER PRIMARY KEY AUTOINCREMENT`로 SQLite의 `rowid`와 동치라 자동 인덱싱됩니다.
- `simulator_state`는 `key`가 PRIMARY KEY이므로 단건 조회가 자동 인덱싱됩니다.
- 데이터량이 학생 시연 규모(수천 ~ 수만 행)라 추가 인덱스는 과설계로 판단.

향후 확장 시 후보:
- 다중 사용자 도입 시 `fitbit_data(user_id, id)` 복합 인덱스
- 알림 필터링 빈도가 높아지면 `alerts(acknowledged, id)` 또는 `alerts(alert_type, id)`

---

## 6. 동시성 / 트랜잭션

- 본 시스템은 두 개의 쓰기 프로세스(`server.js`의 mqtt-handler, 별도 `fitbit-publisher`)와 한 개의 읽기 프로세스(라우트 핸들러)가 같은 SQLite 파일에 접근합니다.
- SQLite는 기본적으로 파일 락을 사용하며, 본 시스템의 쓰기 빈도(10초 + 60초 주기)에서는 충돌이 거의 없습니다.
- 학생 시연 규모에서는 별도 `PRAGMA busy_timeout` 설정 없이도 안정 동작을 확인했습니다 (Phase 4·5 검증). 더 높은 동시성이 필요해질 경우 `PRAGMA busy_timeout = 5000` 또는 WAL 모드(`PRAGMA journal_mode = WAL`) 검토.
