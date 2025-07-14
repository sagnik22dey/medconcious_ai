import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { AppState, ChatMessage } from '../types';

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

type AppAction =
  | { type: 'SET_RECORDING'; payload: boolean }
  | { type: 'SET_CHAT_RECORDING'; payload: boolean }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_MESSAGE_TEXT'; payload: { id: string; newText: string } } // Added new action
  | { type: 'SET_CURRENT_SCREEN'; payload: string }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_PATIENT_DATA'; payload: any }; // Add action type for patient data

const initialState: AppState = {
  isRecording: false,
  isChatRecording: false,
  messages: [],
  currentScreen: 'Voice',
  patientData: null, // Initialize patientData as null
};

const AppContext = createContext<AppContextType | undefined>(undefined);

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_RECORDING':
      return { ...state, isRecording: action.payload };
    case 'SET_CHAT_RECORDING':
      return { ...state, isChatRecording: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'UPDATE_MESSAGE_TEXT': // Added reducer case
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.id ? { ...msg, text: action.payload.newText } : msg
        ),
      };
    case 'SET_CURRENT_SCREEN':
      return { ...state, currentScreen: action.payload };
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] };
    case 'SET_PATIENT_DATA': // Add reducer case for patient data
      return { ...state, patientData: action.payload };
    default:
      return state;
  }
}

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}