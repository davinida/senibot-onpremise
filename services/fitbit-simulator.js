// FitbitSimulator: HealthDataSource의 시뮬레이션 구현체
// Fitbit Web API 신규 등록이 중단되어 실측 시드값을 기반으로 자연스러운 변동을 만든다.
// 시연용 트리거(simulator_state)가 활성화되면 일부 값을 강제 오버라이드한다.

const HealthDataSource = require('./data-source');

// 트리거 키 상수 (simulator-trigger.js와 일치시킨다)
const KEY_HR_OVERRIDE = 'heart_rate_override';
const KEY_LOW_ACTIVITY = 'low_activity_override';

// 정수 시드 파싱 헬퍼: NaN이면 기본값 반환 + 경고 로그
function parseIntSeed(raw, defaultValue, label) {
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) {
    console.warn(`[Fitbit] ${label} 시드값 누락 또는 잘못됨, 기본값 ${defaultValue} 사용`);
    return defaultValue;
  }
  return n;
}

// 실수 시드 파싱 헬퍼
function parseFloatSeed(raw, defaultValue, label) {
  const n = parseFloat(raw);
  if (Number.isNaN(n)) {
    console.warn(`[Fitbit] ${label} 시드값 누락 또는 잘못됨, 기본값 ${defaultValue} 사용`);
    return defaultValue;
  }
  return n;
}

// 수면 점수는 기본값을 강제하지 않는다 — 시드 없으면 그대로 null
function parseSleepSeed(raw) {
  if (raw === undefined || raw === null || raw === '') {
    console.warn('[Fitbit] SLEEP_SCORE 시드값 없음, sleep_score는 null로 유지');
    return null;
  }
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) {
    console.warn('[Fitbit] SLEEP_SCORE 시드값 잘못됨, sleep_score는 null로 유지');
    return null;
  }
  return n;
}

// 오버라이드 객체가 "활성"인지 판정.
// storage.getSimulatorState는 만료 시 null을 반환하므로 추가 만료 체크 불필요.
function isOverrideActive(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'object' && Object.keys(value).length === 0) return false;
  return true;
}

class FitbitSimulator extends HealthDataSource {
  constructor(storage) {
    super();
    this.storage = storage;

    // .env 시드 로드
    this.seedHeartRate = parseIntSeed(process.env.FITBIT_SEED_HEART_RATE, 65, 'HEART_RATE');
    this.seedSteps = parseIntSeed(process.env.FITBIT_SEED_STEPS, 1500, 'STEPS');
    this.seedSleepScore = parseSleepSeed(process.env.FITBIT_SEED_SLEEP_SCORE);
    this.seedSpo2 = parseFloatSeed(process.env.FITBIT_SEED_SPO2, 97, 'SPO2');

    // 누적 걸음수 내부 상태 (호출 시마다 증가)
    this.cumulativeSteps = this.seedSteps;
  }

  // [-range, +range] 정수 난수
  _randIntDelta(range) {
    return Math.floor(Math.random() * (range * 2 + 1)) - range;
  }

  async getCurrentSnapshot() {
    // 기본 변동치 적용
    let heart_rate = this.seedHeartRate + this._randIntDelta(5);

    // 1분 주기 호출 가정: 분당 0~30 보 누적
    this.cumulativeSteps += Math.floor(Math.random() * 31);
    let steps = this.cumulativeSteps;

    const sleep_score = this.seedSleepScore; // 어젯밤 점수는 하루 안 바뀜
    let spo2 = Number((this.seedSpo2 + (Math.random() * 2 - 1)).toFixed(1));

    // 시뮬레이터 트리거 적용 (시연용)
    try {
      const hrOverride = await this.storage.getSimulatorState(KEY_HR_OVERRIDE);
      if (isOverrideActive(hrOverride)) {
        heart_rate = 105;
      }
    } catch (err) {
      console.error('[Fitbit] HR 오버라이드 조회 실패:', err.message || err);
    }

    try {
      const lowActOverride = await this.storage.getSimulatorState(KEY_LOW_ACTIVITY);
      if (isOverrideActive(lowActOverride)) {
        steps = Math.floor(this.seedSteps * 0.2);
      }
    } catch (err) {
      console.error('[Fitbit] 저활동 오버라이드 조회 실패:', err.message || err);
    }

    return {
      timestamp: new Date().toISOString(),
      heart_rate,
      steps,
      sleep_score,
      spo2,
    };
  }
}

module.exports = FitbitSimulator;
module.exports.KEY_HR_OVERRIDE = KEY_HR_OVERRIDE;
module.exports.KEY_LOW_ACTIVITY = KEY_LOW_ACTIVITY;
