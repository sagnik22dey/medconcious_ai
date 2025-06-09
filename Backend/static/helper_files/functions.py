import re
# import openai
import json
from dotenv import load_dotenv
import os
import random
from google import genai
from google.genai import types
import tempfile
from datetime import datetime
import markdown
from typing import List, Tuple

load_dotenv()
DEBUG = True

def log_debug(data, name=None, level="DEBUG"):
    """Enhanced logging function with timestamp and log levels"""
    if DEBUG:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if isinstance(data, (dict, list)):
            data = json.dumps(data, indent=2)
        message = f"[{timestamp}] [{level}] {name}: {data}" if name else f"[{timestamp}] [{level}] {data}"
        print(message)


#Parse text to JSON
def parse_text_to_json(text):
    try:
        if "```json" in text:
            text = text.replace("```json","").replace("```","")
        if "```" in text:
            text = text.replace("```", "")

        return json.loads(text)
    except Exception as e:
        log_debug(f"Error parsing text to JSON: {e}")
        return {"error": str(e)}
    
# Generate a medical report in HTML format
def generate_medical_report_html(markdown_text):
    # Replace tabs with spaces and preserve line breaks
    markdown_text = markdown_text.replace('\t', '    ')
    
    # Convert markdown to HTML using the markdown library with extensions
    html_content = markdown.markdown(
        markdown_text,
        extensions=['fenced_code', 'nl2br'],
        output_format='html5'
    )
    formatted_html = f"<div class='medical-report'>{html_content}</div>".replace('''<br>
    - ''', '''<br>
       - ''')
    log_debug(formatted_html)
    return {"type":"markdown" ,"html": formatted_html, "markdown": markdown_text}
