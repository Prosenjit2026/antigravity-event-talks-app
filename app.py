import os
import re
import html
import time
import requests
import xml.etree.ElementTree as ET
from flask import Flask, render_template, jsonify, request

# Cache Configurations
FEED_CACHE = None
FEED_CACHE_TIME = 0
CACHE_DURATION = 600  # 10 minutes (600 seconds)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, 
            template_folder=os.path.join(BASE_DIR, 'templates'),
            static_folder=os.path.join(BASE_DIR, 'static'))

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_content(html_content):
    if not html_content:
        return []
    
    # Split the HTML content by <h3> headers to segment individual updates
    parts = re.split(r'(?i)<h3>', html_content)
    updates = []
    for part in parts:
        if not part.strip():
            continue
        
        # Separate the type (e.g., Feature, Issue) from the rest of the text
        sub_parts = re.split(r'(?i)</h3>', part, maxsplit=1)
        if len(sub_parts) == 2:
            update_type = sub_parts[0].strip()
            update_html = sub_parts[1].strip()
            
            # Clean HTML tags to get pure text for drafting a Tweet
            plain_text = re.sub(r'<[^>]+>', '', update_html)
            plain_text = html.unescape(plain_text).strip()
            plain_text = re.sub(r'\s+', ' ', plain_text)
            
            updates.append({
                "type": update_type,
                "html": update_html,
                "text": plain_text
            })
        else:
            # Fallback if no <h3> tags were found in the block
            plain_text = re.sub(r'<[^>]+>', '', part)
            plain_text = html.unescape(plain_text).strip()
            plain_text = re.sub(r'\s+', ' ', plain_text)
            updates.append({
                "type": "General",
                "html": part.strip(),
                "text": plain_text
            })
    return updates

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    global FEED_CACHE, FEED_CACHE_TIME
    
    # Read the cache control flag
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    current_time = time.time()
    if FEED_CACHE and not force_refresh and (current_time - FEED_CACHE_TIME < CACHE_DURATION):
        return jsonify({
            "status": "success",
            "releases": FEED_CACHE,
            "cached": True,
            "cache_age_seconds": round(current_time - FEED_CACHE_TIME)
        })
        
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        response = requests.get(FEED_URL, headers=headers, timeout=15)
        response.raise_for_status()
        
        # Parse XML (Atom format)
        root = ET.fromstring(response.content)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        entries = []
        for entry in root.findall('atom:entry', ns):
            title = entry.find('atom:title', ns)
            entry_id = entry.find('atom:id', ns)
            updated = entry.find('atom:updated', ns)
            
            # Find alternate link
            link_href = ""
            for link in entry.findall('atom:link', ns):
                if link.attrib.get('rel') == 'alternate':
                    link_href = link.attrib.get('href', '')
                    break
            if not link_href:
                link = entry.find('atom:link', ns)
                if link is not None:
                    link_href = link.attrib.get('href', '')
            
            content = entry.find('atom:content', ns)
            html_content = content.text if content is not None else ""
            
            date_str = title.text if title is not None else "Unknown Date"
            updated_str = updated.text if updated is not None else ""
            id_str = entry_id.text if entry_id is not None else ""
            
            updates = parse_content(html_content)
            
            entries.append({
                "id": id_str,
                "date": date_str,
                "updated": updated_str,
                "link": link_href,
                "updates": updates
            })
            
        FEED_CACHE = entries
        FEED_CACHE_TIME = current_time
        
        return jsonify({
            "status": "success",
            "releases": entries,
            "cached": False
        })
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
