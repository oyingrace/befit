#!/usr/bin/env python3
# Test script to verify that the embedding and retrieval system is working

import requests
from qdrant_client import QdrantClient
import os

# Configuration (same as main.py)
LM_STUDIO_BASE_URL = os.getenv("LM_STUDIO_URL", "http://172.21.96.1:1234")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-nomic-embed-text-v1.5")
COLL = "rp_exercises"

class LMStudioEmbedding:
    def __init__(self, base_url=LM_STUDIO_BASE_URL, model=EMBEDDING_MODEL):
        self.base_url = base_url
        self.model = model
        
    def encode(self, text):
        """Generate embeddings using LM Studio's API"""
        url = f"{self.base_url}/v1/embeddings"
        headers = {"Content-Type": "application/json"}
        payload = {
            "model": self.model,
            "input": text if isinstance(text, list) else [text],
            "encoding_format": "float"
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            embeddings = [item["embedding"] for item in data["data"]]
            return embeddings[0] if isinstance(text, str) else embeddings
        except Exception as e:
            print(f"Error generating embedding: {e}")
            raise

def test_retrieval():
    """Test the retrieval system with various queries"""
    
    # Initialize clients
    model = LMStudioEmbedding()
    qdr = QdrantClient(url="http://localhost:6333")
    
    # Check if collection exists
    try:
        collections = qdr.get_collections().collections
        collection_names = [col.name for col in collections]
        
        if COLL not in collection_names:
            print(f"❌ Collection '{COLL}' not found!")
            print(f"Available collections: {collection_names}")
            return
        else:
            print(f"✅ Collection '{COLL}' found")
            
        # Get collection info
        collection_info = qdr.get_collection(COLL)
        print(f"Collection points count: {collection_info.points_count}")
        print(f"Collection vector size: {collection_info.config.params.vectors.size}")
        print()
        
    except Exception as e:
        print(f"❌ Error accessing Qdrant: {e}")
        return
    
    # Test queries
    test_queries = [
        "muscle hypertrophy training",
        "how many sets per muscle group",
        "rest periods between sets",
        "progressive overload techniques",
        "training frequency for muscle growth",
        "rep ranges for hypertrophy"
    ]
    
    print("Testing retrieval with various queries:")
    print("=" * 50)
    
    for query in test_queries:
        try:
            print(f"\n🔍 Query: '{query}'")
            
            # Generate embedding for the query
            query_vector = model.encode(query)
            
            # Search in Qdrant using the newer query_points method
            search_response = qdr.query_points(
                collection_name=COLL,
                query=query_vector,
                limit=3,  # Get top 3 results
                with_payload=True
            )
            
            search_results = search_response.points
            
            if search_results:
                print(f"Found {len(search_results)} results:")
                for i, result in enumerate(search_results, 1):
                    score = result.score
                    title = result.payload.get('title', 'No title')
                    url = result.payload.get('url', 'No URL')
                    
                    print(f"  {i}. Score: {score:.3f}")
                    print(f"     Title: {title}")
                    print(f"     URL: {url}")
                    print()
            else:
                print("  No results found")
                
        except Exception as e:
            print(f"  ❌ Error processing query '{query}': {e}")
            continue
    
    # Test with a specific detailed query
    print("\n" + "=" * 50)
    print("Testing detailed query:")
    detailed_query = "What is the optimal training volume for muscle hypertrophy? How many sets should I do per week?"
    
    try:
        print(f"🔍 Detailed Query: '{detailed_query}'")
        query_vector = model.encode(detailed_query)
        
        search_response = qdr.query_points(
            collection_name=COLL,
            query=query_vector,
            limit=5,
            with_payload=True
        )
        
        search_results = search_response.points
        
        if search_results:
            print(f"\nFound {len(search_results)} results:")
            for i, result in enumerate(search_results, 1):
                score = result.score
                title = result.payload.get('title', 'No title')
                url = result.payload.get('url', 'No URL')
                
                print(f"\n{i}. Score: {score:.3f}")
                print(f"   Title: {title}")
                print(f"   URL: {url}")
                
                # If it's the top result, show that it's highly relevant
                if i == 1:
                    if score > 0.7:
                        print("   ✅ Highly relevant result!")
                    elif score > 0.5:
                        print("   ✓ Good relevance")
                    else:
                        print("   ⚠️ Lower relevance - may need more data")
        else:
            print("No results found for detailed query")
            
    except Exception as e:
        print(f"❌ Error with detailed query: {e}")

if __name__ == "__main__":
    print("🧪 Testing Retrieval System")
    print("=" * 30)
    test_retrieval()
    print("\n✅ Retrieval test completed!")
