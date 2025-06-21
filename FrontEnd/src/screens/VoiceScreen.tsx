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
import { AudioManager } from "../utils/audioManager";
import { BACKEND_URL } from "../config";
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
    fileName?: string;
  } | null>(null);

  // State to hold the transcript received from the server for the user's speech
  const [userSpokenText, setUserSpokenText] = useState<string | null>(null);
  const [partialTranscript, setPartialTranscript] = useState<string>("");

  const {
    isListening, // This now reflects expo-av recording state
    hasAudioRecordingPermission,
    toggle, // Renamed from start/stopListening pair for simplicity if preferred
    speak,
    // recordedAudioUri, // Available if needed for display
  } = useSpeechRecognition({
    onError: (error) => {
      console.error("Audio Hook Error:", error);
      setRecordingStatus(`Error: ${error}. Tap to try again.`);
      dispatch({ type: "SET_RECORDING", payload: false });
      setIsLoading(false);
    },
    onPartialTranscript: (text) => {
      setPartialTranscript(text);
    },
    onAudioRecorded: async (audioInfo) => {
      setPartialTranscript(""); // Clear partial transcript when full audio is recorded
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
      // Extract filename from URI for display
      const fileName = audioInfo.uri ? audioInfo.uri.split('/').pop() || 'Unknown' : 'Unknown';
      
      setLastRecordedAudioInfo({
        uri: audioInfo.uri,
        base64Length: audioInfo.base64.length,
        mimeType: audioInfo.mimeType,
        fileName: fileName,
      });
      setUserSpokenText(null); // Clear previous user spoken text

      // --- START: New logic as per request ---
      // Save the recorded audio file locally
      try {
        const savedUri = await AudioManager.saveAudio(audioInfo.uri, fileName);
        console.log(`Audio saved locally at: ${savedUri}`);
        
        // Update the info with the new permanent URI if needed
        setLastRecordedAudioInfo(prev => prev ? { ...prev, uri: savedUri } : {
          uri: savedUri,
          base64Length: audioInfo.base64.length,
          mimeType: audioInfo.mimeType,
          fileName: fileName,
        });

      } catch (error) {
        console.error("Failed to save audio locally:", error);
      }

      const endpoint = `${BACKEND_URL}/upload-audio/`;

      setIsLoading(true);
      setRecordingStatus("Uploading recorded audio...");

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fileName: fileName,
            audio_base64: audioInfo.base64,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        if (!response.body) {
          throw new Error("Response body is null");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep the last partial line

          for (const line of lines) {
            if (line.trim() === "") continue;
            try {
              const jsonData = JSON.parse(line);
              console.log("Streamed data:", jsonData);

              // Update UI based on streamed status
              if (jsonData.status) {
                setRecordingStatus(jsonData.message || `Status: ${jsonData.status}`);
              }

              if (jsonData.status === "transcribed") {
                setUserSpokenText(jsonData.user_text);
                const userMessage = createMessage(jsonData.user_text, "user");
                dispatch({ type: "ADD_MESSAGE", payload: userMessage });
              }

              if (jsonData.status === "questions_pending") {
                const aiMessage = createMessage(jsonData.questions, "ai");
                dispatch({ type: "ADD_MESSAGE", payload: aiMessage });
                speak(jsonData.questions);
                navigation.navigate("Chat");
              }

              if (jsonData.status === "complete") {
                const aiMessage = createMessage(jsonData.final_response_text, "ai");
                dispatch({ type: "ADD_MESSAGE", payload: aiMessage });
                speak(jsonData.final_response_text);
                navigation.navigate("Chat");
              }
              
              if (jsonData.status === "error") {
                throw new Error(jsonData.error);
              }

            } catch (e: any) {
              console.error("Error parsing streamed JSON:", e.message);
            }
          }
        }
      } catch (error: any) {
        console.error("Audio Upload/Stream Error:", error.message);
        setRecordingStatus(`Error: ${error.message}`);
        Alert.alert("Stream Error", `Failed to process audio stream: ${error.message}`);
      } finally {
        setIsLoading(false);
        dispatch({ type: "SET_RECORDING", payload: false });
        setRecordingStatus("Tap to speak");
      }
      // --- END: New logic ---

      /* --- START: Commenting out old logic ---
      // Prepare JSON data for your backend (matching your expected format)
      const previousQuestionFromState =
        state.messages.filter((msg) => msg.sender === "ai").pop()?.text ||
        "Give me the patient Name, Age, Gender and Symptoms";
      const userInfoFromState = { name: "John Doe", email: "abc@xyz.com" };

      const serverPayload = {
        audio_bytes: audioInfo.base64,
        previous_question: previousQuestionFromState,
        user_info: userInfoFromState,
      };

      console.log(
        "Prepared payload for /process-response:",
        JSON.stringify(serverPayload).substring(0, 200) + "..."
      );

      // Backend URL - ensure consistency with updated hook
      const YOUR_BACKEND_BASE_URL = "http://192.168.204.73:8000";
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
      --- END: Commenting out old logic --- */
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
      isLoading
    );
    if (isLoading) {
      console.log("Mic press ignored, currently loading API response.");
      return; // Don't toggle if already processing a request
    }

    // The `toggle` function from the hook now handles starting/stopping the expo-av recording.
    // The `isListening` state from the hook will change, and the useEffect above will update UI.
    toggle();
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

      // Backend URL for text processing - use same URL as voice processing
      const textEndpoint = `${BACKEND_URL}/process-text/`;

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

  const navigateToAudioFiles = () => {
    // @ts-ignore - AudioFiles screen will be added to navigation
    navigation.navigate('AudioFiles');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <MaterialIcon name="android" size={24} color="#FFFFFF" />
          </View>
        </View>
        <Text style={styles.headerTitle}>Med-Conscious</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={navigateToAudioFiles}
          >
            <MaterialIcon
              name="folder"
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate("Settings")}
          >
            <MaterialIcon name="settings" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.microphoneSection}>
          <MicrophoneButton
            isRecording={isListening} // Reflects actual recording state from the hook
            onPress={handleMicPress}
            size={120}
            disabled={
              isLoading ||
              (hasAudioRecordingPermission === false && Platform.OS !== "web")
            }
          />
          {/* Show partial transcript while listening */}
          {isListening && partialTranscript && (
            <View style={styles.transcriptContainer}>
              <Text style={styles.transcriptLabel}>Listening:</Text>
              <Text style={styles.transcriptText}>"{partialTranscript}"</Text>
            </View>
          )}

          <Text style={styles.recordingStatus}>
            {isLoading ? "Processing..." : recordingStatus}
          </Text>

          {/* Display user's spoken text after server processing */}
          {userSpokenText && !isListening && !isLoading && (
            <View style={styles.transcriptContainer}>
              <Text style={styles.transcriptLabel}>You said:</Text>
              <Text style={styles.transcriptText}>"{userSpokenText}"</Text>
            </View>
          )}

          {lastRecordedAudioInfo && lastRecordedAudioInfo.uri && (
            <View style={styles.audioInfoContainer}>
              <Text style={styles.audioInfoLabel}>Last recording saved:</Text>
              <Text style={styles.audioInfoText}>
                {lastRecordedAudioInfo.fileName}
              </Text>
              <Text style={styles.audioInfoText}>
                Type: {lastRecordedAudioInfo.mimeType || "N/A"} • Size: {AudioManager.formatFileSize(lastRecordedAudioInfo.base64Length)}
              </Text>
              <TouchableOpacity
                style={styles.viewFilesButton}
                onPress={navigateToAudioFiles}
              >
                <MaterialIcon name="folder-open" size={16} color="#007AFF" />
                <Text style={styles.viewFilesText}>View All Recordings</Text>
              </TouchableOpacity>
            </View>
          )}

          {hasAudioRecordingPermission === false && Platform.OS !== "web" && (
            <Text style={styles.permissionWarning}>
              Audio recording permission required. Please enable in settings.
            </Text>
          )}
        </View>

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
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
    justifyContent: 'flex-end',
  },
  headerButton: {
    marginLeft: 8,
    padding: 4,
  },
  viewFilesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#1E1E1E',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  viewFilesText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 20, // Added padding at bottom
  },
  microphoneSection: {
    alignItems: "center",
    marginBottom: 20, // Adjusted marginBottom
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
});
