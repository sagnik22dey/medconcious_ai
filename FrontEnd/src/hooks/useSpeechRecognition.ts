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
    setIsListening(true); // Update UI state to reflect recording immediately
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

      // Create recording with optimized settings for speech recognition
      console.log("Creating Audio.Recording instance...");
      const recordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.MEDIUM,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        web: {
          mimeType: 'audio/webm;codecs=opus',
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
        
        const startedStatus = await recording.getStatusAsync();
        console.log("Recording status after startAsync:", startedStatus);
        
        if (!startedStatus.isRecording) {
          throw new Error("Recording failed to start - status after startAsync indicates not recording");
        }
        console.log("expo-av audio recording started successfully via startAsync.");
      }
      
      isRecordingRef.current = true;
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
      const recordingsDir = FileSystem.documentDirectory + "recordings/";
      const dirInfo = await FileSystem.getInfoAsync(recordingsDir);
      if (!dirInfo.exists) {
        console.log("Creating recordings directory:", recordingsDir);
        await FileSystem.makeDirectoryAsync(recordingsDir, {
          intermediates: true,
        });
      }

      const fileName = `recording-${Date.now()}.m4a`;
      const newUri = recordingsDir + fileName;

      console.log(`Moving recorded audio from ${uri} to ${newUri}`);
      await FileSystem.moveAsync({
        from: uri,
        to: newUri,
      });

      console.log(
        `Processing recorded audio file for base64 conversion: ${newUri}`
      );
      const fileInfo = await FileSystem.getInfoAsync(newUri);
      if (!fileInfo || !fileInfo.exists) {
        console.error(
          "Recorded audio file does not exist or info not available:",
          newUri
        );
        onError?.("Recorded audio file not found.");
        return;
      }

      const base64 = await FileSystem.readAsStringAsync(newUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      let mimeType = "audio/m4a"; // Default to m4a

      console.log(
        `Audio recorded and converted to base64. Length: ${base64.length}, URI: ${newUri}, MIME Type: ${mimeType}`
      );
      onAudioRecorded?.({ base64, uri: newUri, mimeType });
      setRecordedAudioUri(newUri);
    } catch (error: any) {
      console.error(
        "Error processing audio recording (base64 conversion and saving):",
        error
      );
      onError?.(`Failed to process audio recording: ${error.message}`);
    }
  };

  const stopListening = async () => {
    setIsListening(false); // Update UI state to stop recording immediately
    if (!isRecordingRef.current || !recordingRef.current) {
      console.log("Not recording or recordingRef is unexpectedly null.");
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
