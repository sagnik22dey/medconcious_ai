import requests
import json
import base64
import pyaudio
import wave
import threading
import time
import pygame
import tempfile
import os

# Audio recording parameters
CHUNK = 1024
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 44100
RECORD_SECONDS = 30

def record_audio():
    """Record audio for 30 seconds"""
    print("Starting audio recording...")
    print("Speak now! Recording for 30 seconds...")
    
    # Initialize PyAudio
    audio = pyaudio.PyAudio()
    
    # Open stream
    stream = audio.open(format=FORMAT,
                       channels=CHANNELS,
                       rate=RATE,
                       input=True,
                       frames_per_buffer=CHUNK)
    
    frames = []
    
    # Record audio with countdown
    for i in range(0, int(RATE / CHUNK * RECORD_SECONDS)):
        data = stream.read(CHUNK)
        frames.append(data)
        
        # Show countdown every second
        if i % (RATE // CHUNK) == 0:
            remaining = RECORD_SECONDS - (i // (RATE // CHUNK))
            if remaining > 0:
                print(f"Recording... {remaining} seconds remaining")
    
    print("Recording finished!")
    
    # Stop and close stream
    stream.stop_stream()
    stream.close()
    audio.terminate()
    
    # Create temporary file and write audio data
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
    temp_filename = temp_file.name
    temp_file.close()  # Close the file handle first
    
    # Now write to the file
    wf = wave.open(temp_filename, 'wb')
    wf.setnchannels(CHANNELS)
    wf.setsampwidth(audio.get_sample_size(FORMAT))
    wf.setframerate(RATE)
    wf.writeframes(b''.join(frames))
    wf.close()
    
    # Read audio file as bytes
    with open(temp_filename, 'rb') as audio_file:
        audio_bytes = audio_file.read()
    
    # Clean up temporary file
    try:
        os.unlink(temp_filename)
    except PermissionError:
        # If we can't delete it immediately, try again after a short delay
        time.sleep(0.1)
        try:
            os.unlink(temp_filename)
        except PermissionError:
            print(f"Warning: Could not delete temporary file {temp_filename}")
    
    return audio_bytes

def play_audio(audio_base64):
    """Play audio from base64 encoded string"""
    try:
        # Decode base64 to bytes
        audio_bytes = base64.b64decode(audio_base64)
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        temp_filename = temp_file.name
        temp_file.close()  # Close the file handle first
        
        # Write audio data
        with open(temp_filename, 'wb') as f:
            f.write(audio_bytes)
        
        # Initialize pygame mixer
        pygame.mixer.init()
        
        # Load and play audio
        pygame.mixer.music.load(temp_filename)
        pygame.mixer.music.play()
        
        # Wait for playback to finish
        while pygame.mixer.music.get_busy():
            time.sleep(0.1)
        
        # Clean up
        pygame.mixer.quit()
        
        # Clean up temporary file with retry
        try:
            os.unlink(temp_filename)
        except PermissionError:
            time.sleep(0.1)
            try:
                os.unlink(temp_filename)
            except PermissionError:
                print(f"Warning: Could not delete temporary file {temp_filename}")
        
    except Exception as e:
        print(f"Error playing audio: {e}")

def test_voice_integrated(audio_base64):
    """Test the new voice integrated processing endpoint"""
    print("\n" + "="*60)
    print("TESTING NEW VOICE INTEGRATED PROCESSING")
    print("="*60)
    
    # Prepare payload for voice integrated processing
    payload = {
        "audio_base64": audio_base64,
        "user_info": {
            "name": "John Doe",
            "email": "john.doe@example.com"
        },
        "conversation_stage": "followup",
        "context": {
            "previous_questions": "What symptoms are you experiencing?",
            "patient_info": "Patient seeking medical consultation"
        }
    }
    
    try:
        print("Sending request to /process-voice-integrated/ endpoint...")
        response = requests.post(
            "http://localhost:8000/process-voice-integrated/",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ SUCCESS! Voice integrated processing response:")
            print(f"📝 Transcription: {result.get('transcription', 'N/A')}")
            print(f"🤖 AI Response: {result.get('ai_response', 'N/A')}")
            print(f"🎭 Stage: {result.get('conversation_stage', 'N/A')}")
                
            # Save response
            with open('voice_integrated_response.json', 'w') as f:
                json.dump(result, f, indent=2)
            print("Response saved to 'voice_integrated_response.json'")
            
        else:
            print(f"❌ Error: Voice integrated API returned status code {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing voice integrated endpoint: {e}")

def test_traditional_endpoint(audio_base64):
    """Test the traditional process-response endpoint"""
    print("\n" + "="*60)
    print("TESTING TRADITIONAL ENDPOINT (for comparison)")
    print("="*60)
    
    # Prepare payload according to traditional API format
    payload = {
        "audio_bytes": audio_base64,
        "previous_question": "Give me the patient Name, Age, Gender and Symptoms",
        "user_info": {
            "name": "John Doe",
            "email": "abc@xyz.com"
        }
    }
    
    # Save payload to JSON file for reference
    with open('audio_request_payload.json', 'w') as f:
        json.dump({
            "audio_bytes": audio_base64[:100] + "...(truncated)",  # Truncate for readability
            "previous_question": payload["previous_question"],
            "user_info": payload["user_info"]
        }, f, indent=2)
    
    print("Payload saved to 'audio_request_payload.json'")
    
    try:
        # Send POST request to FastAPI server
        print("Sending request to traditional /process-response/ endpoint...")
        response = requests.post(
            "http://localhost:8000/process-response/",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=60  # 60 second timeout
        )
        
        if response.status_code == 200:
            result = response.json()
            
            print("✅ SUCCESS! Traditional endpoint response:")
            print(f"Message: {result.get('message', 'N/A')}")
            print(f"User Text (Transcribed): {result.get('user_text', 'N/A')}")
            print(f"Generated Questions: {result.get('questions', 'N/A')}")
            print(f"Status: {result.get('status', 'N/A')}")
            
            # Save full response to JSON file
            with open('api_response.json', 'w') as f:
                json.dump(result, f, indent=2)
            print("Full response saved to 'api_response.json'")
                
        else:
            print(f"❌ Error: Traditional API returned status code {response.status_code}")
            print(f"Response: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to FastAPI server. Make sure it's running on http://localhost:8000")
    except requests.exceptions.Timeout:
        print("❌ Error: Request timed out. The server may be processing...")
    except Exception as e:
        print(f"❌ Error sending request: {e}")

def test_initiate_chat():
    """Test the initiate chat endpoint"""
    print("\n" + "="*60)
    print("TESTING INITIATE CHAT")
    print("="*60)
    
    payload = {
        "User_Info": {
            "name": "Test Patient",
            "email": "test@example.com"
        }
    }
    
    try:
        print("Sending request to /initiate-chat/ endpoint...")
        response = requests.post(
            "http://localhost:8000/initiate-chat/",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ SUCCESS! Initiate chat response:")
            print(f"📝 Greeting Text: {result.get('text', 'N/A')}")
            print(f"🔧 Processing Type: {result.get('processing_type', 'N/A')}")
                
        else:
            print(f"❌ Error: Initiate chat returned status code {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error testing initiate chat: {e}")

def send_audio_to_api(audio_bytes):
    """Send recorded audio to FastAPI server and test all endpoints"""
    
    # Convert audio bytes to base64
    audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
    
    # Test all endpoints
    print("🚀 COMPREHENSIVE VOICE PROCESSING TESTING SUITE")
    print("="*60)
    
    # Test 1: Initiate chat
    test_initiate_chat()
    
    # Test 2: Voice integrated processing
    test_voice_integrated(audio_base64)
    
    # Test 3: Traditional endpoint
    test_traditional_endpoint(audio_base64)
    
    print("\n" + "="*60)
    print("🎉 VOICE PROCESSING TESTING COMPLETE!")
    print("="*60)

def main():
    """Main function to orchestrate the recording and API call"""
    print("Audio Recording and Voice Processing API Test Script")
    print("="*40)
    
    # Check if server is running
    try:
        print("Attempting to connect to FastAPI server...")
        response = requests.get("http://localhost:8000/health-check/", timeout=5)
        if response.status_code == 200:
            print("✅ FastAPI server is running")
        else:
            print("⚠️ Server responded but may have issues")
    except:
        print("⚠️ Cannot verify if FastAPI server is running. Proceeding anyway...")
    
    print("\nPreparing to record audio...")
    input("Press Enter when ready to start recording...")
    
    # Record audio
    audio_bytes = record_audio()
    
    print(f"Audio recorded successfully! Size: {len(audio_bytes)} bytes")
    
    # Send to API and test voice processing functionality
    send_audio_to_api(audio_bytes)

if __name__ == "__main__":
    # Install required packages if not already installed
    try:
        import pyaudio
        import pygame
    except ImportError as e:
        print(f"Missing required package: {e}")
        print("Please install required packages:")
        print("pip install pyaudio pygame requests")
        exit(1)
    
    main()