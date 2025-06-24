import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcon } from './MaterialIcon';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface VoiceRecordPlaybackProps {
  onRecordingComplete?: (audioData: { base64: string; uri: string | null; mimeType?: string }) => void;
}

export function VoiceRecordPlayback({ onRecordingComplete }: VoiceRecordPlaybackProps) {
  const [status, setStatus] = useState('Tap the microphone to start recording');
  const [lastRecordingInfo, setLastRecordingInfo] = useState<{
    uri: string | null;
    size: number;
    mimeType?: string;
  } | null>(null);

  const {
    isListening,
    isPlaying,
    hasAudioRecordingPermission,
    recordedAudioUri,
    toggle,
    playRecordedAudio,
    stopPlayback,
  } = useSpeechRecognition({
    onError: (error) => {
      console.error('Voice Recording Error:', error);
      setStatus(`Error: ${error}`);
      Alert.alert('Recording Error', error);
    },
    onAudioRecorded: (audioData) => {
      console.log('Audio recorded successfully:', {
        uri: audioData.uri,
        mimeType: audioData.mimeType,
        base64Length: audioData.base64.length,
      });
      
      setLastRecordingInfo({
        uri: audioData.uri,
        size: audioData.base64.length,
        mimeType: audioData.mimeType,
      });
      
      setStatus('Recording completed! Playing back in 2 seconds...');
      
      // Automatically play the recording after a brief delay
      setTimeout(() => {
        if (audioData.uri) {
          setStatus('Playing your recording...');
          playRecordedAudio(audioData.uri);
        }
      }, 2000);
      
      // Call the callback if provided
      onRecordingComplete?.(audioData);
    },
    onPlaybackFinished: () => {
      setStatus('Playback finished. Tap microphone to record again.');
    },
  });

  const handleMicPress = () => {
    if (isPlaying) {
      setStatus('Please wait for playback to finish...');
      return;
    }
    
    if (isListening) {
      setStatus('Stopping recording...');
    } else {
      setStatus('Starting recording... Speak now!');
      setLastRecordingInfo(null);
    }
    
    toggle();
  };

  const handlePlayPress = () => {
    if (!lastRecordingInfo?.uri && !recordedAudioUri) {
      Alert.alert('No Recording', 'Please record some audio first.');
      return;
    }

    if (isPlaying) {
      stopPlayback();
      setStatus('Playback stopped.');
    } else {
      setStatus('Playing recorded audio...');
      playRecordedAudio(lastRecordingInfo?.uri || recordedAudioUri || undefined);
    }
  };

  // Update status based on recording state
  React.useEffect(() => {
    if (isListening) {
      setStatus('Recording... Speak now!');
    } else if (!isPlaying && !isListening && status.includes('Recording...')) {
      setStatus('Processing recording...');
    }
  }, [isListening, isPlaying]);

  const getMicrophoneColor = () => {
    if (isListening) return '#dc2626'; // Red when recording
    if (isPlaying) return '#f59e0b'; // Orange when playing
    return '#007AFF'; // Blue default
  };

  const getMicrophoneIcon = () => {
    if (isListening) return 'stop';
    return 'mic';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Record & Playback</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      <View style={styles.controlsContainer}>
        {/* Microphone Button */}
        <TouchableOpacity
          style={[
            styles.microphoneButton,
            { backgroundColor: getMicrophoneColor() },
            (hasAudioRecordingPermission === false && Platform.OS !== 'web') && styles.disabledButton,
          ]}
          onPress={handleMicPress}
          disabled={hasAudioRecordingPermission === false && Platform.OS !== 'web'}
        >
          <MaterialIcon
            name={getMicrophoneIcon()}
            size={32}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        {/* Play Button */}
        {(lastRecordingInfo?.uri || recordedAudioUri) && (
          <TouchableOpacity
            style={[
              styles.playButton,
              { backgroundColor: isPlaying ? '#dc2626' : '#10b981' },
            ]}
            onPress={handlePlayPress}
          >
            <MaterialIcon
              name={isPlaying ? 'stop' : 'play-arrow'}
              size={24}
              color="#FFFFFF"
            />
            <Text style={styles.playButtonText}>
              {isPlaying ? 'Stop' : 'Play'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Recording Info */}
      {lastRecordingInfo && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Last Recording:</Text>
          <Text style={styles.infoText}>
            Format: {lastRecordingInfo.mimeType || 'Unknown'}
          </Text>
          <Text style={styles.infoText}>
            Size: {(lastRecordingInfo.size / 1024).toFixed(1)} KB
          </Text>
        </View>
      )}

      {/* Permission Warning */}
      {hasAudioRecordingPermission === false && Platform.OS !== 'web' && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>
            🎤 Microphone permission is required for recording.
            Please enable it in your device settings.
          </Text>
        </View>
      )}

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>How to use:</Text>
        <Text style={styles.instructionsText}>
          1. Tap the microphone to start recording{'\n'}
          2. Speak your message{'\n'}
          3. Tap again to stop recording{'\n'}
          4. Your recording will play back automatically{'\n'}
          5. Use the Play button to replay anytime
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  statusContainer: {
    backgroundColor: '#2a2a2a',
    padding: 15,
    borderRadius: 10,
    marginBottom: 30,
    minWidth: '80%',
    minHeight: 50,
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 20,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    gap: 20,
  },
  microphoneButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  playButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  infoContainer: {
    backgroundColor: '#333333',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    minWidth: '80%',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 5,
  },
  infoText: {
    fontSize: 12,
    color: '#ababab',
    marginBottom: 2,
  },
  warningContainer: {
    backgroundColor: '#7f1d1d',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    minWidth: '80%',
  },
  warningText: {
    fontSize: 14,
    color: '#fecaca',
    textAlign: 'center',
    lineHeight: 18,
  },
  instructionsContainer: {
    backgroundColor: '#1f2937',
    padding: 15,
    borderRadius: 10,
    minWidth: '80%',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 18,
  },
});