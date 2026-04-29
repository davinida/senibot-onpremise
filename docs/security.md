# 보안 적용 내역서

> 본 문서는 시니봇 **On-Premise 단계**의 보안 적용 현황과 미적용 항목,
> 그리고 다음 단계인 **클라우드 전환** 시의 강화 계획을 정리합니다.

---

## 1. 개요

본 시스템은 학부 수업 프로젝트의 On-Premise 단계로, **폐쇄망 / 단일 사용자**
가정 하에 4-Layer 구조와 핵심 데이터 파이프라인 학습을 우선 목표로 했습니다.
프로덕션 수준의 보안(HTTPS, 인증·인가, 데이터 암호화, 감사 로그 등)은
다음 단계인 클라우드 전환 시 단계적으로 도입할 예정입니다.

본 문서는 *지금* 적용된 항목과 *왜 미적용인지*, *언제 적용할지*를 솔직하게 기술합니다.

---

## 2. 적용된 보안 조치

### 2.1. 입력 검증 (Input Validation)

- **쿼리 파라미터 클램프**: `limit` 등 모든 정수형 쿼리는 `parseInt` 후
  `Math.min(Math.max(...), upper)`로 범위 클램프.
  - 예: `/api/environment/history?limit` → 1~500
  - 예: `/api/fitbit/history?limit` → 1~200
  - 예: `/api/simulator/trigger/heart-rate-high` `durationSec` → 10~600
  - 예: `/api/simulator/trigger/low-activity` `durationSec` → 10~1800
- **경로 파라미터 검증**: `POST /api/alerts/:id/acknowledge`에서 `parseInt(id)` 후
  `Number.isNaN` 체크 → `400 { error: '잘못된 ID' }`.
- **JSON 파싱 실패 격리**: MQTT 메시지 JSON 파싱 실패 시 에러 로그만 남기고
  메시지를 무시 (`services/mqtt-handler.js`). 프로세스 크래시 방지.

### 2.2. SQL Injection 방지

- `sqlite3` 패키지의 **prepared statement** 사용.
- 모든 사용자 입력을 `?` 플레이스홀더로 바인딩 (`services/sqlite-storage.js`).
- 쿼리 문자열 직접 조합(string concat) 없음.

### 2.3. 민감 정보 분리 (Secret Management)

- `.env` 파일에 **모든 시드값/임계값/보호자 정보** 저장.
- `.gitignore`에 `.env` 포함 → 저장소에 노출되지 않음.
- 공개 저장소에는 `.env.example`만 포함 (시드/이름은 빈 템플릿).
- 서버 콘솔 / 클라이언트 응답 어디에도 secret을 노출하지 않음.

### 2.4. 에러 응답 정제 (Information Hiding)

- 500 에러 시 내부 stack trace를 클라이언트에 **노출하지 않음**.
- 사용자에게는 `{ "error": "<한국어 메시지>" }` 형식만 응답.
- 상세 에러는 `console.error('[API] ... 에러:', err)` 로 **서버 측에만** 로깅.

### 2.5. 권한 분리 (Principle of Least Privilege)

- **DHT 센서 발행자**(`sensor-publisher.js`)만 `sudo` 실행 (GPIO 권한 필요).
- 메인 서버(`server.js`), Fitbit 발행자(`fitbit-publisher.js`)는 **일반 권한**.
- 권한이 필요한 프로세스를 분리해 공격 표면 최소화.

### 2.6. CORS 정책

- Express에 `cors` 미들웨어 적용.
- 학습 단계에서는 모든 origin 허용 (LAN 내부 다양한 디바이스 접근 편의).
- 프로덕션에서는 화이트리스트 origin 제한 예정.

### 2.7. 알림 디바운싱 — 간접적 DoS 완화

- `alert-engine.js`의 모듈 스코프 캐시로 같은 `alert_type`을
  `ALERT_DEBOUNCE_SEC`(기본 300초) 내 중복 발화 차단.
- 본래 의도는 보호자 알림 폭주 방지지만,
  **알림 폭주를 통한 저장소 부하 시도(저비용 DoS)도 자연 완화**.

### 2.8. 시뮬레이터 트리거 만료

- 시연용 트리거(`heart_rate_override`, `low_activity_override`)는
  `expires_at` 만료 시각을 가지고, 만료 후엔 `getSimulatorState`가
  `null`을 반환하여 자동 비활성화.
