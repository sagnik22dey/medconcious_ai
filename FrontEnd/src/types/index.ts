export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export interface AppState {
  isRecording: boolean;
  isChatRecording: boolean;
  messages: ChatMessage[];
  currentScreen: string;
  patientData: any | null; // To store patient information for subsequent requests
}

export interface VoiceRecognitionResult {
  transcript: string;
  confidence: number;
}

export interface SettingsItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
}

export interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

export type RootStackParamList = {
  Home: undefined;
  Chat: undefined;
  Voice: undefined;
  Settings: undefined;
  'Voice-Demo': undefined;
  'Chat-Demo': undefined;
  Diagnosis: { diagnosisData: any }; // Updated to accept diagnosisData
  Prescription: undefined;
};

export type MainTabParamList = {
  Voice: undefined;
  Chat: undefined;
  Profile: undefined;
};
export interface DiagnosisReport {
  patientInfo: {
    name: string;
    age: number;
    gender: 'Male' | 'Female' | 'Other';
  };
  symptoms: string[];
  diagnosis: string;
  confidence: number;
  recommendations: string[];
  date: string;
}

export interface Prescription {
    id: string;
    patientName: string;
    medications: {
        name: string;
        dosage: string;
        frequency: string;
    }[];
    doctorName: string;
    date: string;
}