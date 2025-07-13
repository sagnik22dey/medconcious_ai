import base64
from openai import OpenAI
from concurrent.futures import ThreadPoolExecutor
import functools

def audio_bytes_to_base64(audio_bytes):
    return base64.b64encode(audio_bytes).decode("utf-8")


def text_to_speech(text, voice="shimmer", model="tts-1", language=None):
    client = OpenAI()

    response = client.audio.speech.create(
        model=model,
        voice=voice,
        input=text
    )
    
    return audio_bytes_to_base64(response.content)

def base64_to_audio_file(base64_string, filename):
    audio_bytes = base64.b64decode(base64_string)
    with open(filename, "wb") as audio_file:
        audio_file.write(audio_bytes)

def text_to_speech_concurrent(list_of_texts, language = "English"):
    with ThreadPoolExecutor(max_workers=10) as executor:
        # Create partial function with language parameter
        tts_func = functools.partial(text_to_speech, language=language)
        
        # Submit all tasks
        audio_results = list(executor.map(tts_func, list_of_texts))
    
    print("Audio generation completed for all texts.")
    
    data = []
    for i, text in enumerate(list_of_texts):
        data.append({
            "text": text,
            "audio": audio_results[i]
        })
    
    return {"data": data}

