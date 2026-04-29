// 환경 센서(DHT11) 조회 API
//
// GET /api/environment/current  : 현재(최신) 1건
// GET /api/environment/history?limit=50 : 최근 limit개 (1~500), 시간 오름차순
//
// storage.getRecentSensorData는 시간 오름차순(오래된 → 최신)으로 반환하므로
// "가장 최근"은 배열의 마지막 요소다.

const express = require('express');

module.exports = (storage) => {
  const router = express.Router();

  router.get('/current', async (req, res) => {
    try {
      const data = await storage.getRecentSensorData(1);
      const latest = data && data.length > 0 ? data[data.length - 1] : null;
      res.json(latest);
    } catch (err) {
      console.error('[API] /environment/current 에러:', err);
      res.status(500).json({ error: '환경 데이터 조회 실패' });
    }
  });

  router.get('/history', async (req, res) => {
    try {
      let limit = parseInt(req.query.limit, 10) || 50;
      limit = Math.min(Math.max(limit, 1), 500); // 1~500 클램프
      const data = await storage.getRecentSensorData(limit);
      res.json(data);
    } catch (err) {
      console.error('[API] /environment/history 에러:', err);
      res.status(500).json({ error: '환경 이력 조회 실패' });
    }
  });

  return router;
};
