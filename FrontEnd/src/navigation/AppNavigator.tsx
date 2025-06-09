import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { SettingsScreen } from '../screens/SettingsScreen';
import { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#141414' },
        }}
      >
        <Stack.Screen 
          name="MainTabs" 
          component={TabNavigator}
        />
        <Stack.Screen 
          name="Settings" 
          component={SettingsScreen}
          options={{
            presentation: 'modal',
            animation: 'slide_from_right',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}