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
// import { Audio } from 'expo-av';

// Define the base URL for your backend API
// const API_BASE_URL = "http://192.168.153.125:8000"; // Assuming backend runs on port 8000
const API_BASE_URL = "http://192.168.29.65:8000";


export function ChatScreen() {
  const navigation = useNavigation();
  const { state, dispatch } = useAppContext();
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [lastAiQuestionText, setLastAiQuestionText] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const { speak, stop, isMessageSpeaking } = useTextToSpeech();

  const { isListening, toggle } = useSpeechRecognition({
    onAudioRecorded: (audioData: { base64: string; uri: string | null; mimeType?: string }) => {
      const placeholderUiText = "Voice input captured, processing...";
      // Don't add to input text, directly send
      // setInputText(placeholderUiText);
      sendMessage(placeholderUiText, audioData.base64);
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

            // Speak AI response (using text, backend audio_bytes can be used if TTS hook supports it)
            setTimeout(() => {
              speak(initialText, initialAiMessage.id, { pitch: 0.9, rate: 0.8 });
            }, 500);
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

  const callProcessResponseAPI = async (
    userMessageText: string, // This is the original placeholder text or typed text
    audioBase64?: string,
    placeholderMessageId?: string | null // New parameter
  ) => {
    setIsTyping(true);
    try {
      const userInfoForPayload = {
        name: "John Doe",
        email: "john.doe@example.com",
      };

      const lastAiMessage = state.messages.filter((msg) => msg.sender === "ai").pop();
      const previousQuestionText = lastAiMessage?.text || "Initial interaction";

      const payload = {
        audio_bytes: audioBase64 || "",
        previous_question: previousQuestionText,
        user_info: userInfoForPayload,
      };

      const response = await fetch(`${API_BASE_URL}/process-response/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      // data can be:
      // 1. { message, user_text, questions, audio_bytes, status: "questions_pending" }
      // 2. { message, user_text, diagnosis_text, report_markdown, final_response_text, audio_bytes, status: "complete" }
      // 3. { error, status: "error" }

      // Update the placeholder user message with the actual transcript from the backend
      if (placeholderMessageId && data.user_text && typeof data.user_text === 'string' && data.user_text.trim() !== "") {
        dispatch({
          type: "UPDATE_MESSAGE_TEXT", // This action needs to be defined in AppContext
          payload: { id: placeholderMessageId, newText: data.user_text },
        });
      }

      if (data.status === "questions_pending") {
        let questionText: string;
        if (Array.isArray(data.questions)) {
          questionText = data.questions.join(" ");
        } else if (typeof data.questions === 'string') {
          questionText = data.questions;
        } else if (data.questions !== null && data.questions !== undefined) {
          questionText = String(data.questions);
        } else {
          questionText = ""; // Default for null/undefined
          console.warn("Received null or undefined for data.questions from backend.");
        }

        const aiQuestionMessage = createMessage(questionText, "ai");
        dispatch({ type: "ADD_MESSAGE", payload: aiQuestionMessage });
        setLastAiQuestionText(questionText);
        setTimeout(() => {
          speak(questionText, aiQuestionMessage.id, { pitch: 0.9, rate: 0.8 });
          // Potentially play data.audio_bytes if TTS hook supports base64
        }, 500);
      } else if (data.status === "complete") {
        let responseText: string;
        if (Array.isArray(data.final_response_text)) {
          responseText = data.final_response_text.join(" ");
        } else if (typeof data.final_response_text === 'string') {
          responseText = data.final_response_text;
        } else if (data.final_response_text !== null && data.final_response_text !== undefined) {
          responseText = String(data.final_response_text);
        } else {
          responseText = ""; // Default for null/undefined
          console.warn("Received null or undefined for data.final_response_text from backend.");
        }

        const aiSummaryMessage = createMessage(responseText, "ai");
        dispatch({ type: "ADD_MESSAGE", payload: aiSummaryMessage });
        
        // Assuming diagnosis_text and report_markdown are expected to be strings.
        // If they can also be arrays, similar handling would be needed.
        const diagnosisText = (typeof data.diagnosis_text === 'string') ? data.diagnosis_text : String(data.diagnosis_text || "");
        const reportMarkdown = (typeof data.report_markdown === 'string') ? data.report_markdown : String(data.report_markdown || "");

        const reportContent = `Diagnosis:\n${diagnosisText}\n\nMedical Report:\n${reportMarkdown}`;
        const reportMessage = createMessage(reportContent, "ai");
        dispatch({ type: "ADD_MESSAGE", payload: reportMessage });

        setLastAiQuestionText(null); // End of Q&A

        setTimeout(() => {
          speak(responseText, aiSummaryMessage.id, { pitch: 0.9, rate: 0.8 });
          // Potentially play data.audio_bytes
        }, 500);
        // Consider disabling input or showing "Consultation Ended"
      } else if (data.status === "error") {
        throw new Error(data.error || "An unknown error occurred while processing your response.");
      }

    } catch (error: any) {
      console.error("Error processing response:", error);
      const errorMessageText = error.message || "An unknown error occurred.";
      const errorMessage = createMessage(`Error: ${errorMessageText}`, "ai");
      dispatch({ type: "ADD_MESSAGE", payload: errorMessage });
      speak(errorMessage.text, errorMessage.id);
    } finally {
      setIsTyping(false);
    }
  };

  const sendMessage = async (text: string = inputText, audioBase64?: string) => {
    const messageContent = text.trim();
    // If audioBase64 is present, messageContent might be a placeholder like "Voice input captured..."
    // We still want to proceed if audio is available.
    if (!messageContent && !audioBase64) return;

    let placeholderMessageId: string | null = null;

    // Add user message to UI. If it's a voice placeholder, capture its ID.
    if (messageContent) {
        const userMessage = createMessage(messageContent, "user");
        dispatch({ type: "ADD_MESSAGE", payload: userMessage });
        // Check if this is the specific placeholder text for voice input
        if (audioBase64 && messageContent === "Voice input captured, processing...") {
            placeholderMessageId = userMessage.id;
        }
    }
    
    setInputText(""); // Clear input field

    // Call the API processing function, passing the ID if it's a placeholder
    await callProcessResponseAPI(messageContent, audioBase64, placeholderMessageId);
  };

  const handleMicPress = () => {
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
                state.isChatRecording
                  ? "Listening..."
                  : "Type or say something..."
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
