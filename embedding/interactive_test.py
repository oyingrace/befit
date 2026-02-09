#!/usr/bin/env python3
"""
Interactive test script for the hypertrophy training retrieval system.
Run with: uv run interactive_test.py
"""

import requests
from qdrant_client import QdrantClient
import os

# Configuration
LM_STUDIO_BASE_URL = os.getenv("LM_STUDIO_URL", "http://172.21.96.1:1234")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-nomic-embed-text-v1.5")
COLLECTION_NAME = "rp_exercises"

class LMStudioEmbedding:
    def __init__(self, base_url=LM_STUDIO_BASE_URL, model=EMBEDDING_MODEL):
        self.base_url = base_url
        self.model = model
    
    def encode(self, text):
        url = f"{self.base_url}/v1/embeddings"
        headers = {"Content-Type": "application/json"}
        payload = {
            "model": self.model,
            "input": text if isinstance(text, list) else [text],
            "encoding_format": "float"
        }
        
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        embeddings = [item["embedding"] for item in data["data"]]
        return embeddings[0] if isinstance(text, str) else embeddings

def search_knowledge_base(query, top_k=5):
    """Search the hypertrophy knowledge base"""
    try:
        embedding_model = LMStudioEmbedding()
        client = QdrantClient(url="http://localhost:6333")
        
        print(f"🔍 Searching for: '{query}'")
        
        # Generate embedding
        query_vector = embedding_model.encode(query)
        
        # Search
        search_response = client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            limit=top_k,
            with_payload=True
        )
        
        results = search_response.points
        
        if not results:
            print("❌ No results found.")
            return
        
        print(f"\n📋 Found {len(results)} results:")
        print("=" * 80)
        
        for i, result in enumerate(results, 1):
            score = result.score
            payload = result.payload
            title = payload.get('title', 'No title')
            url = payload.get('url', 'No URL')
            content_preview = payload.get('content', 'No content preview')
            
            print(f"\n{i}. Score: {score:.3f}")
            print(f"   📰 {title}")
            print(f"   🔗 {url}")
            if content_preview:
                print(f"   📝 {content_preview}")
            
    except Exception as e:
        print(f"❌ Error during search: {e}")

def main():
    print("💪 Hypertrophy Training Knowledge Base")
    print("=" * 50)
    print("Enter your training questions (or 'quit' to exit)")
    print("\nExample queries:")
    print("• How many sets for biceps per week?")
    print("• Best exercises for chest hypertrophy")
    print("• Training frequency for muscle growth")
    print("• Progressive overload techniques")
    print("• Rest periods between sets")
    
    while True:
        try:
            query = input("\n🤔 Your question: ").strip()
            
            if query.lower() in ['quit', 'exit', 'q']:
                break
                
            if not query:
                continue
                
            search_knowledge_base(query)
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"❌ Error: {e}")
    
    print("\n👋 Happy training!")

if __name__ == "__main__":
    main()
