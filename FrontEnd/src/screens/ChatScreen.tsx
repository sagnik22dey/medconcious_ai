import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcon } from "../components/MaterialIcon";
import { ChatBubble, TypingIndicator } from "../components/ChatBubble";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useTextToSpeech } from "../hooks/useTextToSpeech";
import { useAppContext } from "../context/AppContext";
import {
  createMessage,
} from "../utils/aiResponses";
import { ChatMessage } from "../types";
import { AudioManager } from "../utils/audioManager";
import { BACKEND_URL } from "../config";
import { Audio } from 'expo-av';

// Define the base URL for your backend API
const API_BASE_URL = "http://192.168.204.73:8000"; // Assuming backend runs on port 8000

export function ChatScreen() {
  const navigation = useNavigation();
  const { state, dispatch } = useAppContext();
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState("Tap to speak");
  const [lastAiQuestionText, setLastAiQuestionText] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const playAudioFromBase64 = async (base64String: string) => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${base64String}` },
        { shouldPlay: true }
      );

      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.isLoaded && status.didJustFinish) {
          await sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error("Failed to play audio:", error);
      Alert.alert("Playback Error", "Failed to play audio response.");
    }
  };

  const { speak, stop, isMessageSpeaking } = useTextToSpeech();

  const { isListening, toggle } = useSpeechRecognition({
    onAudioRecorded: async (audioInfo) => {
      if (!audioInfo.base64 || !audioInfo.uri) {
        console.warn("Audio recorded but data is missing.");
        setRecordingStatus("Error: Failed to capture audio.");
        setIsLoading(false);
        dispatch({ type: "SET_RECORDING", payload: false }); // Ensure context state is updated
        return;
      }

      const fileName = audioInfo.uri ? audioInfo.uri.split('/').pop() || 'Unknown' : 'Unknown';
      
      try {
        const savedUri = await AudioManager.saveAudio(audioInfo.uri, fileName);
        console.log(`Audio saved locally at: ${savedUri}`);
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

              if (jsonData.status) {
                setRecordingStatus(jsonData.message || `Status: ${jsonData.status}`);
              }

              if (jsonData.status === "transcribed") {
                const userMessage = createMessage(jsonData.user_text, "user");
                dispatch({ type: "ADD_MESSAGE", payload: userMessage });
              }

              if (jsonData.status === "questions_pending") {
                const aiMessage = createMessage(jsonData.questions, "ai");
                dispatch({ type: "ADD_MESSAGE", payload: aiMessage });
                speak(jsonData.questions, aiMessage.id);
              }

              if (jsonData.status === "complete") {
                const aiMessage = createMessage(jsonData.final_response_text, "ai");
                dispatch({ type: "ADD_MESSAGE", payload: aiMessage });
                speak(jsonData.final_response_text, aiMessage.id);
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
    },
    onError: (error) => {
      console.error("Speech recognition error:", error);
      dispatch({ type: "SET_CHAT_RECORDING", payload: false });
      const errMessage = createMessage("Error during voice recording. Please try again.", "ai");
      dispatch({ type: "ADD_MESSAGE", payload: errMessage });
      speak(errMessage.text, errMessage.id);
    },
  });

  useEffect(() => {
    dispatch({ type: "SET_CHAT_RECORDING", payload: isListening });
  }, [isListening]);

  useEffect(() => {
    if (state.messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [state.messages, isTyping]);

  useEffect(() => {
    const initiateChat = async () => {
      if (state.messages.length === 0 && !isTyping) {
        setIsTyping(true);
        try {
          const userInfoPayload = {
            User_Info: {
              name: "John Doe",
              email: "john.doe@example.com",
            },
          };

          const response = await fetch(`${API_BASE_URL}/initiate-chat/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userInfoPayload),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error ${response.status}`);
          }

          const data = await response.json();
          // data: { message, text (greeting), audio_bytes }
          
          if (data.text) {
            let initialText: string;
            if (Array.isArray(data.text)) {
              initialText = data.text.join(" ");
            } else if (typeof data.text === 'string') {
              initialText = data.text;
            } else {
              // Fallback for other types, or if data.text might be null/undefined unexpectedly
              initialText = data.text ? String(data.text) : "";
            }

            const initialAiMessage = createMessage(initialText, "ai");
            dispatch({ type: "ADD_MESSAGE", payload: initialAiMessage });
            setLastAiQuestionText(initialText); // Store AI's first question/greeting

            // Play audio from backend if available
            if (data.audio_bytes) {
              playAudioFromBase64(data.audio_bytes);
            } else {
              // Fallback to frontend TTS if no audio is sent
              speak(initialText, initialAiMessage.id, { pitch: 0.9, rate: 0.8 });
            }
          }
        } catch (error: any) {
          console.error("Failed to initiate chat:", error);
          const errorMessageText = error.message || "Could not connect to start the chat.";
          const errorMessage = createMessage(`Error: ${errorMessageText}`, "ai");
          dispatch({ type: "ADD_MESSAGE", payload: errorMessage });
          speak(errorMessage.text, errorMessage.id);
        } finally {
          setIsTyping(false);
        }
      }
    };

    initiateChat();
  }, []); // Runs once on mount

  const sendTextMessage = async (messageText: string) => {
    setIsTyping(true);
    try {
      const userMessage = createMessage(messageText, "user");
      dispatch({ type: "ADD_MESSAGE", payload: userMessage });
      setInputText("");

      const previousQuestionFromState =
        state.messages.filter((msg) => msg.sender === "ai").pop()?.text ||
        "Give me the patient Name, Age, Gender and Symptoms";
      const userInfoFromState = { name: "John Doe", email: "abc@xyz.com" };

      const textEndpoint = `${BACKEND_URL}/process-text/`;

      const payload = {
        user_text: messageText,
        previous_question: previousQuestionFromState,
        user_info: userInfoFromState,
      };

      const response = await fetch(textEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
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

            if (jsonData.status === "questions_pending") {
              const aiMessage = createMessage(jsonData.questions, "ai");
              dispatch({ type: "ADD_MESSAGE", payload: aiMessage });
              speak(jsonData.questions, aiMessage.id);
            }

            if (jsonData.status === "complete") {
              const aiMessage = createMessage(jsonData.final_response_text, "ai");
              dispatch({ type: "ADD_MESSAGE", payload: aiMessage });
              speak(jsonData.final_response_text, aiMessage.id);
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
      console.error("Error processing text message:", error.message);
      const errorMessage = createMessage(`Error: ${error.message}`, "ai");
      dispatch({ type: "ADD_MESSAGE", payload: errorMessage });
      speak(errorMessage.text, errorMessage.id);
    } finally {
      setIsTyping(false);
    }
  };

  const sendMessage = (text: string = inputText) => {
    const messageContent = text.trim();
    if (!messageContent) return;
    sendTextMessage(messageContent);
  };

  const handleMicPress = () => {
    if (isLoading) {
      return;
    }
    toggle();
  };

  const handleSpeakMessage = (text: string, messageId: string) => {
    const message = state.messages.find((msg) => msg.id === messageId);
    if (message) {
      const options =
        message.sender === "user"
          ? { pitch: 1.1, rate: 0.9 }
          : { pitch: 0.9, rate: 0.8 };
      speak(text, messageId, options);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <ChatBubble
      message={item}
      onSpeakMessage={handleSpeakMessage}
      isMessageSpeaking={isMessageSpeaking}
      onStopMessage={stop} // Pass the stop function
    />
  );

  const renderHeader = () => (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeAvatar}>
        {/* <MaterialIcon name="android" size={32} color="#FFFFFF" /> */}
        <Image
          source={require("../../assets/Med-logo1.jpeg")}
          style={styles.avatarImage}
        />
      </View>

      <Text style={styles.welcomeTitle}>Med-Conscious AI</Text>
      <Text style={styles.welcomeSubtitle}>
        Welcome to Med-Conscious Chat! Ask me anything about your health or get
        advice on medical topics. I'm here to help you stay informed and
        conscious about your well-being.
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!isTyping) return null;
    return <TypingIndicator />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcon name="arrow-back-ios" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Med-Conscious Chat</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <FlatList
          ref={flatListRef}
          style={styles.messagesList}
          data={state.messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesContainer}
        />

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder={
                isLoading ? "Processing..." : (state.isChatRecording
                  ? "Listening..."
                  : "Type or say something...")
              }
              placeholderTextColor="#ababab"
              multiline
              maxLength={500}
              onSubmitEditing={() => sendMessage()}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[
                styles.micButton,
                state.isChatRecording && styles.micButtonActive,
              ]}
              onPress={handleMicPress}
              disabled={isLoading}
            >
              <MaterialIcon
                name="mic"
                size={20}
                color={state.isChatRecording ? "#dc2626" : "#ababab"}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={() => sendMessage()}
            disabled={!inputText.trim()}
          >
            <MaterialIcon name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 35,
    borderBottomWidth: 1,
    borderBottomColor: "#303030",
  },
  backButton: {
    width: 40,
    height: 40,
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
  },
  content: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    paddingBottom: 20,
  },
  welcomeContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  welcomeAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#505050",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: "#ababab",
    textAlign: "center",
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#141414",
    alignItems: "flex-end",
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#303030",
    borderRadius: 24,
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#FFFFFF",
    maxHeight: 100,
    paddingVertical: 8,
  },
  micButton: {
    padding: 8,
    marginLeft: 8,
  },
  micButtonActive: {
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    borderRadius: 20,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#505050",
  },
  avatarImage: {
    width: 50, // Set the desired width for your image
    height: 50, // Set the desired height for your image
    borderRadius: 25, // Make it circular
  },
});
