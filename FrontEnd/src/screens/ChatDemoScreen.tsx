import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import * as Animatable from 'react-native-animatable';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type ChatDemoScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Chat-Demo'>;

const { width, height } = Dimensions.get('window');

const Star = () => {
    const style = React.useMemo(() => ({
        top: Math.random() * height,
        left: Math.random() * width,
        opacity: Math.random() * 0.5 + 0.5,
        transform: [{ scale: Math.random() * 1.5 + 0.5 }],
    }), []);

    const duration = React.useMemo(() => Math.random() * 2000 + 3000, []);

    return (
        <Animatable.View
            animation="fadeIn"
            duration={500}
            style={[styles.star, style]}
        >
            <Animatable.View
                animation={{
                    from: { translateY: -height },
                    to: { translateY: height * 2 },
                }}
                duration={duration}
                easing="linear"
                iterationCount="infinite"
                style={{ width: 2, height: 2, backgroundColor: 'white' }}
            />
        </Animatable.View>
    );
};

export const ChatDemoScreen = ({ navigation }: { navigation: ChatDemoScreenNavigationProp }) => {
  const glowAnim = React.useRef(new Animated.Value(0)).current; // Initial value for opacity: 0
  const stars = useMemo(() => Array.from({ length: 150 }).map((_, i) => <Star key={i} />), []);

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(
        glowAnim,
        {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }
      )
    ).start();
  }, [glowAnim]);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.5, 1, 0.5]
  });

  return (
    <View style={styles.container}>
      {stars}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
      </TouchableOpacity>
      <Animated.Text style={[styles.text, { opacity: glowOpacity }]}>
        Coming soon...
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  text: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 1,
  },
  star: {
    position: 'absolute',
  },
});