# Expo-AV Audio Recording Integration

This document describes the implementation of expo-av audio recording in the frontend and the corresponding backend modifications to handle the audio payload.

## Overview

The system now supports recording audio using expo-av in the React Native frontend, converting it to base64, and sending it to the backend for processing. The backend has been enhanced to properly handle various audio formats from expo-av.

## Frontend Implementation

### Audio Recording with Expo-AV

The frontend uses the `useSpeechRecognition` hook (located at `src/hooks/useSpeechRecognition.ts`) which:

1. **Records audio using expo-av**:
   - Uses `Audio.Recording.createAsync()` with optimized settings
   - Supports both WAV and M4A formats
   - Handles permissions and audio mode configuration

2. **Converts to base64**:
   - Uses `FileSystem.readAsStringAsync()` with base64 encoding
   - Includes MIME type detection based on file extension

3. **Sends to backend**:
   - Automatically triggers when recording stops
   - Passes audio data with MIME type information

### Key Features

- **Permission handling**: Requests and manages audio recording permissions
- **Cross-platform support**: Works on iOS and Android (web support limited)
- **Error handling**: Comprehensive error reporting and recovery
- **Audio format detection**: Automatically detects MIME type from file extension

### Usage in ChatScreen

```typescript
const { isListening, toggle } = useSpeechRecognition({
  onAudioRecorded: (audioData: { base64: string; uri: string | null; mimeType?: string }) => {
    const placeholderUiText = "Voice input captured, processing...";
    sendMessage(placeholderUiText, audioData.base64, audioData.mimeType);
  },
  onError: (error) => {
    console.error("Speech recognition error:", error);
    // Handle error appropriately
  },
});
```

## Backend Implementation

### Enhanced Audio Processing

The backend has been modified to handle expo-av audio formats:

1. **Improved `speech_to_text()` function**:
   - Detects if audio is already in a proper format (WAV, M4A, etc.)
   - Falls back to wrapping raw PCM data in WAV format if needed
   - Uses Groq's Whisper-large-v3 for transcription

2. **New `/process-expo-av-audio/` endpoint**:
   - Specifically designed for expo-av audio input
   - Handles base64 audio with MIME type information
   - Supports conversation staging (followup, diagnosis, etc.)

### Endpoint Comparison

| Endpoint | Purpose | Audio Input | Best For |
|----------|---------|-------------|----------|
| `/process-response/` | Original endpoint | Base64 → bytes | Legacy compatibility |
| `/process-expo-av-audio/` | New expo-av endpoint | Base64 with MIME type | Expo-AV integration |
| `/process-voice-integrated/` | Gemini integration | Base64 for Gemini | Advanced AI processing |

### API Payload Examples

#### New Expo-AV Endpoint
```json
{
  "audio_base64": "<base64_encoded_audio>",
  "mime_type": "audio/wav",
  "previous_question": "What brings you here today?",
  "user_info": {
    "name": "John Doe",
    "email": "john.doe@example.com"
  },
  "conversation_stage": "followup"
}
```

#### Response Format
```json
{
  "message": "Audio processed successfully",
  "transcription": "I have a headache and feel nauseous",
  "questions": "How long have you been experiencing these symptoms?",
  "status": "questions_pending",
  "conversation_stage": "followup"
}
```

## Audio Format Support

### Supported Formats
- **WAV**: Primary format, best compatibility
- **M4A**: iOS default, good quality
- **MP4**: Alternative container format
- **AAC**: Compressed audio codec
- **AMR**: Mobile optimized format
- **3GP**: Legacy mobile format

### Format Detection
The system automatically detects audio format based on:
1. File extension from URI
2. MIME type header analysis
3. Binary signature detection (RIFF for WAV, ftyp for M4A)

## Configuration

### Frontend Audio Settings

```typescript
const recordingOptions = {
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 44100,
    numberOfChannels: 1,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    sampleRate: 44100,
    numberOfChannels: 1,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsFloat: false,
    linearPCMIsBigEndian: false,
  },
};
```

### Backend Environment Variables

Ensure these environment variables are set:
- `GROQ_API_KEY`: For speech-to-text transcription
- `GEMINI_API_KEY`: For advanced AI processing

## Testing

### Running Tests

1. **Start the backend**:
   ```bash
   cd medconcious_ai/Backend
   python main.py
   ```

2. **Run integration tests**:
   ```bash
   cd medconcious_ai
   python test_expo_av_integration.py
   ```

3. **Test with frontend**:
   ```bash
   cd medconcious_ai/FrontEnd
   npm start
   ```

### Test Coverage

The test suite covers:
- ✅ Backend health check
- ✅ Expo-AV audio endpoint functionality
- ✅ Original endpoint compatibility
- ✅ Audio format detection
- ✅ Error handling

## Troubleshooting

### Common Issues

1. **Audio recording fails**:
   - Check permissions in device settings
   - Ensure audio mode is properly configured
   - Verify expo-av version compatibility

2. **Transcription errors**:
   - Check audio quality and duration
   - Verify GROQ_API_KEY is set
   - Ensure audio format is supported

3. **Backend errors**:
   - Check server logs for detailed error messages
   - Verify all required dependencies are installed
   - Ensure API keys are properly configured

### Debug Tips

1. **Enable debug logging**:
   ```python
   DEBUG = True  # in functions.py
   ```

2. **Check audio file integrity**:
   ```javascript
   console.log('Audio URI:', audioData.uri);
   console.log('Audio MIME type:', audioData.mimeType);
   console.log('Base64 length:', audioData.base64.length);
   ```

3. **Test with sample audio**:
   Use the provided test audio files in `Backend/tests/test_files/`

## Dependencies

### Frontend
- `expo-av`: Audio recording and playback
- `expo-file-system`: File system operations
- `react-native`: Core framework

### Backend
- `groq`: Speech-to-text API
- `google.genai`: Advanced AI processing
- `fastapi`: Web framework
- `python-multipart`: File upload handling

## Future Enhancements

1. **Audio quality optimization**:
   - Implement adaptive bitrate encoding
   - Add noise reduction preprocessing

2. **Enhanced format support**:
   - Add support for additional audio codecs
   - Implement real-time streaming

3. **Performance improvements**:
   - Add audio compression before transmission
   - Implement chunked upload for large files

4. **Advanced features**:
   - Real-time transcription
   - Speaker identification
   - Emotion detection from voice

## Version History

- **v1.0**: Initial expo-av integration
- **v1.1**: Enhanced audio format support
- **v1.2**: Added comprehensive error handling
- **v1.3**: Improved backend compatibility