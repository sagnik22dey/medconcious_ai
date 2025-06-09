# MedConscious - Voice Assistant & Chat App

A comprehensive React Native application built with Expo CLI featuring voice recognition, real-time chat, and seamless navigation. The app provides an intuitive interface for voice commands and text-based conversations with an AI assistant.

## Features

### 🎤 Voice Assistant

- **Push-to-talk functionality** with visual feedback
- **Pulse animations** during recording
- **Speech-to-text conversion** using Expo Speech Recognition
- **Text-to-speech output** with customizable voice options
- **Voice command processing** with AI responses
- **Microphone permission handling**
- **Simulation mode** for Expo Go development

### 💬 Chat Interface

- **Real-time messaging** with message bubbles
- **Speech input support** in chat
- **Text-to-speech playback** for AI responses
- **Typing indicators** with animated dots
- **Auto-scroll** to latest messages
- **Simulated AI responses** with natural delays

### ⚙️ Settings & Navigation

- **Tab navigation** between Voice, Chat, and Settings
- **Stack navigation** for modal screens
- **Organized settings menu** with sections
- **Smooth transitions** and animations

### 🎨 Design & UI

- **Dark theme** with black (#141414) background
- **Material Icons** integration
- **Responsive layout** with safe area handling
- **Touch-optimized** button sizes
- **Gradient accents** and visual polish

## Tech Stack

- **React Native** (0.79.2)
- **Expo SDK** (~53.0.9)
- **TypeScript** for type safety
- **React Navigation** for routing
- **Expo Speech** for text-to-speech
- **Expo Speech Recognition** for voice input
- **Expo Audio** for audio recording
- **React Context** for state management

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── MaterialIcon.tsx     # Material Icons wrapper
│   ├── MicrophoneButton.tsx # Voice recording button with animations
│   ├── ChatBubble.tsx       # Message bubbles and typing indicator
│   └── ErrorBoundary.tsx    # Error handling component
├── screens/             # Application screens
│   ├── VoiceScreen.tsx      # Main voice assistant interface
│   ├── ChatScreen.tsx       # Chat messaging interface
│   └── SettingsScreen.tsx   # Settings menu
├── navigation/          # Navigation configuration
│   ├── AppNavigator.tsx     # Main stack navigator
│   └── TabNavigator.tsx     # Bottom tab navigation
├── hooks/               # Custom React hooks
│   ├── useSpeechRecognition.ts # Speech recognition functionality
│   └── useTextToSpeech.ts      # Text-to-speech functionality
├── context/             # React Context providers
│   └── AppContext.tsx       # Global state management
├── types/               # TypeScript type definitions
│   └── index.ts             # Application types
└── utils/               # Utility functions
    └── aiResponses.ts       # AI response generation
```

## Setup Instructions

### Prerequisites

- **Node.js** (v16 or later)
- **npm** or **yarn**
- **Expo CLI** (`npm install -g @expo/cli`)
- **Visual Studio Code** (recommended)

### Installation

1. **Clone or download** the project files
2. **Navigate** to the project directory:

   ```bash
   cd MedConscious
   ```

3. **Install dependencies**:

   ```bash
   npm install
   ```

4. **Start the development server**:
   ```bash
   npm start
   ```

### Running the Application

#### Mobile Development

- **iOS Simulator**: `npm run ios` (macOS only)
- **Android Emulator**: `npm run android`
- **Expo Go App**: Scan QR code from terminal

#### Web Development

- **Web Browser**: `npm run web`

### Development Workflow

#### VS Code Setup

1. **Install recommended extensions**:

   - React Native Tools
   - TypeScript and JavaScript Language Features
   - ES7+ React/Redux/React-Native snippets

2. **Enable debugging**:
   - Use VS Code's integrated terminal
   - Set breakpoints in TypeScript files
   - Use React Native debugger

#### Key Files to Customize

- **`src/utils/aiResponses.ts`** - Modify AI response logic
- **`src/hooks/useSpeechRecognition.ts`** - Enhance speech recognition
- **`src/hooks/useTextToSpeech.ts`** - Configure text-to-speech options
- **`App.tsx`** - Main application entry point
- **`src/screens/`** - Screen components and layouts
- **`test-voice.html`** - Web-based voice testing interface

## Features Deep Dive

### Voice Recognition

The app uses a custom hook ([`useSpeechRecognition`](src/hooks/useSpeechRecognition.ts:1)) that wraps Expo's speech recognition capabilities:

```typescript
const { isListening, toggle, transcript } = useSpeechRecognition({
  onResult: (result) => {
    // Handle voice recognition result
  },
  onError: (error) => {
    // Handle errors gracefully
  },
});
```

### Text-to-Speech

The app includes a comprehensive text-to-speech system via [`useTextToSpeech`](src/hooks/useTextToSpeech.ts:1):

```typescript
const { speak, stop, isSpeaking, isMessageSpeaking } = useTextToSpeech();

// Speak AI responses with customizable options
speak(aiResponse, messageId, {
  language: "en",
  pitch: 1.0,
  rate: 0.8,
});
```

### State Management

Global state is managed using React Context with useReducer:

```typescript
const { state, dispatch } = useAppContext();

// Update recording state
dispatch({ type: "SET_RECORDING", payload: true });

// Add new message
dispatch({ type: "ADD_MESSAGE", payload: message });
```

### Navigation

The app uses React Navigation v6 with both stack and tab navigators:

- **Tab Navigator**: Voice, Chat, Settings
- **Stack Navigator**: Modal presentation for settings
- **Deep Linking**: Support for navigation state persistence

## Customization

### Theming

Colors and styles are defined in component StyleSheets:

```typescript
const styles = StyleSheet.create({
  container: {
    backgroundColor: "#141414", // Dark background
  },
  primaryButton: {
    backgroundColor: "#007AFF", // Blue accent
  },
});
```

### AI Responses

Customize response generation in `src/utils/aiResponses.ts`:

```typescript
export function generateAIResponse(userMessage: string): string {
  // Add your custom logic here
  // Integrate with external APIs if needed
}
```

## Performance Optimizations

- **Memoized components** with React.memo
- **Optimized FlatList** rendering
- **Native animations** using Animated API
- **Lazy loading** of screen components
- **Error boundaries** for graceful fallbacks
- **Speech cleanup** on component unmount
- **Audio resource management** for recordings

## Debugging

### Common Issues

1. **Microphone permissions**: Ensure device permissions are granted
2. **Speech recognition**: Uses simulation mode in Expo Go, requires development build for real functionality
3. **Text-to-speech**: May not work in all simulators, test on physical devices
4. **Navigation errors**: Check navigation prop types
5. **Build errors**: Clear cache with `expo r -c`
6. **Audio conflicts**: Stop existing audio before starting new recordings

### Debugging Tools

- **Expo DevTools**: Access via browser
- **React Native Debugger**: Standalone debugging tool
- **VS Code Debugger**: Integrated debugging support
- **Console logging**: Check Metro bundler output
- **Voice Test Page**: Use [`test-voice.html`](test-voice.html:1) for web-based voice testing

## Production Deployment

### Building for Production

1. **Configure app.json**:

   ```json
   {
     "expo": {
       "name": "MedConscious",
       "slug": "medconscious",
       "version": "1.0.0"
     }
   }
   ```

2. **Build the app**:

   ```bash
   expo build:ios    # iOS
   expo build:android # Android
   ```

3. **Submit to stores**:
   ```bash
   expo submit:ios
   expo submit:android
   ```

## License

This project is private and proprietary. All rights reserved.

## Support

For development support or questions, refer to:

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [React Navigation Documentation](https://reactnavigation.org/docs/getting-started)

---

**Built with ❤️ using React Native and Expo**
