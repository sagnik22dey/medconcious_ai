import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { MaterialIcon } from './MaterialIcon';
import { AudioManager, SavedAudioFile } from '../utils/audioManager';

interface SavedAudioListProps {
  onAudioSelect?: (audioFile: SavedAudioFile) => void;
  maxItems?: number;
  showHeader?: boolean;
}

export function SavedAudioList({
  onAudioSelect,
  maxItems,
  showHeader = true,
}: SavedAudioListProps) {
  const [audioFiles, setAudioFiles] = useState<SavedAudioFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalSize, setTotalSize] = useState(0);

  const loadAudioFiles = async () => {
    setLoading(true);
    try {
      const files = await AudioManager.getSavedAudioFiles();
      const limitedFiles = maxItems ? files.slice(0, maxItems) : files;
      setAudioFiles(limitedFiles);
      
      const size = await AudioManager.getTotalAudioSize();
      setTotalSize(size);
    } catch (error: any) {
      console.error('Error loading audio files:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudioFiles();
  }, [maxItems]);

  const handleDeleteFile = async (audioFile: SavedAudioFile) => {
    Alert.alert(
      'Delete Recording',
      `Are you sure you want to delete "${audioFile.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await AudioManager.deleteAudioFile(audioFile.path);
            if (success) {
              await loadAudioFiles(); // Refresh the list
            } else {
              Alert.alert('Error', 'Failed to delete the audio file.');
            }
          },
        },
      ]
    );
  };

  const handleShareFile = async (audioFile: SavedAudioFile) => {
    const success = await AudioManager.shareAudioFile(audioFile.path);
    if (!success) {
      Alert.alert('Share Error', 'Unable to share the audio file.');
    }
  };

  const handleFileOptions = (audioFile: SavedAudioFile) => {
    Alert.alert(
      audioFile.name,
      `Size: ${AudioManager.formatFileSize(audioFile.size)}\nCreated: ${audioFile.dateCreated.toLocaleString()}\n\nWhat would you like to do?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share/Export',
          onPress: () => handleShareFile(audioFile),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteFile(audioFile),
        },
      ]
    );
  };

  const handleClearAll = async () => {
    if (audioFiles.length === 0) return;

    Alert.alert(
      'Clear All Recordings',
      `Are you sure you want to delete all ${audioFiles.length} recordings?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            const success = await AudioManager.clearAllAudioFiles();
            if (success) {
              await loadAudioFiles(); // Refresh the list
            } else {
              Alert.alert('Error', 'Failed to delete all audio files.');
            }
          },
        },
      ]
    );
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderAudioItem = ({ item }: { item: SavedAudioFile }) => (
    <TouchableOpacity
      style={styles.audioItem}
      onPress={() => onAudioSelect ? onAudioSelect(item) : handleFileOptions(item)}
    >
      <View style={styles.audioItemContent}>
        <View style={styles.audioIcon}>
          <MaterialIcon name="audiotrack" size={20} color="#007AFF" />
        </View>
        <View style={styles.audioInfo}>
          <Text style={styles.audioName} numberOfLines={1}>
            {item.name.replace(/^recording_/, '').replace(/\.wav$/, '')}
          </Text>
          <Text style={styles.audioDetails}>
            {AudioManager.formatFileSize(item.size)} • {formatDate(item.dateCreated)}
          </Text>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleShareFile(item)}
          >
            <MaterialIcon name="share" size={18} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteFile(item)}
          >
            <MaterialIcon name="delete" size={18} color="#ff6b6b" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (!showHeader && audioFiles.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Saved Recordings</Text>
            {audioFiles.length > 0 && (
              <Text style={styles.subtitle}>
                {audioFiles.length} recording{audioFiles.length !== 1 ? 's' : ''} • {AudioManager.formatFileSize(totalSize)}
              </Text>
            )}
          </View>
          {audioFiles.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
              <MaterialIcon name="delete-sweep" size={20} color="#ff6b6b" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {audioFiles.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcon name="mic-off" size={48} color="#666666" />
          <Text style={styles.emptyText}>No recordings yet</Text>
          <Text style={styles.emptySubtext}>Your audio recordings will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={audioFiles}
          renderItem={renderAudioItem}
          keyExtractor={(item) => item.path}
          style={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={loadAudioFiles}
              tintColor="#007AFF"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#303030',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#ABABAB',
  },
  clearButton: {
    padding: 8,
  },
  list: {
    flex: 1,
  },
  audioItem: {
    backgroundColor: '#2A2A2A',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  audioItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  audioIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  audioInfo: {
    flex: 1,
  },
  audioName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  audioDetails: {
    fontSize: 12,
    color: '#ABABAB',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#ABABAB',
    marginTop: 12,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
    textAlign: 'center',
  },
});