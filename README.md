# 시니봇 (SeniBot) — On-Premise 스마트 돌봄 시스템

> 독거노인을 위한 On-Premise 스마트 돌봄 시스템. DHT11 환경 센서와
> Fitbit Charge 5의 데이터를 통합해 어르신의 위험 상황을 자동 감지하고,
> 보호자(자녀)가 원격으로 어르신 상태를 모니터링할 수 있게 합니다.

- **수업**: 클라우드 IoT 서비스 — 프로젝트 #3 (On-Premise 단계)
- **팀**: 11팀 — 최다빈, 조용찬, 조상윤, 투굴두루
<img width="2940" height="1666" alt="image" src="https://github.com/user-attachments/assets/63178f49-30dc-4e3e-96e8-3cb07a268a45" />

<img width="1372" height="762" alt="image" src="https://github.com/user-attachments/assets/d031c3ae-d72c-4e39-8c5a-b7a82ff46ec7" />
<img width="1362" height="293" alt="image" src="https://github.com/user-attachments/assets/cbf35548-a574-4d62-8aa8-cbc9485b9d49" />

---

## 1. 시스템 아키텍처

4-Layer 구조 (수집 → 처리 → 저장 → 서비스):

```
┌─────────────────────────────────────────────────────────────────┐
│                        보호자 (자녀)                               │
│            웹 브라우저 — 보호자 대시보드 (5초 자동 갱신)                  │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP (REST + JSON)
┌────────────────────────▼────────────────────────────────────────┐
│  [서비스 Layer]   Express.js  (server.js)                          │ 
│   ├─ /api/environment   /api/fitbit   /api/alerts                │
│   ├─ /api/dashboard/summary    (보호자 통합 응답)                    │
│   └─ /api/simulator/*          (시연용 트리거)                      │
└──┬──────────────────────────────────────────────────────────────┘
   │
┌──▼──────────────────────────────────────────────────────────────┐
│  [저장 Layer]    SQLite (senibot.db)                              │
│    fitbit_data │ sensor_data │ alerts │ simulator_state          │
│   ▲ StorageAdapter (인터페이스) ─ SQLiteStorage (구현)               │
└──▲──────────────────────────────────────────────────────────────┘
   │ saveSensorData / saveFitbitData / saveAlert
┌──┴──────────────────────────────────────────────────────────────┐
│  [처리 Layer]                                                    │
│   ┌─ mqtt-handler   : MQTT 구독 → 저장 → 알림 평가                   │
│   ├─ fitbit-publisher: 시뮬레이터 → 저장 → 알림 평가                   │
│   └─ alert-engine   : Rule-based 평가 + 디바운싱(5분)                │
└──▲──────────────────────────────────────────────────────────────┘
   │ MQTT publish (senibot/sensor/dht11)            │ 1분 주기
┌──┴──────────────────────────────┐  ┌──────────────▼─────────────┐
│ [수집 A]  DHT11 → GPIO           │  │ [수집 B]  FitbitSimulator    │
│   sensor-publisher.js (10초)     │  │   HealthDataSource (구현)   │
│   Mosquitto (localhost:1883)    │  │   본인 Charge 5 실측 시드      │
└─────────────────────────────────┘  └────────────────────────────┘
```

상세 설명: [`docs/architecture.md`](docs/architecture.md)

---

## 2. 주요 기능

| 영역 | 기능 |
|------|------|
| 환경 모니터링 | DHT11 → MQTT → SQLite (10초 주기, 실시간) |
| 건강 모니터링 | Fitbit 시뮬레이터 → SQLite (1분 주기) |
| 자동 알림 | Rule-based 7종 알림 (환경 4종 + Fitbit 3종), 디바운싱 5분 |
| 보호자 대시보드 | 4개 카드 + 온도 추이 차트 + 알림 목록, 5초 자동 갱신 |
| 시연 트리거 API | 심박수 이상 / 활동량 급감 / 정상화 / 상태 조회 |
| 추상화 레이어 | 클라우드 전환 시 `HealthDataSource`, `StorageAdapter` 교체로 대응 |

