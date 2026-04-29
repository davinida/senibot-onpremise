// 시연용 시뮬레이터 트리거 API
//
// POST /api/simulator/trigger/heart-rate-high  : 심박수 이상 트리거 (10~600초)
// POST /api/simulator/trigger/low-activity     : 활동량 급감 트리거 (10~1800초)
// POST /api/simulator/reset                    : 모든 트리거 즉시 무효화
// GET  /api/simulator/status                   : 현재 트리거 상태 조회

const express = require('express');
const {
  triggerHeartRateHigh,
  triggerLowActivity,
  resetTriggers,
  KEY_HR_OVERRIDE,
  KEY_LOW_ACTIVITY,
} = require('../services/simulator-trigger');

module.exports = (storage) => {
  const router = express.Router();

  router.post('/trigger/heart-rate-high', async (req, res) => {
    try {
      const duration = parseInt(req.body && req.body.durationSec, 10) || 120;
      const safeDuration = Math.min(Math.max(duration, 10), 600);
      const result = await triggerHeartRateHigh(storage, safeDuration);
      res.json(result);
    } catch (err) {
      console.error('[API] heart-rate-high 트리거 실패:', err);
      res.status(500).json({ error: '트리거 실패' });
    }
  });

  router.post('/trigger/low-activity', async (req, res) => {
    try {
      const duration = parseInt(req.body && req.body.durationSec, 10) || 300;
      const safeDuration = Math.min(Math.max(duration, 10), 1800);
      const result = await triggerLowActivity(storage, safeDuration);
      res.json(result);
    } catch (err) {
      console.error('[API] low-activity 트리거 실패:', err);
      res.status(500).json({ error: '트리거 실패' });
    }
  });

  router.post('/reset', async (req, res) => {
    try {
      await resetTriggers(storage);
      res.json({ reset: true });
    } catch (err) {
      console.error('[API] reset 실패:', err);
      res.status(500).json({ error: '리셋 실패' });
    }
  });

  router.get('/status', async (req, res) => {
    try {
      const hr = await storage.getSimulatorState(KEY_HR_OVERRIDE);
      const activity = await storage.getSimulatorState(KEY_LOW_ACTIVITY);
      res.json({
        heart_rate_override: hr,
        low_activity_override: activity,
      });
    } catch (err) {
      console.error('[API] status 조회 실패:', err);
      res.status(500).json({ error: '상태 조회 실패' });
    }
  });

  return router;
};
