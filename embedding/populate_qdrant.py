#!/usr/bin/env python3
"""
Populate Qdrant with exercise science articles using OpenRouter embeddings.
This script scrapes RPStrength articles and stores them in Qdrant for RAG retrieval.

Requirements:
    pip install requests beautifulsoup4 qdrant-client python-dotenv

Usage:
    # Set your OpenRouter API key in .env file or export it:
    export OPENROUTER_API_KEY="sk-or-v1-your-key-here"
    
    # Make sure Qdrant is running:
    docker run -p 6333:6333 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant
    
    # Run the script:
    python populate_qdrant.py
"""

import requests
from bs4 import BeautifulSoup
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, PointStruct
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "openai/text-embedding-ada-002")
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
COLLECTION_NAME = "rp_exercises"

if not OPENROUTER_API_KEY:
    print("❌ ERROR: OPENROUTER_API_KEY not found!")
    print("Please set it in your .env file or export it:")
    print('  export OPENROUTER_API_KEY="sk-or-v1-your-key-here"')
    exit(1)

print(f"✅ Using OpenRouter API key: {OPENROUTER_API_KEY[:20]}...")
print(f"✅ Embedding model: {EMBEDDING_MODEL}")
print(f"✅ Qdrant URL: {QDRANT_URL}")
print()


class OpenRouterEmbedding:
    """Generate embeddings using OpenRouter API (same as your app)"""
    
    def __init__(self, api_key, base_url=OPENROUTER_BASE_URL, model=EMBEDDING_MODEL):
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self.embedding_dimension = None
    
    def encode(self, text):
        """Generate embeddings using OpenRouter API"""
        url = f"{self.base_url}/embeddings"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "BeFit"
        }
        payload = {
            "model": self.model,
            "input": text if isinstance(text, list) else [text]
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            
            # Extract embeddings from response
            embeddings = [item["embedding"] for item in data["data"]]
            
            # Set dimension if not already set
            if self.embedding_dimension is None:
                self.embedding_dimension = len(embeddings[0])
            
            # Return single embedding if single text was passed
            return embeddings[0] if isinstance(text, str) else embeddings
            
        except requests.exceptions.RequestException as e:
            print(f"❌ Error calling OpenRouter API: {e}")
            if hasattr(e.response, 'text'):
                print(f"Response: {e.response.text}")
            raise


# Initialize embedding model
embedding_model = OpenRouterEmbedding(OPENROUTER_API_KEY)

# Initialize Qdrant client
qdrant_client = QdrantClient(url=QDRANT_URL)


def get_section_links():
    """Scrape RPStrength articles related to hypertrophy"""
    hub = "https://rpstrength.com/blogs/articles/complete-hypertrophy-training-guide"
    print(f"📡 Scraping articles from: {hub}")
    
    try:
        r = requests.get(hub, timeout=10)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        
        # Find all hypertrophy-related links
        links = []
        for link in soup.select("a[href*='hypertrophy']"):
            href = link.get("href", "")
            # Skip app links and focus on article links
            if href and "blogs/articles" in href and href not in ["/pages/hypertrophy-app"]:
                full_url = href if href.startswith("http") else "https://rpstrength.com" + href
                links.append(full_url)
        
        # Remove duplicates
        unique_links = list(set(links))
        print(f"✅ Found {len(unique_links)} unique article links")
        return unique_links
        
    except Exception as e:
        print(f"❌ Error scraping links: {e}")
        return []


def fetch_page(url):
    """Fetch and parse a single article page"""
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        
        # Try to find title
        title_elem = soup.find("h1")
        title = title_elem.get_text(strip=True) if title_elem else "Untitled"
        
        # Try to find article body
        body_elem = soup.select_one(".blog-body") or soup.select_one("article") or soup.find("main")
        if body_elem:
            body = body_elem.get_text("\n", strip=True)
        else:
            # Fallback: get all paragraph text
            paragraphs = soup.find_all("p")
            body = "\n".join([p.get_text(strip=True) for p in paragraphs if p.get_text(strip=True)])
        
        return title, body
        
    except Exception as e:
        print(f"  ⚠️  Error fetching {url}: {e}")
        return None, None


def chunk_text(text, max_chars=2000):
    """Split text into chunks for embedding"""
    if not text or len(text.strip()) < 100:
        return []
    
    paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 100]
    if not paragraphs:
        # Fallback: split by sentences
        sentences = [s.strip() for s in text.split(". ") if len(s.strip()) > 50]
        paragraphs = sentences
    
    current, chunks = [], []
    for p in paragraphs:
        if sum(len(x) for x in current) + len(p) > max_chars:
            if current:
                chunks.append("\n\n".join(current))
            current = [p]
        else:
            current.append(p)
    
    if current:
        chunks.append("\n\n".join(current))
    
    return chunks