---

## 3. 기술 스택

- **Runtime**: Node.js LTS
- **Backend**: Express.js, RESTful API
- **Database**: SQLite 3
- **Messaging**: MQTT — Mosquitto 브로커 (localhost)
- **Sensor**: DHT11 (GPIO 4번) — `node-dht-sensor` + `bcm2835`
- **Frontend**: HTML + CSS + Vanilla JS + Chart.js (CDN)
- **Auth (예정)**: Fitbit OAuth 2.0 PKCE → 현재 Google Health API로 마이그레이션 중. 이번 단계는 시뮬레이터.
- **Hardware**: Raspberry Pi 4 (Raspberry Pi OS)

---

## 4. 폴더 구조

```
senibot/
├── server.js                      # Express 진입점 (DB 초기화 + MQTT + API 등록)
├── sensor-publisher.js            # DHT11 → MQTT 발행 (sudo)
├── fitbit-publisher.js            # Fitbit 시뮬레이터 → DB 저장
├── db/
│   └── init.js                    # SQLite 4개 테이블 초기화
├── routes/
│   ├── environment.js             # GET /api/environment/{current,history}
│   ├── fitbit.js                  # GET /api/fitbit/{latest,history}
│   ├── alerts.js                  # GET /api/alerts, POST /:id/acknowledge
│   ├── dashboard.js               # GET /api/dashboard/summary
│   └── simulator.js               # POST /api/simulator/trigger/*, /reset, GET /status
├── services/
│   ├── data-source.js             # HealthDataSource 추상 인터페이스
│   ├── fitbit-simulator.js        # FitbitSimulator (HealthDataSource 구현)
│   ├── simulator-trigger.js       # 시연용 트리거 함수
│   ├── storage.js                 # StorageAdapter 추상 인터페이스
│   ├── sqlite-storage.js          # SQLiteStorage (StorageAdapter 구현)
│   ├── mqtt-handler.js            # MQTT 구독 → DB 저장 + 알림 평가
│   └── alert-engine.js            # Rule-based 알림 평가 + 디바운싱
├── public/
│   └── index.html                 # 보호자 대시보드 (단일 HTML, CSS/JS 인라인)
├── docs/
│   ├── architecture.md            # 시스템 아키텍처 상세
│   ├── api-spec.md                # API 명세서 (마크다운)
│   ├── openapi.yaml               # API 명세서 (OpenAPI 3.0, Swagger UI)
│   ├── db-schema.md               # DB 스키마 정의서
│   └── security.md                # 보안 적용 내역서
├── .env.example                   # 환경 변수 템플릿
├── .env                           # (gitignored) 실제 환경 변수
├── .gitignore
└── package.json
```

---

## 5. 실행 방법

### 5.1. 사전 요구사항

- Raspberry Pi 4 (Raspberry Pi OS)
- Node.js LTS, npm
- Mosquitto MQTT 브로커
  ```bash
  sudo apt update
  sudo apt install -y mosquitto mosquitto-clients
  sudo systemctl enable --now mosquitto
  ```
- bcm2835 라이브러리 (DHT 센서 제어용)
- DHT11 센서 (GPIO 4번 연결)

### 5.2. 설치

```bash
git clone https://github.com/davinida/senibot-onpremise.git senibot
cd senibot
npm install
cp .env.example .env
# .env 파일을 열어 본인의 Fitbit 시드값과 어르신/보호자 정보를 입력
```

`.env` 주요 항목:
- `FITBIT_SEED_HEART_RATE` / `FITBIT_SEED_STEPS` / `FITBIT_SEED_SLEEP_SCORE` / `FITBIT_SEED_SPO2`
- `SENIOR_NAME` / `GUARDIAN_NAME` / `GUARDIAN_PHONE`
- 임계값(`TEMP_HIGH_THRESHOLD`, `HR_HIGH_THRESHOLD`, …)은 기본값으로 채워져 있음

### 5.3. 실행 (3개 터미널)

