import { useState, useCallback } from "react";
import * as Speech from "expo-speech";

export interface TextToSpeechOptions {
  language?: string;
  pitch?: number;
  rate?: number;
  voice?: string;
}

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

  const speak = useCallback(
    async (
      text: string,
      messageId?: string,
      options: TextToSpeechOptions = {}
    ) => {
      try {
        // Stop any current speech
        if (isSpeaking) {
          Speech.stop();
        }

        setIsSpeaking(true);
        setCurrentMessageId(messageId || null);

        const speechOptions = {
          language: options.language || "en",
          pitch: options.pitch || 1.0,
          rate: options.rate || 0.8,
          voice: options.voice,
          onDone: () => {
            setIsSpeaking(false);
            setCurrentMessageId(null);
          },
          onStopped: () => {
            setIsSpeaking(false);
            setCurrentMessageId(null);
          },
          onError: (error: any) => {
            console.error("TTS Error:", error);
            setIsSpeaking(false);
            setCurrentMessageId(null);
          },
        };

        await Speech.speak(text, speechOptions);
      } catch (error) {
        console.error("Failed to speak:", error);
        setIsSpeaking(false);
        setCurrentMessageId(null);
      }
    },
    [isSpeaking]
  );

  const stop = useCallback(() => {
    Speech.stop();
    setIsSpeaking(false);
    setCurrentMessageId(null);
  }, []);

  const isMessageSpeaking = useCallback(
    (messageId: string) => {
      return isSpeaking && currentMessageId === messageId;
    },
    [isSpeaking, currentMessageId]
  );

  return {
    speak,
    stop,
    isSpeaking,
    isMessageSpeaking,
    currentMessageId,
  };
}
