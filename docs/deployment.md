# Deployment Guide

This guide covers deploying the Conscience application, which consists of:
- **Frontend**: Next.js application in the `ui/` folder → deployed to **Vercel**
- **Backend**: FastAPI application in the root folder → deployed to **Railway**

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│   Vercel    │────▶│   Railway   │
│             │     │  (Next.js)  │     │  (FastAPI)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────────────────────────┐
                    │           Supabase              │
                    │   (PostgreSQL + Auth)           │
                    └─────────────────────────────────┘
```

---

## Prerequisites

- GitHub repository connected
- Supabase project configured
- OpenAI API key

---

## Part 1: Frontend Deployment (Vercel)

Vercel is optimized for Next.js and supports monorepo deployments.

### Step 1: Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New Project"
3. Import your `conscience` repository

### Step 2: Configure Project Settings

In the Vercel project configuration:

| Setting | Value |
|---------|-------|
| **Root Directory** | `ui` |
| **Framework Preset** | Next.js (auto-detected) |
| **Build Command** | `npm run build` |
| **Output Directory** | `.next` |

### Step 3: Set Environment Variables

Add these environment variables in Vercel dashboard (Settings → Environment Variables):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

### Step 4: Deploy

Click "Deploy" - Vercel will automatically:
- Install dependencies
- Build the Next.js app
- Deploy to a `.vercel.app` domain

### Automatic Deployments

After initial setup:
- **Production**: Pushes to `master` branch auto-deploy
- **Preview**: Pull requests get preview URLs

### Configuration File (Optional)

The `ui/vercel.json` file provides explicit configuration:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

---

## Part 2: Backend Deployment (Railway)

Railway supports both direct Python deploys and Docker containers.

### Option A: Direct Deploy (Simplest)

Railway auto-detects Python from `pyproject.toml`.

#### Step 1: Connect to Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `conscience` repository

#### Step 2: Configure Project

In Railway project settings:

| Setting | Value |
|---------|-------|
| **Root Directory** | `/` (root) |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

#### Step 3: Set Environment Variables

Add these in Railway dashboard (Variables tab):

```
SUPABASE_DATABASE_URL=postgresql://...
SUPABASE_PROJECT_URL=https://your-project.supabase.co
SUPABASE_SECRET_API_KEY=your-service-role-key
OPENAI_API_KEY=sk-...
FRONTEND_URL=https://your-app.vercel.app
RELOAD=false
LOG_LEVEL=info
```

### Option B: Docker Deploy (Recommended)

Using Docker provides consistency and portability for future migration to AWS.

#### Dockerfile

The `Dockerfile` in the project root:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install uv for faster dependency management
RUN pip install uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv pip install --system -r pyproject.toml

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Start command
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### .dockerignore

Excludes unnecessary files from the Docker image:

```
ui/
.git/
.env
*.pyc
__pycache__/
.venv/
node_modules/
.github/
docs/
*.md
```

#### Railway Configuration

The `railway.json` file:

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/docs",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### Generate Domain

After deployment:
1. Go to Settings → Networking
2. Click "Generate Domain" to get a `.railway.app` URL
3. Update your Vercel frontend's `NEXT_PUBLIC_API_URL` with this URL

---

## Part 3: Environment Configuration

### Backend CORS Settings

The `config/settings.py` handles CORS for production:

```python
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
ALLOWED_ORIGINS: List[str] = [
    FRONTEND_URL,
    "http://localhost:3000",  # Local development
]
```

Set `FRONTEND_URL` to your Vercel deployment URL in Railway.

### Frontend API Configuration

API calls should use the environment variable:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
```

---

## Part 4: Local Development

### Running Both Services Locally

**Terminal 1 - Backend:**
```bash
# From project root
uv run python main.py
# Runs on http://localhost:8000
```

**Terminal 2 - Frontend:**
```bash
cd ui
npm run dev
# Runs on http://localhost:3000
```

### Docker Local Testing

```bash
# Build the backend image
docker build -t conscience-backend .

# Run with environment variables
docker run -p 8000:8000 \
  -e SUPABASE_DATABASE_URL="..." \
  -e OPENAI_API_KEY="..." \
  conscience-backend
```

---

## Cost Estimates

| Service | Free Tier | Estimated Monthly |
|---------|-----------|-------------------|
| Vercel | 100GB bandwidth | $0-20 |
| Railway | $5 free credits | $5-15 |
| Supabase | 500MB DB | $0-25 |
| **Total** | | **$5-60/month** |

---

## Future Migration to AWS

The Docker setup enables easy migration to more advanced infrastructure:

### AWS Options

| Service | Complexity | Cost | Best For |
|---------|------------|------|----------|
| **App Runner** | Low | ~$25/mo | Simple container hosting |
| **ECS Fargate** | Medium | ~$30/mo | Production workloads |
| **EKS** | High | ~$75/mo | Kubernetes ecosystem |

### Migration Steps

1. Push Docker image to AWS ECR
2. Create ECS cluster with Fargate
3. Configure Application Load Balancer
4. Update DNS/environment variables
5. Migrate frontend to CloudFront + S3 (optional)

The same `Dockerfile` works across all container platforms.

---

## Troubleshooting

### CORS Errors

- Verify `FRONTEND_URL` is set correctly in Railway
- Check that the URL includes the protocol (`https://`)
- Ensure no trailing slash

### Database Connection Issues

- Verify `SUPABASE_DATABASE_URL` format: `postgresql://user:pass@host:5432/dbname`
- Check Railway logs for connection errors
- Ensure Supabase allows connections from Railway IPs

### Build Failures

**Vercel (Frontend):**
- Check Node.js version compatibility
- Review build logs for missing dependencies

**Railway (Backend):**
- Verify Python version (3.12+)
- Check `pyproject.toml` for dependency issues
- Review deployment logs

### Health Checks

- Backend health: `https://your-backend.railway.app/docs`
- Frontend: `https://your-app.vercel.app`

---

## Deployment Checklist

- [ ] Supabase project configured with database tables
- [ ] Environment variables set in Vercel
- [ ] Environment variables set in Railway
- [ ] CORS configured with production frontend URL
- [ ] Custom domains configured (optional)
- [ ] SSL certificates active (automatic on both platforms)
