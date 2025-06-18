# Afftools - TikTok Affiliate Automation

Automate TikTok affiliate campaigns and reporting with monitoring.

## Features

- OAuth2 Authentication (TikTok Business API)
- Campaign Management (create/update campaigns)
- Reporting (fetch campaign stats)
- Scheduled tasks (token refresh, daily report)
- Logging & Monitoring (Sentry, Prometheus)

## Installation

```bash
git clone https://github.com/forgetme13/Afftools.git
cd Afftools
bash install.sh
```

## Ngrok Setup

```bash
./ngrok config add-authtoken ISI_TOKEN_NGROK_DISINI
npm run start-ngrok
```

Update `.env`:

```env
TIKTOK_REDIRECT_URI=https://xxxxxx.ngrok.io/auth/callback
```

Also update in TikTok Developer → URL properties → Redirect URL

## Running the app

```bash
bash install-deps.sh
npm run dev
```

