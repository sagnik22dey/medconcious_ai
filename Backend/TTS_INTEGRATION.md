# Text-to-Speech (TTS) Integration with Gemini 2.5 Pro Preview

## Overview

The MedConscious AI backend has been enhanced with **Text-to-Speech (TTS) functionality** using **Gemini 2.5 Pro Preview TTS**. After receiving responses from the LLM, the system now generates audio responses in base64 format for seamless frontend integration.

## 🚀 Key Features

### 1. **Integrated TTS Pipeline**
- **Voice Input** → **Gemini 2.5 Flash Preview** → **Text Response** → **Gemini 2.5 Pro Preview TTS** → **Base64 Audio Output**
- Complete voice-to-voice conversation capability
- Consistent audio quality using Google's advanced TTS models

### 2. **Model Configuration**
- **Primary TTS Model**: `gemini-2.5-pro-preview-tts`
- **Fallback TTS**: Groq PlayAI TTS (if Gemini TTS fails)
- **Audio Format**: WAV format, base64 encoded
- **Temperature**: 0.3 (for natural, consistent speech)

## 🔧 Technical Implementation

### New TTS Function
```python
def generate_tts_with_gemini(text: str) -> str:
    """
    Generate text-to-speech audio using Gemini 2.5 Pro Preview TTS
    Args:
        text: Text to convert to speech
    Returns:
        str: Base64 encoded audio data
    """
```

### API Response Enhancement
All API endpoints now include `audio_base64` field in responses:

```json
{
    "message": "Success message",
    "text": "AI response text",
    "audio_base64": "UklGRi4AAABXQVZFZm10...",
    "transcription": "User input transcription",
    "status": "success"
}
```

## 📋 Updated API Endpoints

### 1. **Enhanced Initiate Chat** - `/initiate-chat/`
- **Input**: User info + optional voice input
- **Output**: Greeting text + TTS audio
- **TTS Applied**: AI greeting message

### 2. **Voice Integrated Processing** - `/process-voice-integrated/`
- **Input**: Voice audio + conversation context
- **Output**: Transcription + AI response + TTS audio
- **TTS Applied**: AI medical consultation response

### 3. **Traditional Process Response** - `/process-response/`
- **Input**: Audio bytes + user info
- **Output**: Questions/diagnosis + TTS audio
- **TTS Applied**: Follow-up questions or final diagnosis summary

## 🎯 TTS Integration Points

### Greeting Generation
```python
# Generate TTS audio for the greeting
try:
    greeting_audio_base64 = generate_tts_with_gemini(greeting_text)
except Exception as e:
    print(f"TTS generation failed: {e}")
    greeting_audio_base64 = None
```

### Voice Processing Response
```python
# Generate TTS audio for the AI response
try:
    response_audio_base64 = generate_tts_with_gemini(result["response"])
except Exception as e:
    print(f"TTS generation failed: {e}")
    response_audio_base64 = None
```

### Follow-up Questions
```python
# Generate TTS audio for follow-up questions
try:
    questions_audio_base64 = generate_tts_with_gemini(generated_questions_text)
except Exception as e:
    print(f"TTS generation failed: {e}")
    questions_audio_base64 = None
```

## 🧪 Testing Framework

### Enhanced Test Suite
- **Traditional Greeting with TTS**: Validates text-only greeting + audio generation
- **Voice-Integrated Greeting with TTS**: Tests voice input + audio output
- **Voice Processing with TTS**: Full voice-to-voice pipeline testing
- **Audio Size Validation**: Confirms base64 audio generation

### Test Output Example
```
✅ Voice-integrated greeting successful!
📝 Transcription: Hi, how are you?
💬 AI Response: Hello John Doe, Welcome to MedConscious.in!...
🔊 TTS Audio: Generated successfully!
📊 Audio size: 15432 characters (base64)
```

