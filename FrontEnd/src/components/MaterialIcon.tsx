import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { StyleProp, TextStyle } from 'react-native';

interface MaterialIconProps {
  name: keyof typeof MaterialIcons.glyphMap;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function MaterialIcon({ 
  name, 
  size = 24, 
  color = '#FFFFFF', 
  style 
}: MaterialIconProps) {
  return (
    <MaterialIcons 
      name={name} 
      size={size} 
      color={color} 
      style={style}
    />
  );
}