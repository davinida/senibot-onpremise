// 보호자 대시보드 요약 API
//
// GET /api/dashboard/summary
//   - storage.getDashboardSummary()의 결과를 보호자 친화적 형태로 가공
//   - 미확인 알림 레벨로 어르신 상태 판정 (normal / warning / emergency)
//   - sensor → environment 키 이름 매핑 (대시보드 UI 일관성)

const express = require('express');

module.exports = (storage) => {
  const router = express.Router();

  router.get('/summary', async (req, res) => {
    try {
      const summary = await storage.getDashboardSummary();

      const alerts = summary.unacknowledged_alerts || [];
      let status = 'normal';
      if (alerts.some((a) => a.level === 'EMERGENCY')) {
        status = 'emergency';
      } else if (alerts.some((a) => a.level === 'WARNING')) {
        status = 'warning';
      }

      res.json({
        senior: {
          name: process.env.SENIOR_NAME || '김복순',
          status,
        },
        guardian: {
          name: process.env.GUARDIAN_NAME || '김민준',
          phone: process.env.GUARDIAN_PHONE || '010-0000-0000',
        },
        fitbit: summary.fitbit,
        environment: summary.sensor, // sensor → environment 키 매핑
        unacknowledged_alerts: summary.unacknowledged_alerts,
      });
    } catch (err) {
      console.error('[API] /dashboard/summary 에러:', err);
      res.status(500).json({ error: '대시보드 조회 실패' });
    }
  });

  return router;
};
