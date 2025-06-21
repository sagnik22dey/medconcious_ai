import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import * as Sharing from "expo-sharing";

export interface SavedAudioFile {
  name: string;
  path: string;
  size: number;
  dateCreated: Date;
  mimeType: string;
}

export class AudioManager {
  // Use accessible directory paths
  private static get audioOutputDir(): string {
    // For both platforms, use the document directory which is accessible
    return `${FileSystem.documentDirectory}audio_output/`;
  }

  /**
   * Ensure the audio output directory exists
   */
  static async ensureAudioOutputDir(): Promise<string> {
    const dirPath = this.audioOutputDir;
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
      console.log("Created audio_output directory:", dirPath);
    }
    console.log("Audio output directory:", dirPath);
    return dirPath;
  }

  /**
   * Get all saved audio files
   */
  static async getSavedAudioFiles(): Promise<SavedAudioFile[]> {
    try {
      await this.ensureAudioOutputDir();
      const files = await FileSystem.readDirectoryAsync(this.audioOutputDir);
      
      const audioFiles: SavedAudioFile[] = [];
      
      for (const fileName of files) {
        if (fileName.endsWith('.wav') || fileName.endsWith('.mp3')) {
          const filePath = `${this.audioOutputDir}${fileName}`;
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          
          if (fileInfo.exists) {
            audioFiles.push({
              name: fileName,
              path: filePath,
              size: fileInfo.size || 0,
              dateCreated: new Date(fileInfo.modificationTime || Date.now()),
              mimeType: fileName.endsWith('.wav') ? 'audio/wav' : 'audio/mp3',
            });
          }
        }
      }
      
      // Sort by date created (newest first)
      return audioFiles.sort((a, b) => b.dateCreated.getTime() - a.dateCreated.getTime());
    } catch (error: any) {
      console.error("Error getting saved audio files:", error);
      return [];
    }
  }

  /**
   * Save an audio file from a temporary URI to a permanent location
   */
  static async saveAudio(tempUri: string, fileName: string): Promise<string> {
    try {
      const dir = await this.ensureAudioOutputDir();
      const newPath = `${dir}${fileName}`;
      
      await FileSystem.moveAsync({
        from: tempUri,
        to: newPath,
      });
      
      console.log(`Audio file moved from ${tempUri} to ${newPath}`);
      return newPath;
    } catch (error) {
      console.error(`Failed to save audio file: ${fileName}`, error);
      throw error; // Re-throw to be handled by the caller
    }
  }

  /**
   * Delete a saved audio file
   */
  static async deleteAudioFile(filePath: string): Promise<boolean> {
    try {
      await FileSystem.deleteAsync(filePath);
      console.log("Deleted audio file:", filePath);
      return true;
    } catch (error: any) {
      console.error("Error deleting audio file:", error);
      return false;
    }
  }

  /**
   * Get total size of all saved audio files
   */
  static async getTotalAudioSize(): Promise<number> {
    const files = await this.getSavedAudioFiles();
    return files.reduce((total, file) => total + file.size, 0);
  }

  /**
   * Clear all saved audio files
   */
  static async clearAllAudioFiles(): Promise<boolean> {
    try {
      const files = await this.getSavedAudioFiles();
      for (const file of files) {
        await this.deleteAudioFile(file.path);
      }
      console.log("Cleared all audio files");
      return true;
    } catch (error: any) {
      console.error("Error clearing audio files:", error);
      return false;
    }
  }

  /**
   * Generate a unique filename for a new recording
   */
  static generateFileName(extension: 'wav' | 'mp3' = 'wav'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    // Replace colons with a valid character for filenames
    const sanitizedTimestamp = timestamp.replace(/:/g, '_');
    return `recording_${sanitizedTimestamp}.${extension}`;
  }

  /**
   * Get the audio output directory path
   */
  static getAudioOutputDir(): string {
    return this.audioOutputDir;
  }

  /**
   * Share/Export an audio file so user can save it to desired location
   */
  static async shareAudioFile(filePath: string): Promise<boolean> {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'audio/wav',
          dialogTitle: 'Save Audio Recording',
        });
        return true;
      } else {
        console.log('Sharing is not available on this platform');
        return false;
      }
    } catch (error: any) {
      console.error('Error sharing audio file:', error);
      return false;
    }
  }

  /**
   * Get the absolute path where audio files are stored
   */
  static async getAbsoluteAudioPath(): Promise<string> {
    await this.ensureAudioOutputDir();
    return this.audioOutputDir;
  }

  /**
   * Copy an audio file to the project's Audio_output folder for development
   * This is for development/testing purposes only and will fail on device (which is expected)
   */
  static async copyToProjectFolder(filePath: string, fileName: string): Promise<boolean> {
    // Skip copy operation entirely on device - only attempt in simulator/emulator
    if (!__DEV__) {
      return false;
    }
    
    try {
      // Check if we're running on actual device vs simulator
      // On actual devices, this will always fail due to file system restrictions
      const testPath = `${FileSystem.documentDirectory}../../../`;
      const testInfo = await FileSystem.getInfoAsync(testPath);
      
      if (!testInfo.exists) {
        console.log("Project directory not accessible (running on device) - skipping copy");
        return false;
      }
      
      const projectAudioDir = `${testPath}FrontEnd/Audio_output/`;
      
      // Try to create the project directory
      try {
        await FileSystem.makeDirectoryAsync(projectAudioDir, { intermediates: true });
        console.log("Created project audio directory:", projectAudioDir);
      } catch (dirError) {
        console.log("Could not create project directory (this is normal on device)");
        return false;
      }
      
      const destPath = `${projectAudioDir}${fileName}`;
      await FileSystem.copyAsync({
        from: filePath,
        to: destPath,
      });
      
      console.log(`Successfully copied audio file to project folder: ${destPath}`);
      return true;
      
    } catch (error: any) {
      // This is expected on actual devices and should not be treated as an error
      console.log("Cannot copy to project folder (this is normal on device):", error.message);
      return false;
    }
  }

  /**
   * Format file size in human readable format
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}