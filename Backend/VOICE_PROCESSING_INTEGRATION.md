# Voice Processing Integration with Gemini 2.5 Flash Preview

## Overview

The backend has been overhauled to integrate **Gemini 2.5 Flash Preview 05-20** for direct voice processing. This eliminates the need for separate speech-to-text conversion and enables seamless voice input processing with integrated transcription and AI response generation.

## Key Changes

### 1. New Voice Processing Function
- **`process_voice_with_gemini()`**: Core function that processes base64 audio directly with Gemini 2.5 Flash Preview
- Performs both transcription and AI response generation in a single API call
- Returns structured JSON with transcription and contextual medical response

### 2. Enhanced System Prompts
- **`VOICE_PROCESSING_SYSTEM_PROMPT`**: New system prompt designed for integrated voice processing
- Instructs the AI to both transcribe audio and provide appropriate medical responses
- Maintains medical consultation context and professional standards

### 3. Updated API Endpoints

#### Primary Voice Processing Endpoint
**`POST /process-voice-integrated/`**
```json
{
    "audio_base64": "<base64_encoded_audio>",
    "user_info": {
        "name": "John Doe",
        "email": "abc@xyz.com"
    },
    "conversation_stage": "greeting|followup|diagnosis|report",
    "context": {
        "previous_questions": "optional previous questions",
        "patient_info": "optional patient information"
    }
}
```

#### Enhanced Initiate Chat Endpoint
**`POST /initiate-chat/`** - Now supports voice input
```json
{
    "User_Info": {
        "name": "John Doe",
        "email": "abc@xyz.com"
    },
    "audio_base64": "<optional_base64_encoded_audio_for_voice_greeting>"
}
```

## Technical Architecture

### Voice Processing Flow
1. **Frontend** → Sends base64 encoded audio to backend
2. **Backend** → Forwards audio directly to Gemini 2.5 Flash Preview
3. **Gemini** → Processes audio for both transcription and medical response
4. **Backend** → Returns structured response with transcription and AI analysis
5. **Frontend** → Receives integrated response

### Model Configuration
- **Model**: `gemini-2.5-flash-preview-05-20`
- **Response Format**: `application/json`
- **Temperature**: `0.7` for balanced creativity and consistency
- **MIME Type**: `audio/wav` for audio input

## Benefits of Integration

### 1. Reduced Latency
- Single API call instead of separate transcription + LLM calls
- Eliminates intermediary processing steps
- Faster response times for users

### 2. Improved Context Awareness
- AI processes both audio nuances and content simultaneously
- Better understanding of patient tone and urgency
- More contextually appropriate responses

### 3. Enhanced Accuracy
- Direct audio processing reduces transcription errors
- AI can interpret unclear speech in medical context
- Better handling of medical terminology

### 4. Simplified Architecture
- Fewer moving parts in the processing pipeline
- Reduced complexity in error handling
- Easier maintenance and debugging

## Conversation Stages

The system supports different conversation stages with tailored prompts:

1. **Greeting**: Initial patient interaction and welcome
2. **Followup**: Ongoing medical assessment questions
3. **Diagnosis**: Analysis and differential diagnosis generation
4. **Report**: Final medical report and recommendations

## Error Handling

- Comprehensive error handling for audio processing failures
- Fallback to traditional speech-to-text if Gemini processing fails
- Structured error responses for frontend integration
- Conversation history preservation during errors

## Environment Requirements

### Required Environment Variables
```
GEMINI_API_KEY=your_gemini_api_key_here
```

### Updated Dependencies
```
google-genai>=0.3.0
```

## Migration Guide

### From Old System
1. Replace `speech_to_text()` + `generate_response()` calls
2. Use `process_voice_with_gemini()` for integrated processing
3. Update frontend to use new `/process-voice-integrated/` endpoint
4. Modify audio payload structure to include conversation stage

### Frontend Changes Required
1. Update API endpoint URLs
2. Modify request payload structure
3. Handle new response format with integrated transcription
4. Implement conversation stage management

## Testing

### Test Audio Format
- **Format**: WAV
- **Sample Rate**: 44100 Hz
- **Channels**: Mono (1)
- **Bit Depth**: 16-bit
- **Encoding**: Base64

### Sample Request
```python
import base64

# Read audio file
with open("test_audio.wav", "rb") as audio_file:
    audio_data = audio_file.read()
    audio_base64 = base64.b64encode(audio_data).decode('utf-8')

# Make request
payload = {
    "audio_base64": audio_base64,
    "user_info": {"name": "Test Patient", "email": "test@example.com"},
    "conversation_stage": "followup",
    "context": {}
}
```

## Performance Considerations

- Audio file size should be kept under 10MB for optimal processing
- Base64 encoding increases payload size by ~33%
- Consider audio compression for large files
- Monitor API rate limits for Gemini Flash Preview

## Future Enhancements

1. **Real-time Processing**: Stream audio for live transcription
2. **Multi-language Support**: Extend to support multiple languages
3. **Voice Analytics**: Extract emotional and stress indicators
4. **Custom Voice Models**: Train specialized medical voice models