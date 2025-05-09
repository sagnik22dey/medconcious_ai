from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse
import uvicorn
from pathlib import Path
import tempfile
import os
from .static.helper_files.llm import speech_to_text, text_to_speech

app = FastAPI(
    title="MedConscious AI",
    description="Voice Processing API for Medical Consciousness",
    version="1.0.0"
)

# Create temporary directory for audio files
TEMP_DIR = Path("temp")
TEMP_DIR.mkdir(exist_ok=True)

@app.post("/process-voice/")
async def process_voice(audio_file: UploadFile = File(...)):
    """
    Process voice input:
    1. Save uploaded audio
    2. Convert to text
    3. Convert text back to speech
    4. Return audio response
    """
    try:
        # Save uploaded file temporarily
        temp_input = TEMP_DIR / f"input_{audio_file.filename}"
        with open(temp_input, "wb") as f:
            content = await audio_file.read()
            f.write(content)

        # Convert speech to text
        text = speech_to_text(temp_input)
        print(f"Transcribed text: {text}")

        # Convert text to speech
        temp_output = TEMP_DIR / "response.wav"
        text_to_speech(text, str(temp_output))

        # Return the audio file
        return FileResponse(
            path=temp_output,
            media_type="audio/wav",
            filename="response.wav"
        )

    except Exception as e:
        return {"error": str(e)}

    finally:
        # Cleanup temporary files
        if temp_input.exists():
            os.unlink(temp_input)
        if temp_output.exists():
            os.unlink(temp_output)

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Voice processing server is running"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)