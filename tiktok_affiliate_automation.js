/*
Project: TikTok Affiliate Automation
Stack: Node.js + TypeScript
Features:
  - OAuth2 Authentication (TikTok Business API)
  - Campaign Management (create/update campaigns)
  - Reporting (fetch campaign stats)
  - Scheduled tasks (token refresh, daily report)
  - Logging & Monitoring (Sentry, Prometheus)
*/

// ─────────────────────────────────────────────────────────────────────────────
// File: package.json
// ─────────────────────────────────────────────────────────────────────────────
{
  "name": "tiktok-affiliate-automation",
  "version": "1.1.0",
  "description": "Automate TikTok affiliate campaigns and reporting with monitoring",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node-dev src/index.ts"
  },
  "dependencies": {
    "axios": "^1.5.0",
    "bullmq": "^2.0.0",
    "dotenv": "^16.0.0",
    "express": "^4.18.2",
    "pg": "^8.10.0",
    "redis": "^4.6.0",
    "@sentry/node": "^7.0.0",
    "prom-client": "^14.0.0"
  },
  "devDependencies": {
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.1.6",
    "@types/express": "^4.17.17",
    "@types/node": "^20.3.1"
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// File: tsconfig.json
// ─────────────────────────────────────────────────────────────────────────────
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "commonjs",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// File: .env.example
// ─────────────────────────────────────────────────────────────────────────────
// TikTok API Credentials
TIKTOK_CLIENT_ID=your_client_id
TIKTOK_CLIENT_SECRET=your_client_secret
TIKTOK_REDIRECT_URI=https://yourapp.com/auth/callback

// Redis & DB
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost:5432/tiktok

// Sentry DSN
SENTRY_DSN=https://xxxx@sentry.io/your_project_id

// Server
PORT=3000


// ─────────────────────────────────────────────────────────────────────────────
// File: src/auth/tiktok.ts
// ─────────────────────────────────────────────────────────────────────────────
import axios from 'axios';
import qs from 'qs';
import { Queue } from 'bullmq';

const {
  TIKTOK_CLIENT_ID,
  TIKTOK_CLIENT_SECRET,
  TIKTOK_REDIRECT_URI,
  REDIS_URL
} = process.env;

const tokenQueue = new Queue('token-refresh', { connection: { url: REDIS_URL } });

export function getAuthUrl(state: string): string {
  const params = qs.stringify({
    client_key: TIKTOK_CLIENT_ID,
    response_type: 'code',
    scope: 'business.customers.read,business.ad.read,business.ad.report.write',
    redirect_uri: TIKTOK_REDIRECT_URI,
    state,
  });
  return `https://business-api.tiktok.com/open_api/oauth2/authorize?${params}`;
}

export async function exchangeCodeForToken(code: string) {
  const resp = await axios.post(
    'https://business-api.tiktok.com/open_api/oauth2/access_token/',
    { client_key: TIKTOK_CLIENT_ID, client_secret: TIKTOK_CLIENT_SECRET, code, grant_type: 'authorization_code' }
  );
  const data = resp.data.data;
  await tokenQueue.add('refresh', { refresh_token: data.refresh_token }, { delay: (data.expires_in - 60) * 1000 });
  return data;
}

export async function refreshAccessToken(refresh_token: string) {
  const resp = await axios.post(
    'https://business-api.tiktok.com/open_api/oauth2/refresh_token/',
    {
      client_key: TIKTOK_CLIENT_ID,
      client_secret: TIKTOK_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token,
    }
  );
  const data = resp.data.data;
  await tokenQueue.add('refresh', { refresh_token: data.refresh_token }, { delay: (data.expires_in - 60) * 1000 });
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// File: src/campaign/createCampaign.ts
// ─────────────────────────────────────────────────────────────────────────────
import axios from 'axios';

interface CampaignParams {
  advertiser_id: string;
  campaign_name: string;
  budget: number;
  status: 'ACTIVE' | 'PAUSED';
}

export async function createAffiliateCampaign(
  token: string,
  params: CampaignParams
): Promise<any> {
  const resp = await axios.post(
    'https://business-api.tiktok.com/open_api/v1.3/campaign/create/',
    {
      advertiser_id: params.advertiser_id,
      campaign_name: params.campaign_name,
      budget_mode: 'BUDGET_MODE_INFINITE',
      budget: params.budget,
      landing_type: 'WEBSITE',
      status: params.status,
      objective_type: 'CONVERSION',
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return resp.data.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// File: src/report/getStats.ts
// ─────────────────────────────────────────────────────────────────────────────
import axios from 'axios';

export async function fetchCampaignStats(
  token: string,
  advertiser_id: string,
  campaign_ids: string[],
  start_date: string,
  end_date: string
): Promise<any[]> {
  const resp = await axios.post(
    'https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/',
    {
      advertiser_id,
      report_type: 'BASIC',
      data_level: 'AUCTION_AD',
      dimensions: ['campaign_id'],
      metrics: ['impressions', 'click', 'convert'],
      start_date,
      end_date,
      campaign_ids,
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return resp.data.data.list;
}

// ─────────────────────────────────────────────────────────────────────────────
// File: src/index.ts
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import dotenv from 'dotenv';
import Sentry from '@sentry/node';
import promClient from 'prom-client';
import { getAuthUrl, exchangeCodeForToken, refreshAccessToken } from './auth/tiktok';
import { createAffiliateCampaign } from './campaign/createCampaign';
import { fetchCampaignStats } from './report/getStats';
import { Worker } from 'bullmq';

dotenv.config();

// Initialize Sentry
Sentry.init({ dsn: process.env.SENTRY_DSN });

// Initialize Prometheus metrics
promClient.collectDefaultMetrics();

const app = express();
app.use(express.json());
// Sentry request handler
app.use(Sentry.Handlers.requestHandler());

// Metrics endpoint
app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.send(await promClient.register.metrics());
});

const PORT = process.env.PORT || 3000;

// OAuth redirect endpoint
app.get('/auth/url', (req, res) => {
  const state = 'optional_state';
  res.json({ url: getAuthUrl(state) });
});

// OAuth callback
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');
  try {
    const data = await exchangeCodeForToken(code as string);
    res.json(data);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).send('Auth exchange failed');
  }
});

// Campaign creation endpoint
app.post('/campaign', async (req, res) => {
  const { token, advertiser_id, campaign_name, budget, status } = req.body;
  try {
    const result = await createAffiliateCampaign(token, { advertiser_id, campaign_name, budget, status });
    res.json(result);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).send('Campaign creation failed');
  }
});

// Report endpoint
app.post('/report', async (req, res) => {
  const { token, advertiser_id, campaign_ids, start_date, end_date } = req.body;
  try {
    const stats = await fetchCampaignStats(token, advertiser_id, campaign_ids, start_date, end_date);
    res.json(stats);
  } catch (err) {
    Sentry.captureException(err);
    res.status(500).send('Report fetch failed');
  }
});

// Worker for token refresh jobs
new Worker('token-refresh', async job => {
  const { refresh_token } = job.data;
  try {
    await refreshAccessToken(refresh_token);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}, { connection: { url: process.env.REDIS_URL } });

// Sentry error handler
app.use(Sentry.Handlers.errorHandler());

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
