import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MaterialIcon } from "../components/MaterialIcon";
import { MicrophoneButton } from "../components/MicrophoneButton";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useAppContext } from "../context/AppContext";
import { createMessage } from "../utils/aiResponses";
import type { MainTabParamList, RootStackParamList } from "../types";

type VoiceScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Voice'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function VoiceScreen() {
  const navigation = useNavigation<VoiceScreenNavigationProp>();
  const { state, dispatch } = useAppContext();
  const [recordingStatus, setRecordingStatus] = useState("Tap to speak");
  const [isLoading, setIsLoading] = useState(false); // For API loading state

  const [lastRecordedAudioInfo, setLastRecordedAudioInfo] = useState<{
    uri: string | null;
    base64Length: number;
    mimeType?: string;
  } | null>(null);

  // State to hold the transcript received from the server for the user's speech
  const [userSpokenText, setUserSpokenText] = useState<string | null>(null);

  const {
    isListening, // This now reflects expo-av recording state
    isPlaying, // True when playing back recorded audio
    hasAudioRecordingPermission,
    toggle, // Renamed from start/stopListening pair for simplicity if preferred
    speak,
    playRecordedAudio, // Function to play back recorded audio
    stopPlayback, // Function to stop audio playback
    recordedAudioUri, // Available for display and playback
  } = useSpeechRecognition({
    onError: (error) => {
      console.error("Audio Hook Error:", error);
      setRecordingStatus(`Error: ${error}. Tap to try again.`);
      dispatch({ type: "SET_RECORDING", payload: false });
      setIsLoading(false);
    },
    onAudioRecorded: async (audioInfo) => {
      if (!audioInfo.base64 || !audioInfo.uri) {
        console.warn("Audio recorded but data is missing.");
        setRecordingStatus("Error: Failed to capture audio.");
        setIsLoading(false);
        dispatch({ type: "SET_RECORDING", payload: false }); // Ensure context state is updated
        return;
      }

      console.log("Audio recorded successfully in VoiceScreen:", {
        uri: audioInfo.uri,
        mimeType: audioInfo.mimeType,
        base64Length: audioInfo.base64.length,
      });
      setLastRecordedAudioInfo({
        uri: audioInfo.uri,
        base64Length: audioInfo.base64.length,
        mimeType: audioInfo.mimeType,
      });
      setUserSpokenText(null); // Clear previous user spoken text

      // Automatically play the recorded audio after a brief delay
      setTimeout(() => {
        if (audioInfo.uri) {
          setRecordingStatus("Playing your recording...");
          playRecordedAudio(audioInfo.uri);
        }
      }, 1000);

      // Prepare JSON data for your backend
      const previousQuestionFromState =
        state.messages.filter((msg) => msg.sender === "ai").pop()?.text ||
        "Give me the patient Name, Age, Gender and Symptoms";
      const userInfoFromState = { name: "John Doe", email: "john.doe@example.com" }; // Standardized email

      const serverPayload = {
        audio_bytes: audioInfo.base64,
        audio_format: audioInfo.mimeType || 'audio/m4a',
        previous_question: previousQuestionFromState,
        user_info: userInfoFromState,
      };

      console.log(
        "Prepared payload for /process-response:",
        JSON.stringify(serverPayload).substring(0, 200) + "..."
      );

      // Backend URL - using localhost for development
      const YOUR_BACKEND_BASE_URL = Platform.OS === 'android'
        ? "http://192.168.153.125:8000"  // Android emulator localhost
        : "http://192.168.153.125:8000"; // iOS simulator and web
      const endpoint = `${YOUR_BACKEND_BASE_URL}/process-response/`;

      setIsLoading(true);
      setRecordingStatus("Sending to server...");

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(serverPayload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Server error response text:", errorText);
          throw new Error(
            `Server error: ${response.status} - ${errorText.substring(0, 100)}`
          );
        }

        const responseData = await response.json();
        console.log("Server response from /process-response:", responseData);

        // User's transcribed text from server
        const userTranscriptFromServer =
          responseData.user_text || "Your speech (processed)";
        setUserSpokenText(userTranscriptFromServer); // Store it

        // Add user message to chat
        const userMessage = createMessage(userTranscriptFromServer, "user");
        dispatch({ type: "ADD_MESSAGE", payload: userMessage });

        // AI's response (question)
        if (responseData.questions) {
          const aiResponseMessage = createMessage(responseData.questions, "ai");
          dispatch({ type: "ADD_MESSAGE", payload: aiResponseMessage });
          speak(responseData.questions); // Speak AI's question
        }

        // Navigate to chat screen
        navigation.navigate("Chat");

        // Playback AI's audio response if provided
        if (responseData.audio_bytes) {
          console.log("AI audio (base64) received, attempting playback...");
          // TODO: Implement playback of the received base64 audio using expo-speech or expo-av
          // For expo-speech (if it's just text to be spoken by AI voice):
          // speak(responseData.questions); // Already done above if questions is the text
          // For expo-av (if server sends actual audio bytes for AI voice):
          // const soundObject = new Audio.Sound();
          // try {
          //   await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
          //   await soundObject.loadAsync({ uri: `data:audio/wav;base64,${responseData.audio_bytes}` }); // Adjust MIME type if not WAV
          //   await soundObject.playAsync();
          // } catch (e) { console.error("Failed to play AI audio response", e); }
        }

        setRecordingStatus("Response received. Tap to speak.");
      } catch (error: any) {
        console.error("Network/Server Error:", error.message);
        setRecordingStatus(`Error: ${error.message.substring(0, 50)}...`);
        Alert.alert(
          "Server Error",
          `Failed to process audio: ${error.message}`
        );
      } finally {
        setIsLoading(false);
        dispatch({ type: "SET_RECORDING", payload: false }); // Ensure recording state in context is false
      }
    },
    onPlaybackFinished: () => {
      console.log("Audio playback finished");
      setRecordingStatus("Playback finished. Tap to speak.");
    },
  });

  // Effect to update recording status based on hook's isListening state
  useEffect(() => {
    if (isListening) {
      setRecordingStatus("Listening... Speak now");
      dispatch({ type: "SET_RECORDING", payload: true });
      setLastRecordedAudioInfo(null); // Clear previous audio info when new recording starts
      setUserSpokenText(null); // Clear previous user spoken text
    } else {
      // Only set to "Tap to speak" if not loading (i.e., not waiting for server)
      if (!isLoading) {
        setRecordingStatus("Tap to speak");
      }
      dispatch({ type: "SET_RECORDING", payload: false });
    }
  }, [isListening, isLoading, dispatch]);

  const handleMicPress = () => {
    console.log(
      "Mic pressed. Current isListening (from hook):",
      isListening,
      "isLoading:",
      isLoading,
      "isPlaying:",
      isPlaying
    );
    if (isLoading || isPlaying) {
      console.log("Mic press ignored, currently loading API response or playing audio.");
      return; // Don't toggle if already processing a request or playing audio
    }

    // The `toggle` function from the hook now handles starting/stopping the expo-av recording.
    // The `isListening` state from the hook will change, and the useEffect above will update UI.
    toggle();
  };

  const handlePlayRecording = () => {
    if (isPlaying) {
      stopPlayback();
      setRecordingStatus("Playback stopped. Tap to speak.");
    } else if (recordedAudioUri || lastRecordedAudioInfo?.uri) {
      setRecordingStatus("Playing recorded audio...");
      playRecordedAudio(lastRecordedAudioInfo?.uri || recordedAudioUri || undefined);
    }
  };

  // Handle "Try Saying" suggestions by sending them to the server as text
  const handleSuggestionPress = async (suggestionText: string) => {
    if (isLoading) return;

    setRecordingStatus("Processing suggestion...");
    setIsLoading(true);

    try {
      // Add user message from suggestion
      const userMessage = createMessage(suggestionText, "user");
      dispatch({ type: "ADD_MESSAGE", payload: userMessage });

      // Prepare data for text processing endpoint
      const previousQuestionFromState =
        state.messages.filter((msg) => msg.sender === "ai").pop()?.text ||
        "Give me the patient Name, Age, Gender and Symptoms";
      const userInfoFromState = { name: "John Doe", email: "abc@xyz.com" };

      // Backend URL for text processing
      const YOUR_BACKEND_BASE_URL = Platform.OS === 'android'
        ? "http://10.0.2.2:8000"
        : "http://localhost:8000";
      const textEndpoint = `${YOUR_BACKEND_BASE_URL}/process-text/`;

      const payload = {
        user_text: suggestionText,
        previous_question: previousQuestionFromState,
        user_info: userInfoFromState,
      };

      console.log("Sending text suggestion to server:", payload);

      const response = await fetch(textEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const responseData = await response.json();
      console.log("Server response for suggestion:", responseData);

      // Add AI response
      if (responseData.questions) {
        const aiResponseMessage = createMessage(responseData.questions, "ai");
        dispatch({ type: "ADD_MESSAGE", payload: aiResponseMessage });
        speak(responseData.questions);
      }

      // Navigate to chat screen
      navigation.navigate("Chat");

      setRecordingStatus("Suggestion processed. Tap to speak.");
    } catch (error: any) {
      console.error("Error processing suggestion:", error.message);
      Alert.alert(
        "Suggestion Error",
        `Failed to process suggestion: ${error.message}`
      );
      setRecordingStatus("Error processing suggestion. Tap to speak.");
    } finally {
      setIsLoading(false);
    }
  };

  const suggestions = [
    "I have a headache, what should I do?",
    "What are the symptoms of flu?",
    "How can I improve my sleep?",
    "What foods are good for heart health?",
    "I feel stressed, any advice?",
    "How much water should I drink daily?",
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <MaterialIcon name="android" size={24} color="#FFFFFF" />
          </View>
        </View>
        <Text style={styles.headerTitle}>Med-Conscious</Text>
        <TouchableOpacity
          style={styles.headerRight}
          onPress={() => navigation.navigate("Settings")}
        >
          <MaterialIcon name="settings" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.scrollContentWrapper}>
          {/* Display user's spoken text after server processing */}
          {userSpokenText && !isListening && !isLoading && (
            <View style={styles.transcriptContainer}>
              <Text style={styles.transcriptLabel}>You said:</Text>
              <Text style={styles.transcriptText}>"{userSpokenText}"</Text>
            </View>
          )}

          {lastRecordedAudioInfo && lastRecordedAudioInfo.uri && (
            <View style={styles.audioInfoContainer}>
              <Text style={styles.audioInfoLabel}>Last recording:</Text>
              <Text style={styles.audioInfoText}>
                Type: {lastRecordedAudioInfo.mimeType || "N/A"}, Size:{" "}
                {(lastRecordedAudioInfo.base64Length / 1024).toFixed(1)} KB
              </Text>
              <TouchableOpacity
                style={[
                  styles.playButton,
                  isPlaying && styles.playButtonActive,
                ]}
                onPress={handlePlayRecording}
                disabled={isLoading || isListening}
              >
                <MaterialIcon
                  name={isPlaying ? "stop" : "play-arrow"}
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.playButtonText}>
                  {isPlaying ? "Stop Playback" : "Play Recording"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {hasAudioRecordingPermission === false && Platform.OS !== "web" && (
            <Text style={styles.permissionWarning}>
              Audio recording permission required. Please enable in settings.
            </Text>
          )}

          <View style={styles.suggestionsSection}>
            <Text style={styles.suggestionsTitle}>Try saying...</Text>
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionItem}
                onPress={() => handleSuggestionPress(suggestion)}
                disabled={isLoading}
              >
                <Text style={styles.suggestionText}>"{suggestion}"</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomMicrophoneContainer}>
        <MicrophoneButton
          isRecording={isListening} // Reflects actual recording state from the hook
          onPress={handleMicPress}
          size={120}
          disabled={
            isLoading ||
            isPlaying ||
            (hasAudioRecordingPermission === false && Platform.OS !== "web")
          }
        />
        <Text style={styles.recordingStatus}>
          {isLoading ? "Processing..." : recordingStatus}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#141414",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === "android" ? 25 : 35, // Adjusted for Android status bar
    borderBottomWidth: 1,
    borderBottomColor: "#303030",
  },
  headerLeft: {
    width: 40,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#505050",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  headerRight: {
    width: 40,
    alignItems: "flex-end",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: "flex-start", // Changed to flex-start
    paddingHorizontal: 20,
    paddingBottom: 150, // Added padding at bottom to accommodate bottom mic button
  },
  scrollContentWrapper: { // New style for content inside ScrollView
    alignItems: "center",
    paddingTop: 20, // Add some top padding
  },
  recordingStatus: {
    fontSize: 16,
    color: "#FFFFFF",
    marginTop: 20,
    textAlign: "center",
    minHeight: 20, // Ensure space for status text
  },
  transcriptContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    maxWidth: "90%",
  },
  transcriptLabel: {
    fontSize: 12,
    color: "#ababab",
    marginBottom: 3,
    textAlign: "center",
  },
  transcriptText: {
    fontSize: 14,
    color: "#FFFFFF",
    fontStyle: "italic",
    textAlign: "center",
  },
  audioInfoContainer: {
    marginTop: 10,
    padding: 8,
    backgroundColor: "#2c2c2c",
    borderRadius: 8,
    maxWidth: "90%",
    alignItems: "center",
  },
  audioInfoLabel: {
    fontSize: 11,
    color: "#c0c0c0",
    marginBottom: 2,
  },
  audioInfoText: {
    fontSize: 12,
    color: "#e0e0e0",
    textAlign: "center",
  },
  permissionWarning: {
    fontSize: 14,
    color: "#ff6b6b",
    marginTop: 15,
    textAlign: "center",
    fontWeight: "500",
    paddingHorizontal: 10,
  },
  suggestionsSection: {
    alignItems: "center",
    marginTop: 20, // Adjusted marginTop
  },
  suggestionsTitle: {
    fontSize: 16,
    color: "#ababab",
    marginBottom: 15, // Adjusted marginBottom
    textAlign: "center",
  },
  suggestionItem: {
    backgroundColor: "#303030",
    paddingHorizontal: 15, // Adjusted padding
    paddingVertical: 10, // Adjusted padding
    borderRadius: 20,
    marginBottom: 10, // Adjusted marginBottom
    minWidth: 220, // Adjusted minWidth
    maxWidth: "90%",
  },
  suggestionText: {
    fontSize: 14,
    color: "#FFFFFF",
    textAlign: "center",
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
    minWidth: 120,
  },
  playButtonActive: {
    backgroundColor: "#dc2626",
  },
  playButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 5,
  },
  bottomMicrophoneContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 20, // Padding from the very bottom of the screen
    backgroundColor: '#141414', // Match container background
  },
});
