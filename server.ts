import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { initDatabase } from './backend/src/config/database.ts';
import { initSocketServer } from './backend/src/websocket/socketServer.ts';
import { mqttService } from './backend/src/mqtt/mqttService.ts';
import { iotSimulator } from './iot-simulator/simulator.ts';
import { apiRouter } from './backend/src/routes/apiRoutes.ts';

dotenv.config();

async function startServer() {
  // 1. Initialize relational SQL database (sql.js with schema.sql + seed.sql)
  await initDatabase();

  // 2. Create Express App & HTTP Server
  const app = express();
  const httpServer = createServer(app);

  app.use(express.json());

  // 3. Initialize Socket.IO real-time server on the same HTTP server (port 3000)
  initSocketServer(httpServer);

  // 4. Initialize MQTT communication service & start ESP32 IoT Simulator
  mqttService.init();
  iotSimulator.start();

  // 5. Mount SERN REST API routes
  app.use('/api', apiRouter);

  // 6. Vite Middleware (Development) or Static Asset Serving (Production)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`NexusHome SERN Stack Server (Express + SQL + MQTT + Socket.IO) listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SERN server:', err);
  process.exit(1);
});
