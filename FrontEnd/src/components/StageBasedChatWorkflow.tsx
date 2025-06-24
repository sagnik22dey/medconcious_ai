import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcon } from './MaterialIcon';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

interface ChatStage {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  completed: boolean;
  current: boolean;
}

interface WorkflowState {
  currentStage: string;
  nextStage: string;
  stageData: any;
  chatHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    stage: string;
  }>;
}

export function StageBasedChatWorkflow() {
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    currentStage: 'initiate_chat',
    nextStage: 'process_response',
    stageData: {},
    chatHistory: []
  });

  const [stages, setStages] = useState<ChatStage[]>([
    { id: 'initiate_chat', name: 'Initial Greeting', description: 'Doctor greets patient', endpoint: '/initiate-chat/', completed: false, current: true },
    { id: 'process_response', name: 'Symptom Collection', description: 'Gathering patient information', endpoint: '/process-response/', completed: false, current: false },
    { id: 'generate_diagnosis', name: 'Diagnosis', description: 'Analyzing symptoms', endpoint: '/generate-diagnosis/', completed: false, current: false },
    { id: 'generate_prescription', name: 'Prescription', description: 'Creating treatment plan', endpoint: '/generate-prescription/', completed: false, current: false },
    { id: 'generate_report', name: 'Final Report', description: 'Comprehensive medical report', endpoint: '/generate-report/', completed: false, current: false },
  ]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [userInfo] = useState({
    name: 'John Doe',
    email: 'john.doe@example.com'
  });

  const {
    isListening,
    isPlaying,
    hasAudioRecordingPermission,
    toggle,
    playRecordedAudio,
  } = useSpeechRecognition({
    onError: (error) => {
      console.error('Voice Recording Error:', error);
      Alert.alert('Recording Error', error);
    },
    onAudioRecorded: async (audioData) => {
      await handleVoiceInput(audioData);
    },
    onPlaybackFinished: () => {
      console.log('Audio playback finished');
    },
  });

  const addToChatHistory = (role: 'user' | 'assistant', content: string, stage: string) => {
    const newMessage = {
      role,
      content,
      timestamp: new Date().toISOString(),
      stage
    };
    setWorkflowState(prev => ({
      ...prev,
      chatHistory: [...prev.chatHistory, newMessage]
    }));
  };

  const updateStageStatus = (stageId: string, completed: boolean, current: boolean) => {
    setStages(prev => prev.map(stage => ({
      ...stage,
      completed: stage.id === stageId ? completed : stage.completed,
      current: stage.id === stageId ? current : false
    })));
  };

  const handleVoiceInput = async (audioData: { base64: string; uri: string | null; mimeType?: string }) => {
    if (isProcessing) return;

    setIsProcessing(true);
    
    try {
      let response;
      const baseUrl = Platform.OS === 'android' 
        ? 'http://192.168.153.125:8000' 
        : 'http://192.168.153.125:8000';

      switch (workflowState.currentStage) {
        case 'initiate_chat':
          response = await handleInitiateChat(baseUrl, audioData);
          break;
        case 'process_response':
          response = await handleProcessResponse(baseUrl, audioData);
          break;
        case 'generate_diagnosis':
          response = await handleGenerateDiagnosis(baseUrl, audioData);
          break;
        case 'generate_prescription':
          response = await handleGeneratePrescription(baseUrl, audioData);
          break;
        case 'generate_report':
          response = await handleGenerateReport(baseUrl, audioData);
          break;
        default:
          throw new Error(`Unknown stage: ${workflowState.currentStage}`);
      }

      // Update workflow state based on response
      if (response.nextStage) {
        setWorkflowState(prev => ({
          ...prev,
          currentStage: response.nextStage,
          nextStage: response.nextStage,
          stageData: { ...prev.stageData, ...response.stageData }
        }));

        // Update stage status
        updateStageStatus(workflowState.currentStage, true, false);
        updateStageStatus(response.nextStage, false, true);
      }

    } catch (error: any) {
      console.error('Workflow error:', error);
      Alert.alert('Workflow Error', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInitiateChat = async (baseUrl: string, audioData: any) => {
    const payload = {
      User_Info: userInfo,
      audio_base64: audioData.base64
    };

    const response = await fetch(`${baseUrl}/initiate-chat/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Initiate chat failed: ${response.status}`);

    const result = await response.json();
    
    if (result.transcription) {
      addToChatHistory('user', result.transcription, 'initiate_chat');
    }
    addToChatHistory('assistant', result.text, 'initiate_chat');

    return {
      nextStage: 'process_response',
      stageData: { greeting: result.text }
    };
  };

  const handleProcessResponse = async (baseUrl: string, audioData: any) => {
    const payload = {
      audio_bytes: audioData.base64,
      audio_format: audioData.mimeType || 'audio/m4a',
      previous_question: workflowState.chatHistory[workflowState.chatHistory.length - 1]?.content || '',
      user_info: userInfo
    };

    const response = await fetch(`${baseUrl}/process-response/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Process response failed: ${response.status}`);

    const result = await response.json();
    
    addToChatHistory('user', result.user_text, 'process_response');
    
    if (result.status === 'questions_pending') {
      addToChatHistory('assistant', result.questions, 'process_response');
      return {
        nextStage: 'process_response', // Stay in same stage
        stageData: { questions: result.questions }
      };
    } else if (result.status === 'ready_for_diagnosis') {
      return {
        nextStage: 'generate_diagnosis',
        stageData: result.stage_data
      };
    }

    return { nextStage: 'process_response', stageData: {} };
  };

  const handleGenerateDiagnosis = async (baseUrl: string, audioData: any) => {
    const payload = {
      user_info: userInfo,
      audio_bytes: audioData.base64,
      audio_format: audioData.mimeType || 'audio/m4a',
      stage_data: workflowState.stageData
    };

    const response = await fetch(`${baseUrl}/generate-diagnosis/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Generate diagnosis failed: ${response.status}`);

    const result = await response.json();
    
    if (result.user_text) {
      addToChatHistory('user', result.user_text, 'generate_diagnosis');
    }
    addToChatHistory('assistant', `Diagnosis: ${result.primary_diagnosis}`, 'generate_diagnosis');

    if (result.ready_for_prescription) {
      return {
        nextStage: 'generate_prescription',
        stageData: { ...workflowState.stageData, diagnosis_data: result.diagnosis_data }
      };
    } else {
      return {
        nextStage: 'generate_diagnosis', // Stay in same stage
        stageData: { ...workflowState.stageData, diagnosis_data: result.diagnosis_data }
      };
    }
  };

  const handleGeneratePrescription = async (baseUrl: string, audioData: any) => {
    const payload = {
      user_info: userInfo,
      chosen_diagnosis: workflowState.stageData.diagnosis_data?.primary_diagnosis || '',
      diagnosis_data: workflowState.stageData.diagnosis_data,
      additional_notes: '' // Could be transcribed from audio if needed
    };

    const response = await fetch(`${baseUrl}/generate-prescription/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Generate prescription failed: ${response.status}`);

    const result = await response.json();
    
    const prescriptionSummary = result.prescription_summary?.medications?.length > 0
      ? `Prescribed: ${result.prescription_summary.medications.map((m: any) => m.name).join(', ')}`
      : 'Prescription generated successfully';
    
    addToChatHistory('assistant', prescriptionSummary, 'generate_prescription');

    if (result.ready_for_report) {
      return {
        nextStage: 'generate_report',
        stageData: { ...workflowState.stageData, prescription_data: result.prescription_data }
      };
    } else {
      return {
        nextStage: 'generate_prescription', // Stay in same stage
        stageData: { ...workflowState.stageData, prescription_data: result.prescription_data }
      };
    }
  };

  const handleGenerateReport = async (baseUrl: string, audioData: any) => {
    const payload = {
      user_info: userInfo,
      diagnosis_data: workflowState.stageData.diagnosis_data,
      prescription_data: workflowState.stageData.prescription_data,
      additional_notes: '' // Could be transcribed from audio if needed
    };

    const response = await fetch(`${baseUrl}/generate-report/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`Generate report failed: ${response.status}`);

    const result = await response.json();
    
    addToChatHistory('assistant', result.summary || 'Final medical report has been generated successfully.', 'generate_report');

    // Mark consultation as complete
    updateStageStatus('generate_report', true, false);

    return {
      nextStage: 'completed',
      stageData: { ...workflowState.stageData, final_report: result.report_data }
    };
  };

  const initializeChat = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      const baseUrl = Platform.OS === 'android' 
        ? 'http://192.168.153.125:8000' 
        : 'http://192.168.153.125:8000';

      const payload = { User_Info: userInfo };

      const response = await fetch(`${baseUrl}/initiate-chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`Initiate chat failed: ${response.status}`);

      const result = await response.json();
      
      addToChatHistory('assistant', result.text, 'initiate_chat');

      // Move to next stage
      setWorkflowState(prev => ({
        ...prev,
        currentStage: 'process_response',
        nextStage: 'process_response'
      }));

      updateStageStatus('initiate_chat', true, false);
      updateStageStatus('process_response', false, true);

    } catch (error: any) {
      console.error('Initialize chat error:', error);
      Alert.alert('Chat Initialization Error', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    // Auto-initialize chat when component mounts
    initializeChat();
  }, []);

  const getCurrentStage = () => stages.find(s => s.id === workflowState.currentStage);
  const isCompleted = workflowState.currentStage === 'completed';

  return (
    <View style={styles.container}>
      {/* Stage Progress Indicator */}
      <View style={styles.stageProgressContainer}>
        <Text style={styles.stageProgressTitle}>Consultation Progress</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {stages.map((stage, index) => (
            <View key={stage.id} style={styles.stageItem}>
              <View style={[
                styles.stageIndicator,
                stage.completed && styles.stageCompleted,
                stage.current && styles.stageCurrent
              ]}>
                <Text style={styles.stageNumber}>{index + 1}</Text>
              </View>
              <Text style={[
                styles.stageName,
                stage.completed && styles.stageNameCompleted,
                stage.current && styles.stageNameCurrent
              ]}>
                {stage.name}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Chat History */}
      <ScrollView style={styles.chatContainer} showsVerticalScrollIndicator={false}>
        {workflowState.chatHistory.map((message, index) => (
          <View key={index} style={[
            styles.messageContainer,
            message.role === 'user' ? styles.userMessage : styles.assistantMessage
          ]}>
            <Text style={styles.messageRole}>
              {message.role === 'user' ? '👤 You' : '👨‍⚕️ Doctor'}
            </Text>
            <Text style={styles.messageContent}>{message.content}</Text>
            <Text style={styles.messageStage}>Stage: {message.stage}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Current Stage Info */}
      <View style={styles.currentStageContainer}>
        <Text style={styles.currentStageTitle}>
          {isCompleted ? '✅ Consultation Complete' : `Current: ${getCurrentStage()?.name}`}
        </Text>
        <Text style={styles.currentStageDescription}>
          {isCompleted ? 'Your medical consultation has been completed successfully.' : getCurrentStage()?.description}
        </Text>
      </View>

      {/* Voice Controls */}
      {!isCompleted && (
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[
              styles.voiceButton,
              isListening && styles.voiceButtonRecording,
              isProcessing && styles.voiceButtonDisabled
            ]}
            onPress={toggle}
            disabled={isProcessing || hasAudioRecordingPermission === false}
          >
            <MaterialIcon
              name={isListening ? 'stop' : 'mic'}
              size={32}
              color="#FFFFFF"
            />
            <Text style={styles.voiceButtonText}>
              {isProcessing ? 'Processing...' : isListening ? 'Stop Recording' : 'Speak to Doctor'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Permissions Warning */}
      {hasAudioRecordingPermission === false && Platform.OS !== 'web' && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>
            🎤 Microphone permission required for voice consultation.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  stageProgressContainer: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  stageProgressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  stageItem: {
    alignItems: 'center',
    marginRight: 20,
    minWidth: 80,
  },
  stageIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#404040',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stageCompleted: {
    backgroundColor: '#10b981',
  },
  stageCurrent: {
    backgroundColor: '#3b82f6',
  },
  stageNumber: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  stageName: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 12,
  },
  stageNameCompleted: {
    color: '#10b981',
  },
  stageNameCurrent: {
    color: '#3b82f6',
  },
  chatContainer: {
    flex: 1,
    padding: 16,
  },
  messageContainer: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    maxWidth: '85%',
  },
  userMessage: {
    backgroundColor: '#1e40af',
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    backgroundColor: '#374151',
    alignSelf: 'flex-start',
  },
  messageRole: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 4,
  },
  messageContent: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  messageStage: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 4,
    fontStyle: 'italic',
  },
  currentStageContainer: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#404040',
  },
  currentStageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  currentStageDescription: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 18,
  },
  controlsContainer: {
    padding: 16,
    alignItems: 'center',
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 30,
    minWidth: 200,
    justifyContent: 'center',
  },
  voiceButtonRecording: {
    backgroundColor: '#dc2626',
  },
  voiceButtonDisabled: {
    backgroundColor: '#6b7280',
    opacity: 0.7,
  },
  voiceButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  warningContainer: {
    backgroundColor: '#7f1d1d',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  warningText: {
    color: '#fecaca',
    fontSize: 14,
    textAlign: 'center',
  },
});