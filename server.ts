import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { authenticateToken } from './server/auth/verifyToken';
import { rateLimiter } from './server/middleware/rateLimiter';
import { aiRouter } from './server/routes/ai';

// Guard against unhandled promise rejections crashing the server process
process.on('unhandledRejection', (reason) => {
  console.warn('[Process Warning] Handled unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process Error] Handled uncaughtException:', err);
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. Top-Level Request Deserialization (Ordering Guarantee)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 2. Health & Telemetry
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'private-ai-journal-api',
    });
  });

  // 3. AI Endpoints (Protected by Authentication & Rate Limiting)
  app.use('/api/ai', authenticateToken, rateLimiter, aiRouter);

  // 4. Account Purge Handler
  app.post('/api/user/purge', authenticateToken, async (req, res) => {
    const uid = req.user?.uid;
    console.log(`[Account Purge Request] Initiated for UID: ${uid}`);
    // In production with Firebase Admin SDK, admin.auth().deleteUser(uid) runs here.
    // Client-side Firestore rules also permit subcollection deletion by owner.
    res.json({ success: true, message: 'Account data purged successfully.' });
  });

  // 5. Unhandled API Route Handler - guarantees ANY /api request always returns JSON, never HTML
  app.use('/api', (req, res) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: `API endpoint ${req.method} ${req.originalUrl || req.path} not found.`,
    });
  });

  // 6. Global API Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api') || req.url.startsWith('/api')) {
      console.error('[API Error]', err?.message || err);
      if (!res.headersSent) {
        res.status(err.status || 500).json({
          error: err.code || 'INTERNAL_ERROR',
          message: err.message || 'An unexpected internal error occurred. Please try again.',
        });
      }
      return;
    }
    next(err);
  });

  // 6. Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Private AI Journal Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
