import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcon } from '../components/MaterialIcon';
import { VoiceScreen } from '../screens/VoiceScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MainTabParamList } from '../types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#141414',
          borderTopColor: '#303030',
          borderTopWidth: 1,
          height: 85,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#ababab',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
      }}
    >
      <Tab.Screen
        name="Voice"
        component={VoiceScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcon name="mic" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcon name="chat-bubble-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcon name="settings" size={size} color={color} />
          ),
          tabBarLabel: 'Settings',
        }}
      />
    </Tab.Navigator>
  );
}