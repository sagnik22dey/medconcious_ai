import requests
import wave
import pyaudio
from pathlib import Path

def record_audio(duration=5, output_path="input.wav"):
    """Record audio from microphone"""
    CHUNK = 1024
    FORMAT = pyaudio.paInt16
    CHANNELS = 1
    RATE = 44100

    p = pyaudio.PyAudio()
    print("Recording... Speak now!")
    
    stream = p.open(format=FORMAT,
                   channels=CHANNELS,
                   rate=RATE,
                   input=True,
                   frames_per_buffer=CHUNK)

    frames = []
    for _ in range(0, int(RATE / CHUNK * duration)):
        data = stream.read(CHUNK)
        frames.append(data)

    print("Recording finished!")
    stream.stop_stream()
    stream.close()
    p.terminate()

    # Save the recorded audio
    with wave.open(output_path, 'wb') as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(p.get_sample_size(FORMAT))
        wf.setframerate(RATE)
        wf.writeframes(b''.join(frames))
    
    return output_path

def send_audio_to_server(audio_file_path, server_url="http://localhost:8000"):
    """Send audio file to server and save response"""
    # Check server health
    try:
        health_check = requests.get(f"{server_url}/")
        if health_check.status_code != 200:
            raise ConnectionError("Server is not responding")
        
        print("Server is healthy, sending audio file...")
        
        # Send audio file
        with open(audio_file_path, 'rb') as f:
            files = {'audio_file': (Path(audio_file_path).name, f, 'audio/wav')}
            response = requests.post(f"{server_url}/process-voice/", files=files)
        
        # Check content type of response
        content_type = response.headers.get('content-type', '')
        
        if 'audio/wav' in content_type:
            # Handle audio response
            output_path = "response.wav"
            with open(output_path, 'wb') as f:
                f.write(response.content)
            print(f"Response saved to {output_path}")
            return output_path
        elif 'application/json' in content_type:
            # Handle error response
            error_msg = response.json().get('error', 'Unknown error')
            print(f"Server error: {error_msg}")
            return None
        else:
            print(f"Unexpected response type: {content_type}")
            return None
            
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to server. Is it running?")
        return None
    except Exception as e:
        print(f"Error: {str(e)}")
        return None

if __name__ == "__main__":
    # Record audio and send to server
    try:
        # Record audio
        input_file = record_audio(duration=5)
        print(f"Audio saved to {input_file}")
        
        # Send to server and get response
        response_file = send_audio_to_server(input_file)
        
        if response_file:
            print("Process completed successfully!")
            
    except Exception as e:
        print(f"Error: {str(e)}")