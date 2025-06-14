# MedConscious AI Backend

This is the backend API for the MedConscious AI voice processing application, featuring **integrated voice processing with Gemini 2.5 Flash Preview**.

## 🚀 New Features (Voice Processing Integration)

- **Direct Voice Processing**: Voice input processed directly by Gemini 2.5 Flash Preview for both transcription and AI response
- **Integrated Workflow**: Single API call handles transcription + medical consultation
- **Enhanced Context Awareness**: AI processes audio nuances and medical context simultaneously
- **Reduced Latency**: Eliminates separate speech-to-text conversion steps
- **Stage-Based Processing**: Different conversation stages (greeting, followup, diagnosis, report)

## Core Features

- Voice-to-text conversion using Groq's Whisper model (fallback)
- **NEW**: Integrated voice processing with Gemini 2.5 Flash Preview
- Text-to-speech synthesis using Groq's PlayAI
- Medical conversation management with conversation history
- Differential diagnosis generation
- Medical report generation in markdown format
- Multiple API endpoints for different stages of consultation

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables:
```bash
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
```

3. Run the server:
```bash
python main.py
# or
uvicorn main:app --host 0.0.0.0 --port 8000
```

## API Endpoints

### 🎯 Primary Voice Processing Endpoints

#### 1. **NEW** - Integrated Voice Processing
- **POST** `/process-voice-integrated/`
- Process voice input directly with Gemini 2.5 Flash Preview
- **Payload**:
```json
{
    "audio_base64": "<base64_encoded_audio>",
    "user_info": {
        "name": "John Doe",
        "email": "abc@xyz.com"
    },
    "conversation_stage": "greeting|followup|diagnosis|report",
    "context": {
        "previous_questions": "optional",
        "patient_info": "optional"
    }
}
```

#### 2. **ENHANCED** - Initiate Chat (Now supports voice)
- **POST** `/initiate-chat/`
- Initialize conversation with optional voice greeting
- **Payload**:
```json
{
    "User_Info": {
        "name": "John Doe",
        "email": "abc@xyz.com"
    },
    "audio_base64": "<optional_base64_encoded_audio>"
}
```

### 🔧 Traditional Endpoints (Maintained for compatibility)

#### 3. Health Check
- **GET** `/health-check/`
- Returns API status

#### 4. Process Response (Traditional)
- **POST** `/process-response/`
- Process patient audio response using separate transcription
- Generate follow-up questions or proceed to diagnosis

#### 5. Generate Diagnosis
- **POST** `/generate-diagnosis/`
- Generate differential diagnosis based on patient data

#### 6. Generate Prescription
- **POST** `/generate-prescription/`
- Generate prescription based on diagnosis

#### 7. Generate Report
- **POST** `/generate-report/`
- Generate comprehensive medical report in markdown

## 🧪 Testing

Run the integrated test suite:
```bash
python test_voice_integration.py
```

This will test:
- Health check
- Traditional text-only greeting
- Voice-integrated greeting
- Integrated voice processing

## 📚 Documentation

- **[Voice Processing Integration Guide](VOICE_PROCESSING_INTEGRATION.md)** - Comprehensive guide for the new voice processing system
- **[API Documentation](http://localhost:8000/docs)** - Interactive Swagger documentation when server is running

## Technologies Used

- **FastAPI** for web framework
- **Google Gemini 2.5 Flash Preview** for integrated voice processing
- **Groq API** for fallback speech processing
- **PyAudio** for audio handling
- **Python-dotenv** for environment management

## Migration from Old System

If migrating from the previous version:

1. **Frontend Changes**: Update to use `/process-voice-integrated/` endpoint
2. **Payload Structure**: Include `conversation_stage` and `context` in requests
3. **Response Handling**: Process integrated transcription and AI response
4. **Error Handling**: Handle new error response formats

See [VOICE_PROCESSING_INTEGRATION.md](VOICE_PROCESSING_INTEGRATION.md) for detailed migration guide.

## Performance Notes

- Audio files should be under 10MB for optimal processing
- Base64 encoding increases payload size by ~33%
- Gemini 2.5 Flash Preview provides faster response times than separate API calls
- Monitor API rate limits for optimal performance

## Example Usage

### Quick Start with Voice Processing

```python
import requests
import base64

# Load audio file
with open("patient_audio.wav", "rb") as f:
    audio_data = f.read()
    audio_base64 = base64.b64encode(audio_data).decode('utf-8')

# Process voice input
response = requests.post("http://localhost:8000/process-voice-integrated/", json={
    "audio_base64": audio_base64,
    "user_info": {"name": "John Doe", "email": "john@example.com"},
    "conversation_stage": "followup",
    "context": {}
})

result = response.json()
print(f"Transcription: {result['transcription']}")
print(f"AI Response: {result['ai_response']}")
```

## Architecture

```
Frontend (Audio) → Backend → Gemini 2.5 Flash Preview → Integrated Response
                     ↓
               Conversation History
                     ↓
            Structured Medical Response
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass with `python test_voice_integration.py`
5. Submit a pull request

## License

[Your License Here]
