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
                            mime_type="audio/m4a"  # Default to m4a as expo-av typically produces this
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

def speech_to_text(audio_bytes: bytes, mime_type: str = "audio/wav") -> str:
    """
    Convert audio bytes to text with better format handling and error recovery
    Args:
        audio_bytes: Audio data in bytes (can be raw PCM or encoded audio like WAV/M4A)
        mime_type: MIME type of the audio data (e.g., 'audio/wav', 'audio/m4a', 'audio/mp4')
    Returns:
        str: Transcribed text
    """
    max_retries = 3
    retry_delay = 2  # seconds
    
    for attempt in range(max_retries):
        try:
            client = Groq()
            
            # Determine the appropriate file extension and name based on MIME type
            if mime_type in ["audio/m4a", "audio/mp4", "audio/aac"]:
                filename = "audio.m4a"
            elif mime_type in ["audio/wav", "audio/wave"]:
                filename = "audio.wav"
            elif mime_type in ["audio/webm", "audio/webm;codecs=opus"]:
                filename = "audio.webm"
            elif mime_type in ["audio/ogg", "audio/ogg;codecs=opus"]:
                filename = "audio.ogg"
            else:
                # Default to m4a since that's what expo-av typically produces
                filename = "audio.m4a"
            
            print(f"Processing audio (attempt {attempt + 1}): {len(audio_bytes)} bytes, MIME: {mime_type}, Filename: {filename}")
            
            # Check if the audio_bytes is already a valid audio file format
            # WAV files start with 'RIFF'
            # M4A/MP4 files start with 'ftyp' at position 4-8
            # WebM files start with specific byte patterns
            if (audio_bytes[:4] == b'RIFF' or
                audio_bytes[4:8] == b'ftyp' or
                audio_bytes[:8] == b'\x00\x00\x00\x20ftyp' or
                audio_bytes[:4] == b'\x1aE\xdf\xa3'):  # WebM signature
                
                # Audio is already in a proper format
                print(f"Audio detected as valid format, sending to Groq Whisper...")
                transcription = client.audio.transcriptions.create(
                    file=(filename, audio_bytes),
                    model="whisper-large-v3",
                    response_format="verbose_json",
                    language="en"  # Specify English for better accuracy
                )
            else:
                # Audio might be raw PCM data, wrap it in WAV format
                print("Converting raw PCM to WAV format...")
                with io.BytesIO() as wav_buffer:
                    with wave.open(wav_buffer, 'wb') as wf:
                        wf.setnchannels(1)  # Mono
                        wf.setsampwidth(2)  # 16-bit
                        wf.setframerate(44100)
                        wf.writeframes(audio_bytes)
                    wav_data = wav_buffer.getvalue()

                transcription = client.audio.transcriptions.create(
                    file=("audio.wav", wav_data),
                    model="whisper-large-v3",
                    response_format="verbose_json",
                    language="en"
                )
            
            if not transcription.text:
                raise ValueError("No text was transcribed from the audio")
            
            transcribed_text = transcription.text.strip()
            print(f"Transcription successful: '{transcribed_text}'")
            return transcribed_text

        except Exception as e:
            error_message = str(e)
            print(f"Speech-to-text attempt {attempt + 1} failed: {error_message}")
            
            # Check if it's a Groq API overload error (503)
            if "503" in error_message or "overload" in error_message.lower() or "unavailable" in error_message.lower():
                if attempt < max_retries - 1:
                    import time
                    print(f"Groq API is overloaded. Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                    continue
                else:
                    # Return a fallback message for overload situations
                    print("Groq API overloaded after all retries. Returning fallback message.")
                    return "I heard your response but the speech recognition service is temporarily overloaded. Please try again or type your response."
            else:
                # For other errors, don't retry
                print(f"Non-retryable error: {error_message}")
                print(f"Audio bytes length: {len(audio_bytes) if audio_bytes else 0}")
                print(f"First 20 bytes: {audio_bytes[:20] if audio_bytes and len(audio_bytes) > 20 else 'N/A'}")
                
                # Return a generic fallback message
                return "I'm having trouble processing your audio. Please try speaking again or use text input."
    
    # If we get here, all retries failed
    return "Speech recognition service is currently unavailable. Please try again later or use text input."

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

def generate_followup_questions(conversation_context: dict):
    """
    Generate follow-up questions based on previous interaction with stage progression flag
    Args:
        conversation_context: Dict with previous_question, user response, and conversation history
    Returns:
        dict: Generated questions with ready_for_diagnosis flag
    """
    try:
        from .functions import parse_text_to_json
        
        # Include conversation history for better context
        conversation_history = conversation_context.get('conversation_history', [])
        conversation_summary = ""
        if conversation_history:
            conversation_summary = "\n".join([
                f"{msg['role']}: {msg['content']}"
                for msg in conversation_history[-10:]  # Last 10 messages for context
            ])
        
        # Format conversation context with history
        prompt = (
            f"system instruction:{QUESTION_GENERATION_PROMPT_B2B}\n\n"
            f"Previous Question: {conversation_context.get('Assistant', '')}\n"
            f"Patient's Latest Response: {conversation_context.get('user', '')}\n"
            f"Conversation History:\n{conversation_summary}\n\n"
            f"Please analyze if enough information has been gathered for diagnosis and set the ready_for_diagnosis flag accordingly."
        )
        
        response = generate_llm_response(prompt=prompt)
        
        # Ensure response is a string before parsing
        if isinstance(response, dict):
            return response
        
        if not isinstance(response, str):
            response = str(response)
        
        parsed = parse_text_to_json(response)
        
        if "error" in parsed:
            print(f"Error in LLM response: {parsed['error']}")
            # Return fallback response
            return {
                "content": ["Could you provide more details about your symptoms?"],
                "ready_for_diagnosis": False,
                "patient_summary": {},
                "reasoning": "Fallback due to LLM response error"
            }
        
        # Return the full parsed response (includes ready_for_diagnosis flag)
        return parsed

    except Exception as e:
        print(f"Error generating follow-up questions: {e}")
        # Return structured fallback
        return {
            "content": ["Could you provide more details about your symptoms?"],
            "ready_for_diagnosis": False,
            "patient_summary": {
                "name": "NA",
                "age": "NA",
                "gender": "NA",
                "chief_complaint": "NA",
                "medical_history": "NA"
            },
            "reasoning": f"Fallback due to error: {str(e)}"
        }

def generate_differential_diagnosis(patient_data: dict):
    """
    Generate differential diagnosis based on patient data with stage progression flag
    Args:
        patient_data: Dict containing symptoms, history and previous questions
    Returns:
        dict: Differential diagnosis with ready_for_prescription flag
    """
    try:
        from .functions import parse_text_to_json
        
        # Format patient data
        formatted_data = {
            "symptoms": patient_data.get("symptoms", ""),
            "conversation_history": patient_data.get("history", []),
            "previous_questions": patient_data.get("previous_questions", ""),
            "patient_info": patient_data.get("Patient_Info", {})
        }
        
        prompt = (
            f"system instruction:{DIFFERENTIAL_DIAGONOSIS_GENERATION_PROMPT}\n\n"
            f"Patient Data: {formatted_data}\n\n"
            f"Please provide a comprehensive differential diagnosis and determine if there's enough certainty to proceed with prescription."
        )
        
        response = generate_llm_response(prompt=prompt)
        
        # Ensure response is a string before parsing
        if isinstance(response, dict):
            return response
        
        if not isinstance(response, str):
            response = str(response)
        
        # Try to parse as JSON first for new format
        try:
            parsed = parse_text_to_json(response)
            if "error" not in parsed:
                # Ensure required fields are present
                if "ready_for_prescription" not in parsed:
                    parsed["ready_for_prescription"] = True
                if "primary_diagnosis" not in parsed:
                    parsed["primary_diagnosis"] = "See differential diagnosis"
                if "confidence_level" not in parsed:
                    parsed["confidence_level"] = "Medium"
                return parsed
        except Exception as parse_error:
            print(f"Error parsing diagnosis response: {parse_error}")
        
        # Fallback for old format - return as structured data
        return {
            "differential_diagnosis": response,
            "primary_diagnosis": "Based on symptoms provided",
            "ready_for_prescription": True,
            "confidence_level": "Medium",
            "patient_information": {
                "name": patient_data.get("Patient_Info", {}).get("name", "Patient"),
                "symptoms": patient_data.get("symptoms", ""),
                "main_symptoms": [patient_data.get("symptoms", "")]
            }
        }

    except Exception as e:
        print(f"Error generating differential diagnosis: {e}")
        # Return structured fallback instead of raising
        return {
            "differential_diagnosis": "Unable to generate diagnosis due to system error",
            "primary_diagnosis": "System Error - Please consult healthcare professional",
            "ready_for_prescription": False,
            "confidence_level": "Low",
            "error": str(e)
        }

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
