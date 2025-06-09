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
  | { type: 'SET_CURRENT_SCREEN'; payload: string }
  | { type: 'CLEAR_MESSAGES' };

const initialState: AppState = {
  isRecording: false,
  isChatRecording: false,
  messages: [],
  currentScreen: 'Voice',
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
    case 'SET_CURRENT_SCREEN':
      return { ...state, currentScreen: action.payload };
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] };
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