import express from 'express';

const app = express();
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'twilight-izakaya-backend',
    port,
    time: new Date().toISOString(),
  });
});

app.get('/api/ping', (_req, res) => {
  res.json({
    message: 'pong',
    service: 'twilight-izakaya-backend',
  });
});

app.listen(port, host, () => {
  console.log(`[twilight-izakaya-backend] listening on http://${host}:${port}`);
});
