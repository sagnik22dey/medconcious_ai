from fastapi import FastAPI, Body, HTTPException
from fastapi.responses import JSONResponse
import uvicorn
import base64
from dotenv import load_dotenv, find_dotenv
from static.helper_files.llm import speech_to_text, text_to_speech

app = FastAPI(
    title="MedConscious AI",
    description="Voice Processing API for Medical Consciousness",
    version="1.0.0"
)

@app.post("/process-voice/")
async def process_voice(audio_data: dict = Body(...)):
    """
    Process voice input in base64 bytes format:
    1. Decode base64 audio to bytes
    2. Convert speech bytes to text
    3. Convert text back to speech
    4. Return both text and audio response
    """
    try:
        # Decode base64 audio data to bytes
        if 'audio_bytes' not in audio_data:
            raise HTTPException(status_code=400, detail="No audio data provided")
            
        input_audio_bytes = base64.b64decode(audio_data['audio_bytes'])
        
        # Convert speech bytes to text
        text = speech_to_text(input_audio_bytes)
        print(f"Transcribed text: {text}")
        
        # Convert text back to speech and handle binary response
        response_audio_bytes = text_to_speech(text)
        if not isinstance(response_audio_bytes, bytes):
            raise ValueError("Text-to-speech failed to return audio bytes")
            
        response_audio_base64 = base64.b64encode(response_audio_bytes).decode('utf-8')
        
        return JSONResponse({
            "message": "Audio processed successfully",
            "text": text,
            "audio_bytes": response_audio_base64
        })

    except Exception as e:
        print(f"Error in process_voice: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Voice processing server is running"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)