- 트리거 리셋도 행 삭제가 아닌 **만료 시각을 과거로 덮어쓰는 멱등 방식** —
  감사 흔적이 남고 재실행 안전.

---

## 3. 미적용 항목 및 클라우드 전환 시 강화 계획

| # | 항목 | 현재 (On-Premise) | 클라우드 (예정) | 미적용 사유 |
|---|------|-------------------|------------------|--------------|
| 1 | HTTPS / TLS | 미적용 (HTTP만)            | AWS ACM + CloudFront / ALB | 폐쇄망 가정, 인증서 발급 인프라 미비 |
| 2 | 인증 / 인가 | 미적용 (LAN 내부 가정)      | AWS Cognito + JWT (보호자 로그인) | 단일 사용자 / 학습 단계, 다음 단계의 핵심 작업 |
| 3 | Rate Limiting | 미적용                   | API Gateway throttling    | 단일 사용자 가정, 외부 노출 없음 |
| 4 | 저장 데이터 암호화 | 평문 SQLite        | RDS at-rest 암호화 + KMS  | SQLite 암호화 옵션 미적용, 학습 범위 외 |
| 5 | 전송 데이터 암호화 (MQTT) | 평문 MQTT     | MQTT over TLS (AWS IoT Core) | 로컬 브로커, 학습 단계 단순화 |
| 6 | 감사 로그 (audit log)   | 콘솔 로그만       | CloudWatch Logs + S3 보관  | 영속 로그 인프라 미비 |
| 7 | 보안 헤더 (helmet, CSP) | 미적용            | helmet + Content-Security-Policy | 우선순위 후순위 |
| 8 | OAuth 2.0 (건강 데이터)  | 미적용 (시뮬레이션) | Google Health API OAuth 2.0 PKCE | Fitbit Web API deprecation, 시뮬레이션으로 대체 |
| 9 | Secret 관리            | `.env` 파일       | AWS Secrets Manager / Parameter Store | 단일 머신 환경 |
| 10 | DDoS / WAF            | 미적용            | AWS WAF + Shield           | 외부 노출 없음 |

---

## 4. Fitbit / 건강 데이터 보안 고려사항

- **현재 단계**: 건강 데이터는 시뮬레이션이므로 실제 PHI(Personal Health
  Information)를 저장·전송하지 않음. 시드값 또한 본인 데이터.
- **클라우드 단계**: 실제 Google Health API 연동 시
  - HIPAA 수준 가이드라인 검토 (저장 암호화, 접근 로깅, 최소 보존 기간)
  - **보호자 동의 / 철회 흐름** 구현 (보호자 가입 시 어르신 명시 동의 + 철회 시 데이터 삭제)
  - OAuth 토큰은 서버 측에서만 보관, 프런트로 노출 X

---

## 5. 보안 사고 대응 (현재 단계 한계)

- **단일 RPi 단일 프로세스** 구조 → 장애 시 보호자 알림 미전달 위험.
- 알림 디바운싱 캐시는 메모리 기반 → 서버 재시작 시 초기화
  (의도된 단순화 — 위험성 낮음).
- **클라우드 단계**의 강화:
  - 다중 가용 영역(Multi-AZ) + 자동 페일오버
  - 시뮬레이터 트리거 / 알림 캐시 외부 저장소(예: Redis ElastiCache)로 이관
  - 헬스체크 + CloudWatch 알람으로 보호자 채널 자체의 가용성 모니터링

---

## 6. 결론

On-Premise 단계는 **시스템의 본질적 동작과 4-Layer 구조 학습**이 우선이므로
보안 적용을 의도적으로 단순화했습니다. 그럼에도 다음 항목은 *지금* 적용했습니다:

- prepared statement 기반 SQL Injection 방지
- 입력 클램프 / ID 파싱 검증
- secret 분리 (`.env` + `.gitignore`)
- 에러 메시지 정제 (stack trace 비노출)
- 권한 최소화 (sudo는 GPIO 발행자만)
- 알림 디바운싱 (간접적 DoS 완화)

미적용 항목은 §3 표에 모두 명시했으며, 클라우드 단계에서 **HTTPS, 인증·인가,
저장·전송 암호화, 감사 로그, OAuth 2.0** 등을 단계적으로 도입하여 프로덕션
수준으로 강화할 예정입니다.
