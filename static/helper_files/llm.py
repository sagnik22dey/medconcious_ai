import os
import wave
import pyaudio
import tempfile
import pygame
from pathlib import Path
from groq import Groq
from dotenv import load_dotenv, find_dotenv
import io
from google import genai
from google.genai import types
from typing import List
from prompts import *
from functions import *

_ = find_dotenv()
_ = load_dotenv()

# Initialize Gemini client
genai_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))



def speech_to_text(audio_bytes: bytes) -> str:
    """
    Convert audio bytes to text
    Args:
        audio_bytes: Raw audio data in bytes
    Returns:
        str: Transcribed text
    """
    try:
        # Create in-memory WAV file
        with io.BytesIO() as wav_buffer:
            with wave.open(wav_buffer, 'wb') as wf:
                wf.setnchannels(1)  # Mono
                wf.setsampwidth(2)  # 16-bit
                wf.setframerate(44100)
                wf.writeframes(audio_bytes)
            
            wav_data = wav_buffer.getvalue()

        # Transcribe audio
        client = Groq()
        transcription = client.audio.transcriptions.create(
            file=("audio.wav", wav_data),
            model="whisper-large-v3",
            response_format="verbose_json",
        )
        
        return transcription.text

    except Exception as e:
        print(f"Error in speech to text conversion: {e}")
        raise

def text_to_speech(text: str) -> bytes:
    """
    Convert text to speech bytes
    Args:
        text: Input text as string to convert to speech
    Returns:
        bytes: WAV audio data in bytes format
    """
    try:
        # Validate input
        if not isinstance(text, str):
            raise ValueError("Input must be a string")
        if not text.strip():
            raise ValueError("Input text cannot be empty")

        # Initialize Groq client
        client = Groq()
        
        # Convert text to speech
        response = client.audio.speech.create(
            model="playai-tts",
            voice="Aaliyah-PlayAI",
            response_format="wav",
            input=text
        )
        
        # Extract bytes from BinaryAPIResponse
        if hasattr(response, 'read'):
            # If response has read method, use it
            return response.read()
        elif hasattr(response, 'data'):
            # If response has data attribute, use it
            return response.data
        else:
            # Last resort: try to get raw content
            return bytes(response._content)

    except Exception as e:
        print(f"Error in text to speech conversion: {e}")
        raise

def play_audio(audio_data: bytes):
    """Play audio data using pygame"""
    # Save the audio data to a temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
    temp_filename = temp_file.name
    temp_file.write(audio_data)
    temp_file.close()

    # Play the audio using pygame
    pygame.mixer.init()
    try:
        pygame.mixer.music.load(temp_filename)
        pygame.mixer.music.play()
        
        # Wait for playback to finish
        while pygame.mixer.music.get_busy():
            pygame.time.Clock().tick(10)
    finally:
        pygame.mixer.quit()
        
    # Clean up the temporary file
    os.unlink(temp_filename)

def generate_followup_questions(conversation_text: str) -> List[str]:
    """
    Generate follow-up questions based on the conversation using Gemini
    Args:
        conversation_text: The text from speech-to-text conversion
        system_prompt: Optional system prompt to guide the model's behavior
    Returns:
        List[str]: List of follow-up questions
    """
    try:
        model = "gemini-2.5-pro-preview-05-06"
        
        # Default system prompt if none provided
        
        system_prompt = QUESTION_GENERATION_PROMPT_B2B
        
        # Prepare the content
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(
                        text=f"system instrcution:{system_prompt}\n\nQuestion:{conversation_text['Assistant']}\n\nPatient's response: {conversation_text['user']}"
                    ),
                ],
            ),
        ]
        
        # Configure generation parameters
        generate_config = types.GenerateContentConfig(
            response_mime_type="text/plain",
        )
        
        # Generate response
        response = ""
        for chunk in genai_client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_config,
        ):
            response += chunk.text
        
        parsed_response = parse_text_to_json(response)
        if "error" in parsed_response:
            raise ValueError(f"Error in response: {parsed_response['error']}")
        # Parse response into list of questions
        questions = ''
        for question in parsed_response['content']:
            questions += question['text'].strip('\n\t ') + '       '
        
        return questions  

    except Exception as e:
        print(f"Error generating follow-up questions: {e}")
        return ["Could not generate follow-up questions."]
    

def generate_greeting(patient_info: dict) -> str:
    """
    Generate a personalized greeting for the patient
    Args:
        patient_info: Dictionary containing patient information
    Returns:
        str: Personalized greeting and initial question
    """
    try:
        model = "gemini-2.5-pro-preview-05-06"
        
        # Prepare the content
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(
                        text=f"system instruction:{GREETINGS_PROMPT}\n\nPatient Information: {patient_info}"
                    ),
                ],
            ),
        ]
        
        # Configure generation parameters
        generate_config = types.GenerateContentConfig(
            response_mime_type="text/plain",
        )
        
        # Generate response
        response = ""
        for chunk in genai_client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_config,
        ):
            response += chunk.text
        
        parsed_response = parse_text_to_json(response)
        if "error" in parsed_response:
            raise ValueError(f"Error in response: {parsed_response['error']}")
            
        return parsed_response['content']

    except Exception as e:
        print(f"Error generating greeting: {e}")
        return "Welcome to MedConscious. How can I help you today?"

def generate_differential_diagnosis(patient_data: dict) -> str:
    """
    Generate differential diagnosis based on patient data
    Args:
        patient_data: Dictionary containing patient symptoms and history
    Returns:
        str: Detailed differential diagnosis in markdown format
    """
    try:
        model = "gemini-2.5-pro-preview-05-06"
        
        # Prepare the content
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(
                        text=f"system instruction:{DIFFERENTIAL_DIAGONOSIS_GENERATION_PROMPT}\n\nPatient Data: {patient_data}"
                    ),
                ],
            ),
        ]
        
        # Configure generation parameters
        generate_config = types.GenerateContentConfig(
            response_mime_type="text/plain",
        )
        
        # Generate response
        response = ""
        for chunk in genai_client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_config,
        ):
            response += chunk.text
        
        return response

    except Exception as e:
        print(f"Error generating differential diagnosis: {e}")
        return "Unable to generate differential diagnosis at this time."

def generate_medical_report(conversation_history: List[dict], patient_data: dict) -> str:
    """
    Generate a comprehensive medical report
    Args:
        conversation_history: List of conversation exchanges
        patient_data: Dictionary containing patient information
    Returns:
        str: Medical report in markdown format
    """
    try:
        model = "gemini-2.5-pro-preview-05-06"
        
        # Prepare the content
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(
                        text=f"system instruction:{REPORT_GENERATION_PROMPT}\n\nConversation History: {conversation_history}\n\nPatient Data: {patient_data}"
                    ),
                ],
            ),
        ]
        
        # Configure generation parameters
        generate_config = types.GenerateContentConfig(
            response_mime_type="text/plain",
        )
        
        # Generate response
        response = ""
        for chunk in genai_client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_config,
        ):
            response += chunk.text
        
        return response

    except Exception as e:
        print(f"Error generating medical report: {e}")
        return "Unable to generate medical report at this time."

def record_audio(duration=5):
    """Record audio and return as bytes"""
    CHUNK = 1024
    FORMAT = pyaudio.paInt16
    CHANNELS = 1
    RATE = 44100

    p = pyaudio.PyAudio()
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
        stream.stop_stream()
        stream.close()
        p.terminate()

    return b''.join(frames)
