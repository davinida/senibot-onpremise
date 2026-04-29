// 알림 조회/확인 API
//
// GET  /api/alerts?limit=30&unacknowledged_only=false
//   - storage.getRecentAlerts는 시간 내림차순(최신 → 오래된 것)
//   - unacknowledged_only=true면 acknowledged=0 만 필터
//   - (의도된 단순화) 필터 후 결과가 limit보다 적을 수 있음
//
// POST /api/alerts/:id/acknowledge
//   - 잘못된 ID(NaN) → 400
//   - 존재하지 않는 ID → 404
//   - 정상 → { success: true }

const express = require('express');

module.exports = (storage) => {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      let limit = parseInt(req.query.limit, 10) || 30;
      limit = Math.min(Math.max(limit, 1), 200); // 1~200 클램프

      let alerts = await storage.getRecentAlerts(limit);
      if (req.query.unacknowledged_only === 'true') {
        // 필터 후 결과가 limit보다 적을 수 있음 (의도된 단순화)
        alerts = alerts.filter((a) => a.acknowledged === 0);
      }
      res.json(alerts);
    } catch (err) {
      console.error('[API] /alerts 에러:', err);
      res.status(500).json({ error: '알림 조회 실패' });
    }
  });

  router.post('/:id/acknowledge', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: '잘못된 ID' });
    }
    try {
      const result = await storage.acknowledgeAlert(id);
      if (result.changes === 0) {
        return res.status(404).json({ error: '알림을 찾을 수 없음' });
      }
      res.json({ success: true });
    } catch (err) {
      console.error('[API] /alerts/:id/acknowledge 에러:', err);
      res.status(500).json({ error: '알림 확인 처리 실패' });
    }
  });

  return router;
};
