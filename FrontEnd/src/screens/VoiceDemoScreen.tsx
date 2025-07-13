import React, { useState, useEffect, useRef } from "react";
import axios from 'axios';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Audio } from 'expo-av';
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from '../types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MicrophoneButton } from "../components/MicrophoneButton";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useAppContext } from "../context/AppContext";
import { createMessage } from "../utils/aiResponses";

interface Question {
  text: string;
  audio: string;
}

type VoiceDemoScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Voice-Demo'>;

export const VoiceDemoScreen = ({ navigation }: { navigation: VoiceDemoScreenNavigationProp }) => {
  const { state, dispatch } = useAppContext();
  const [recordingStatus, setRecordingStatus] = useState("Tap to speak");
  const [isLoading, setIsLoading] = useState(false);
  const [aiSound, setAiSound] = useState<Audio.Sound | null>(null);
  const [isAiSoundPlaying, setIsAiSoundPlaying] = useState(false);
  const [activeAiMessageId, setActiveAiMessageId] = useState<string | null>(null);
  const [isChatInitialized, setIsChatInitialized] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [initialLaunch, setInitialLaunch] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  // New state variables for question/answer flow
  const [questions, setQuestions] = useState<Question[]>([]); // Stores questions with text and audio
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<(string | null)[]>([]); // Stores base64 audio of user answers
  const [initialPayload, setInitialPayload] = useState<any>(null); // Stores the full response from /initialize

  const [lastRecordedAudioInfo, setLastRecordedAudioInfo] = useState<{
    uri: string | null;
    base64Length: number;
    mimeType?: string;
  } | null>(null);

  const [userSpokenText, setUserSpokenText] = useState<string | null>(null);

  const {
    isListening,
    hasAudioRecordingPermission,
    toggle,
    speak,
    recordedAudioUri,
  } = useSpeechRecognition({
    onError: (error) => {
      console.error("Audio Hook Error:", error);
      setRecordingStatus(`Error: ${error}. Tap to try again.`);
      setIsLoading(false);
    },
    onAudioRecorded: async (audioInfo) => {
      if (!audioInfo.base64 || !audioInfo.uri) {
        console.warn("Audio recorded but data is missing.");
        setRecordingStatus("Error: Failed to capture audio.");
        setIsLoading(false);
        return;
      }

      console.log("Audio recorded successfully in VoiceDemoScreen:", {
        uri: audioInfo.uri,
        mimeType: audioInfo.mimeType,
        base64Length: audioInfo.base64.length,
      });
      setLastRecordedAudioInfo({
        uri: audioInfo.uri,
        base64Length: audioInfo.base64.length,
        mimeType: audioInfo.mimeType,
      });
      setUserSpokenText(null);

      setIsLoading(true);
      setRecordingStatus("Processing audio...");

      const YOUR_BACKEND_BASE_URL = Platform.OS === 'android'
        ? "http://192.168.29.226:8000"
        : "http://192.168.29.226:8000";

      try {
        if (!isChatInitialized) {
          // Initial call to /initialize
          const endpoint = `${YOUR_BACKEND_BASE_URL}/initialize`;
          const payload = { voice_data: audioInfo.base64 };

          const response = await axios.post(endpoint, payload, {
            headers: { "Content-Type": "application/json" },
          });

          const responseData = response.data;
          console.log("Server response from /initialize:", responseData);

          const initializeResponseData = responseData as {
            status: string;
            user_data?: any;
            questions?: Question[];
            message?: string;
          };

          if (initializeResponseData.status === 'success') {
            setUserData(initializeResponseData.user_data);
            setIsChatInitialized(true);
            setInitialPayload(initializeResponseData); // Store the entire payload for later modification

            const userMessage = createMessage("Initial information provided.", "user");
            dispatch({ type: "ADD_MESSAGE", payload: userMessage });

            if (initializeResponseData.questions && initializeResponseData.questions.length > 0) {
              setQuestions(initializeResponseData.questions);
              setCurrentQuestionIndex(0);
              setAnswers(new Array(initializeResponseData.questions.length).fill(null)); // Initialize answers array

              // Ask the first question
              const firstQuestion = initializeResponseData.questions[0];
              if (firstQuestion && firstQuestion.audio) { // Ensure the first question exists
                const aiMessage = createMessage(firstQuestion.text || "AI asks a new question.", "ai"); // Use actual text
                dispatch({ type: "ADD_MESSAGE", payload: aiMessage });
                await playAiAudio(firstQuestion.audio, aiMessage.id);
                setRecordingStatus("Please provide your answer.");
              } else {
                console.warn("No audio data for the first question.");
                setRecordingStatus("Error: No question audio. Tap to retry.");
              }
            } else {
              // No questions, either an error or initial information was sufficient
              setRecordingStatus("No follow-up questions received. Ready for diagnosis.");
            }
          } else {
            const errorAudio = initializeResponseData.message;
            if (errorAudio) {
                const aiMessage = createMessage("Error from server.", "ai");
                dispatch({ type: "ADD_MESSAGE", payload: aiMessage });
                await playAiAudio(errorAudio, aiMessage.id);
            }
            setRecordingStatus("Initialization failed. Tap to retry.");
          }
        } else {
          // Subsequent calls: answering a question
          const currentAnswers = [...answers];
          currentAnswers[currentQuestionIndex] = audioInfo.base64; // Store the current answer
          setAnswers(currentAnswers);

          const nextQuestionIndex = currentQuestionIndex + 1;

          if (nextQuestionIndex < questions.length) {
            // Ask the next question
            setCurrentQuestionIndex(nextQuestionIndex);
            const nextQuestion = questions[nextQuestionIndex];
            if (nextQuestion && nextQuestion.audio) { // Ensure the next question exists
              const aiMessage = createMessage(nextQuestion.text || "AI asks a new question.", "ai"); // Use actual text
              dispatch({ type: "ADD_MESSAGE", payload: aiMessage });
              await playAiAudio(nextQuestion.audio, aiMessage.id);
              setRecordingStatus("Please provide your answer.");
            } else {
              console.warn(`No audio data for question index ${nextQuestionIndex}.`);
              setRecordingStatus("Error: No question audio. Tap to retry.");
            }
          } else {
            // All questions answered, time to send for diagnosis
            setIsLoading(true);
            setRecordingStatus("Diagnosis in progress...");

            // Prepare the final payload for diagnosis
            // The task implies modifying the initial response and sending it back.
            // The backend's /generate_diagnosis expects `voice_data` and `user_data`.
            // We'll put the collected answers into `user_data`.
            const finalUserDataForDiagnosis = {
                ...userData, // Original user_data (age, gender, symptoms)
                conversation_questions_audio: initialPayload.questions.map((q: Question) => q.audio), // Original questions' audio
                conversation_answers_audio: currentAnswers // User's recorded answers' audio
            };

            const endpoint = `${YOUR_BACKEND_BASE_URL}/generate_diagnosis`;
            const payloadForDiagnosis = {
              voice_data: audioInfo.base64, // The last recorded audio
              user_data: finalUserDataForDiagnosis,
            };

            const response = await axios.post(endpoint, payloadForDiagnosis, {
              headers: { "Content-Type": "application/json" },
            });

            const diagnosisResponseData = response.data;
            console.log("Server response from /generate_diagnosis:", diagnosisResponseData);

            const userMessage = createMessage("All answers provided. Generating diagnosis.", "user");
            dispatch({ type: "ADD_MESSAGE", payload: userMessage });

            // Navigate to DiagnosisScreen
            navigation.navigate('Diagnosis', { diagnosisData: diagnosisResponseData });
            setRecordingStatus("Diagnosis completed.");
            setIsLoading(false); // Ensure loader is hidden after navigation
            return; // Exit early to prevent setting status again
          }
        }
        setIsLoading(false); // Hide loader after processing response or playing next question
      } catch (error: any) {
        console.error("Network/Server Error:", error.message);
        setRecordingStatus(`Error: ${error.message.substring(0, 50)}...`);
        Alert.alert("Server Error", `Failed to process audio: ${error.response ? (error.response.data?.message || error.message) : error.message}`);
        setIsLoading(false);
      }
    },
  });

  useEffect(() => {
    if (isListening) {
      setRecordingStatus("Listening... Speak now");
      setLastRecordedAudioInfo(null);
      setUserSpokenText(null);
    } else {
      if (!isLoading && !isAiSoundPlaying) {
        setRecordingStatus("Tap to speak");
      }
    }
  }, [isListening, isLoading, isAiSoundPlaying]);

  const handleMicPress = () => {
    console.log(
      "Mic pressed. Current isListening (from hook):",
      isListening,
      "isLoading:",
      isLoading,
      "isAiSoundPlaying:",
      isAiSoundPlaying
    );
    if (isLoading || isAiSoundPlaying) {
      console.log("Mic press ignored, currently loading API response or playing audio.");
      return;
    }

    if (!isChatInitialized || (isChatInitialized && currentQuestionIndex < questions.length)) {
      toggle();
    } else {
      console.log("Cannot record: All questions answered or not in a recording phase.");
      Alert.alert("Action Not Allowed", "Please wait for the diagnosis process to complete or provide your answer to the current question.");
    }
  };


  const playAiAudio = async (base64Audio: string, messageId: string) => {
    if (aiSound) {
      await aiSound.unloadAsync();
      setAiSound(null);
    }
    setActiveAiMessageId(messageId);
    setIsAiSoundPlaying(true);

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mpeg;base64,${base64Audio}` },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && !status.isPlaying) {
            setIsAiSoundPlaying(false);
            setActiveAiMessageId(null);
            // This is crucial: after AI finishes speaking a question, prompt user to answer
            if (isChatInitialized && currentQuestionIndex < questions.length) {
              setRecordingStatus("Please provide your answer.");
            } else if (isChatInitialized && currentQuestionIndex === questions.length) {
                // If AI was playing the last question and it's done, and all answers are collected
                // This state should not be reached if diagnosis is auto-triggered
                setRecordingStatus("All questions asked. Ready for diagnosis.");
            }
          }
        }
      );
      setAiSound(sound);
    } catch (error) {
      console.error("Failed to play AI audio:", error);
      setIsAiSoundPlaying(false);
      setActiveAiMessageId(null);
      setRecordingStatus("Error playing AI audio.");
    }
  };

  const handleAiAudioToggle = async () => {
    if (!aiSound) return;

    if (isAiSoundPlaying) {
      await aiSound.pauseAsync();
      setIsAiSoundPlaying(false);
    } else {
      await aiSound.playAsync();
      setIsAiSoundPlaying(true);
    }
  };

  const stopAiAudio = async () => {
    if (aiSound) {
      await aiSound.stopAsync();
      await aiSound.unloadAsync();
      setAiSound(null);
      setIsAiSoundPlaying(false);
      setActiveAiMessageId(null);
    }
  };

  useEffect(() => {
    return () => {
      aiSound?.unloadAsync();
    };
  }, [aiSound]);

  useFocusEffect(
    React.useCallback(() => {
      // Reset state when screen is focused
      setIsChatInitialized(false);
      setUserData(null);
      setQuestions([]);
      setCurrentQuestionIndex(0);
      setAnswers([]);
      setInitialPayload(null);
      setInitialLaunch(true); // Reset initialLaunch to true for fresh start
      dispatch({ type: 'CLEAR_MESSAGES' });
      setRecordingStatus("Tap to speak");
      setIsLoading(false);
      if (aiSound) {
        aiSound.unloadAsync();
        setAiSound(null);
        setIsAiSoundPlaying(false);
        setActiveAiMessageId(null);
      }

      return () => {
        // Cleanup when screen loses focus
        if (aiSound) {
          aiSound.unloadAsync();
        }
      };
    }, [dispatch, aiSound])
  );


  return (
    <SafeAreaView style={styles.container}>
      {/* <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Med-Conscious</Text>
      </View> */}

      <ScrollView
        style={styles.chatContainer}
        contentContainerStyle={styles.chatContentContainer}
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        <View style={styles.welcomeMessageContainer}>
            <MaterialCommunityIcons name="robot-outline" size={48} color="#007AFF" />
            <Text style={styles.welcomeTitle}>Welcome to Med-Conscious</Text>
            <Text style={styles.welcomeText}>
              {isChatInitialized && questions.length > 0 && currentQuestionIndex < questions.length
                ? `Please listen to Question ${currentQuestionIndex + 1} and record your answer.`
                : (isListening ? "I'm listening for your symptoms, age, and gender." : "Tap the microphone to start the diagnosis process.")
              }
            </Text>
        </View>

        {state.messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.messageBubble,
              message.sender === "user" ? styles.userBubble : styles.aiBubble,
            ]}
          >
            <Text style={message.sender === "user" ? styles.userText : styles.aiText}>
              {message.text}
            </Text>
            {message.sender === 'ai' && activeAiMessageId === message.id && (
              <View style={styles.aiAudioControls}>
                <TouchableOpacity onPress={handleAiAudioToggle}>
                  <MaterialCommunityIcons name={isAiSoundPlaying ? "pause" : "play"} size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={stopAiAudio} style={{ marginLeft: 15 }}>
                  <MaterialCommunityIcons name="stop" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {/* Display current question indicator if AI is speaking a question */}
        {isChatInitialized && questions.length > 0 && currentQuestionIndex < questions.length && isAiSoundPlaying && (
            <View style={[styles.messageBubble, styles.aiBubble]}>
                <Text style={styles.aiText}>
                    {`AI is speaking Question ${currentQuestionIndex + 1}...`}
                </Text>
            </View>
        )}
      </ScrollView>

      <View style={styles.bottomContainer}>
        <View style={styles.statusContainer}>
            {isLoading && <ActivityIndicator size="small" color="#FFFFFF" />}
            <Text style={styles.recordingStatus}>
            {isLoading ? "Processing..." : recordingStatus}
            </Text>
        </View>

        <MicrophoneButton
          isRecording={isListening}
          onPress={handleMicPress}
          size={80}
          disabled={isLoading || isAiSoundPlaying || (hasAudioRecordingPermission === false && Platform.OS !== "web") || (isChatInitialized && currentQuestionIndex === questions.length)}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    top: 12,
    zIndex: 1,
  },
  chatContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  chatContentContainer: {
    paddingVertical: 20,
  },
  welcomeMessageContainer: {
    alignItems: 'center',
    marginVertical: 40,
    paddingHorizontal: 20,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
  },
  welcomeText: {
    fontSize: 16,
    color: '#AAAAAA',
    textAlign: 'center',
    marginTop: 8,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 15,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderColor: '#0056b3',
    marginRight: 10,
  },
aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#2C2C2E',
    borderColor: '#444444',
    marginLeft: 10,
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  aiText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  aiAudioControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  bottomContainer: {
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    paddingTop: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#222222',
    backgroundColor: '#000000',
    alignItems: 'center',
  },
  statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
      minHeight: 24,
  },
  recordingStatus: {
    fontSize: 14,
    color: "#FFFFFF",
    textAlign: "center",
    marginLeft: 8,
  },
  playButton: {
    position: 'absolute',
    right: 20,
    top: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
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
});