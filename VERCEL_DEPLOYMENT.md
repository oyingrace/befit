# Vercel Deployment Guide for BeFit

## Quick Setup Checklist

### ✅ 1. Prisma Generate (Already Configured)

**Good news!** Prisma generate is already set up. I've added a `postinstall` script to your `package.json` that automatically runs `prisma generate` after `pnpm install` or `npm install`.

This means:
- ✅ Vercel will automatically run `prisma generate` during build
- ✅ No additional configuration needed
- ✅ Prisma Client will be generated on every deployment

### ✅ 2. Set Production Database URL in Vercel

1. **Go to Vercel Dashboard**
   - Navigate to your project → Settings → Environment Variables

2. **Add/Update DATABASE_URL**
   - **Key**: `DATABASE_URL`
   - **Value**: Your production PostgreSQL connection string
     ```
     postgresql://user:password@host:port/database?sslmode=require
     ```
   - **Environment**: Select all (Production, Preview, Development)

3. **Save the changes**

### ✅ 3. Run Migrations on Production Database

**Important**: You need to run migrations on your production database **before** deploying.

#### Option A: Run Migrations Locally (Recommended)

```bash
# Set your production DATABASE_URL temporarily
export DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"

# Run migrations
pnpm prisma migrate deploy

# Or if you need to create a new migration:
pnpm prisma migrate dev --name production_setup
```

#### Option B: Use Vercel CLI

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Pull environment variables from Vercel
vercel env pull .env.production

# Run migrations using production URL
DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d '=' -f2) pnpm prisma migrate deploy
```

#### Option C: Use Prisma Studio (For First-Time Setup)

```bash
# Connect to production database
export DATABASE_URL="your-production-url"

# Open Prisma Studio to verify
pnpm prisma studio
```

### ⚠️ Important Notes

1. **Migration Strategy**:
   - Use `prisma migrate deploy` for production (doesn't create new migrations)
   - Use `prisma migrate dev` only in development
   - Always test migrations locally first with production URL

2. **First-Time Production Setup**:
   ```bash
   # 1. Set production DATABASE_URL
   export DATABASE_URL="your-production-postgres-url"
   
   # 2. Deploy all migrations
   pnpm prisma migrate deploy
   
   # 3. Verify tables were created
   pnpm prisma studio
   ```

3. **After Changing DATABASE_URL in Vercel**:
   - You **must** run migrations again if schema changed
   - Vercel will rebuild automatically after env var changes
   - But migrations need to be run manually

### 🔧 Complete Environment Variables for Vercel

Make sure these are set in Vercel Dashboard:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-your-key
CHAT_MODEL=qwen/qwen-2.5-7b-instruct:free
EMBEDDING_MODEL=openai/text-embedding-ada-002

# Qdrant (Cloud)
QDRANT_URL=https://your-cluster.cloud.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key

# Auth
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=https://your-app.vercel.app

# Opik (Optional)
OPIK_API_KEY=your-opik-key
OPIK_URL_OVERRIDE=https://www.comet.com/opik/api
OPIK_PROJECT_NAME=befit
OPIK_WORKSPACE=devqueen
```

### 🚀 Deployment Steps Summary

1. ✅ **Prisma Generate**: Already configured (runs automatically)
2. ✅ **Set DATABASE_URL**: Add production URL in Vercel dashboard
3. ✅ **Run Migrations**: Execute `pnpm prisma migrate deploy` with production URL
4. ✅ **Deploy**: Push to GitHub or run `vercel --prod`

### 🐛 Troubleshooting

**Issue**: "Cannot find module '.prisma/client/default'"
- **Solution**: The `postinstall` script should fix this. If it persists, check that `prisma` is in `devDependencies`

**Issue**: "Migration failed"
- **Solution**: Make sure your production DATABASE_URL is correct and accessible
- Check that you have proper SSL settings (`?sslmode=require`)

**Issue**: "Tables don't exist"
- **Solution**: Run `pnpm prisma migrate deploy` with production DATABASE_URL

**Issue**: "Connection timeout"
- **Solution**: Check your database firewall settings allow Vercel IPs
- Some databases require IP whitelisting

### 📝 Quick Commands Reference

```bash
# Generate Prisma Client (runs automatically on install)
pnpm prisma generate

# Run migrations on production
DATABASE_URL="your-prod-url" pnpm prisma migrate deploy

# Check migration status
DATABASE_URL="your-prod-url" pnpm prisma migrate status

# View database in browser
DATABASE_URL="your-prod-url" pnpm prisma studio
```

