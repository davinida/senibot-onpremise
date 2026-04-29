// 시연용 트리거 비즈니스 로직
// Phase 5에서 routes/simulator.js를 통해 HTTP 라우트로 노출한다.
// 여기서는 storage.setSimulatorState를 호출해 트리거 상태를 저장만 한다.
// FitbitSimulator가 매 스냅샷 생성 시 이 상태를 읽어 강제 오버라이드를 적용한다.

const KEY_HR_OVERRIDE = 'heart_rate_override';
const KEY_LOW_ACTIVITY = 'low_activity_override';

// 만료 시각을 ISO 문자열로 계산
function expiresInSec(durationSec) {
  return new Date(Date.now() + durationSec * 1000).toISOString();
}

// 심박수 이상 트리거: heart_rate를 105 bpm으로 강제 (durationSec 동안)
async function triggerHeartRateHigh(storage, durationSec = 120) {
  const expiresAt = expiresInSec(durationSec);
  await storage.setSimulatorState(
    KEY_HR_OVERRIDE,
    { active: true, target_hr: 105, reason: '시연용 심박수 이상 트리거' },
    expiresAt
  );
  return { triggered: true, key: KEY_HR_OVERRIDE, expiresAt };
}

// 활동량 급감 트리거: steps를 시드의 20%로 강제 (durationSec 동안)
async function triggerLowActivity(storage, durationSec = 300) {
  const expiresAt = expiresInSec(durationSec);
  await storage.setSimulatorState(
    KEY_LOW_ACTIVITY,
    { active: true, ratio: 0.2, reason: '시연용 활동량 급감 트리거' },
    expiresAt
  );
  return { triggered: true, key: KEY_LOW_ACTIVITY, expiresAt };
}

// 모든 트리거 즉시 만료 처리
// 과거 시각을 expires_at으로 덮어쓰면 storage.getSimulatorState가 null을 반환한다.
async function resetTriggers(storage) {
  const past = '1970-01-01T00:00:00.000Z';
  await storage.setSimulatorState(KEY_HR_OVERRIDE, { active: false }, past);
  await storage.setSimulatorState(KEY_LOW_ACTIVITY, { active: false }, past);
  return { reset: true };
}

module.exports = {
  triggerHeartRateHigh,
  triggerLowActivity,
  resetTriggers,
  KEY_HR_OVERRIDE,
  KEY_LOW_ACTIVITY,
};
