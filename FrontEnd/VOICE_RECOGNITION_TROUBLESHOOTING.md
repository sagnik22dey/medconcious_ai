# Voice Recognition Troubleshooting Guide

## Common Issues and Solutions

### 🎤 Issue: Backend Cannot Recognize/Decipher Voice

This is the most common issue when integrating voice recording with speech-to-text services. Here are the potential causes and solutions:

## 🔍 Root Cause Analysis

### 1. Audio Format Mismatch
**Problem**: Frontend sends audio in one format, backend expects another.

**Solution Applied**:
- ✅ Updated backend `speech_to_text()` function to handle multiple audio formats
- ✅ Added MIME type detection and proper file extension mapping
- ✅ Changed frontend recording settings to use M4A format (better compatibility)

```typescript
// Frontend: Now records in M4A format
const recordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  }
}
```

```python
# Backend: Now handles multiple formats
def speech_to_text(audio_bytes: bytes, mime_type: str = "audio/wav") -> str:
    # Determines correct filename and format for Groq Whisper
    if mime_type in ["audio/m4a", "audio/mp4", "audio/aac"]:
        filename = "audio.m4a"
    elif mime_type in ["audio/wav", "audio/wave"]:
        filename = "audio.wav"
    # ... etc
```

### 2. Audio Quality Issues
**Problem**: Poor audio quality leads to failed transcription.

**Solutions**:
- ✅ Optimized recording settings (44.1kHz sample rate, mono channel)
- ✅ Added proper audio encoding (AAC for mobile, Opus for web)
- ✅ Increased bit rate to 128kbps for better quality

### 3. Audio Length Issues
**Problem**: Audio too short or too long for recognition.

**Solutions**:
- Ensure recordings are at least 1-2 seconds long
- Speak clearly and at normal pace
- Avoid background noise

### 4. Network/API Issues
**Problem**: Audio data corrupted during transmission or API errors.

**Solutions Applied**:
- ✅ Added proper base64 encoding/decoding
- ✅ Enhanced error handling and logging
- ✅ Added MIME type information in API requests

## 🛠️ Debugging Tools

### Use the VoiceDebugger Component
We've created a comprehensive debugging tool to help identify issues:

```typescript
import { VoiceDebugger } from './components/VoiceDebugger';

// Use in your app to test voice recognition
<VoiceDebugger />
```

**Features**:
- Real-time logging of all voice operations
- Backend testing with detailed response analysis
- Permission status monitoring
- Audio format information display
- Network error diagnostics

### Enable Debug Logging
The updated backend now includes comprehensive logging:

```python
print(f"Processing audio: {len(audio_bytes)} bytes, MIME: {mime_type}")
print(f"Transcription successful: '{transcribed_text}'")
```

## 🔧 Step-by-Step Troubleshooting

### Step 1: Check Permissions
```typescript
// Verify microphone permissions
const { hasAudioRecordingPermission } = useSpeechRecognition();
console.log('Mic permissions:', hasAudioRecordingPermission);
```

### Step 2: Verify Audio Recording
```typescript
// Check if audio is being recorded properly
onAudioRecorded: (audioData) => {
  console.log('Audio recorded:', {
    uri: audioData.uri,
    mimeType: audioData.mimeType,
    base64Length: audioData.base64.length,
    sizeKB: (audioData.base64.length / 1024).toFixed(1)
  });
}
```

### Step 3: Test Backend Connectivity
```bash
# Test backend health
curl http://localhost:8000/health-check/

# Test with sample audio
curl -X POST http://localhost:8000/process-response/ \
  -H "Content-Type: application/json" \
  -d '{"audio_bytes":"<base64>","audio_format":"audio/m4a"}'
```

### Step 4: Analyze Audio Format
Check the audio file signature:
```python
# Check first few bytes to identify format
audio_bytes = base64.b64decode(audio_base64)
print(f"First 20 bytes: {audio_bytes[:20]}")

# M4A files typically start with: b'\x00\x00\x00 ftyp'
# WAV files start with: b'RIFF'
# WebM files start with: b'\x1aE\xdf\xa3'
```

## 🎯 Testing Checklist

### Frontend Tests
- [ ] Microphone permissions granted
- [ ] Audio recording starts/stops properly
- [ ] Audio file is created with correct format
- [ ] Base64 encoding is working
- [ ] Network request is sent with proper headers

