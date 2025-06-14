import os
import wave
import pyaudio
import tempfile
import pygame
import base64
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

def process_voice_with_gemini(audio_base64: str, system_prompt: str, conversation_history: List[dict] = None) -> dict:
    """
    Process voice input directly with Gemini 2.5 Flash Preview for transcription and response
    Args:
        audio_base64: Base64 encoded audio data
        system_prompt: System prompt for the specific task
        conversation_history: Optional conversation history for context
    Returns:
        dict: Contains transcription and AI response
    """
    try:
        # Prepare conversation context
        conversation_context = ""
        if conversation_history:
            for msg in conversation_history:
                role = msg.get("role", "")
                content = msg.get("content", "")
                conversation_context += f"{role}: {content}\n"
        
        # Create the enhanced system prompt for both transcription and response
        enhanced_prompt = f"""
{system_prompt}

Previous conversation context:
{conversation_context}

IMPORTANT INSTRUCTIONS:
1. First, transcribe the audio input accurately
2. Then, based on the transcription and system prompt, provide an appropriate response
3. Your response must be in this exact JSON format:
{{
    "transcription": "exact transcription of the audio",
    "response": "your response based on the system prompt and transcription"
}}

The audio input you will receive should be processed for both transcription and generating an appropriate medical response based on your role as a doctor at MedConscious.in.
"""

        # Create content with audio
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part(text=enhanced_prompt),
                    types.Part(
                        inline_data=types.Blob(
                            data=base64.b64decode(audio_base64),
                            mime_type="audio/wav"
                        )
                    )
                ]
            )
        ]
        
        # Use Gemini 2.5 Flash Preview model
        response_text = ""
        for chunk in genai_client.models.generate_content_stream(
            model="gemini-2.5-flash-preview-05-20",
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.7
            )
        ):
            response_text += chunk.text
            
        # Parse the JSON response
        parsed_response = parse_text_to_json(response_text)
        
        if "error" in parsed_response:
            raise ValueError(f"Error parsing Gemini response: {parsed_response['error']}")
            
        return {
            "transcription": parsed_response.get("transcription", ""),
            "response": parsed_response.get("response", ""),
            "raw_response": response_text
        }

    except Exception as e:
        print(f"Error in voice processing with Gemini: {e}")
        raise

def generate_greeting_with_voice(user_info: dict, audio_base64: str = None) -> dict:
    """
    Generate personalized greeting using Gemini 2.5 Flash Preview with optional voice input
    Args:
        user_info: Dict containing User_Info with name and email
        audio_base64: Optional base64 encoded audio for voice-initiated greeting
    Returns:
        dict: Generated greeting response with transcription if audio provided
    """
    try:
        if audio_base64:
            # Use voice processing for interactive greeting
            greeting_prompt = f"""
{VOICE_PROCESSING_SYSTEM_PROMPT}

**Current Task**: Generate a personalized greeting for a new patient session.
**Patient Info**: {user_info}
**Instructions**: 
1. First transcribe any audio input accurately
2. Provide a warm, personalized greeting using the patient's name from the user info
3. Welcome them to MedConscious
4. Ask an initial question to begin the medical consultation (e.g., "What brings you here today?" or "How can I help you?")
5. Keep the greeting professional yet warm and reassuring
"""
            
            result = process_voice_with_gemini(
                audio_base64=audio_base64,
                system_prompt=greeting_prompt,
                conversation_history=[]
            )
            
            return {
                "transcription": result.get("transcription", ""),
                "greeting": result.get("response", ""),
                "type": "voice_interactive"
            }
        else:
            # Traditional text-based greeting
            name = user_info.get("name", "")
            prompt = f"system instruction:{GREETINGS_PROMPT}\n\nPatient Information: {user_info}"
            
            response = generate_llm_response(prompt=prompt)
            parsed = parse_text_to_json(response)
            
            if "error" in parsed:
                raise ValueError(f"Error in response: {parsed['error']}")
                
            return {
                "greeting": parsed['content'],
                "type": "text_only"
            }

    except Exception as e:
        print(f"Error generating greeting with voice: {e}")
        raise

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
            
        return " ".join(parsed['content'])

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
        model: Model identifier (default: gemini-2.5-flash-preview-05-20)
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
                parts=[types.Part(text=prompt)],
            ),
        ]
        
        response = ""
        for chunk in genai_client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(response_mime_type="text/plain")
        ):
            response += chunk.text
            
        return response

    except Exception as e:
        print(f"Error in LLM response generation: {e}")
        raise
