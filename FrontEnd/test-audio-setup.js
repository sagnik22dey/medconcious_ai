// Simple test to verify audio recording setup
import { Audio } from 'expo-av';

async function testAudioSetup() {
  try {
    console.log('Testing audio setup...');
    
    // Test permissions
    const { status } = await Audio.requestPermissionsAsync();
    console.log('Permission status:', status);
    
    if (status !== 'granted') {
      console.log('❌ Audio permission not granted');
      return;
    }
    
    // Test audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
    console.log('✅ Audio mode set successfully');
    
    // Test recording creation
    const recordingOptions = {
      android: {
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 64000,
      },
      ios: {
        extension: '.m4a',
        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        audioQuality: Audio.IOSAudioQuality.MEDIUM,
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 64000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
    };
    
    const { recording } = await Audio.Recording.createAsync(recordingOptions);
    console.log('✅ Recording instance created successfully');
    
    // Test starting recording
    await recording.startAsync();
    console.log('✅ Recording started successfully');
    
    // Stop after 1 second
    setTimeout(async () => {
      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        console.log('✅ Recording stopped successfully, URI:', uri);
        console.log('🎉 All audio setup tests passed!');
      } catch (error) {
        console.log('❌ Error stopping recording:', error.message);
      }
    }, 1000);
    
  } catch (error) {
    console.log('❌ Audio setup test failed:', error.message);
  }
}

export { testAudioSetup };