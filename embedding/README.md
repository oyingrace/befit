# Embedding Service with LM Studio

This service scrapes fitness content and creates embeddings using a locally running LM Studio instance.

## Prerequisites

1. **LM Studio Setup**:
   - Install and run LM Studio
   - Load an embedding model (e.g., `text-embedding-3-small`, `all-MiniLM-L6-v2`)
   - Start the local server (typically on `http://localhost:1234`)

2. **Qdrant Setup**:
   - Run Qdrant locally on port 6333
   - `docker run -p 6333:6333 qdrant/qdrant`

## Installation

```bash
# Install dependencies
uv sync
# or
pip install requests beautifulsoup4 qdrant-client
```

## Configuration

Set environment variables (optional):
```bash
export LM_STUDIO_URL="http://localhost:1234"  # Default
export EMBEDDING_MODEL="text-embedding-3-small"  # Default
```

## Usage

```bash
python main.py
```

The script will:
1. Test the connection to LM Studio
2. Scrape content from RPStrength articles
3. Generate embeddings using your local LM Studio model
4. Store vectors in Qdrant for retrieval

## Troubleshooting

### 404 Error: Not Found for url: .../v1/embeddings

This error typically means:

1. **No embedding model loaded**: In LM Studio, make sure you have loaded an embedding model (not a chat model)
2. **Server not started**: In LM Studio, click "Start Server" to start the local API server
3. **Wrong endpoint**: The script expects the server to run on `http://localhost:1234`

**Steps to fix:**
1. Open LM Studio
2. Go to the "Models" tab and download an embedding model like:
   - `sentence-transformers/all-MiniLM-L6-v2`
   - `text-embedding-3-small`
   - Any model with "embedding" in the name
3. Load the embedding model (not a chat model)
4. Go to "Local Server" tab and click "Start Server"
5. Verify the server is running on `http://localhost:1234`

### Different Model Loading Issue

If you see a different model loading even though one exists:
- Make sure you've selected the embedding model in LM Studio's interface
- Check that you're loading an embedding model, not a chat model
- Restart LM Studio if needed

### Connection Error

- **Wrong URL**: Check if LM Studio is running on `localhost:1234` (not an IP like `172.21.96.1`)
- **Firewall**: Ensure no firewall is blocking the connection
- **Environment Variables**: You can override the URL with `export LM_STUDIO_URL="http://your-ip:port"`