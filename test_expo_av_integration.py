#!/usr/bin/env python3
"""
Test script for expo-av audio integration with the backend
"""

import requests
import base64
import json

# Configuration
API_BASE_URL = "http://localhost:8000"
TEST_AUDIO_FILE = "medconcious_ai/Backend/tests/test_files/speech.wav"

def test_health_check():
    """Test if the backend is running"""
    try:
        response = requests.get(f"{API_BASE_URL}/health-check/")
        if response.status_code == 200:
            print("✅ Backend is running")
            return True
        else:
            print(f"❌ Backend health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend connection failed: {e}")
        return False

def test_expo_av_audio_endpoint():
    """Test the new expo-av audio endpoint"""
    try:
        # Read test audio file
        with open(TEST_AUDIO_FILE, 'rb') as f:
            audio_data = f.read()
        
        # Convert to base64
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        
        # Prepare payload
        payload = {
            "audio_base64": audio_base64,
            "mime_type": "audio/wav",
            "previous_question": "What brings you here today?",
            "user_info": {
                "name": "Test User",
                "email": "test@example.com"
            },
            "conversation_stage": "followup"
        }
        
        # Send request
        response = requests.post(
            f"{API_BASE_URL}/process-expo-av-audio/",
            headers={"Content-Type": "application/json"},
            json=payload
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Expo-av audio endpoint test successful")
            print(f"   Transcription: {data.get('transcription', 'N/A')}")
            print(f"   Status: {data.get('status', 'N/A')}")
            return True
        else:
            print(f"❌ Expo-av audio endpoint test failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except FileNotFoundError:
        print(f"❌ Test audio file not found: {TEST_AUDIO_FILE}")
        print("   Please ensure you have a test audio file available")
        return False
    except Exception as e:
        print(f"❌ Expo-av audio endpoint test failed: {e}")
        return False

def test_original_process_response_endpoint():
    """Test the original process-response endpoint with text input"""
    try:
        payload = {
            "audio_bytes": "",
            "text": "I have a headache and feel nauseous",
            "previous_question": "What brings you here today?",
            "user_info": {
                "name": "Test User",
                "email": "test@example.com"
            }
        }
        
        response = requests.post(
            f"{API_BASE_URL}/process-response/",
            headers={"Content-Type": "application/json"},
            json=payload
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Original process-response endpoint test successful")
            print(f"   Status: {data.get('status', 'N/A')}")
            return True
        else:
            print(f"❌ Original process-response endpoint test failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Original process-response endpoint test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Testing Expo-AV Integration with Backend")
    print("=" * 50)
    
    tests = [
        ("Health Check", test_health_check),
        ("Expo-AV Audio Endpoint", test_expo_av_audio_endpoint),
        ("Original Process Response (Text)", test_original_process_response_endpoint)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n🔍 Running: {test_name}")
        if test_func():
            passed += 1
        print("-" * 30)
    
    print(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Expo-AV integration is working correctly.")
    else:
        print("⚠️  Some tests failed. Please check the output above for details.")

if __name__ == "__main__":
    main()