### Comprehensive Trial Script
The updated `trial.py` includes:
- **TTS Testing Suite**: Tests all endpoints with audio generation
- **Audio Playback**: Plays generated TTS audio for verification
- **Multi-endpoint Testing**: Compares traditional vs voice-integrated approaches
- **Error Handling**: Graceful fallback for TTS failures

## 📊 Performance Considerations

### Audio Generation
- **Latency**: Additional 2-3 seconds for TTS generation
- **File Size**: Base64 encoding increases size by ~33%
- **Quality**: High-quality speech synthesis from Gemini TTS

### Fallback Strategy
1. **Primary**: Gemini 2.5 Pro Preview TTS
2. **Fallback**: Groq PlayAI TTS
3. **Graceful Degradation**: Text-only response if TTS fails

## 🔄 Complete Voice Pipeline

### End-to-End Flow
1. **Frontend** sends voice audio (base64) to backend
2. **Backend** processes audio with Gemini 2.5 Flash Preview
3. **Transcription + AI Response** generated in single call
4. **AI Response** converted to speech using Gemini 2.5 Pro Preview TTS
5. **Backend** returns transcription + text response + audio response (base64)
6. **Frontend** can play audio response and display text

### Data Flow
```
User Voice Input (base64)
        ↓
Gemini 2.5 Flash Preview
        ↓
{ transcription, ai_response }
        ↓
Gemini 2.5 Pro Preview TTS
        ↓
Audio Response (base64)
        ↓
Complete JSON Response
```

## 🎵 Audio Specifications

### Input Audio Requirements
- **Format**: WAV
- **Sample Rate**: 44100 Hz
- **Channels**: Mono (1)
- **Bit Depth**: 16-bit
- **Encoding**: Base64

### Output Audio Specifications
- **Format**: WAV (from Gemini TTS)
- **Quality**: High-definition speech synthesis
- **Encoding**: Base64 for web transmission
- **Voice**: Natural, medical consultation appropriate

## 🚀 Frontend Integration

### Request Format
```javascript
const requestData = {
    audio_base64: "UklGRi4AAABXQVZFZm10...",
    user_info: {
        name: "John Doe",
        email: "john@example.com"
    },
    conversation_stage: "followup"
};
```

### Response Handling
```javascript
const response = await fetch('/process-voice-integrated/', {
    method: 'POST',
    body: JSON.stringify(requestData)
});

const result = await response.json();

// Display transcription and text response
console.log('Transcription:', result.transcription);
console.log('AI Response:', result.ai_response);

// Play audio response
if (result.audio_base64) {
    playAudioFromBase64(result.audio_base64);
}
```

## 🔧 Error Handling

### TTS Generation Failures
- **Graceful Degradation**: Returns text response even if TTS fails
- **Fallback TTS**: Uses Groq TTS if Gemini TTS unavailable
- **Error Logging**: Comprehensive logging for debugging
- **User Experience**: Never blocks response due to TTS failure

### Response Structure
```json
{
    "message": "Success message",
    "text": "AI response (always present)",
    "audio_base64": "base64_audio_or_null",
    "transcription": "user_input_transcription",
    "status": "success"
}
```

## 📈 Benefits

### User Experience
- **Natural Conversations**: Complete voice-to-voice interactions
- **Accessibility**: Audio responses for visually impaired users
- **Multitasking**: Users can listen while doing other tasks
- **Professional Quality**: Medical-grade speech synthesis

### Technical Advantages
- **Consistent Quality**: Same TTS model across all responses
- **Scalable Architecture**: Fallback mechanisms ensure reliability
- **Base64 Transmission**: Web-compatible audio delivery
- **Error Resilience**: Graceful handling of TTS failures

## 🎯 Production Ready

The TTS integration is fully functional with:
- ✅ **Gemini 2.5 Pro Preview TTS** integration
- ✅ **Fallback mechanisms** for reliability
- ✅ **Comprehensive testing** suite
- ✅ **Error handling** and logging
- ✅ **Base64 audio** delivery
- ✅ **Multi-endpoint** support

The system now provides complete voice-to-voice medical consultation capabilities with professional-quality speech synthesis.