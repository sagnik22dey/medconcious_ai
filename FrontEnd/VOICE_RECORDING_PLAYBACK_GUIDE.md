# Voice Recording and Playback Implementation Guide

## Overview

The MedConscious AI frontend now includes comprehensive voice recording and playback functionality. Users can record their voice input and immediately hear it played back after recording is complete.

## Features

### ✅ Implemented Features

1. **Voice Recording**
   - Record audio using device microphone
   - Real-time recording status indicators
   - Automatic permission handling
   - Support for multiple audio formats (m4a, wav, webm, etc.)

2. **Audio Playback**
   - Automatic playback after recording completion
   - Manual playback controls
   - Play/pause/stop functionality
   - Visual feedback during playback

3. **Cross-Platform Support**
   - **React Native (iOS/Android)**: Uses Expo AV for recording and playback
   - **Web**: Uses MediaRecorder API and HTML5 Audio for recording and playback

4. **UI Components**
   - Animated microphone button with visual feedback
   - Recording status indicators
   - Play/stop controls
   - Audio information display (file size, format, etc.)

## File Structure

```
src/
├── components/
│   ├── VoiceRecordPlayback.tsx     # Main voice recording component
│   ├── MicrophoneButton.tsx        # Animated microphone button
│   └── index.ts                    # Component exports
├── hooks/
│   └── useSpeechRecognition.ts     # Voice recording logic
├── screens/
│   ├── VoiceScreen.tsx             # Main voice interface
│   └── VoiceDemoScreen.tsx         # Demo/testing screen
└── test-voice.html                 # Web testing interface
```

## Key Components

### 1. VoiceRecordPlayback Component

A self-contained component that provides complete voice recording and playback functionality.

```typescript
import { VoiceRecordPlayback } from '../components/VoiceRecordPlayback';

// Usage
<VoiceRecordPlayback 
  onRecordingComplete={(audioData) => {
    console.log('Audio recorded:', audioData);
    // Handle the recorded audio data
  }}
/>
```

**Features:**
- One-tap recording start/stop
- Automatic playback after recording
- Manual playback controls
- Recording information display
- Permission handling
- Error handling with user feedback

### 2. useSpeechRecognition Hook

Enhanced hook that handles both recording and playback functionality.

```typescript
const {
  isListening,           // Currently recording
  isPlaying,             // Currently playing audio
  recordedAudioUri,      // URI of last recorded audio
  toggle,                // Start/stop recording
  playRecordedAudio,     // Play recorded audio
  stopPlayback,          // Stop audio playback
  hasAudioRecordingPermission
} = useSpeechRecognition({
  onAudioRecorded: (audioData) => {
    // Handle recorded audio
  },
  onPlaybackFinished: () => {
    // Handle playback completion
  },
  onError: (error) => {
    // Handle errors
  }
});
```

### 3. Enhanced VoiceScreen

The main voice interface now includes:
- Automatic playback after recording
- Manual playback controls
- Enhanced status indicators
- Better error handling

## How It Works

### Recording Flow

1. **Permission Request**: App requests microphone permissions
2. **Recording Start**: User taps microphone button
3. **Audio Capture**: Device records audio using Expo AV (mobile) or MediaRecorder (web)
4. **Recording Stop**: User taps button again or timeout occurs
5. **Audio Processing**: Audio is converted to base64 and stored
6. **Automatic Playback**: Recorded audio plays back automatically after 1-2 seconds

### Playback Flow

1. **Audio Preparation**: Audio URI is prepared for playback
2. **Audio Loading**: Audio is loaded using Expo AV Sound or HTML5 Audio
3. **Playback Control**: User can play, pause, or stop playback
4. **Status Updates**: UI updates to reflect playback status

## Technical Implementation

### Mobile (React Native)

```typescript
// Recording with Expo AV
const { recording } = await Audio.Recording.createAsync(recordingOptions);
await recording.startAsync();

// Playback with Expo AV
const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
await sound.playAsync();
```

### Web (HTML5)

```javascript
// Recording with MediaRecorder
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const mediaRecorder = new MediaRecorder(stream);
mediaRecorder.start();

// Playback with HTML5 Audio
const audioElement = new Audio(audioUrl);
audioElement.play();
```

## Configuration

### Audio Recording Settings

**Mobile (Expo AV):**
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
  }
};
```

**Web (MediaRecorder):**
```javascript
const audioConstraints = {
  audio: {
    sampleRate: 44100,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  }
};
```

## Usage Examples

### Basic Usage

```typescript
import { VoiceRecordPlayback } from './components/VoiceRecordPlayback';

function MyComponent() {
  return (
    <VoiceRecordPlayback
      onRecordingComplete={(audioData) => {
        // Send to server, save locally, etc.
        console.log('Recorded audio:', audioData);
      }}
    />
  );
}
```

### Advanced Usage with Custom Hook

```typescript
import { useSpeechRecognition } from './hooks/useSpeechRecognition';

function CustomVoiceComponent() {
  const {
    isListening,
    isPlaying,
    toggle,
    playRecordedAudio,
    recordedAudioUri
  } = useSpeechRecognition({
    onAudioRecorded: (audioData) => {
      // Custom handling
      processAudioData(audioData);
    }
  });

  return (
    <View>
      <Button 
        title={isListening ? "Stop Recording" : "Start Recording"}
        onPress={toggle}
      />
      {recordedAudioUri && (
        <Button
          title={isPlaying ? "Stop Playback" : "Play Recording"}
          onPress={() => playRecordedAudio()}
        />
      )}
    </View>
  );
}
```

## Testing

### Web Testing
Open `test-voice.html` in a browser to test the web implementation:
```bash
# Serve the file (example with Python)
cd temp_medconcious_ai/FrontEnd
python -m http.server 8000
# Then open http://localhost:8000/test-voice.html
```

### Mobile Testing
Use the VoiceDemoScreen component:
```typescript
import { VoiceDemoScreen } from './screens/VoiceDemoScreen';
// Add to your navigation stack
```

## Troubleshooting

### Common Issues

1. **Permission Denied**
   - Ensure microphone permissions are granted
   - Check browser/device settings
   - Restart app after granting permissions

2. **Recording Fails**
   - Verify audio format support on device
   - Check available storage space
   - Ensure no other apps are using microphone

3. **Playback Issues**
   - Verify audio file was created successfully
   - Check audio format compatibility
   - Ensure device volume is not muted

### Error Handling

The implementation includes comprehensive error handling:
- Permission errors
- Recording failures
- Playback errors
- Format compatibility issues
- Network issues (if sending to server)

## Performance Considerations

- **Memory Management**: Audio files are properly disposed after use
- **Battery Usage**: Recording is optimized to minimize battery drain
- **Storage**: Temporary audio files are cleaned up automatically
- **Network**: Base64 encoding is used for server transmission

## Future Enhancements

Potential improvements could include:
- Audio compression before transmission
- Multiple audio format support
- Audio visualization during recording
- Cloud storage integration
- Speech-to-text integration
- Audio editing capabilities

## Dependencies

- **expo-av**: Audio recording and playback (React Native)
- **expo-file-system**: File operations
- **react-native**: Core framework
- **MediaRecorder API**: Web audio recording
- **HTML5 Audio**: Web audio playback

## Conclusion

The voice recording and playback functionality is now fully implemented and ready for use. The system provides a seamless user experience with automatic playback after recording, comprehensive error handling, and cross-platform compatibility.