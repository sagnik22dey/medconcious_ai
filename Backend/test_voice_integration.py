#!/usr/bin/env python3
"""
Test script for the new voice processing integration with Gemini 2.5 Flash Preview
"""

import requests
import base64
import json
import os
from pathlib import Path

# Configuration
API_BASE_URL = "http://localhost:8000"
TEST_AUDIO_PATH = "tests/test_files/speech.wav"  # Update this path as needed

def load_test_audio():
    """Load test audio file and convert to base64"""
    try:
        audio_path = Path(TEST_AUDIO_PATH)
        if not audio_path.exists():
            print(f"⚠️  Test audio file not found: {TEST_AUDIO_PATH}")
            print("Please ensure you have a test audio file available.")
            return None
            
        with open(audio_path, "rb") as audio_file:
            audio_data = audio_file.read()
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            print(f"✅ Loaded test audio: {audio_path.name} ({len(audio_data)} bytes)")
            return audio_base64
    except Exception as e:
        print(f"❌ Error loading test audio: {e}")
        return None

def test_health_check():
    """Test the health check endpoint"""
    try:
        response = requests.get(f"{API_BASE_URL}/health-check/")
        if response.status_code == 200:
            print("✅ Health check passed")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_voice_integrated_greeting():
    """Test the integrated voice processing for greeting"""
    print("\n🔄 Testing voice-integrated greeting...")
    
    audio_base64 = load_test_audio()
    if not audio_base64:
        return False
        
    payload = {
        "User_Info": {
            "name": "John Doe",
            "email": "john.doe@example.com"
        },
        "audio_base64": audio_base64
    }
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/initiate-chat/",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Voice-integrated greeting successful!")
            print(f"📝 Transcription: {result.get('transcription', 'N/A')}")
            print(f"💬 AI Response: {result.get('text', 'N/A')}")
            print(f"🔧 Processing Type: {result.get('processing_type', 'N/A')}")
            
            return True
        else:
            print(f"❌ Voice greeting failed: {response.status_code}")
            print(f"Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Voice greeting error: {e}")
        return False

def test_voice_integrated_processing():
    """Test the main voice processing endpoint"""
    print("\n🔄 Testing integrated voice processing...")
    
    audio_base64 = load_test_audio()
    if not audio_base64:
        return False
        
    payload = {
        "audio_base64": audio_base64,
        "user_info": {
            "name": "Jane Smith",
            "email": "jane.smith@example.com"
        },
        "conversation_stage": "followup",
        "context": {
            "previous_questions": "What symptoms are you experiencing?",
            "patient_info": "Patient complaining of headache and fever"
        }
    }
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/process-voice-integrated/",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Integrated voice processing successful!")
            print(f"📝 Transcription: {result.get('transcription', 'N/A')}")
            print(f"💬 AI Response: {result.get('ai_response', 'N/A')}")
            print(f"🎭 Stage: {result.get('conversation_stage', 'N/A')}")
            
            return True
        else:
            print(f"❌ Voice processing failed: {response.status_code}")
            print(f"Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Voice processing error: {e}")
        return False

def test_traditional_greeting():
    """Test traditional text-only greeting for comparison"""
    print("\n🔄 Testing traditional text-only greeting...")
    
    payload = {
        "User_Info": {
            "name": "Alice Johnson",
            "email": "alice.johnson@example.com"
        }
    }
    
    try:
        response = requests.post(
            f"{API_BASE_URL}/initiate-chat/",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Traditional greeting successful!")
            print(f"💬 AI Response: {result.get('text', 'N/A')}")
            print(f"🔧 Processing Type: {result.get('processing_type', 'N/A')}")
            
            return True
        else:
            print(f"❌ Traditional greeting failed: {response.status_code}")
            print(f"Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Traditional greeting error: {e}")
        return False

def run_all_tests():
    """Run all test cases"""
    print("🚀 Starting Voice Processing Integration Tests\n")
    print("=" * 60)
    
    tests = [
        ("Health Check", test_health_check),
        ("Traditional Greeting", test_traditional_greeting),
        ("Voice-Integrated Greeting", test_voice_integrated_greeting),
        ("Voice Processing", test_voice_integrated_processing),
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n📋 Running: {test_name}")
        print("-" * 40)
        success = test_func()
        results.append((test_name, success))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if success:
            passed += 1
    
    print(f"\n🎯 Results: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("🎉 All tests passed! Voice processing integration is working correctly.")
    else:
        print("⚠️  Some tests failed. Please check the error messages above.")

if __name__ == "__main__":
    # Check if server is running
    print("🔍 Checking if server is running...")
    try:
        response = requests.get(f"{API_BASE_URL}/health-check/", timeout=5)
        if response.status_code == 200:
            print("✅ Server is running")
            run_all_tests()
        else:
            print("❌ Server responded with error")
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Please ensure the FastAPI server is running:")
        print("   python main.py")
        print("   or")
        print("   uvicorn main:app --host 0.0.0.0 --port 8000")
    except Exception as e:
        print(f"❌ Error checking server: {e}")