import json
import os
from google import genai
from google.genai import types
import base64

def generate_with_gemini(input_text, sys):
    client = genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"),
    )

    model = "gemini-2.5-flash"
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=input_text),
            ],
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(), # Removed thinking_budget
        response_mime_type="application/json",
        system_instruction=[
            types.Part.from_text(text=sys),
        ],
    )

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=generate_content_config,
    )

    return json.loads(response.text)


def Process_voice_with_Gemini(voice_base64, sys, input_text=""):
    client = genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"),
    )

    model = "gemini-2.5-flash"
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_bytes(
                    mime_type="audio/mpeg",
                    data=base64.b64decode(voice_base64),
                ),
                types.Part.from_text(text=input_text),
            ],
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(), # Removed thinking_budget
        response_mime_type="application/json",
        system_instruction=[
            types.Part.from_text(text=sys),
        ],
    )

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=generate_content_config,
    )

    return json.loads(response.text)

def transcribe_audio_with_gemini(audio_base64: str) -> str:
    """
    Transcribes audio from a base64 encoded string using Gemini.
    """
    client = genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"),
    )
    model = "gemini-2.5-flash" # This model supports audio input
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_bytes(
                    mime_type="audio/mpeg", # Assuming mpeg from previous code
                    data=base64.b64decode(audio_base64),
                ),
                types.Part.from_text(text="Transcribe this audio."), # Instruction for transcription
            ],
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(), # Removed thinking_budget
        # No specific response_mime_type for plain text, Gemini will just return text
    )

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=generate_content_config,
    )
    return response.text # Direct text response


def Process_parts_with_Gemini(data, sys):
    client = genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"),
    )
    parts = []
    for item in data:
        parts.append(types.Part.from_text(text=item['text']))
        parts.append(types.Part.from_bytes(mime_type="audio/mpeg",data=base64.b64decode(item['audio'])))

    model = "gemini-2.0-flash"
    contents = [
        types.Content(
            role="user",
            parts=parts,
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        # thinking_config=types.ThinkingConfig(), # Removed thinking_budget
        response_mime_type="application/json",
        system_instruction=[
            types.Part.from_text(text=sys),
        ],
    )

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=generate_content_config,
    )

    return json.loads(response.text)


validation_prompt = """User will provide some audio data. we have to convert it into json format. JSON SCHEMA: 
{"age": int (if the age is below 0 or above 120 please return with the following text 'The age does not seem to be valid for a human. please retry again'),
 "Gender": str (MALE, FEMALE, OTHER),
 "symptoms": str ,
 "additional_info": {"field_name": data } (if any additional info is present in the provided audio, return that for this field else return None),
 "detected_language": str (if the language is not detected return 'This language is not supported yet'),
 }
 
 if the data is not present in the provided audio, return None for that field."""

