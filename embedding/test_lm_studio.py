#!/usr/bin/env python3
"""
Simple test script to check LM Studio connection and available models.
Run this first to diagnose connection issues.
"""

import requests
import json
import os

LM_STUDIO_BASE_URL = os.getenv("LM_STUDIO_URL", "http://172.21.96.1:1234")

def test_connection():
    print(f"Testing connection to LM Studio at: {LM_STUDIO_BASE_URL}")
    
    # Test basic connection
    try:
        response = requests.get(f"{LM_STUDIO_BASE_URL}/v1/models", timeout=5)
        print(f"✅ Server responded with status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if 'data' in data and data['data']:
                print("\n📋 Available models:")
                for model in data['data']:
                    print(f"  - {model['id']}")
                    
                # Test embedding with first available model
                model_name = data['data'][0]['id']
                test_embedding(model_name)
            else:
                print("❌ No models found. Load an embedding model in LM Studio.")
        else:
            print(f"❌ Unexpected response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed. Is LM Studio running and server started?")
    except Exception as e:
        print(f"❌ Error: {e}")

def test_embedding(model_name):
    print(f"\n🧪 Testing embedding generation with model: {model_name}")
    
    url = f"{LM_STUDIO_BASE_URL}/v1/embeddings"
    payload = {
        "model": model_name,
        "input": ["Hello world"],
        "encoding_format": "float"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"Embedding endpoint status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if 'data' in data and data['data']:
                embedding = data['data'][0]['embedding']
                print(f"✅ Embedding generated successfully!")
                print(f"   Dimension: {len(embedding)}")
                print(f"   First 5 values: {embedding[:5]}")
                return True
            else:
                print(f"❌ Unexpected embedding response: {data}")
                return False
        else:
            error_data = response.json() if response.content else {}
            if "Model is not embedding" in str(error_data):
                print(f"❌ '{model_name}' is a text generation model, not an embedding model")
                print("   You need to load an actual embedding model in LM Studio")
                print("   Recommended embedding models:")
                print("   - sentence-transformers/all-MiniLM-L6-v2")
                print("   - nomic-ai/nomic-embed-text-v1.5") 
                print("   - BAAI/bge-small-en-v1.5")
                print("   - text-embedding-3-small")
            else:
                print(f"❌ Embedding failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Embedding test failed: {e}")
        return False

def test_all_models_for_embeddings():
    """Test all available models to find which ones support embeddings"""
    print(f"\n🔍 Testing all models for embedding support...")
    
    try:
        response = requests.get(f"{LM_STUDIO_BASE_URL}/v1/models", timeout=5)
        if response.status_code == 200:
            data = response.json()
            if 'data' in data and data['data']:
                embedding_models = []
                for model in data['data']:
                    model_name = model['id']
                    print(f"\nTesting {model_name}...")
                    if test_embedding(model_name):
                        embedding_models.append(model_name)
                
                if embedding_models:
                    print(f"\n✅ Found {len(embedding_models)} embedding model(s):")
                    for model in embedding_models:
                        print(f"   - {model}")
                else:
                    print(f"\n❌ No embedding models found among loaded models")
                    print("   You need to download and load an embedding model in LM Studio")
                
                return embedding_models
            else:
                print("❌ No models found")
                return []
        else:
            print(f"❌ Failed to get models: {response.text}")
            return []
            
    except Exception as e:
        print(f"❌ Error testing models: {e}")
        return []

if __name__ == "__main__":
    test_connection()
    embedding_models = test_all_models_for_embeddings()
    
    if not embedding_models:
        print("\n📥 To fix this issue:")
        print("1. In LM Studio, go to the 'Discover' or 'Models' tab")
        print("2. Search for and download one of these embedding models:")
        print("   - sentence-transformers/all-MiniLM-L6-v2 (small, fast)")
        print("   - nomic-ai/nomic-embed-text-v1.5 (good quality)")
        print("   - BAAI/bge-small-en-v1.5 (good balance)")
        print("3. Load the embedding model (not the qwen3 text generation model)")
        print("4. Make sure the server is started")
        print("5. Run this test again")
