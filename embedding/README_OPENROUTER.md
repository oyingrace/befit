# Populate Qdrant with OpenRouter

This script populates your Qdrant vector database with exercise science articles using OpenRouter embeddings (same as your BeFit app).

## Quick Start

### 1. Install Python Dependencies

```bash
pip install requests beautifulsoup4 qdrant-client python-dotenv
```

Or if you're using `uv`:

```bash
uv pip install requests beautifulsoup4 qdrant-client python-dotenv
```

### 2. Set Up Environment Variables

Make sure your `.env` file in the project root has:

```env
OPENROUTER_API_KEY="sk-or-v1-your-key-here"
EMBEDDING_MODEL="openai/text-embedding-ada-002"  # Optional, this is the default
QDRANT_URL="http://localhost:6333"  # Optional, this is the default
```

Or export them:

```bash
export OPENROUTER_API_KEY="sk-or-v1-your-key-here"
```

### 3. Start Qdrant

Make sure Qdrant is running:

```bash
docker run -p 6333:6333 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant
```

### 4. Run the Script

```bash
cd embedding
python populate_qdrant.py
```

## What It Does

1. **Tests Connections**: Verifies OpenRouter API and Qdrant are accessible
2. **Creates Collection**: Creates the `rp_exercises` collection if it doesn't exist
3. **Scrapes Articles**: Fetches exercise science articles from RPStrength.com
4. **Generates Embeddings**: Uses OpenRouter API to create embeddings (same model as your app)
5. **Stores in Qdrant**: Saves article chunks with embeddings for fast retrieval

## Expected Output

```
============================================================
BeFit Qdrant Population Script
Using OpenRouter for embeddings
============================================================

🔍 Testing OpenRouter connection...
✅ OpenRouter connected successfully!
✅ Embedding dimension: 1536

🔍 Testing Qdrant connection...
✅ Qdrant connected successfully!
✅ Found 0 existing collections

🔍 Checking collection 'rp_exercises'...
📦 Creating collection 'rp_exercises'...
✅ Collection 'rp_exercises' created

📚 Scraping exercise science articles...
📡 Scraping articles from: https://rpstrength.com/...
✅ Found 15 unique article links
📄 Found 15 articles to process

[1/15] Processing: https://rpstrength.com/...
  📝 Title: Complete Hypertrophy Training Guide...
  📦 Created 8 chunks
    ✓ Indexed 5/8 chunks...
  ✅ Successfully indexed article (8 chunks)

...

============================================================
✅ Indexing Complete!
   Articles processed: 15/15
   Total chunks indexed: 127
   Collection: rp_exercises
============================================================

🎉 Your RAG system is now ready!
   Your BeFit app will now use these articles for evidence-based responses.
```

## Troubleshooting

### "OPENROUTER_API_KEY not found"
- Make sure your `.env` file is in the project root (not in the `embedding/` folder)
- Or export the environment variable: `export OPENROUTER_API_KEY="your-key"`

### "Failed to connect to Qdrant"
- Make sure Qdrant Docker container is running
- Check that port 6333 is not blocked
- Verify: `curl http://localhost:6333/health`

### "No links found to process"
- The scraping might fail if RPStrength website structure changed
- Check your internet connection
- The script will continue gracefully if some articles fail

### Embedding API Errors
- Make sure you have credits in your OpenRouter account
- Check that the embedding model name is correct
- Verify your API key has access to the embedding model

## Cost Estimate

Using `openai/text-embedding-ada-002`:
- ~$0.0001 per 1K tokens
- Typical article: ~500-1000 tokens
- 15 articles × 8 chunks = ~120 chunks
- Estimated cost: **$0.01 - $0.05** total

## After Running

Once the script completes, your BeFit app will automatically use the RAG system:

1. **Chat API**: When users ask fitness questions, it will search Qdrant for relevant articles
2. **Feedback API**: Form analysis feedback can include exercise science references
3. **Better Responses**: AI responses will cite sources and use evidence-based information

You'll see in your app logs:
```
Chat API: High-relevance content found, using RAG data
```

Instead of:
```
Chat API: No high-relevance content found, proceeding without RAG
```

## Re-running the Script

If you want to update the collection with new articles:

- The script will ask if you want to clear existing data
- Or manually delete: `qdrant_client.delete_collection("rp_exercises")`
- Then run the script again

