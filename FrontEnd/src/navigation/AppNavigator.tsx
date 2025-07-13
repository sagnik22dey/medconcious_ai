import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { VoiceScreen } from '../screens/VoiceScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { VoiceDemoScreen } from '../screens/VoiceDemoScreen';
import { ChatDemoScreen } from '../screens/ChatDemoScreen';
import DiagnosisScreen from '../screens/DiagnosisScreen';
import PrescriptionScreen from '../screens/PrescriptionScreen';
import { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#141414' },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
        />
       <Stack.Screen name="Diagnosis" component={DiagnosisScreen} />
       <Stack.Screen name="Prescription" component={PrescriptionScreen} />
       <Stack.Screen name="Voice-Demo" component={VoiceDemoScreen} />
       <Stack.Screen name="Chat-Demo" component={ChatDemoScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}