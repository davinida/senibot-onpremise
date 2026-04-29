// StorageAdapter: 저장소 추상 인터페이스
// 클라우드 전환 시 다른 구현체(AWSStorage 등)로 교체할 수 있도록 추상화한다.
// 모든 구현체는 이 클래스를 상속하고 아래 메서드를 모두 구현해야 한다.

class StorageAdapter {
  // ─── 저장(Write) ──────────────────────────────────────────────

  // Fitbit 시계열 데이터 한 건 저장
  // data: { user_id?, timestamp, heart_rate, steps, sleep_score, spo2 }
  async saveFitbitData(data) {
    throw new Error('구현 필요');
  }

  // 환경 센서(DHT11) 데이터 한 건 저장
  // data: { timestamp, sensor_type, temperature, humidity }
  async saveSensorData(data) {
    throw new Error('구현 필요');
  }

  // 알림 한 건 저장
  // alert: { timestamp, alert_type, level, message, data? }
  async saveAlert(alert) {
    throw new Error('구현 필요');
  }

  // ─── 조회(Read) ───────────────────────────────────────────────

  // 최근 limit개의 환경 센서 데이터, 시간 오름차순(오래된 것 → 최신).
  // 시계열 그래프용.
  async getRecentSensorData(limit = 50) {
    throw new Error('구현 필요');
  }

  // 최근 limit개의 Fitbit 데이터, 시간 오름차순(오래된 것 → 최신).
  async getRecentFitbitData(limit = 10) {
    throw new Error('구현 필요');
  }

  // 최근 limit개의 알림, 시간 내림차순(최신 → 오래된 것).
  // 알림 목록 표시용.
  async getRecentAlerts(limit = 30) {
    throw new Error('구현 필요');
  }

  // 보호자 대시보드 상단 요약용.
  // 반환:
  // {
  //   fitbit: { heart_rate, steps, sleep_score, spo2, timestamp } | null,
  //   sensor: { temperature, humidity, timestamp } | null,
  //   unacknowledged_alerts: [{ id, alert_type, level, message, timestamp }, ...]
  // }
  async getDashboardSummary() {
    throw new Error('구현 필요');
  }

  // ─── 시뮬레이터 트리거 상태 (Phase 4 시연용) ────────────────────

  // 시뮬레이터 강제값 저장. value는 임의 객체(JSON 직렬화), expiresAt은 ISO 문자열.
  async setSimulatorState(key, value, expiresAt) {
    throw new Error('구현 필요');
  }

  // 시뮬레이터 강제값 조회. 만료되었으면 null 반환.
  async getSimulatorState(key) {
    throw new Error('구현 필요');
  }
}

module.exports = StorageAdapter;
