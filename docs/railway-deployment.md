# Deploy FastAPI Backend to Railway

## Overview

This guide covers deploying the FastAPI backend to Railway, a traditional server platform that runs your app continuously (not serverless).

## Prerequisites

- GitHub account with this repo pushed
- Railway account at [railway.app](https://railway.app)

## Required Files

### requirements.txt

Create in project root:

```txt
python-dotenv>=1.0.0
fastapi>=0.128.0
uvicorn>=0.40.0
sqlalchemy>=2.0.0
alembic>=1.13.0
psycopg2-binary>=2.9.0
```

### Procfile

Create in project root:

```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

### runtime.txt

Create in project root:

```
python-3.12
```

## Code Changes

### config/settings.py

Update the HOST default for production compatibility:

```python
HOST: str = os.getenv("HOST", "0.0.0.0")
```

## Environment Variables

Set these in Railway dashboard:

| Variable | Description |
|----------|-------------|
| `FRONTEND_URL` | Your Vercel frontend URL (for CORS) |
| `OPENAI_API_KEY` | OpenAI API key |
| `SUPABASE_DATABASE_URL` | Supabase connection string |
| `SUPABASE_PROJECT_URL` | Supabase project URL |
| `SUPABASE_SECRET_API_KEY` | Supabase secret key |

Note: Railway automatically provides the `PORT` variable.

## Deployment Steps

1. Push all changes to GitHub
2. Go to [railway.app](https://railway.app) and sign in
3. Click "New Project" → "Deploy from GitHub repo"
4. Select the `conscience` repository
5. Railway auto-detects Python and uses the Procfile
6. Go to project Settings → Variables → Add environment variables
7. Once deployed, Railway provides a public URL for your API

## Verify Deployment

After deployment, test the health endpoint:

```bash
curl https://your-railway-url.railway.app/api/health
```

Expected response:

```json
{"status": "healthy", "uptime": 123.45}
```

## Update Frontend

After deploying, update your Next.js frontend to use the Railway URL:

1. In Vercel dashboard, add environment variable:
   - `NEXT_PUBLIC_API_URL` = `https://your-railway-url.railway.app`

2. Or update `ui/.env.local` for local development pointing to production API
