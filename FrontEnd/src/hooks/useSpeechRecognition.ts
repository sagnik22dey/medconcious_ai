import { useState, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Speech from "expo-speech";
import { AudioManager } from "../utils/audioManager";

interface UseAudioRecorderProps {
  onError?: (error: string) => void;
  onPartialTranscript?: (text: string) => void;
  onAudioRecorded?: (audioData: {
    base64: string;
    uri: string | null;
    mimeType?: string;
  }) => void;
}

export function useSpeechRecognition({
  onError,
  onPartialTranscript,
  onAudioRecorded,
}: UseAudioRecorderProps = {}) {
  const [isListening, setIsListening] = useState(false);
  const [hasAudioRecordingPermission, setHasAudioRecordingPermission] =
    useState<boolean | null>(null);
  const isRecordingRef = useRef(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [recordedAudioUri, setRecordedAudioUri] = useState<string | null>(null);

  useEffect(() => {
    requestAudioPermissions();

    return () => {
      if (isRecordingRef.current && recordingRef.current) {
        console.log("Cleaning up: stopping recording on unmount");
        recordingRef.current
          .stopAndUnloadAsync()
          .catch((e) =>
            console.error("Error stopping recording on unmount", e)
          );
        isRecordingRef.current = false;
        recordingRef.current = null;
      }
    };
  }, []);

  const requestAudioPermissions = async () => {
    console.log("Requesting audio recording permissions...");
    if (Platform.OS !== "web") {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
        
        const { status } = await Audio.requestPermissionsAsync();
        setHasAudioRecordingPermission(status === "granted");
        if (status !== "granted") {
          console.warn("Audio recording permission not granted.");
          onError?.(
            "Audio recording permission not granted. Please enable it in settings."
          );
        } else {
          console.log("Audio recording permission granted.");
        }
      } catch (e: any) {
        console.error(
          "Error requesting audio recording permissions:",
          e.message
        );
        setHasAudioRecordingPermission(false);
        onError?.(`Error requesting audio permissions: ${e.message}`);
      }
    } else {
      setHasAudioRecordingPermission(true);
      console.log(
        "Web platform: Audio recording permissions would be handled by browser."
      );
    }
  };

  const startListening = async () => {
    if (Platform.OS === "web") {
      onError?.(
        "Audio recording via expo-av is not supported on web in this hook."
      );
      return;
    }

    if (hasAudioRecordingPermission === null) {
      console.log(
        "Audio recording permissions not yet determined, requesting..."
      );
      await requestAudioPermissions();
      return;
    }

    if (!hasAudioRecordingPermission) {
      onError?.(
        "Audio recording permission not granted. Please enable it in settings."
      );
      return;
    }

    try {
      const { status } = await Audio.getPermissionsAsync();
      if (status !== 'granted') {
        console.log("Permissions changed, requesting again...");
        const { status: newStatus } = await Audio.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          onError?.("Audio permission is required for recording.");
          return;
        }
      }
    } catch (permError: any) {
      console.warn("Permission check failed:", permError.message);
    }

    if (recordingRef.current) {
      console.log(
        "startListening: Existing recordingRef.current found. Attempting to stop and unload."
      );
      try {
        await recordingRef.current.stopAndUnloadAsync();
        console.log(
          "startListening: Previous recording instance unloaded successfully."
        );
      } catch (e: any) {
        console.warn(
          `startListening: Error during stopAndUnloadAsync of existing recording: ${e.message}`
        );
      }
      recordingRef.current = null;
    }

    isRecordingRef.current = false;
    setIsListening(false);

    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      console.log("Starting high-quality WAV audio recording...");
      setRecordedAudioUri(null);

      // Set audio mode immediately before recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      // High-quality recording options for better speech recognition
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

      const { recording, status: createStatus } = await Audio.Recording.createAsync(recordingOptions);
      recordingRef.current = recording;
      console.log("High-quality WAV recording instance created:", createStatus);

      if (!createStatus.canRecord) {
        throw new Error("Recording instance cannot record - check permissions and audio mode");
      }

      if (!createStatus.isRecording) {
        console.log("Starting recording...");
        await recording.startAsync();
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const startedStatus = await recording.getStatusAsync();
        if (!startedStatus.isRecording) {
          throw new Error("Recording failed to start");
        }
        console.log("WAV recording started successfully");
      }
      
      isRecordingRef.current = true;
      setIsListening(true);
      
      onPartialTranscript?.("Listening...");
      
    } catch (error: any) {
      console.error("Error starting audio recording:", error);
      onError?.(`Failed to start audio recording: ${error.message}`);
      
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (cleanupError: any) {
          console.warn(`Cleanup failed: ${cleanupError.message}`);
        }
        recordingRef.current = null;
      }
      isRecordingRef.current = false;
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    if (!isRecordingRef.current || !recordingRef.current) {
      console.log("Not recording or recordingRef is unexpectedly null.");
      setIsListening(false);
      isRecordingRef.current = false;
      return;
    }
    console.log("Stopping WAV audio recording...");

    try {
      const status = await recordingRef.current.getStatusAsync();
      
      if (!status.canRecord || !status.isRecording) {
        console.warn("Recording is not in a recordable state:", status);
        onError?.("Recording was not active when trying to stop.");
        return;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      console.log("WAV recording stopped successfully. URI:", uri);

      if (uri) {
        await processAudioRecording(uri);
      } else {
        console.warn("No URI found after stopping recording.");
        onError?.("Failed to get audio file URI after stopping.");
      }
    } catch (error: any) {
      console.error("Error stopping WAV recording:", error);
      onError?.(`Failed to stop audio recording: ${error.message}`);
    } finally {
      recordingRef.current = null;
      isRecordingRef.current = false;
      setIsListening(false);
      console.log("WAV recording process fully stopped and resources released.");
    }
  };

  const processAudioRecording = async (uri: string) => {
    try {
      console.log(`Processing high-quality WAV audio file: ${uri}`);
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo || !fileInfo.exists) {
        console.error("Recorded audio file does not exist:", uri);
        onError?.("Recorded audio file not found.");
        return;
      }

      console.log(`WAV file size: ${AudioManager.formatFileSize(fileInfo.size || 0)}`);

      // Ensure audio output directory exists
      const audioOutputDir = await AudioManager.ensureAudioOutputDir();

      // Generate unique filename
      const savedFileName = AudioManager.generateFileName('wav');
      const savedFilePath = `${audioOutputDir}${savedFileName}`;

      // Copy the temporary recording to our permanent audio_output folder
      await FileSystem.copyAsync({
        from: uri,
        to: savedFilePath,
      });

      console.log(`Audio file saved to: ${savedFilePath}`);

      // Read the saved file as base64
      const base64 = await FileSystem.readAsStringAsync(savedFilePath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const mimeType = "audio/wav";
      console.log(`WAV audio converted to base64. Length: ${base64.length} characters`);
      console.log(`Estimated audio duration: ${(fileInfo.size / 176400).toFixed(1)}s`); // Rough estimate for 44.1kHz mono WAV
      console.log(`Audio saved as: ${savedFileName}`);
      
      // Return the saved file path instead of temporary path
      onAudioRecorded?.({ base64, uri: savedFilePath, mimeType });
      setRecordedAudioUri(savedFilePath);

      // Try to copy to project folder for development (this will only work in simulator/emulator)
      // This operation will silently fail on actual devices which is expected behavior
      await AudioManager.copyToProjectFolder(savedFilePath, savedFileName);

      // Clean up temporary file
      try {
        await FileSystem.deleteAsync(uri);
        console.log("Temporary audio file cleaned up");
      } catch (cleanupError: any) {
        console.warn("Failed to clean up temporary file:", cleanupError.message);
      }
    } catch (error: any) {
      console.error("Error processing WAV audio recording:", error);
      onError?.(`Failed to process audio recording: ${error.message}`);
    }
  };

  const speak = async (text: string) => {
    try {
      await Speech.speak(text, {
        language: "en-US",
        pitch: 1.0,
        rate: 0.8,
      });
    } catch (error: any) {
      console.error("Error speaking text (TTS):", error);
      onError?.(`TTS failed: ${error.message}`);
    }
  };

  const toggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return {
    isListening,
    hasAudioRecordingPermission,
    recordedAudioUri,
    startListening,
    stopListening,
    toggle,
    speak,
  };
}
