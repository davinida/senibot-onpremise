# API 명세서

> Base URL: `http://<RPi-IP>:3000`
> 모든 응답은 `application/json` (단, `/health`만 단순 객체).
> 에러 응답은 `{ "error": "<한국어 메시지>" }` 형식.
>
> **OpenAPI 3.0 스펙**: [`docs/openapi.yaml`](./openapi.yaml)
> **Swagger UI**: 서버 기동 시 `http://<RPi-IP>:3000/api-docs` 에서 확인 가능.

---

## 0. `/health`

| 항목 | 값 |
|------|----|
| Method | `GET` |
| 경로   | `/health` |
| 설명   | 서버 헬스체크 |

**응답 200**
```json
{ "status": "ok" }
```

---

## 1. 환경 데이터 — `/api/environment`

### 1.1. `GET /api/environment/current`

가장 최근 환경(DHT11) 데이터 1건.

**응답 200** (데이터 없으면 `null`)
```json
{
  "id": 123,
  "timestamp": "2026-04-30T15:23:45.000Z",
  "sensor_type": "DHT11",
  "temperature": 25.4,
  "humidity": 58.0,
  "created_at": "2026-04-30 15:23:45"
}
```

**500** `{ "error": "환경 데이터 조회 실패" }`

### 1.2. `GET /api/environment/history?limit=50`

최근 환경 데이터 시계열. **시간 오름차순(오래된 → 최신)** — 그래프용.

| 파라미터 | 타입 | 기본 | 범위 |
|----------|------|------|------|
| `limit` | int | 50 | 1 ~ 500 (자동 클램프) |

**응답 200** — 객체 배열 (위 1.1과 같은 항목들)

**500** `{ "error": "환경 이력 조회 실패" }`

---

## 2. Fitbit 데이터 — `/api/fitbit`

### 2.1. `GET /api/fitbit/latest`

가장 최근 Fitbit 데이터 1건.

**응답 200** (데이터 없으면 `null`)
```json
{
  "id": 42,
  "user_id": "senior_001",
  "timestamp": "2026-04-30T15:23:00.000Z",
  "heart_rate": 72,
  "steps": 1923,
  "sleep_score": 78,
  "spo2": 97.0,
  "created_at": "2026-04-30 15:23:00"
}
```

**500** `{ "error": "Fitbit 데이터 조회 실패" }`

### 2.2. `GET /api/fitbit/history?limit=20`

| 파라미터 | 타입 | 기본 | 범위 |
|----------|------|------|------|
| `limit` | int | 20 | 1 ~ 200 |

시간 오름차순.

---

## 3. 알림 — `/api/alerts`

### 3.1. `GET /api/alerts?limit=30&unacknowledged_only=false`

알림 목록. **시간 내림차순(최신 → 오래된 것)**.

| 파라미터 | 타입 | 기본 | 비고 |
|----------|------|------|------|
| `limit`               | int    | 30    | 1 ~ 200 |
| `unacknowledged_only` | string | false | `'true'`이면 `acknowledged=0`만 필터 (필터 후 결과가 limit보다 적을 수 있음) |

**응답 200**
```json
[
  {
    "id": 7,
    "timestamp": "2026-04-30T15:23:00.000Z",
    "alert_type": "HR_HIGH",
    "level": "WARNING",
    "message": "어머니의 안정 시 심박수가 높습니다 (105 bpm). 즉시 안부 확인 권장.",
    "data": "{\"heart_rate\":105,\"threshold\":100}",
    "acknowledged": 0,
    "created_at": "2026-04-30 15:23:00"
  }
]
```

`level`은 `INFO` / `WARNING` / `EMERGENCY` 중 하나. `data`는 JSON 문자열로 직렬화된 원본.

### 3.2. `POST /api/alerts/:id/acknowledge`

해당 알림을 확인 처리(`acknowledged=1`).

| 응답 | 본문 |
|------|------|
| **200** | `{ "success": true }` |
| **400** | `{ "error": "잘못된 ID" }` (ID 파싱 실패) |
| **404** | `{ "error": "알림을 찾을 수 없음" }` |
| **500** | `{ "error": "알림 확인 처리 실패" }` |

---

## 4. 대시보드 — `/api/dashboard/summary`

보호자 대시보드 통합 응답. 알림 레벨로 어르신 상태(`status`)를 판정한다.