def main():
    print("=" * 60)
    print("BeFit Qdrant Population Script")
    print("Using OpenRouter for embeddings")
    print("=" * 60)
    print()
    
    # Test OpenRouter connection
    print("🔍 Testing OpenRouter connection...")
    try:
        test_embedding = embedding_model.encode("test connection")
        embedding_dim = len(test_embedding)
        print(f"✅ OpenRouter connected successfully!")
        print(f"✅ Embedding dimension: {embedding_dim}")
    except Exception as e:
        print(f"❌ Failed to connect to OpenRouter: {e}")
        print("Make sure your OPENROUTER_API_KEY is correct and you have credits")
        return
    
    # Test Qdrant connection
    print()
    print("🔍 Testing Qdrant connection...")
    try:
        collections = qdrant_client.get_collections().collections
        print(f"✅ Qdrant connected successfully!")
        print(f"✅ Found {len(collections)} existing collections")
    except Exception as e:
        print(f"❌ Failed to connect to Qdrant: {e}")
        print("Make sure Qdrant is running:")
        print("  docker run -p 6333:6333 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant")
        return
    
    # Create or verify collection
    print()
    print(f"🔍 Checking collection '{COLLECTION_NAME}'...")
    try:
        collections = qdrant_client.get_collections().collections
        collection_names = [col.name for col in collections]
        
        if COLLECTION_NAME not in collection_names:
            print(f"📦 Creating collection '{COLLECTION_NAME}'...")
            qdrant_client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=embedding_dim, distance="Cosine")
            )
            print(f"✅ Collection '{COLLECTION_NAME}' created")
        else:
            print(f"✅ Collection '{COLLECTION_NAME}' already exists")
            # Ask if user wants to clear it
            response = input(f"  Do you want to clear existing data and re-index? (y/N): ").strip().lower()
            if response == 'y':
                print(f"🗑️  Deleting existing collection...")
                qdrant_client.delete_collection(COLLECTION_NAME)
                qdrant_client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=VectorParams(size=embedding_dim, distance="Cosine")
                )
                print(f"✅ Collection recreated")
    except Exception as e:
        print(f"❌ Error with Qdrant collection: {e}")
        return
    
    # Scrape articles
    print()
    print("📚 Scraping exercise science articles...")
    links = get_section_links()
    
    if not links:
        print("❌ No links found to process")
        return
    
    print(f"📄 Found {len(links)} articles to process")
    print()
    
    # Process each article
    idx = 1
    total_chunks = 0
    successful_articles = 0
    
    for i, url in enumerate(links, 1):
        print(f"[{i}/{len(links)}] Processing: {url}")
        
        try:
            title, body = fetch_page(url)
            
            if not title or not body:
                print(f"  ⚠️  Skipping (no content found)")
                continue
            
            # Chunk the content
            chunks = chunk_text(body)
            
            if not chunks:
                print(f"  ⚠️  Skipping (no valid chunks)")
                continue
            
            print(f"  📝 Title: {title[:60]}...")
            print(f"  📦 Created {len(chunks)} chunks")
            
            # Generate embeddings and store in Qdrant
            for chunk_idx, chunk in enumerate(chunks, 1):
                try:
                    # Generate embedding
                    vector = embedding_model.encode(chunk)
                    
                    # Store in Qdrant
                    qdrant_client.upsert(
                        collection_name=COLLECTION_NAME,
                        points=[PointStruct(
                            id=idx,
                            vector=vector,
                            payload={
                                "title": title,
                                "url": url,
                                "content": chunk[:500] + "..." if len(chunk) > 500 else chunk,  # Store preview
                                "chunk_index": chunk_idx,
                                "total_chunks": len(chunks)
                            }
                        )]
                    )
                    
                    idx += 1
                    total_chunks += 1
                    
                    if chunk_idx % 5 == 0:
                        print(f"    ✓ Indexed {chunk_idx}/{len(chunks)} chunks...")
                        
                except Exception as e:
                    print(f"    ❌ Error indexing chunk {chunk_idx}: {e}")
                    continue
            
            print(f"  ✅ Successfully indexed article ({len(chunks)} chunks)")
            successful_articles += 1
            
        except Exception as e:
            print(f"  ❌ Error processing article: {e}")
            continue
        
        print()
    
    # Summary
    print("=" * 60)
    print("✅ Indexing Complete!")
    print(f"   Articles processed: {successful_articles}/{len(links)}")
    print(f"   Total chunks indexed: {total_chunks}")
    print(f"   Collection: {COLLECTION_NAME}")
    print("=" * 60)
    print()
    print("🎉 Your RAG system is now ready!")
    print("   Your BeFit app will now use these articles for evidence-based responses.")


if __name__ == "__main__":
    main()

