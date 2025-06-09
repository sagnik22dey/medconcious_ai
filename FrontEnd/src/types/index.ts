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
  MainTabs: undefined;
  Settings: undefined;
};

export type MainTabParamList = {
  Voice: undefined;
  Chat: undefined;
  Profile: undefined;
};