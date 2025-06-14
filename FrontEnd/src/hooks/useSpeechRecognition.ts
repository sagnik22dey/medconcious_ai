import { useState, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Speech from "expo-speech"; // Keep for Text-to-Speech (TTS)

interface UseAudioRecorderProps {
  onError?: (error: string) => void;
  onAudioRecorded?: (audioData: {
    base64: string;
    uri: string | null;
    mimeType?: string;
  }) => void;
}

// Consider renaming the hook to useAudioRecorder in the future if STT is fully removed from its responsibilities.
// For now, keeping useSpeechRecognition to minimize breaking changes in VoiceScreen immediately.
export function useSpeechRecognition({
  onError,
  onAudioRecorded,
}: UseAudioRecorderProps = {}) {
  const [isListening, setIsListening] = useState(false); // True when actively recording audio
  const [hasAudioRecordingPermission, setHasAudioRecordingPermission] =
    useState<boolean | null>(null);
  const isRecordingRef = useRef(false); // To track internal recording state reliably
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [recordedAudioUri, setRecordedAudioUri] = useState<string | null>(null);

  useEffect(() => {
    requestAudioPermissions();

    // Cleanup function to ensure recording is stopped on unmount
    return () => {
      if (isRecordingRef.current && recordingRef.current) {
        console.log("Cleaning up: stopping recording on unmount");
        recordingRef.current
          .stopAndUnloadAsync()
          .catch((e) =>
            console.error("Error stopping recording on unmount", e)
          );
        isRecordingRef.current = false; // Ensure ref is updated
        recordingRef.current = null; // Ensure ref is cleared
      }
    };
  }, []);

  const requestAudioPermissions = async () => {
    console.log("Requesting audio recording permissions (expo-av)...");
    if (Platform.OS !== "web") {
      try {
        // Initialize audio mode first
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
      // For web, MediaRecorder API would be used for audio recording.
      // This hook is now primarily for native expo-av.
      setHasAudioRecordingPermission(true); // Placeholder for web, not using expo-av here.
      console.log(
        "Web platform: Audio recording permissions would be handled by browser if MediaRecorder were used."
      );
    }
  };

  const startListening = async () => {
    // This function now solely starts audio recording
    if (Platform.OS === "web") {
      onError?.(
        "Audio recording via expo-av is not supported on web in this hook."
      );
      // Implement web audio recording (e.g., using MediaRecorder API) separately if needed.
      return;
    }

    if (hasAudioRecordingPermission === null) {
      console.log(
        "Audio recording permissions not yet determined, requesting..."
      );
      await requestAudioPermissions();
      // It's often better to let the user click again after permissions are granted
      // as the permission dialog can interrupt the flow.
      return;
    }

    if (!hasAudioRecordingPermission) {
      onError?.(
        "Audio recording permission not granted. Please enable it in settings."
      );
      return;
    }

    // Double-check permissions right before recording
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

    // Consolidated cleanup and state reset before attempting to start a new recording
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
      recordingRef.current = null; // Nullify the ref in any case
    }

    // Reset internal and UI recording state flags
    isRecordingRef.current = false;
    setIsListening(false); // Ensure UI is reset before attempting to start

    // Brief delay to allow system resources to potentially free up after any stop/unload.
    // This can be crucial for expo-av stability.
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      console.log("Starting audio recording (expo-av)...");
      setRecordedAudioUri(null); // Clear previous URI

      // Ensure audio mode is set before creating recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      // Create recording with simplified, more reliable options
      console.log("Creating Audio.Recording instance...");
      const recordingOptions = {
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT, // Attempt to get WAV output
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT, // Use default encoder
          sampleRate: 44100,
          numberOfChannels: 1,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM, // This is for WAV
          sampleRate: 44100,
          numberOfChannels: 1,
          audioQuality: Audio.IOSAudioQuality.MEDIUM, // Required by type, may be ignored for LINEARPCM
          bitRate: 128000, // Required by type, may be ignored for LINEARPCM
          linearPCMBitDepth: 16, // Specify bit depth for PCM
          linearPCMIsFloat: false, // Specify float for PCM
          linearPCMIsBigEndian: false, // Specify endianness for PCM
        },
        web: { // Web settings remain, though this hook focuses on native
          mimeType: 'audio/wav', // Consistent with WAV attempt
          bitsPerSecond: 128000,
        },
      };

      const { recording, status: createStatus } = await Audio.Recording.createAsync(recordingOptions);
      recordingRef.current = recording;
      console.log("Audio.Recording instance created. Initial status from createAsync:", createStatus);

      if (!createStatus.canRecord) {
        throw new Error("Recording instance cannot record (status from createAsync) - check permissions and audio mode");
      }

      if (createStatus.isRecording) {
        console.log("Recording already started by createAsync.");
      } else {
        console.log("Starting recording via startAsync()...");
        await recording.startAsync();
        
        // Small delay to ensure recording has actually started
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const startedStatus = await recording.getStatusAsync();
        console.log("Recording status after startAsync:", startedStatus);
        
        if (!startedStatus.isRecording) {
          throw new Error("Recording failed to start - status after startAsync indicates not recording");
        }
        console.log("expo-av audio recording started successfully via startAsync.");
      }
      
      isRecordingRef.current = true;
      setIsListening(true); // Update UI state to reflect recording
    } catch (error: any) {
      console.error("Error starting audio recording:", error);
      onError?.(`Failed to start audio recording: ${error.message}`);
      
      // Ensure full cleanup in case of error during start
      if (recordingRef.current) {
        try {
          console.log("Error handler: attempting to stop and unload recordingRef.");
          await recordingRef.current.stopAndUnloadAsync();
        } catch (cleanupError: any) {
          console.warn(`Error handler: cleanup stopAndUnloadAsync failed: ${cleanupError.message}`);
        }
        recordingRef.current = null;
      }
      isRecordingRef.current = false;
      setIsListening(false);
    }
  };

  const processAudioRecording = async (uri: string) => {
    try {
      console.log(
        `Processing recorded audio file for base64 conversion: ${uri}`
      );
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo || !fileInfo.exists) {
        console.error(
          "Recorded audio file does not exist or info not available:",
          uri
        );
        onError?.("Recorded audio file not found.");
        return;
      }

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      let mimeType = "application/octet-stream"; // Default
      if (uri.endsWith(".m4a")) mimeType = "audio/m4a";
      else if (uri.endsWith(".mp4")) mimeType = "audio/mp4";
      else if (uri.endsWith(".aac")) mimeType = "audio/aac";
      else if (uri.endsWith(".amr")) mimeType = "audio/amr";
      else if (uri.endsWith(".3gp")) mimeType = "audio/3gpp";
      else if (uri.endsWith(".wav")) mimeType = "audio/wav"; // If you manage to record WAV

      console.log(
        `Audio recorded and converted to base64. Length: ${base64.length}, URI: ${uri}, MIME Type: ${mimeType}`
      );
      onAudioRecorded?.({ base64, uri, mimeType });
      setRecordedAudioUri(uri);
    } catch (error: any) {
      console.error(
        "Error processing audio recording (base64 conversion):",
        error
      );
      onError?.(`Failed to process audio recording: ${error.message}`);
    }
  };

  const stopListening = async () => {
    if (!isRecordingRef.current || !recordingRef.current) {
      console.log("Not recording or recordingRef is unexpectedly null.");
      setIsListening(false);
      isRecordingRef.current = false;
      return;
    }
    console.log("Stopping audio recording (expo-av)...");

    try {
      // Get the recording status before stopping
      const status = await recordingRef.current.getStatusAsync();
      console.log("Recording status before stopping:", status);
      
      if (!status.canRecord || !status.isRecording) {
        console.warn("Recording is not in a recordable state:", status);
        onError?.("Recording was not active when trying to stop.");
        return;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI(); // Get URI after stopping
      console.log("expo-av recording stopped. URI:", uri);

      if (uri) {
        await processAudioRecording(uri); // Process after stopping and getting URI
      } else {
        console.warn("No URI found after stopping recording.");
        onError?.("Failed to get audio file URI after stopping.");
      }
    } catch (error: any) {
      console.error("Error stopping expo-av recording:", error);
      onError?.(`Failed to stop audio recording: ${error.message}`);
    } finally {
      recordingRef.current = null;
      isRecordingRef.current = false;
      setIsListening(false);
      console.log(
        "Audio recording process fully stopped and resources released."
      );
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
