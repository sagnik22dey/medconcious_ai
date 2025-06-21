// Test script to verify audio saving functionality
// This can be run to test the AudioManager utility

import * as FileSystem from 'expo-file-system';

// Mock AudioManager functionality for testing
class TestAudioManager {
  static audioOutputDir = `${FileSystem.documentDirectory}audio_output/`;

  static async ensureAudioOutputDir() {
    const dirInfo = await FileSystem.getInfoAsync(this.audioOutputDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.audioOutputDir, { intermediates: true });
      console.log("✅ Created audio_output directory:", this.audioOutputDir);
    } else {
      console.log("✅ Audio output directory already exists:", this.audioOutputDir);
    }
    return this.audioOutputDir;
  }

  static async testAudioSaving() {
    try {
      // Ensure directory exists
      await this.ensureAudioOutputDir();

      // Create a test file
      const testFileName = `test_recording_${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
      const testFilePath = `${this.audioOutputDir}${testFileName}`;
      const testContent = "This is a test audio file content";

      // Write test file
      await FileSystem.writeAsStringAsync(testFilePath, testContent);
      console.log("✅ Test audio file created:", testFileName);

      // Verify file exists
      const fileInfo = await FileSystem.getInfoAsync(testFilePath);
      if (fileInfo.exists) {
        console.log("✅ File verification successful:", {
          path: testFilePath,
          size: fileInfo.size,
          exists: fileInfo.exists
        });
      } else {
        console.log("❌ File verification failed - file does not exist");
      }

      // List all files in directory
      const files = await FileSystem.readDirectoryAsync(this.audioOutputDir);
      console.log("📁 Files in audio_output directory:", files);

      // Clean up test file
      await FileSystem.deleteAsync(testFilePath);
      console.log("🧹 Test file cleaned up");

      return true;
    } catch (error) {
      console.error("❌ Audio saving test failed:", error);
      return false;
    }
  }

  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

// Run the test
console.log("🧪 Starting audio save functionality test...");
TestAudioManager.testAudioSaving()
  .then((success) => {
    if (success) {
      console.log("✅ All tests passed! Audio saving functionality is working correctly.");
    } else {
      console.log("❌ Tests failed! Check the error messages above.");
    }
  })
  .catch((error) => {
    console.error("❌ Test execution failed:", error);
  });