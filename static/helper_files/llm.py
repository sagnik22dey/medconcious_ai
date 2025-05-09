import os
import wave
import pyaudio
import tempfile
import pygame
from pathlib import Path
from groq import Groq
from dotenv import load_dotenv, find_dotenv

_ = find_dotenv()
_ = load_dotenv()

def speech_to_text(duration=5):
    """Record audio and convert to text"""
    # Audio recording parameters
    CHUNK = 1024
    FORMAT = pyaudio.paInt16
    CHANNELS = 1
    RATE = 44100

    p = pyaudio.PyAudio()
    print("Listening... Speak now!")
    
    stream = p.open(format=FORMAT,
                   channels=CHANNELS,
                   rate=RATE,
                   input=True,
                   frames_per_buffer=CHUNK)

    frames = []
    try:
        for i in range(0, int(RATE / CHUNK * duration)):
            data = stream.read(CHUNK)
            frames.append(data)
    finally:
        print("Processing your speech...")
        stream.stop_stream()
        stream.close()
        p.terminate()

    # Save recording to temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
    temp_filename = temp_file.name
    temp_file.close()  # Close the file handle immediately

    # Write audio data to file
    with wave.open(temp_filename, 'wb') as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(p.get_sample_size(FORMAT))
        wf.setframerate(RATE)
        wf.writeframes(b''.join(frames))

    # Transcribe audio
    client = Groq()
    try:
        with open(temp_filename, "rb") as file:
            transcription = client.audio.transcriptions.create(
                file=(temp_filename, file.read()),
                model="whisper-large-v3",
                response_format="verbose_json",
            )
    finally:
        # Ensure file is closed before deletion
        try:
            os.unlink(temp_filename)
        except Exception as e:
            print(f"Warning: Could not delete temporary file: {e}")
    
    return transcription.text

def text_to_speech(text, voice="Aaliyah-PlayAI"):
    """Convert text to speech and play it"""
    client = Groq()
    
    # Generate speech file path
    speech_file_path = Path(__file__).parent / "response.wav"
    
    # Create speech from text
    response = client.audio.speech.create(
        model="playai-tts",
        voice=voice,
        response_format="wav",
        input=text,
    )
    
    # Save the audio file
    response.write_to_file(speech_file_path)
    
    # Play the audio using pygame
    pygame.mixer.init()
    try:
        pygame.mixer.music.load(str(speech_file_path))
        pygame.mixer.music.play()
        
        # Wait for playback to finish
        while pygame.mixer.music.get_busy():
            pygame.time.Clock().tick(10)
    finally:
        pygame.mixer.quit()
        
    # Clean up the audio file
    os.unlink(speech_file_path)

def main():
    try:
        # Step 1: Convert speech to text
        text = speech_to_text(duration=5)
        print(f"You said: {text}")
        
        # Step 2: Convert text back to speech and play it
        print("Playing response...")
        text_to_speech(text)
        
    except Exception as e:
        print(f"An error occurred: {str(e)}")


if __name__ == "__main__":
    pass