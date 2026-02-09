# Deployment Guide for FitWise

This guide explains how to deploy FitWise to Vercel (or similar platforms) when your application requires Docker for Qdrant.

## Overview

FitWise requires:
- **SvelteKit app** → Can deploy to Vercel ✅
- **PostgreSQL database** → Use external service (Vercel Postgres, Supabase, Neon, etc.)
- **Qdrant vector database** → Requires Docker (not supported on Vercel) ⚠️

## Solution Options

### Option 1: Qdrant Cloud (Recommended) 🌟

**Easiest and most reliable option** - Use Qdrant's managed cloud service.

#### Steps:

1. **Sign up for Qdrant Cloud**
   - Go to [https://cloud.qdrant.io](https://cloud.qdrant.io)
   - Create a free account (free tier available)
   - Create a new cluster

2. **Get your Qdrant URL and API Key**
   - After creating a cluster, you'll get:
     - Cluster URL (e.g., `https://xxxxx-xxxxx.us-east-1-0.aws.cloud.qdrant.io`)
     - API Key for authentication

3. **Update your code to use API key** (if needed)
   - The `@qdrant/js-client-rest` client supports API keys
   - Update your Qdrant client initialization:

   ```typescript
   // In src/routes/api/chat/+server.ts and src/routes/api/feedback/+server.ts
   const qdrantClient = new QdrantClient({ 
     url: QDRANT_URL,
     apiKey: process.env.QDRANT_API_KEY // Add this if using Qdrant Cloud
   });
   ```

4. **Set environment variables in Vercel**
   - `QDRANT_URL`: Your Qdrant Cloud cluster URL
   - `QDRANT_API_KEY`: Your Qdrant Cloud API key (if required)

#### Pros:
- ✅ No infrastructure management
- ✅ Free tier available
- ✅ Automatic backups and scaling
- ✅ Production-ready

#### Cons:
- ⚠️ Requires account setup
- ⚠️ May have usage limits on free tier

---

### Option 2: Deploy Qdrant Separately (Self-Hosted)

Deploy Qdrant on a platform that supports Docker, then connect from Vercel.

#### Platform Options:

**A. Railway** (Recommended for simplicity)
- Go to [https://railway.app](https://railway.app)
- Create new project → Deploy from Docker Hub
- Use image: `qdrant/qdrant`
- Expose port 6333
- Get the public URL
- Set `QDRANT_URL` in Vercel to Railway's public URL

**B. Render**
- Go to [https://render.com](https://render.com)
- New → Web Service
- Use Docker image: `qdrant/qdrant`
- Set port to 6333
- Get the public URL

**C. Fly.io**
- Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
- Create `fly.toml`:
  ```toml
  app = "your-qdrant-app"
  primary_region = "iad"

   [build]
     image = "qdrant/qdrant"

   [[services]]
     internal_port = 6333
     protocol = "tcp"
   ```
- Deploy: `fly launch`
- Get the public URL

**D. DigitalOcean App Platform**
- Create new app → Docker container
- Use image: `qdrant/qdrant`
- Expose port 6333

#### Pros:
- ✅ Full control over Qdrant instance
- ✅ Can use local storage volumes
- ✅ No external service dependencies

#### Cons:
- ⚠️ Requires managing separate infrastructure
- ⚠️ Need to handle backups yourself
- ⚠️ Additional cost for hosting

---

### Option 3: Alternative Vector Database

Replace Qdrant with a vector database that works better with serverless:

**A. Pinecone** (Serverless-friendly)
- Sign up at [https://www.pinecone.io](https://www.pinecone.io)
- Create an index
- Replace Qdrant client with Pinecone client
- Requires code changes

**B. Weaviate Cloud**
- Managed Weaviate service
- Similar to Qdrant Cloud
- Requires code changes

**C. Supabase Vector (pgvector)**
- If you're already using Supabase for PostgreSQL
- Use pgvector extension
- Requires significant code changes

#### Pros:
- ✅ Some options are more serverless-friendly
- ✅ Better integration with existing services (e.g., Supabase)

#### Cons:
- ⚠️ Requires code refactoring
- ⚠️ Different API and features

---

## Vercel Deployment Steps

### 1. Prepare Your Repository

Ensure your code is ready:
```bash
# Make sure all dependencies are in package.json
pnpm install

# Build locally to check for errors
pnpm build
```

### 2. Set Up PostgreSQL

Vercel doesn't provide PostgreSQL, so use one of these:

**A. Vercel Postgres** (Recommended if using Vercel)
- Go to your Vercel project → Storage → Create Database
- Select Postgres
- Copy the connection string

**B. Supabase**
- Create project at [https://supabase.com](https://supabase.com)
- Get connection string from Settings → Database

**C. Neon**
- Create project at [https://neon.tech](https://neon.tech)
- Get connection string

**D. Railway/PlanetScale**
- Other managed PostgreSQL options

### 3. Deploy to Vercel

1. **Install Vercel CLI** (optional, can use GitHub integration)
   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```
   Or connect your GitHub repo to Vercel for automatic deployments.

3. **Set Environment Variables in Vercel Dashboard**
   Go to Project Settings → Environment Variables and add:
   
   ```
   # Required
   OPENROUTER_API_KEY=sk-or-v1-...
   DATABASE_URL=postgresql://...
   BETTER_AUTH_SECRET=your-secret-key
   
   # Qdrant (choose one option)
   QDRANT_URL=https://your-qdrant-cloud-url.cloud.qdrant.io
   QDRANT_API_KEY=your-api-key  # If using Qdrant Cloud
   
   # Or if self-hosting:
   QDRANT_URL=https://your-railway-or-render-url.com
   
   # Optional
   CHAT_MODEL=qwen/qwen-2.5-7b-instruct:free
   EMBEDDING_MODEL=openai/text-embedding-ada-002
   BETTER_AUTH_URL=https://your-vercel-app.vercel.app
   ```

4. **Run Database Migrations**
   After deployment, run Prisma migrations:
   ```bash
   # Option 1: Via Vercel CLI
   vercel env pull .env.local
   pnpm prisma migrate deploy
   
   # Option 2: Add to package.json scripts and run via Vercel build
   # Add to package.json:
   "postinstall": "prisma generate",
   "vercel-build": "prisma migrate deploy && pnpm build"
   ```

### 4. Update Vercel Build Settings

In Vercel project settings:
- **Framework Preset**: SvelteKit
- **Build Command**: `pnpm build` (or `pnpm vercel-build` if you added migrations)
- **Output Directory**: `.svelte-kit` (auto-detected)
- **Install Command**: `pnpm install`

### 5. Seed Qdrant Data (If Needed)

If you need to populate Qdrant with embeddings:

1. **Option A: Run locally pointing to cloud Qdrant**
   ```bash
   # Set QDRANT_URL to your cloud instance
   export QDRANT_URL=https://your-qdrant-cloud-url.cloud.qdrant.io
   export QDRANT_API_KEY=your-api-key
   
   # Run the embedding script
   cd embedding
   python main.py
   ```

2. **Option B: Create a Vercel API route for seeding**
   - Create `/api/admin/seed-qdrant/+server.ts`
   - Protect with authentication
   - Run seeding logic
   - Call it once after deployment

---

## Recommended Setup for Production

For a production deployment, I recommend:

1. **Vercel** → SvelteKit app
2. **Qdrant Cloud** → Vector database (free tier or paid)
3. **Vercel Postgres or Supabase** → PostgreSQL database
4. **OpenRouter** → LLM and embeddings (already configured)

### Environment Variables Summary

```env
# Core Services
OPENROUTER_API_KEY=sk-or-v1-...
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=generate-random-secret
BETTER_AUTH_URL=https://your-app.vercel.app

# Qdrant (Cloud)
QDRANT_URL=https://xxxxx.cloud.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key

# Models
CHAT_MODEL=qwen/qwen-2.5-7b-instruct:free
EMBEDDING_MODEL=openai/text-embedding-ada-002
```

---

## Troubleshooting

### Qdrant Connection Issues

1. **Check if Qdrant URL is accessible**
   ```bash
   curl https://your-qdrant-url.cloud.qdrant.io/health
   ```

2. **Verify API key** (if using Qdrant Cloud)
   - Make sure `QDRANT_API_KEY` is set in Vercel

3. **Check CORS** (if self-hosting)
   - Qdrant may need CORS headers configured
   - Add to Qdrant config or use a proxy

### Database Connection Issues

1. **Verify DATABASE_URL format**
   - Should be: `postgresql://user:password@host:port/database?sslmode=require`

2. **Run migrations**
   ```bash
   pnpm prisma migrate deploy
   ```

### Build Issues

1. **Check Node version**
   - Vercel uses Node 18+ by default
   - Can specify in `package.json`: `"engines": { "node": ">=18" }`

2. **Prisma generate**
   - Ensure `prisma generate` runs in build
   - Add to `package.json`: `"postinstall": "prisma generate"`

---

## Cost Estimates

### Free Tier Options:
- **Vercel**: Free tier (hobby) available
- **Qdrant Cloud**: Free tier available (limited)
- **Vercel Postgres**: Free tier available (limited storage)
- **OpenRouter**: Free models available

### Paid Options (if needed):
- **Qdrant Cloud**: ~$25/month for starter plan
- **Vercel Pro**: $20/month
- **Supabase Pro**: $25/month
- **Neon**: Pay-as-you-go

---

## Next Steps

1. Choose your Qdrant hosting option (recommend Qdrant Cloud)
2. Set up PostgreSQL (Vercel Postgres or Supabase)
3. Deploy to Vercel
4. Configure environment variables
5. Run database migrations
6. Seed Qdrant with embeddings
7. Test the deployed application

For questions or issues, check the [main README](./README.md) or open an issue on GitHub.

