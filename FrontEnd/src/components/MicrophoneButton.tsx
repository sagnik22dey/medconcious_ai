import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { MaterialIcon } from './MaterialIcon';

interface MicrophoneButtonProps {
  isRecording: boolean;
  onPress: () => void;
  size?: number;
  disabled?: boolean;
}

export function MicrophoneButton({
  isRecording,
  onPress,
  size = 80,
  disabled = false,
}: MicrophoneButtonProps) {
  const pulseAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.5,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.8,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(opacityAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Stop animation and reset
      pulseAnim.stopAnimation();
      opacityAnim.stopAnimation();
      Animated.timing(pulseAnim, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }).start();
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isRecording]);

  return (
    <View style={styles.container}>
      {isRecording && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              width: size * 2,
              height: size * 2,
              borderRadius: size,
              transform: [{ scale: pulseAnim }],
              opacity: opacityAnim,
            },
          ]}
        />
      )}
      <TouchableOpacity
        style={[
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: isRecording ? '#dc2626' : '#007AFF',
          },
          disabled && styles.disabled,
        ]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <MaterialIcon
          name={isRecording ? 'stop' : 'mic'}
          size={size * 0.4}
          color="#FFFFFF"
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  disabled: {
    opacity: 0.5,
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#dc2626',
    backgroundColor: 'transparent',
  },
});