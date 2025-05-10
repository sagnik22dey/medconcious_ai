from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse
import uvicorn
from pathlib import Path
import tempfile
import os
import base64
from dotenv import load_dotenv, find_dotenv
from static.helper_files.llm import speech_to_text, text_to_speech

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
    temp_input = None
    temp_output = None
    
    try:
        # Save uploaded file temporarily
        temp_input = TEMP_DIR / f"input_{audio_file.filename}"
        content = await audio_file.read()
        
        # Ensure temp_input is a string when writing
        with open(str(temp_input), "wb") as f:
            f.write(content)

        # Convert speech to text - pass as string
        text = speech_to_text(str(temp_input))
        print(f"Transcribed text: {text}")

        # Convert text to speech
        temp_output = TEMP_DIR / "response.wav"
        # Ensure output path is a string
        text_to_speech(text, str(temp_output))

        # Wait to ensure file is written
        if not temp_output.exists():
            raise FileNotFoundError("Response audio file was not created")
        # Return the audio file as bytes
        encoded_audio = base64.b64encode(temp_output.read_bytes()).decode('utf-8')
        # Create response
        return {"message": "Audio processed successfully", "text": text, "audio_data": encoded_audio}
    
    except FileNotFoundError as fnf_error:
        print(f"File not found error: {fnf_error}")
        return {"error": "File not found", "details": str(fnf_error)}

    except Exception as e:
        print(f"Error in process_voice: {str(e)}")
        return {"error": str(e)}

    finally:
        # Cleanup temporary files
        try:
            if temp_input and Path(temp_input).exists():
                os.unlink(str(temp_input))
            if temp_output and Path(temp_output).exists():
                os.unlink(str(temp_output))
        except Exception as cleanup_error:
            print(f"Error during cleanup: {cleanup_error}")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Voice processing server is running"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)