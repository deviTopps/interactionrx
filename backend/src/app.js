import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import herbalMedicinesRouter from './routes/herbal-medicines.js';
import setupRouter from './routes/setup.js';
import usersRouter from './routes/users.js';
import profileRouter from './routes/profile.js';
import auditLogsRouter from './routes/audit-logs.js';
import herbImportRouter from './routes/herb-import.js';
import herbsRouter from './routes/herbs.js';
import interactionsRouter from './routes/interactions.js';
import drugInteractionsRouter from './routes/drug-interactions.js';

dotenv.config();

const app = express();

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;

  const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '');
  if (frontendUrl && origin === frontendUrl) return true;

  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (extra.includes(origin)) return true;

  // Vercel preview deployments (*.vercel.app)
  if (process.env.ALLOW_VERCEL_PREVIEWS === 'true') {
    try {
      const { hostname } = new URL(origin);
      if (hostname.endsWith('.vercel.app')) return true;
    } catch {
      return false;
    }
  }

  return false;
}

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.set('trust proxy', 1);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'InteractionRX API' });
});

app.use('/api/herbal-medicines', herbalMedicinesRouter);
app.use('/api/setup', setupRouter);
app.use('/api/profile', profileRouter);
app.use('/api/users', usersRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/herb-import', herbImportRouter);
app.use('/api/herbs', herbsRouter);
app.use('/api/interactions', interactionsRouter);
app.use('/api/drug-interactions', drugInteractionsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Not allowed by CORS' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
