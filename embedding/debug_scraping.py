#!/usr/bin/env python3
"""
Debug script to test the scraping functionality
"""

import requests
from bs4 import BeautifulSoup

def debug_scraping():
    """Debug the scraping logic to see what's happening"""
    hub = "https://rpstrength.com/blogs/articles/complete-hypertrophy-training-guide"
    
    print(f"Fetching hub page: {hub}")
    
    try:
        r = requests.get(hub)
        r.raise_for_status()
        print(f"✅ Successfully fetched hub page (status: {r.status_code})")
        
        soup = BeautifulSoup(r.text, "html.parser")
        
        # Debug: Check if the selector is finding anything
        print("\n🔍 Looking for links with selector: '#hub‑index a[href*='hypertrophy']'")
        links = soup.select("#hub‑index a[href*='hypertrophy']")
        print(f"Found {len(links)} links with original selector")
        
        # Try alternative selectors
        print("\n🔍 Trying alternative selectors...")
        
        # Try without the special character
        alt_links1 = soup.select("#hub-index a[href*='hypertrophy']")
        print(f"Found {len(alt_links1)} links with '#hub-index a[href*=\"hypertrophy\"]'")
        
        # Try more general selectors
        alt_links2 = soup.select("a[href*='hypertrophy']")
        print(f"Found {len(alt_links2)} links with 'a[href*=\"hypertrophy\"]'")
        
        # Try looking for any hub-related elements
        hub_elements = soup.select("[id*='hub']")
        print(f"Found {len(hub_elements)} elements with id containing 'hub'")
        for elem in hub_elements:
            print(f"  - {elem.name} with id='{elem.get('id')}'")
        
        # Show first few hypertrophy links found
        if alt_links2:
            print(f"\n📋 First few hypertrophy links found:")
            for i, link in enumerate(alt_links2[:5]):
                href = link.get("href", "")
                text = link.get_text(strip=True)
                print(f"  {i+1}. {href} - {text[:50]}...")
        
        # Try to find the actual structure
        print(f"\n🔍 Looking for common article list structures...")
        article_containers = soup.select("article, .article, .post, .blog-post, [class*='article'], [class*='post']")
        print(f"Found {len(article_containers)} potential article containers")
        
        # Save the page for manual inspection
        with open("/tmp/hub_page.html", "w") as f:
            f.write(r.text)
        print(f"\n💾 Saved page content to /tmp/hub_page.html for manual inspection")
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error fetching page: {e}")
    except Exception as e:
        print(f"❌ Error parsing page: {e}")

if __name__ == "__main__":
    debug_scraping()
