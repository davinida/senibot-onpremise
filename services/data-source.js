// HealthDataSource: 어르신 건강 데이터 출처 추상 인터페이스
// 클라우드 전환 시 GoogleHealthAPIClient 등 다른 구현체로 교체할 수 있도록 추상화한다.
// 모든 구현체는 이 클래스를 상속하고 아래 메서드를 구현해야 한다.

class HealthDataSource {
  // 현재 시점의 건강 스냅샷 1건 반환.
  // 반환 형식:
  // {
  //   timestamp: ISO 문자열,
  //   heart_rate: number,         // 안정 시 심박수 (bpm)
  //   steps: number,              // 누적 걸음수
  //   sleep_score: number | null, // 어젯밤 수면 점수 (없으면 null)
  //   spo2: number                // 평균 SpO2 (%)
  // }
  async getCurrentSnapshot() {
    throw new Error('구현 필요');
  }
}

module.exports = HealthDataSource;