### Backend Tests
- [ ] Audio bytes are received correctly
- [ ] MIME type is properly detected
- [ ] Groq Whisper API is responding
- [ ] Transcription text is returned
- [ ] No errors in server logs

### Integration Tests
- [ ] End-to-end recording → transcription flow works
- [ ] Error handling works for bad audio
- [ ] Network error handling works
- [ ] UI updates reflect actual status

## 🚨 Common Error Messages and Solutions

### "No text was transcribed from the audio"
**Causes**:
- Audio file is corrupted or empty
- Audio quality is too poor
- Audio format not supported by Whisper

**Solutions**:
- Check audio file size (should be > 1KB)
- Verify recording settings
- Test with known good audio file

### "Error in speech to text conversion"
**Causes**:
- Network connectivity issues
- Groq API key problems
- Audio format incompatibility

**Solutions**:
- Verify internet connection
- Check Groq API key in `.env` file
- Try different audio format

### "Permission denied" or "Microphone not accessible"
**Causes**:
- App doesn't have microphone permissions
- Another app is using the microphone
- Hardware issues

**Solutions**:
- Request permissions explicitly
- Close other apps using microphone
- Test on different device

### "Request timeout" or "Network error"
**Causes**:
- Backend server not running
- Wrong server URL
- Firewall blocking requests

**Solutions**:
- Verify backend is running on correct port
- Check URL in frontend (localhost vs IP address)
- Test with curl/Postman

## 📱 Platform-Specific Issues

### iOS
- **Issue**: Recording permission popup appears repeatedly
- **Solution**: Handle permission state properly, don't request multiple times

- **Issue**: Audio format not compatible
- **Solution**: Use M4A format (now default in our implementation)

### Android
- **Issue**: Audio recording fails in background
- **Solution**: Ensure proper audio mode settings

- **Issue**: Emulator vs device differences
- **Solution**: Test on real device, use correct IP for backend

### Web
- **Issue**: MediaRecorder API not supported
- **Solution**: Check browser compatibility, use WebM format

- **Issue**: CORS errors when accessing backend
- **Solution**: Configure backend CORS settings

## 🔊 Audio Quality Guidelines

### For Best Recognition Results:
1. **Environment**: Record in quiet environment
2. **Distance**: Speak 6-12 inches from microphone
3. **Volume**: Speak at normal conversational volume
4. **Pace**: Speak clearly and at moderate pace
5. **Language**: Use clear pronunciation
6. **Duration**: 2-10 seconds per recording

### Recording Settings (Optimized):
```typescript
const optimalSettings = {
  sampleRate: 44100,    // High quality sampling
  numberOfChannels: 1,   // Mono (sufficient for speech)
  bitRate: 128000,      // Good quality encoding
  format: 'M4A'         // Widely supported format
};
```

## 💡 Advanced Troubleshooting

### Enable Verbose Logging
```python
# In backend llm.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Test with Known Good Audio
Create a test endpoint that processes a known good audio file:
```python
@app.get("/test-transcription/")
async def test_transcription():
    # Load a known good audio file and test transcription
    pass
```

### Monitor Network Traffic
Use browser dev tools or network monitoring to inspect:
- Request payload size
- Response time
- Error codes
- Content-Type headers

## 📞 When to Contact Support

If you've tried all troubleshooting steps and the issue persists:

1. **Gather Information**:
   - Platform (iOS/Android/Web)
   - Device model and OS version
   - Audio file details (format, size, duration)
   - Complete error messages
   - Network environment

2. **Create Reproduction Steps**:
   - Document exact steps to reproduce
   - Include sample audio file if possible
   - Note any workarounds

3. **Check Known Issues**:
   - Review GitHub issues
   - Check API provider status (Groq, Gemini)
   - Verify dependency versions

## 🎉 Success Indicators

You'll know voice recognition is working when:
- ✅ VoiceDebugger shows successful transcription
- ✅ Backend logs show "Transcription successful"
- ✅ Frontend receives proper transcribed text
- ✅ End-to-end flow works consistently
- ✅ No error messages in console/logs

Remember: Voice recognition can be affected by many factors. Use the debugging tools we've provided to systematically identify and resolve issues.