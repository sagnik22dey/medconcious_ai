import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcon } from '../components/MaterialIcon';
import { SavedAudioList } from '../components/SavedAudioList';
import { AudioManager, SavedAudioFile } from '../utils/audioManager';

export function AudioFilesScreen() {
  const navigation = useNavigation();
  const [audioPath, setAudioPath] = useState<string>('');
  const [totalFiles, setTotalFiles] = useState<number>(0);
  const [totalSize, setTotalSize] = useState<number>(0);

  useEffect(() => {
    loadAudioInfo();
  }, []);

  const loadAudioInfo = async () => {
    try {
      const path = await AudioManager.getAbsoluteAudioPath();
      setAudioPath(path);

      const files = await AudioManager.getSavedAudioFiles();
      setTotalFiles(files.length);

      const size = await AudioManager.getTotalAudioSize();
      setTotalSize(size);
    } catch (error) {
      console.error('Error loading audio info:', error);
    }
  };

  const handleAudioSelect = async (audioFile: SavedAudioFile) => {
    Alert.alert(
      'Audio Recording',
      `File: ${audioFile.name}\nSize: ${AudioManager.formatFileSize(audioFile.size)}\nDate: ${audioFile.dateCreated.toLocaleString()}\n\nTap "Export" to save to your device or share with other apps.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: async () => {
            const success = await AudioManager.shareAudioFile(audioFile.path);
            if (success) {
              Alert.alert(
                'Export Successful',
                'The audio file has been exported. You can now save it to your desired location or share it with other apps.'
              );
            } else {
              Alert.alert('Export Failed', 'Unable to export the audio file.');
            }
          },
        },
      ]
    );
  };

  const showPathInfo = () => {
    Alert.alert(
      'Audio Storage Location',
      `Audio files are stored in the app's secure storage:\n\n${audioPath}\n\nTo access your recordings:\n1. Tap any recording to export it\n2. Choose "Save to Files" or share with other apps\n3. Save to your desired location\n\nThis ensures your recordings are secure and accessible.`,
      [{ text: 'OK' }]
    );
  };

  const exportAllFiles = async () => {
    const files = await AudioManager.getSavedAudioFiles();
    if (files.length === 0) {
      Alert.alert('No Files', 'No audio recordings to export.');
      return;
    }

    Alert.alert(
      'Export All Recordings',
      `Export all ${files.length} recordings? Each file will be shared individually.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export All',
          onPress: async () => {
            for (const file of files) {
              await AudioManager.shareAudioFile(file.path);
              // Small delay between exports
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcon name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Audio Recordings</Text>
        <TouchableOpacity
          style={styles.infoButton}
          onPress={showPathInfo}
        >
          <MaterialIcon name="info" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{totalFiles}</Text>
          <Text style={styles.statLabel}>Recordings</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{AudioManager.formatFileSize(totalSize)}</Text>
          <Text style={styles.statLabel}>Total Size</Text>
        </View>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statItem} onPress={exportAllFiles}>
          <MaterialIcon name="share" size={20} color="#007AFF" />
          <Text style={styles.statLabel}>Export All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
        <MaterialIcon name="info-outline" size={16} color="#FFA500" />
        <Text style={styles.infoText}>
          Tap any recording to export it to your device or share with other apps.
        </Text>
      </View>

      <View style={styles.listContainer}>
        <SavedAudioList 
          onAudioSelect={handleAudioSelect}
          showHeader={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#303030',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoButton: {
    marginLeft: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#ABABAB',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#303030',
    marginHorizontal: 10,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 12,
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FFA500',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 10,
    lineHeight: 20,
  },
  listContainer: {
    flex: 1,
    marginHorizontal: 16,
  },
});