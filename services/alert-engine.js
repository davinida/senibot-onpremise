// Rule-based 알림 엔진
//
// 환경/Fitbit 데이터를 평가하여 임계값을 벗어나면 알림을 발화한다.
// - 임계값은 process.env에서 읽음 (기본값 fallback)
// - 디바운싱: 같은 alert_type이 ALERT_DEBOUNCE_SEC 내에 발화됐으면 skip
//   (모듈 스코프 메모리 캐시 — 서버 재시작 시 초기화 OK)
// - storage.saveAlert 시그니처: { timestamp, alert_type, level, message, data? }
//   timestamp는 호출자 책임이므로 여기서 ISO 문자열로 채운다.

// 환경변수 → 숫자 (NaN이면 기본값)
function num(envValue, defaultValue) {
  const n = parseFloat(envValue);
  return Number.isNaN(n) ? defaultValue : n;
}

// 임계값 (모듈 로드 시 1회 읽음)
const TH = {
  TEMP_HIGH: num(process.env.TEMP_HIGH_THRESHOLD, 35),
  TEMP_LOW: num(process.env.TEMP_LOW_THRESHOLD, 10),
  HUMID_HIGH: num(process.env.HUMID_HIGH_THRESHOLD, 80),
  HUMID_LOW: num(process.env.HUMID_LOW_THRESHOLD, 20),
  HR_HIGH: num(process.env.HR_HIGH_THRESHOLD, 100),
  HR_LOW: num(process.env.HR_LOW_THRESHOLD, 45),
  LOW_ACTIVITY_RATIO: num(process.env.LOW_ACTIVITY_RATIO, 0.3),
  DEBOUNCE_SEC: num(process.env.ALERT_DEBOUNCE_SEC, 300),
  SEED_STEPS: num(process.env.FITBIT_SEED_STEPS, 1500),
};

// 디바운싱용 메모리 캐시: { [alert_type]: lastTimestampMs }
const lastAlertTime = {};

// 디바운싱 체크: true면 skip해야 함
function shouldDebounce(alertType) {
  const last = lastAlertTime[alertType];
  if (!last) return false;
  const elapsedMs = Date.now() - last;
  if (elapsedMs < TH.DEBOUNCE_SEC * 1000) {
    const elapsedSec = Math.floor(elapsedMs / 1000);
    console.log(`[Alert] 디바운싱: ${alertType} skip (${elapsedSec}초 전 발화)`);
    return true;
  }
  return false;
}

// 단일 알림 저장 (디바운싱 + 콘솔 로그 + 저장)
async function emitAlert(storage, { alert_type, level, message, data }) {
  if (shouldDebounce(alert_type)) return null;
  const timestamp = new Date().toISOString();
  console.log(`[Alert] 발화: ${level} ${alert_type} - ${message}`);
  try {
    await storage.saveAlert({ timestamp, alert_type, level, message, data });
    lastAlertTime[alert_type] = Date.now();
  } catch (err) {
    console.error('[Alert] 저장 실패:', err.message || err);
    throw err;
  }
  return { alert_type, level, message };
}

// ─── 환경 알림 평가 ───────────────────────────────────────────────
// sensorData: { timestamp, sensor_type, temperature, humidity }
async function evaluateEnvironmentAlerts(storage, sensorData) {
  const { temperature, humidity } = sensorData || {};
  console.log(`[Alert] 평가: TEMP=${temperature} HUMID=${humidity}`);

  const candidates = [];

  if (typeof temperature === 'number') {
    if (temperature > TH.TEMP_HIGH) {
      candidates.push({
        alert_type: 'TEMP_HIGH',
        level: 'WARNING',
        message: `어머니 댁 실내 온도가 위험 수준입니다 (${temperature.toFixed(1)}°C). 안부 확인을 권장합니다.`,
        data: { temperature, threshold: TH.TEMP_HIGH },
      });
    } else if (temperature < TH.TEMP_LOW) {
      candidates.push({
        alert_type: 'TEMP_LOW',
        level: 'WARNING',
        message: `어머니 댁 실내 온도가 너무 낮습니다 (${temperature.toFixed(1)}°C). 난방 점검을 권장합니다.`,
        data: { temperature, threshold: TH.TEMP_LOW },
      });
    }
  }

  if (typeof humidity === 'number') {
    if (humidity > TH.HUMID_HIGH) {
      candidates.push({
        alert_type: 'HUMID_HIGH',
        level: 'INFO',
        message: `어머니 댁 습도가 너무 높습니다 (${humidity.toFixed(0)}%). 환기를 권장합니다.`,
        data: { humidity, threshold: TH.HUMID_HIGH },
      });
    } else if (humidity < TH.HUMID_LOW) {
      candidates.push({
        alert_type: 'HUMID_LOW',
        level: 'INFO',
        message: `어머니 댁 습도가 너무 낮습니다 (${humidity.toFixed(0)}%). 가습을 권장합니다.`,
        data: { humidity, threshold: TH.HUMID_LOW },
      });
    }
  }

  // 한 평가에서 여러 알림 가능 — 한 건 실패해도 다른 건 진행
  const results = await Promise.allSettled(
    candidates.map((c) => emitAlert(storage, c))
  );
  return results;
}

// ─── Fitbit 알림 평가 ─────────────────────────────────────────────
// fitbitData: { timestamp, heart_rate, steps, sleep_score, spo2 }
async function evaluateFitbitAlerts(storage, fitbitData) {
  const { heart_rate, steps } = fitbitData || {};
  console.log(`[Alert] 평가: HR=${heart_rate} STEPS=${steps}`);

  const candidates = [];

  if (typeof heart_rate === 'number') {
    if (heart_rate > TH.HR_HIGH) {
      candidates.push({
        alert_type: 'HR_HIGH',
        level: 'WARNING',
        message: `어머니의 안정 시 심박수가 높습니다 (${heart_rate} bpm). 즉시 안부 확인 권장.`,
        data: { heart_rate, threshold: TH.HR_HIGH },
      });
    } else if (heart_rate < TH.HR_LOW) {
      candidates.push({
        alert_type: 'HR_LOW',
        level: 'WARNING',
        message: `어머니의 안정 시 심박수가 낮습니다 (${heart_rate} bpm). 즉시 안부 확인 권장.`,
        data: { heart_rate, threshold: TH.HR_LOW },
      });
    }
  }

  if (typeof steps === 'number') {
    const lowThreshold = Math.floor(TH.SEED_STEPS * TH.LOW_ACTIVITY_RATIO);
    if (steps < lowThreshold) {
      candidates.push({
        alert_type: 'LOW_ACTIVITY',
        level: 'INFO',
        message: `어머니의 오늘 활동량이 매우 낮습니다 (${steps}보 / 평소 ${TH.SEED_STEPS}보). 컨디션 확인 권장.`,
        data: { steps, threshold: lowThreshold, seed_steps: TH.SEED_STEPS },
      });
    }
  }

  const results = await Promise.allSettled(
    candidates.map((c) => emitAlert(storage, c))
  );
  return results;
}

module.exports = {
  evaluateEnvironmentAlerts,
  evaluateFitbitAlerts,
  // 테스트/디버깅용 export
  _internal: { TH, lastAlertTime, shouldDebounce, emitAlert },
};
