import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcon } from './MaterialIcon';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface DebugInfo {
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  data?: any;
}

export function VoiceDebugger() {
  const [debugLogs, setDebugLogs] = useState<DebugInfo[]>([]);
  const [isTestingBackend, setIsTestingBackend] = useState(false);

  const addLog = (type: DebugInfo['type'], message: string, data?: any) => {
    const newLog: DebugInfo = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      data
    };
    setDebugLogs(prev => [newLog, ...prev].slice(0, 50)); // Keep last 50 logs
  };

  const {
    isListening,
    isPlaying,
    hasAudioRecordingPermission,
    recordedAudioUri,
    toggle,
    playRecordedAudio,
  } = useSpeechRecognition({
    onError: (error) => {
      addLog('error', `Recording Error: ${error}`);
    },
    onAudioRecorded: async (audioData) => {
      addLog('success', 'Audio recorded successfully', {
        uri: audioData.uri,
        mimeType: audioData.mimeType,
        base64Length: audioData.base64.length,
        sizeKB: (audioData.base64.length / 1024).toFixed(1)
      });

      // Test backend processing
      if (audioData.base64 && audioData.uri) {
        await testBackendProcessing(audioData);
      }
    },
    onPlaybackFinished: () => {
      addLog('info', 'Audio playback finished');
    },
  });

  const testBackendProcessing = async (audioData: { base64: string; uri: string | null; mimeType?: string }) => {
    setIsTestingBackend(true);
    addLog('info', 'Testing backend audio processing...');

    try {
      const payload = {
        audio_bytes: audioData.base64,
        audio_format: audioData.mimeType || 'audio/m4a',
        previous_question: 'Test question: Can you hear me?',
        user_info: {
          name: 'Debug User',
          email: 'debug@test.com'
        }
      };

      addLog('info', 'Sending audio to backend...', {
        payloadSize: JSON.stringify(payload).length,
        audioFormat: audioData.mimeType,
        base64Length: audioData.base64.length
      });

      const response = await fetch('http://192.168.153.125:8000/process-response/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        addLog('success', 'Backend processing successful!', {
          userText: result.user_text,
          status: result.status,
          hasQuestions: !!result.questions
        });

        if (result.user_text) {
          Alert.alert(
            'Voice Recognition Success!',
            `Transcribed: "${result.user_text}"`,
            [{ text: 'OK' }]
          );
        } else {
          addLog('warning', 'Backend processed but no transcription returned');
        }
      } else {
        const errorText = await response.text();
        addLog('error', `Backend error: ${response.status}`, { errorText });
        Alert.alert('Backend Error', `Status: ${response.status}\n${errorText}`);
      }
    } catch (error: any) {
      addLog('error', `Network error: ${error.message}`);
      Alert.alert('Network Error', error.message);
    } finally {
      setIsTestingBackend(false);
    }
  };

  const clearLogs = () => {
    setDebugLogs([]);
    addLog('info', 'Debug logs cleared');
  };

  const getLogIcon = (type: DebugInfo['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  const getLogStyle = (type: DebugInfo['type']) => {
    switch (type) {
      case 'success': return styles.successLog;
      case 'error': return styles.errorLog;
      case 'warning': return styles.warningLog;
      default: return styles.infoLog;
    }
  };

  const handleRecord = () => {
    if (isListening) {
      addLog('info', 'Stopping recording...');
    } else {
      addLog('info', 'Starting recording...');
      addLog('info', `Platform: ${Platform.OS}, Permissions: ${hasAudioRecordingPermission}`);
    }
    toggle();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Recognition Debugger</Text>
      
      {/* Status Info */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          📱 Platform: {Platform.OS}
        </Text>
        <Text style={styles.statusText}>
          🎤 Permissions: {hasAudioRecordingPermission ? '✅ Granted' : '❌ Denied'}
        </Text>
        <Text style={styles.statusText}>
          🔴 Recording: {isListening ? '✅ Active' : '⭕ Inactive'}
        </Text>
        <Text style={styles.statusText}>
          🔊 Playing: {isPlaying ? '✅ Active' : '⭕ Inactive'}
        </Text>
        <Text style={styles.statusText}>
          🌐 Backend Test: {isTestingBackend ? '🔄 Testing...' : '⭕ Ready'}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            isListening ? styles.recordingButton : styles.recordButton
          ]}
          onPress={handleRecord}
          disabled={hasAudioRecordingPermission === false}
        >
          <MaterialIcon
            name={isListening ? 'stop' : 'mic'}
            size={24}
            color="#FFFFFF"
          />
          <Text style={styles.buttonText}>
            {isListening ? 'Stop Recording' : 'Test Recording'}
          </Text>
        </TouchableOpacity>

        {recordedAudioUri && (
          <TouchableOpacity
            style={[styles.button, styles.playButton]}
            onPress={() => playRecordedAudio()}
            disabled={isPlaying}
          >
            <MaterialIcon
              name="play-arrow"
              size={24}
              color="#FFFFFF"
            />
            <Text style={styles.buttonText}>Play Last Recording</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearLogs}
        >
          <MaterialIcon
            name="clear"
            size={24}
            color="#FFFFFF"
          />
          <Text style={styles.buttonText}>Clear Logs</Text>
        </TouchableOpacity>
      </View>

      {/* Debug Logs */}
      <Text style={styles.logsTitle}>Debug Logs ({debugLogs.length})</Text>
      <ScrollView style={styles.logsContainer} showsVerticalScrollIndicator={false}>
        {debugLogs.map((log, index) => (
          <View key={index} style={[styles.logItem, getLogStyle(log.type)]}>
            <Text style={styles.logTimestamp}>{log.timestamp}</Text>
            <Text style={styles.logMessage}>
              {getLogIcon(log.type)} {log.message}
            </Text>
            {log.data && (
              <Text style={styles.logData}>
                {typeof log.data === 'object' 
                  ? JSON.stringify(log.data, null, 2) 
                  : String(log.data)
                }
              </Text>
            )}
          </View>
        ))}
        {debugLogs.length === 0 && (
          <Text style={styles.noLogsText}>No debug logs yet. Start recording to see logs.</Text>
        )}
      </ScrollView>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Debugging Steps:</Text>
        <Text style={styles.instructionsText}>
          1. Check permissions status above{'\n'}
          2. Record a short test phrase{'\n'}
          3. Check logs for errors{'\n'}
          4. Verify backend response{'\n'}
          5. Test audio playback
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#141414',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  statusContainer: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 4,
  },
  controlsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 16,
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 120,
  },
  recordButton: {
    backgroundColor: '#007AFF',
  },
  recordingButton: {
    backgroundColor: '#dc2626',
  },
  playButton: {
    backgroundColor: '#10b981',
  },
  clearButton: {
    backgroundColor: '#6b7280',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  logsContainer: {
    flex: 1,
    backgroundColor: '#1f1f1f',
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
  },
  logItem: {
    padding: 8,
    marginBottom: 4,
    borderRadius: 4,
    borderLeftWidth: 3,
  },
  successLog: {
    backgroundColor: '#065f46',
    borderLeftColor: '#10b981',
  },
  errorLog: {
    backgroundColor: '#7f1d1d',
    borderLeftColor: '#ef4444',
  },
  warningLog: {
    backgroundColor: '#78350f',
    borderLeftColor: '#f59e0b',
  },
  infoLog: {
    backgroundColor: '#1e3a8a',
    borderLeftColor: '#3b82f6',
  },
  logTimestamp: {
    color: '#9ca3af',
    fontSize: 10,
    marginBottom: 2,
  },
  logMessage: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  logData: {
    color: '#d1d5db',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 4,
    paddingLeft: 8,
  },
  noLogsText: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },
  instructionsContainer: {
    backgroundColor: '#374151',
    padding: 12,
    borderRadius: 8,
  },
  instructionsTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  instructionsText: {
    color: '#d1d5db',
    fontSize: 12,
    lineHeight: 16,
  },
});