**응답 200**
```json
{
  "senior": {
    "name": "김복순",
    "status": "warning"
  },
  "guardian": {
    "name": "김민준",
    "phone": "010-1234-5678"
  },
  "fitbit": {
    "heart_rate": 72,
    "steps": 1923,
    "sleep_score": 78,
    "spo2": 97.0,
    "timestamp": "2026-04-30T15:23:00.000Z"
  },
  "environment": {
    "temperature": 25.4,
    "humidity": 58.0,
    "timestamp": "2026-04-30T15:23:45.000Z"
  },
  "unacknowledged_alerts": [
    {
      "id": 7,
      "alert_type": "HR_HIGH",
      "level": "WARNING",
      "message": "어머니의 안정 시 심박수가 높습니다 (105 bpm). 즉시 안부 확인 권장.",
      "timestamp": "2026-04-30T15:23:00.000Z"
    }
  ]
}
```

### `senior.status` 판정 규칙

| 조건 | status |
|------|--------|
| 미확인 알림에 `EMERGENCY`가 하나라도 있음 | `emergency` |
| 위 조건 미충족, 미확인 알림에 `WARNING`이 하나라도 있음 | `warning` |
| 그 외 | `normal` |

`fitbit` / `environment`는 데이터 없으면 `null`.

**500** `{ "error": "대시보드 조회 실패" }`

---

## 5. 시연용 시뮬레이터 — `/api/simulator`

시연 시 알림 발화를 위해 Fitbit 시뮬레이터 출력값을 강제로 오버라이드한다.

### 5.1. `POST /api/simulator/trigger/heart-rate-high`

심박수를 105 bpm으로 강제. 다음 측정(최대 1분 후)에 `HR_HIGH` 알림 발화.

**Body** (JSON, 선택)
```json
{ "durationSec": 120 }
```
- 기본 120초, 클램프 10 ~ 600.

**응답 200**
```json
{ "triggered": true, "key": "heart_rate_override", "expiresAt": "2026-04-30T15:25:00.000Z" }
```

### 5.2. `POST /api/simulator/trigger/low-activity`

`steps`를 시드의 20%로 강제. `LOW_ACTIVITY` 알림 발화.

**Body** (선택) `{ "durationSec": 300 }` — 기본 300초, 클램프 10 ~ 1800.

응답 형식은 5.1과 동일 (`key: "low_activity_override"`).

### 5.3. `POST /api/simulator/reset`

모든 트리거를 즉시 무효화 (만료 시각을 과거로 덮어쓰기).

**응답 200** `{ "reset": true }`

### 5.4. `GET /api/simulator/status`

현재 트리거 활성 상태 조회. 만료된 항목은 `null`.

**응답 200**
```json
{
  "heart_rate_override": { "active": true, "target_hr": 105, "reason": "시연용 심박수 이상 트리거" },
  "low_activity_override": null
}
```

---

## 6. 알림 룰 (참고)

| `alert_type`     | level   | 조건 | 메시지 예 |
|------------------|---------|------|-----------|
| `TEMP_HIGH`      | WARNING | `temperature > TEMP_HIGH_THRESHOLD` (35°C) | "어머니 댁 실내 온도가 위험 수준입니다 (36.5°C). 안부 확인을 권장합니다." |
| `TEMP_LOW`       | WARNING | `< TEMP_LOW_THRESHOLD` (10°C) | "어머니 댁 실내 온도가 너무 낮습니다…" |
| `HUMID_HIGH`     | INFO    | `> HUMID_HIGH_THRESHOLD` (80%) | "어머니 댁 습도가 너무 높습니다…" |
| `HUMID_LOW`      | INFO    | `< HUMID_LOW_THRESHOLD` (20%) | "어머니 댁 습도가 너무 낮습니다…" |
| `HR_HIGH`        | WARNING | `heart_rate > HR_HIGH_THRESHOLD` (100) | "어머니의 안정 시 심박수가 높습니다 (105 bpm)…" |
| `HR_LOW`         | WARNING | `< HR_LOW_THRESHOLD` (45) | "어머니의 안정 시 심박수가 낮습니다…" |
| `LOW_ACTIVITY`   | INFO    | `steps < FITBIT_SEED_STEPS × LOW_ACTIVITY_RATIO` (×0.3) | "어머니의 오늘 활동량이 매우 낮습니다 (300보 / 평소 1500보)…" |

같은 `alert_type`은 `ALERT_DEBOUNCE_SEC`(기본 300초) 내에 다시 발화되지 않습니다.
