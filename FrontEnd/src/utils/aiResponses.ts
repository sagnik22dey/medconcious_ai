import { ChatMessage } from '../types';

export function generateAIResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return "Hello there! How can I help you today?";
  } else if (lowerMessage.includes('weather')) {
    return "I can't check the real-time weather, but it's always a good time to plan for sunshine! ☀️";
  } else if (lowerMessage.includes('timer')) {
    return "I'm not equipped to set timers yet, but your phone's clock app is great for that! ⏰";
  } else if (lowerMessage.includes('joke')) {
    const jokes = [
      "Why don't scientists trust atoms? Because they make up everything! 😄",
      "Why did the scarecrow win an award? He was outstanding in his field! 🌾",
      "What do you call a fake noodle? An impasta! 🍝",
      "Why don't eggs tell jokes? They'd crack each other up! 🥚",
    ];
    return jokes[Math.floor(Math.random() * jokes.length)]!;
  } else if (lowerMessage.includes('how are you')) {
    return "I'm doing great, thank you for asking! Ready to assist you with anything you need. 😊";
  } else if (lowerMessage.includes('help')) {
    return "I'm here to help! You can ask me about the weather, request jokes, or just have a conversation. What would you like to know?";
  } else if (lowerMessage.includes('time')) {
    const now = new Date();
    return `The current time is ${now.toLocaleTimeString()}. ⏰`;
  } else if (lowerMessage.includes('date')) {
    const now = new Date();
    return `Today's date is ${now.toLocaleDateString()}. 📅`;
  }
  
  const genericResponses = [
    "That's interesting! Tell me more about that.",
    "I understand. How can I help you with that?",
    "Thanks for sharing that with me. What else would you like to know?",
    "That's a great point! Is there anything specific I can assist you with?",
    "I appreciate you telling me that. How else can I help today?",
  ];
  
  return genericResponses[Math.floor(Math.random() * genericResponses.length)]!;
}

export function createMessage(text: string, sender: 'user' | 'ai'): ChatMessage {
  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    text,
    sender,
    timestamp: new Date(),
  };
}

export function getTypingDuration(): number {
  // Random typing duration between 1-3 seconds
  return Math.random() * 2000 + 1000;
}