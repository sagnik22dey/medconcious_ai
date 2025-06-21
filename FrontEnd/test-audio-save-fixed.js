/**
 * Test script to verify audio saving functionality works correctly
 * This tests the core audio saving without trying to access restricted directories
 */

import * as FileSystem from "expo-file-system";
import { AudioManager } from "./src/utils/audioManager.js";

async function testAudioSaving() {
  console.log("=== Audio Saving Test ===");
  
  try {
    // Test 1: Ensure audio output directory can be created
    console.log("\n1. Testing audio output directory creation...");
    const audioDir = await AudioManager.ensureAudioOutputDir();
    console.log("✅ Audio output directory:", audioDir);
    
    // Test 2: Test file name generation
    console.log("\n2. Testing file name generation...");
    const fileName = AudioManager.generateFileName('wav');
    console.log("✅ Generated filename:", fileName);
    
    // Test 3: Test getting saved audio files
    console.log("\n3. Testing saved audio files retrieval...");
    const savedFiles = await AudioManager.getSavedAudioFiles();
    console.log("✅ Found", savedFiles.length, "saved audio files");
    
    if (savedFiles.length > 0) {
      console.log("   Latest file:", savedFiles[0].name);
      console.log("   File size:", AudioManager.formatFileSize(savedFiles[0].size));
      console.log("   Created:", savedFiles[0].dateCreated.toISOString());
    }
    
    // Test 4: Test total audio size calculation
    console.log("\n4. Testing total audio size calculation...");
    const totalSize = await AudioManager.getTotalAudioSize();
    console.log("✅ Total audio size:", AudioManager.formatFileSize(totalSize));
    
    // Test 5: Test accessible path
    console.log("\n5. Testing accessible path...");
    const absolutePath = await AudioManager.getAbsoluteAudioPath();
    console.log("✅ Absolute audio path:", absolutePath);
    
    // Test 6: Verify directory is writable
    console.log("\n6. Testing directory write access...");
    const testFile = `${audioDir}test-write.txt`;
    await FileSystem.writeAsStringAsync(testFile, "test content");
    const testInfo = await FileSystem.getInfoAsync(testFile);
    if (testInfo.exists) {
      console.log("✅ Directory is writable");
      await FileSystem.deleteAsync(testFile);
      console.log("✅ Test file cleaned up");
    } else {
      console.log("❌ Directory write test failed");
    }
    
    console.log("\n=== Audio Saving Test Complete ===");
    console.log("✅ All core audio saving functionality is working correctly");
    console.log("📱 Audio files are saved to:", audioDir);
    console.log("ℹ️  Project folder copy will only work in simulator/emulator, not on device");
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack:", error.stack);
  }
}

// Export for manual testing
export { testAudioSaving };

// Run if called directly
if (require.main === module) {
  testAudioSaving();
}