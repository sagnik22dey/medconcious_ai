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
  generateAIResponse,
  createMessage,
  getTypingDuration,
} from "../utils/aiResponses";
import { ChatMessage } from "../types";

export function ChatScreen() {
  const navigation = useNavigation();
  const { state, dispatch } = useAppContext();
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const { speak, isMessageSpeaking } = useTextToSpeech();

  const { isListening, toggle } = useSpeechRecognition({
    onAudioRecorded: (audioData) => {
      // In chat mode, we would process the audio differently
      // For now, let's use a placeholder text since this needs server integration
      const transcriptText = "Speech recognized"; // This would come from server processing
      setInputText(transcriptText);
      sendMessage(transcriptText);
    },
    onError: (error) => {
      console.error("Speech recognition error:", error);
      dispatch({ type: "SET_CHAT_RECORDING", payload: false });
    },
  });

  useEffect(() => {
    dispatch({ type: "SET_CHAT_RECORDING", payload: isListening });
  }, [isListening]);

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (state.messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [state.messages, isTyping]);

  const sendMessage = (text: string = inputText) => {
    const message = text.trim();
    if (!message) return;

    // Add user message
    const userMessage = createMessage(message, "user");
    dispatch({ type: "ADD_MESSAGE", payload: userMessage });

    // Speak user message
    speak(message, userMessage.id, { pitch: 1.1, rate: 0.9 });

    // Clear input
    setInputText("");

    // Show typing indicator
    setIsTyping(true);

    // Generate AI response after delay
    setTimeout(() => {
      setIsTyping(false);
      const aiResponse = generateAIResponse(message);
      const aiMessage = createMessage(aiResponse, "ai");
      dispatch({ type: "ADD_MESSAGE", payload: aiMessage });

      // Speak AI response with a slight delay
      setTimeout(() => {
        speak(aiResponse, aiMessage.id, { pitch: 0.9, rate: 0.8 });
      }, 500);
    }, getTypingDuration());
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
