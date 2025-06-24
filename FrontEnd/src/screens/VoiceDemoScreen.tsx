import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { VoiceRecordPlayback } from '../components/VoiceRecordPlayback';

export function VoiceDemoScreen() {
  const handleRecordingComplete = (audioData: {
    base64: string;
    uri: string | null;
    mimeType?: string;
  }) => {
    console.log('Recording completed in demo screen:', {
      uri: audioData.uri,
      mimeType: audioData.mimeType,
      base64Length: audioData.base64.length,
    });
    
    // Here you could send the audio data to a server, save it locally, etc.
    // For now, we just log it
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Voice Recording Demo</Text>
          <Text style={styles.headerSubtitle}>
            Record your voice and hear it played back immediately
          </Text>
        </View>

        <VoiceRecordPlayback onRecordingComplete={handleRecordingComplete} />

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Technical Details:</Text>
          <Text style={styles.footerText}>
            • Platform: {Platform.OS}{'\n'}
            • Uses Expo AV for recording on mobile{'\n'}
            • Automatic playback after recording{'\n'}
            • Supports multiple audio formats{'\n'}
            • Built-in permission handling
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#ababab',
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  footerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 20,
    textAlign: 'center',
  },
});