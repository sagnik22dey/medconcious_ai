import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Image,
} from "react-native";
import { MaterialIcon } from "./MaterialIcon";
import { ChatMessage } from "../types";

interface ChatBubbleProps {
  message: ChatMessage;
  onSpeakMessage?: (text: string, messageId: string) => void;
  isMessageSpeaking?: (messageId: string) => boolean;
}

export function ChatBubble({
  message,
  onSpeakMessage,
  isMessageSpeaking,
}: ChatBubbleProps) {
  const slideAnim = useRef(new Animated.Value(10)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const isUser = message.sender === "user";
  const isSpeaking = isMessageSpeaking ? isMessageSpeaking(message.id) : false;

  const handleSpeakPress = () => {
    if (onSpeakMessage) {
      onSpeakMessage(message.text, message.id);
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.aiContainer,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Image
            source={require("../../assets/bot-logo-med.jpeg")}
            style={styles.avatarImage}
          />
        </View>
      )}

      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessage : styles.aiMessage,
        ]}
      >
        <View style={styles.messageHeader}>
          <Text style={styles.senderName}>
            {isUser ? "You" : "AI Assistant"}
          </Text>
          <TouchableOpacity
            style={styles.speakerButton}
            onPress={handleSpeakPress}
          >
            <MaterialIcon
              name={isSpeaking ? "volume-up" : "volume-off"}
              size={16}
              color={isSpeaking ? "#007AFF" : "#ababab"}
            />
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.aiBubble,
            isSpeaking && styles.bubbleSpeaking,
          ]}
        >
          <Text style={styles.messageText}>{message.text}</Text>
        </View>
      </View>

      {isUser && (
        <View style={styles.userAvatar}>
          <MaterialIcon name="person" size={18} color="#FFFFFF" />
        </View>
      )}
    </Animated.View>
  );
}

export function TypingIndicator() {
  const dot1Anim = useRef(new Animated.Value(0.4)).current;
  const dot2Anim = useRef(new Animated.Value(0.4)).current;
  const dot3Anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animateDot = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 600,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.4,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateDot(dot1Anim, 0);
    animateDot(dot2Anim, 200);
    animateDot(dot3Anim, 400);

    return () => {
      dot1Anim.stopAnimation();
      dot2Anim.stopAnimation();
      dot3Anim.stopAnimation();
    };
  }, []);

  return (
    <View style={[styles.container, styles.aiContainer]}>
      <View style={styles.aiAvatar}>
        <MaterialIcon name="android" size={18} color="#FFFFFF" />
      </View>

      <View style={[styles.messageContainer, styles.aiMessage]}>
        <Text style={styles.senderName}>AI Assistant</Text>
        <View style={[styles.bubble, styles.aiBubble]}>
          <View style={styles.typingContainer}>
            <Animated.View style={[styles.typingDot, { opacity: dot1Anim }]} />
            <Animated.View style={[styles.typingDot, { opacity: dot2Anim }]} />
            <Animated.View style={[styles.typingDot, { opacity: dot3Anim }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginVertical: 8,
    paddingHorizontal: 16,
    alignItems: "flex-end",
  },
  userContainer: {
    justifyContent: "flex-end",
  },
  aiContainer: {
    justifyContent: "flex-start",
  },
  messageContainer: {
    flex: 1,
    maxWidth: "80%",
  },
  userMessage: {
    alignItems: "flex-end",
    marginRight: 8,
  },
  aiMessage: {
    alignItems: "flex-start",
    marginLeft: 8,
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  senderName: {
    fontSize: 12,
    color: "#ababab",
    fontWeight: "500",
    flex: 1,
  },
  speakerButton: {
    padding: 4,
    marginLeft: 8,
  },
  bubbleSpeaking: {
    borderWidth: 1,
    borderColor: "#007AFF",
    shadowColor: "#007AFF",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    maxWidth: "100%",
  },
  userBubble: {
    backgroundColor: "#007AFF",
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: "#303030",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#505050",
    alignItems: "center",
    justifyContent: "center",
  },
  typingContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 20,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
    marginHorizontal: 2,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
});
