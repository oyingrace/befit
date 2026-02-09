#!/usr/bin/env python3
# pip install requests beautifulsoup4 qdrant-client

import requests
from bs4 import BeautifulSoup
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, PointStruct
import textwrap
import os
import json

# 1. LM Studio configuration
LM_STUDIO_BASE_URL = os.getenv("LM_STUDIO_URL", "http://172.21.96.1:1234")  # Default LM Studio port
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-nomic-embed-text-v1.5")  # Use the model name as it appears in LM Studio

class LMStudioEmbedding:
    def __init__(self, base_url=LM_STUDIO_BASE_URL, model=EMBEDDING_MODEL):
        self.base_url = base_url
        self.model = model
        self.embedding_dimension = None
        
    def check_server_status(self):
        """Check if LM Studio server is running and what models are available"""
        try:
            # Try to get available models
            response = requests.get(f"{self.base_url}/v1/models")
            if response.status_code == 200:
                models = response.json()
                print(f"✅ LM Studio server is running at {self.base_url}")
                if 'data' in models:
                    available_models = [model['id'] for model in models['data']]
                    print(f"Available models: {available_models}")
                    return available_models
                else:
                    print("No models found in response")
                    return []
            else:
                print(f"❌ Server responded with status {response.status_code}")
                return []
        except requests.exceptions.ConnectionError:
            print(f"❌ Cannot connect to LM Studio at {self.base_url}")
            print("Make sure LM Studio is running and the server is started")
            return []
        except Exception as e:
            print(f"❌ Error checking server status: {e}")
            return []
    
    def encode(self, text):
        """Generate embeddings using LM Studio's API"""
        url = f"{self.base_url}/v1/embeddings"
        headers = {
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "input": text if isinstance(text, list) else [text],
            "encoding_format": "float"
        }
        
        try:
            print(f"Sending request to: {url}")
            print(f"Model: {self.model}")
            response = requests.post(url, headers=headers, json=payload)
            
            if response.status_code == 404:
                print("❌ 404 Error: The embeddings endpoint was not found")
                print("This usually means:")
                print("1. No embedding model is loaded in LM Studio")
                print("2. The server is not properly started")
                print("3. Wrong model name specified")
                available_models = self.check_server_status()
                if available_models:
                    print(f"Try using one of these model names: {available_models}")
                raise requests.exceptions.HTTPError(f"404 Client Error: Embeddings endpoint not found")
            
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
            print(f"Error calling LM Studio API: {e}")
            raise
        except KeyError as e:
            print(f"Unexpected response format from LM Studio: {e}")
            print(f"Response: {response.text}")
            raise
    
    def get_sentence_embedding_dimension(self):
        """Get the embedding dimension"""
        if self.embedding_dimension is None:
            # Test with a small text to determine dimension
            test_embedding = self.encode("test")
            self.embedding_dimension = len(test_embedding)
        return self.embedding_dimension

# Initialize the embedding model
model = LMStudioEmbedding()

# 2. Initialize Qdrant client (local on port 6333)
qdr = QdrantClient(url="http://localhost:6333")
COLL = "rp_exercises"

# 4. Scraping logic
def get_section_links():
    hub = "https://rpstrength.com/blogs/articles/complete-hypertrophy-training-guide"
    r = requests.get(hub); r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    
    # Find all hypertrophy-related links
    links = []
    for link in soup.select("a[href*='hypertrophy']"):
        href = link.get("href", "")
        # Skip app links and focus on article links
        if href and "blogs/articles" in href and href not in ["/pages/hypertrophy-app"]:
            full_url = href if href.startswith("http") else "https://rpstrength.com" + href
            links.append(full_url)
    
    # Remove duplicates and return
    return list(set(links))

def fetch_page(url):
    r = requests.get(url); r.raise_for_status()
    s = BeautifulSoup(r.text, "html.parser")
    title = s.find("h1").get_text(strip=True)
    body = (s.select_one(".blog-body") or s.select_one("article")).get_text("\n", strip=True)
    return title, body

# 5. Chunking helper
def chunk_text(text, max_chars=2000):
    paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 200]
    current, chunks = [], []
    for p in paragraphs:
        if sum(len(x) for x in current) + len(p) > max_chars:
            chunks.append("\n\n".join(current))
            current = []
        current.append(p)
    if current:
        chunks.append("\n\n".join(current))
    return chunks

# 6. Main ingestion
def main():
    # Test LM Studio connection first
    print("Checking LM Studio server status...")
    available_models = model.check_server_status()
    
    if not available_models:
        print("❌ Cannot proceed without a working LM Studio connection")
        return
    
    # Test embedding generation
    try:
        print("Testing embedding generation...")
        test_embedding = model.encode("test connection")
        print(f"✅ LM Studio connected successfully. Embedding dimension: {len(test_embedding)}")
    except Exception as e:
        print(f"❌ Failed to generate embeddings: {e}")
        print("Make sure an embedding model is loaded in LM Studio and the server is started")
        return
    
    # Create Qdrant collection if missing
    try:
        collections = qdr.get_collections().collections
        collection_names = [col.name for col in collections]
        
        if COLL not in collection_names:
            print(f"Creating Qdrant collection '{COLL}'...")
            qdr.recreate_collection(
                collection_name=COLL,
                vectors_config=VectorParams(size=len(test_embedding), distance="Cosine")
            )
            print(f"✅ Collection '{COLL}' created")
        else:
            print(f"✅ Collection '{COLL}' already exists")
    except Exception as e:
        print(f"❌ Error with Qdrant: {e}")
        return
    
    # Start scraping and indexing
    print("Starting content scraping and indexing...")
    links = get_section_links()
    print(f"Found {len(links)} article links to process")
    
    if not links:
        print("❌ No links found to process. Check the scraping logic.")
        return
    
    idx = 1
    for url in links:
        try:
            print(f"Processing {url}...")
            title, body = fetch_page(url)
            chunks = chunk_text(body)
            print(f"  Created {len(chunks)} chunks for: {title[:50]}...")
            
            for chunk in chunks:
                vec = model.encode(chunk)
                qdr.upsert(
                    collection_name=COLL,
                    points=[PointStruct(id=idx, vector=vec, payload={"title": title, "url": url, "content": chunk[:200] + "..."})]
                )
                print(f"  Indexed chunk {idx}")
                idx += 1
        except Exception as e:
            print(f"❌ Error processing {url}: {e}")
            continue
    print("✅ Done indexing into Qdrant")

if __name__ == "__main__":
    main()
