/**
 * Test file to verify WAV audio recording and BASE64 conversion
 * Run this test to ensure audio recording works properly before backend integration
 */

import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

const testWAVRecording = async () => {
  console.log("🎤 Starting WAV Recording Test...");
  
  try {
    // Step 1: Request permissions
    console.log("📋 Requesting audio permissions...");
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
    
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Audio permission not granted");
    }
    console.log("✅ Audio permissions granted");

    // Step 2: Configure high-quality WAV recording
    console.log("⚙️ Configuring high-quality WAV recording...");
    const recordingOptions = {
      android: {
        extension: '.wav',
        outputFormat: Audio.AndroidOutputFormat.DEFAULT,
        audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
        sampleRate: 44100, // High-quality sample rate
        numberOfChannels: 1, // Mono for speech
        bitRate: 128000, // Higher bit rate for better quality
      },
      ios: {
        extension: '.wav',
        outputFormat: Audio.IOSOutputFormat.LINEARPCM,
        sampleRate: 44100, // High-quality sample rate
        numberOfChannels: 1, // Mono for speech
        audioQuality: Audio.IOSAudioQuality.HIGH,
        bitRate: 128000, // Higher bit rate for better quality
        linearPCMBitDepth: 16,
        linearPCMIsFloat: false,
        linearPCMIsBigEndian: false,
      },
      web: {
        mimeType: 'audio/wav',
        bitsPerSecond: 128000,
      },
    };

    // Step 3: Create and start recording
    console.log("🔴 Creating recording instance...");
    const { recording } = await Audio.Recording.createAsync(recordingOptions);
    
    console.log("🎵 Starting recording for 3 seconds...");
    console.log("📢 SAY: 'Hi I am testing the audio recording system'");
    
    // Record for 3 seconds
    setTimeout(async () => {
      try {
        console.log("⏹️ Stopping recording...");
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        
        if (!uri) {
          throw new Error("No URI found after stopping recording");
        }
        
        console.log("📁 Recording saved to:", uri);
        
        // Step 4: Check file info
        const fileInfo = await FileSystem.getInfoAsync(uri);
        console.log("📊 File info:", {
          exists: fileInfo.exists,
          size: `${(fileInfo.size / 1024).toFixed(1)} KB`,
          estimatedDuration: `${(fileInfo.size / 176400).toFixed(1)}s`
        });
        
        // Step 5: Convert to BASE64
        console.log("🔄 Converting to BASE64...");
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        console.log("✅ BASE64 conversion successful!");
        console.log("📏 BASE64 length:", base64.length, "characters");
        console.log("🎯 First 100 characters:", base64.substring(0, 100) + "...");
        
        // Step 6: Prepare JSON payload (same format as your backend expects)
        const payload = {
          audio_bytes: base64,
          previous_question: "Give me the patient Name, Age, Gender and Symptoms",
          user_info: { name: "Test User", email: "test@example.com" }
        };
        
        console.log("📦 JSON payload prepared:");
        console.log("- audio_bytes length:", payload.audio_bytes.length);
        console.log("- previous_question:", payload.previous_question);
        console.log("- user_info:", payload.user_info);
        
        console.log("🎉 WAV Recording Test COMPLETED SUCCESSFULLY!");
        console.log("📤 Ready to send to backend endpoint: /process-response/");
        
      } catch (stopError) {
        console.error("❌ Error stopping recording:", stopError);
      }
    }, 3000);
    
  } catch (error) {
    console.error("❌ WAV Recording Test FAILED:", error);
  }
};

// Export for use in your app
export { testWAVRecording };

// Usage instructions:
console.log(`
📝 WAV Recording Test Instructions:
1. Import this function in your component
2. Call testWAVRecording() to run the test
3. Check console logs for results
4. If successful, your audio will be recorded in high-quality WAV format and converted to BASE64

Example usage:
import { testWAVRecording } from './test-wav-recording';
// Then call: testWAVRecording();
`);