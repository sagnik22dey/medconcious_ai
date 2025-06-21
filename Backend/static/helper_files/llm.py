import os
import wave
import base64
import pyaudio
import tempfile
import pygame
from pathlib import Path
from groq import Groq
from dotenv import load_dotenv, find_dotenv
import io
from google import genai
from google.genai import types
from typing import List, Optional, Callable, Any
from .prompts import *
from .functions import *

_ = find_dotenv()
_ = load_dotenv()

# Initialize Gemini client
genai_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))



def speech_to_text(audio_path: str) -> str:
    """
    Convert audio file to text
    Args:
        audio_path: Path to the audio file
    Returns:
        str: Transcribed text
    """
    try:
        # Transcribe audio using the file path
        client = Groq()
        with open(audio_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=(os.path.basename(audio_path), audio_file.read()),
                model="whisper-large-v3",
                response_format="verbose_json",
            )
        
        if not transcription.text:
            raise ValueError("No text was transcribed from the audio")
            
        return transcription.text.strip()

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

        client = Groq()
        response = client.audio.speech.create(
            model="playai-tts",
            voice="Aaliyah-PlayAI",
            response_format="wav",
            input=text
        )
        
        # Get raw bytes from response
        # response.write_to_file() can sometimes cause issues with BytesIO.
        # Reading the stream directly is often more robust.
        audio_bytes = response.read()
        return audio_bytes

    except Exception as e:
        print(f"Error in text to speech conversion: {e}")
        raise

def generate_greeting(patient_info: dict) -> str:
    """
    Generate personalized greeting using patient info
    Args:
        patient_info: Dict containing User_Info with name and email
    Returns:
        str: Generated greeting text
    """
    try:
        # Extract user info
        user_info = patient_info.get("User_Info", {})
        name = user_info.get("name", "")
        
        prompt = f"system instruction:{GREETINGS_PROMPT}\n\nPatient Information: {user_info}"
        
        response = generate_llm_response(prompt=prompt)
        parsed = parse_text_to_json(response)
        
        if "error" in parsed:
            raise ValueError(f"Error in response: {parsed['error']}")
            
        return parsed['content']

    except Exception as e:
        print(f"Error generating greeting: {e}")
        raise

def generate_followup_questions(conversation_context: dict) -> str:
    """
    Generate follow-up questions based on previous interaction
    Args:
        conversation_context: Dict with previous_question and user response
    Returns:
        str: Generated questions
    """
    try:
        # Format conversation context
        prompt = (
            f"system instruction:{QUESTION_GENERATION_PROMPT_B2B}\n\n"
            f"Previous Question: {conversation_context['Assistant']}\n"
            f"Patient's Response: {conversation_context['user']}"
        )
        
        response = generate_llm_response(prompt=prompt)
        parsed = parse_text_to_json(response)
        
        if "error" in parsed:
            raise ValueError(f"Error in response: {parsed['error']}")
            
        # Ensure content is a list and filter out None values
        content_list = parsed.get('content', [])
        if content_list is None:
            return "" # Return empty string if content is None
        
        if not isinstance(content_list, list):
            # If content is not a list, convert it to a string and wrap in a list
            content_list = [str(content_list)]

        # Filter out None values and ensure all items are strings
        questions = [str(q) for q in content_list if q is not None]
        return " ".join(questions)

    except Exception as e:
        print(f"Error generating follow-up questions: {e}")
        raise

def generate_differential_diagnosis(patient_data: dict) -> str:
    """
    Generate differential diagnosis based on patient data
    Args:
        patient_data: Dict containing symptoms, history and previous questions
    Returns:
        str: Markdown formatted differential diagnosis
    """
    try:
        # Format patient data
        formatted_data = {
            "symptoms": patient_data.get("symptoms", ""),
            "conversation_history": patient_data.get("history", []),
            "previous_questions": patient_data.get("previous_questions", ""),
            "patient_info": patient_data.get("Patient_Info", {})
        }
        
        prompt = (
            f"system instruction:{DIFFERENTIAL_DIAGONOSIS_GENERATION_PROMPT}\n\n"
            f"Patient Data: {formatted_data}"
        )
        
        response = generate_llm_response(prompt=prompt)
        return response

    except Exception as e:
        print(f"Error generating differential diagnosis: {e}")
        raise

def generate_medical_report(conversation_history: List[dict], patient_data: dict) -> str:
    """
    Generate medical report including prescription
    Args:
        conversation_history: List of conversation exchanges
        patient_data: Dict with diagnosis, prescription and patient/doctor info
    Returns:
        str: Markdown formatted medical report
    """
    try:
        # Format report data
        report_data = {
            "conversation_history": conversation_history,
            "patient_info": patient_data.get("patient_info", {}),
            "doctor_info": patient_data.get("doctor_info", {}),
            "diagnosis": patient_data.get("diagnosis", ""),
            "prescription": patient_data.get("prescription", "")
        }
        
        prompt = (
            f"system instruction:{REPORT_GENERATION_PROMPT}\n\n"
            f"Report Data: {report_data}"
        )
        
        response = generate_llm_response(prompt=prompt)
        return response

    except Exception as e:
        print(f"Error generating medical report: {e}")
        raise

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

def generate_llm_response(
    prompt: str, 
    model: str = "gemini-2.5-flash-preview-05-20",
    custom_model_fn: Optional[Callable] = None,
    **kwargs: Any
) -> str:
    """
    Wrapper function to handle both Gemini and custom model responses
    Args:
        prompt: Input text prompt
        model: Model identifier (default: gemini-2.5-pro)
        custom_model_fn: Optional custom model function
        **kwargs: Additional arguments for custom model
    Returns:
        str: Generated response
    """
    try:
        if custom_model_fn:
            return custom_model_fn(prompt, **kwargs)
            
        # Default Gemini implementation
        contents = [
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=prompt)],
            ),
        ]
        
        response = ""
        for chunk in genai_client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(response_mime_type="text/plain")
        ):
            response += chunk.text or ""
            
        return response

    except Exception as e:
        print(f"Error in LLM response generation: {e}")
        raise
