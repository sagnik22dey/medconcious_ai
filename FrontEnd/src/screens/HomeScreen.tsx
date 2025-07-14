import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import * as Animatable from 'react-native-animatable';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';

const { width, height } = Dimensions.get('window');

const Star = () => {
    const style = useMemo(() => ({
        top: Math.random() * height,
        left: Math.random() * width,
        opacity: Math.random() * 0.5 + 0.5,
        transform: [{ scale: Math.random() * 1.5 + 0.5 }],
    }), []);

    const duration = useMemo(() => Math.random() * 2000 + 3000, []);

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

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

const HomeScreen = ({ navigation }: { navigation: HomeScreenNavigationProp }) => {
  const stars = useMemo(() => Array.from({ length: 150 }).map((_, i) => <Star key={i} />), []);

  return (
    <View style={styles.container}>
      {stars}
      <View style={styles.content}>
        <Animatable.Text animation="fadeIn" duration={1500} style={styles.title}>Medi-Conscious AI</Animatable.Text>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Voice-Demo')}>
            <MaterialCommunityIcons name="microphone" size={24} color="white" />
            <Text style={styles.buttonText}>Voice</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Chat-Demo')}>
            <MaterialCommunityIcons name="message-processing" size={24} color="white" />
            <Text style={styles.buttonText}>Chat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  star: {
    position: 'absolute',
  },
  content: {
    alignItems: 'center',
  },
  title: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 50,
  },
  buttonContainer: {
    flexDirection: 'row',
  },
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    marginLeft: 10,
  },
});

export default HomeScreen;