```bash
# 터미널 1: 메인 서버 (Express + MQTT 핸들러)
npm start

# 터미널 2: DHT11 센서 발행자 (sudo 필수 — GPIO 권한)
sudo node sensor-publisher.js
# 또는 npm run sensor

# 터미널 3: Fitbit 시뮬레이터 (sudo 불필요)
npm run fitbit
```

### 5.4. 접속

- **보호자 대시보드**: `http://<RPi-IP>:3000/`
- **Swagger UI (API 문서)**: `http://<RPi-IP>:3000/api-docs`
- **API**: `http://<RPi-IP>:3000/api/dashboard/summary`
- **헬스체크**: `http://<RPi-IP>:3000/health`

---

## 6. 주요 API 엔드포인트

| Method | 경로 | 설명 |
|--------|------|------|
| GET  | `/health`                                       | 헬스체크 |
| GET  | `/api/environment/current`                      | 가장 최근 환경(DHT11) 데이터 |
| GET  | `/api/environment/history?limit=50`             | 환경 데이터 시계열 (그래프용, 시간 오름차순) |
| GET  | `/api/fitbit/latest`                            | 가장 최근 Fitbit 데이터 |
| GET  | `/api/fitbit/history?limit=20`                  | Fitbit 시계열 |
| GET  | `/api/alerts?limit=30&unacknowledged_only=false`| 알림 목록 (시간 내림차순) |
| POST | `/api/alerts/:id/acknowledge`                   | 알림 확인 처리 |
| GET  | `/api/dashboard/summary`                        | 대시보드 통합 응답 (status 판정 포함) |
| POST | `/api/simulator/trigger/heart-rate-high`        | 시연: 심박수 이상 트리거 |
| POST | `/api/simulator/trigger/low-activity`           | 시연: 활동량 급감 트리거 |
| POST | `/api/simulator/reset`                          | 시연: 모든 트리거 즉시 무효화 |
| GET  | `/api/simulator/status`                         | 트리거 활성 상태 조회 |

상세 명세: [`docs/api-spec.md`](docs/api-spec.md)

---

## 7. Fitbit 시뮬레이션 채택 사유

- **Fitbit Web API**가 2026년 9월 deprecation 예정으로 `dev.fitbit.com` 신규 앱 등록이 중단됨.
- Google Health API로 이전 중이나 본 프로젝트 일정상 **시뮬레이션 채택**.
- 가이드라인의 *"실제 Fitbit 데이터 또는 시뮬레이션 데이터"* 허용 문구에 근거.
- 시뮬레이터는 **본인 Fitbit Charge 5의 실측값을 시드로 사용**:
  - 안정 시 심박수 72 bpm, 오늘 걸음수 1,900보, 어젯밤 수면 점수 78, 평균 SpO₂ 97%
- 추상화 레이어(`HealthDataSource`)를 통해 향후 실제 API 클라이언트로 교체 가능.

---

## 8. 클라우드 전환 계획 (다음 프로젝트)

이번 On-Premise 단계의 컴포넌트는 다음 표대로 클라우드로 매핑됩니다.
**추상화 레이어 덕분에 비즈니스 로직은 거의 변경 없이 어댑터만 교체**합니다.

| On-Premise (현재)            | 클라우드 (예정)                |
|------------------------------|--------------------------------|
| RPi 단일 서버                 | AWS EC2 / ECS Auto Scaling      |
| SQLite                        | Amazon RDS / DynamoDB           |
| Mosquitto (로컬)              | AWS IoT Core                    |
| Express.js (RPi)              | API Gateway + AWS Lambda        |
| `FitbitSimulator`             | `GoogleHealthAPIClient`         |
| 자체 호스팅 대시보드          | S3 + CloudFront                 |
| 로컬 알림 콘솔 로그           | SNS / SES (실제 푸시·SMS·이메일) |

---

## 9. 라이선스 / 명예 서약

본 프로젝트는 학부 과제 용도로 작성되었으며, 보고서 양심 서약을 준수합니다.
