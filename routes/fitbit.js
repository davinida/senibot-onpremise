// Fitbit(시뮬레이터) 데이터 조회 API
//
// GET /api/fitbit/latest : 가장 최근 1건
// GET /api/fitbit/history?limit=20 : 최근 limit개 (1~200), 시간 오름차순
//
// storage.getRecentFitbitData는 시간 오름차순으로 반환하므로
// "가장 최근"은 배열의 마지막 요소.

const express = require('express');

module.exports = (storage) => {
  const router = express.Router();

  router.get('/latest', async (req, res) => {
    try {
      const data = await storage.getRecentFitbitData(1);
      const latest = data && data.length > 0 ? data[data.length - 1] : null;
      res.json(latest);
    } catch (err) {
      console.error('[API] /fitbit/latest 에러:', err);
      res.status(500).json({ error: 'Fitbit 데이터 조회 실패' });
    }
  });

  router.get('/history', async (req, res) => {
    try {
      let limit = parseInt(req.query.limit, 10) || 20;
      limit = Math.min(Math.max(limit, 1), 200); // 1~200 클램프
      const data = await storage.getRecentFitbitData(limit);
      res.json(data);
    } catch (err) {
      console.error('[API] /fitbit/history 에러:', err);
      res.status(500).json({ error: 'Fitbit 이력 조회 실패' });
    }
  });

  return router;
};
