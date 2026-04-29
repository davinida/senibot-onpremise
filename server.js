// 시니봇 서버 진입점
// Express HTTP 서버 + MQTT 핸들러를 한 프로세스에서 함께 띄운다.

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const { initDB } = require('./db/init');
const SQLiteStorage = require('./services/sqlite-storage');
const { startMqttHandler } = require('./services/mqtt-handler');

const app = express();
app.use(cors());
app.use(express.json());
// public/index.html이 있으면 자동으로 / 에 서빙됨 (Phase 6에서 추가)
app.use(express.static('public'));

(async () => {
  try {
    // 1) DB 테이블 보장
    await initDB();
    console.log('[DB] 테이블 4개 초기화 완료');

    // 2) 저장소 어댑터
    const storage = new SQLiteStorage();

    // 3) MQTT 구독 시작
    startMqttHandler(storage);

    // 4) 헬스체크 (루트 /는 public/index.html이 자동 서빙)
    app.get('/health', (req, res) => res.json({ status: 'ok' }));

    // 5) API 라우트 등록 (storage 주입 패턴)
    app.use('/api/environment', require('./routes/environment')(storage));
    app.use('/api/fitbit', require('./routes/fitbit')(storage));
    app.use('/api/alerts', require('./routes/alerts')(storage));
    app.use('/api/dashboard', require('./routes/dashboard')(storage));
    app.use('/api/simulator', require('./routes/simulator')(storage));

    // Swagger UI: /api-docs (OpenAPI 3.0 명세는 docs/openapi.yaml)
    const swaggerDocument = YAML.load('./docs/openapi.yaml');
    app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerDocument, { customSiteTitle: 'SeniBot API 문서' })
    );

    // 6) HTTP 서버 시작
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('[Server] 시작 실패:', err);
    process.exit(1);
  }
})();
