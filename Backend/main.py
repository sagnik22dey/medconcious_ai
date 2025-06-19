from fastapi import FastAPI, Body, HTTPException
from fastapi.responses import JSONResponse
import uvicorn
import base64
from typing import List, Dict
from dotenv import load_dotenv, find_dotenv
from static.helper_files.llm import (
    speech_to_text,
    text_to_speech,
    generate_greeting,
    generate_followup_questions,
    generate_differential_diagnosis,
    generate_medical_report,
    process_voice_with_gemini,
    generate_greeting_with_voice
)
from static.helper_files.prompts import VOICE_PROCESSING_SYSTEM_PROMPT

app = FastAPI(
    title="MedConscious AI",
    description="Voice Processing API for Medical Consciousness",
    version="1.0.0"
)

# Store conversation history
conversation_history: List[Dict] = []

@app.post("/initiate-chat/")
async def initiate_chat(patient_info_payload: dict = Body(...)):
    """
    Initialize chat with patient greeting and clear previous history.
    
    Payload initiate-chat:
    {
        "User_Info": {
            "name": "John Doe",
            "email": "abc@xyz.com"
        },
        "audio_base64": "<optional_base64_encoded_audio_for_voice_greeting>"
    }
    """
    global conversation_history
    try:
        conversation_history.clear() # Clear history for a new chat session
        
        user_info = patient_info_payload.get("User_Info", {})
        audio_base64 = patient_info_payload.get("audio_base64", None)
        
        if audio_base64:
            # Use enhanced voice processing for greeting
            result = generate_greeting_with_voice(user_info, audio_base64)
            greeting_text = result["greeting"]
            transcription = result.get("transcription", "")
            
            # Add both user's voice input and AI's greeting to history
            if transcription:
                conversation_history.append({
                    "role": "user",
                    "content": transcription,
                    "user_info": user_info
                })
                
            conversation_history.append({
                "role": "assistant",
                "content": greeting_text
            })
            
            return JSONResponse({
                "message": "Voice greeting processed successfully. Conversation history cleared.",
                "text": greeting_text,
                "transcription": transcription,
                "processing_type": "voice_integrated"
            })
        else:
            # Traditional text-based greeting
            greeting_text = generate_greeting({"User_Info": user_info})
            
            conversation_history.append({
                "role": "assistant",
                "content": greeting_text
            })
            
            return JSONResponse({
                "message": "Greeting generated successfully. Conversation history cleared.",
                "text": greeting_text,
                "processing_type": "text_only"
            })

    except Exception as e:
        print(f"Error in initiate_chat: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.get("/health-check/")
async def health_check():
    """
    Health check endpoint to verify API is running
    """
    return JSONResponse({"status": "API is running"})

@app.post("/process-voice-integrated/")
async def process_voice_integrated(request_data: dict = Body(...)):
    """
    Process voice input directly with Gemini 2.5 Flash Preview for integrated transcription and response
    
    Payload process-voice-integrated:
    {
        "audio_base64": "<base64_encoded_audio>",
        "user_info": {
            "name": "John Doe",
            "email": "abc@xyz.com"
        },
        "conversation_stage": "greeting|followup|diagnosis|report",
        "context": {
            "previous_questions": "optional previous questions",
            "patient_info": "optional patient information"
        }
    }
    """
    global conversation_history
    try:
        audio_base64 = request_data.get('audio_base64', '')
        user_info = request_data.get('user_info', {})
        conversation_stage = request_data.get('conversation_stage', 'followup')
        context = request_data.get('context', {})
        
        if not audio_base64:
            raise ValueError("audio_base64 is required")
        
        # Create stage-specific system prompt
        if conversation_stage == "greeting":
            system_prompt = f"""
{VOICE_PROCESSING_SYSTEM_PROMPT}

**Current Task**: Generate a personalized greeting for the patient and ask initial assessment questions.
**Patient Info**: {user_info}
**Instructions**: After transcribing the audio, provide a warm greeting using the patient's name and begin the medical consultation by asking about their chief complaint or symptoms.
"""
        elif conversation_stage == "followup":
            system_prompt = f"""
{VOICE_PROCESSING_SYSTEM_PROMPT}

**Current Task**: Process patient response and generate appropriate follow-up medical questions.
**Context**: {context}
**Instructions**: After transcribing the audio, analyze the patient's response and ask relevant follow-up questions to gather more diagnostic information. If you have enough information, indicate that you're ready to provide a diagnosis.
"""
        elif conversation_stage == "diagnosis":
            system_prompt = f"""
{VOICE_PROCESSING_SYSTEM_PROMPT}

**Current Task**: Process patient information and provide differential diagnosis.
**Context**: {context}
**Conversation History**: {conversation_history}
**Instructions**: After transcribing the audio, analyze all available information and provide a comprehensive differential diagnosis with recommendations.
"""
        elif conversation_stage == "report":
            system_prompt = f"""
{VOICE_PROCESSING_SYSTEM_PROMPT}

**Current Task**: Generate final medical report and recommendations.
**Context**: {context}
**Conversation History**: {conversation_history}
**Instructions**: After transcribing the audio, generate a comprehensive medical report with diagnosis, treatment recommendations, and follow-up instructions.
"""
        else:
            system_prompt = VOICE_PROCESSING_SYSTEM_PROMPT
        
        # Process voice with Gemini
        result = process_voice_with_gemini(
            audio_base64=audio_base64,
            system_prompt=system_prompt,
            conversation_history=conversation_history
        )
        
        # Update conversation history
        conversation_history.append({
            "role": "user",
            "content": result["transcription"],
            "user_info": user_info
        })
        
        conversation_history.append({
            "role": "assistant",
            "content": result["response"]
        })
        
        return JSONResponse({
            "message": "Voice processed successfully with integrated transcription and response",
            "transcription": result["transcription"],
            "ai_response": result["response"],
            "conversation_stage": conversation_stage,
            "status": "success"
        })
        
    except Exception as e:
        print(f"Error in process_voice_integrated: {str(e)}")
        conversation_history.append({
            "role": "system",
            "content": f"Error processing voice: {str(e)}"
        })
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "status": "error"}
        )

@app.post("/process-response/")
async def process_response(request_data: dict = Body(...)):
    """
    Process patient response, generate follow-up questions, or
    generate diagnosis and report if all information is gathered.
    
    Payload process-response:
    {
        "audio_bytes": "<base64_encoded_audio>",
        "previous_question": "Give me the patient Name, Age, Gender and Symptoms",
        "user_info": { # Basic identification info
            "name": "John Doe",
            "email":"abc@xyz.com"
            }
    }
    """
    global conversation_history
    try:
        audio_bytes_b64 = request_data['audio_bytes']
        previous_question_text = request_data.get('previous_question', '')
        current_user_info = request_data.get('user_info', {})

        # Handle empty audio_bytes (for text-only input)
        if not audio_bytes_b64:
            patient_response_text = request_data.get('text', '')
            if not patient_response_text:
                raise ValueError("Either audio_bytes or text must be provided")
        else:
            # Decode and process audio
            audio_bytes_val = base64.b64decode(audio_bytes_b64)
            patient_response_text = speech_to_text(audio_bytes_val)
        
        # Update conversation history with user's response
        conversation_history.append({
            "role": "user",
            "content": patient_response_text,
            "user_info": current_user_info
        })
        
        # Generate follow-up questions.
        # Assumes generate_followup_questions uses conversation context (implicitly or explicitly)
        # and returns an empty string/list if no more questions are needed.
        followup_payload = {
            "Assistant": previous_question_text,
            "user": patient_response_text
            # Ideally, this function should take conversation_history.
        }
        generated_questions_text = generate_followup_questions(followup_payload)
        
        if generated_questions_text and generated_questions_text.strip(): # If there are more questions
            conversation_history.append({
                "role": "assistant",
                "content": generated_questions_text
            })
            
            return JSONResponse({
                "message": "Response processed successfully. Please answer the following questions.",
                "user_text": patient_response_text,
                "questions": generated_questions_text,
                "status": "questions_pending"
            })
        else: # No more questions, proceed to diagnosis and report
            # --- Generate Diagnosis ---
            # Assumes generate_differential_diagnosis primarily uses conversation_history for clinical context.
            diagnosis_payload = {
                "symptoms": patient_response_text,  # The most recent user response
                "history": conversation_history,    # The full conversation
                "previous_questions": previous_question_text, # The last AI question that prompted the user_response
                "Patient_Info": current_user_info   # User's demographic info
            }
            diagnosis_text = generate_differential_diagnosis(diagnosis_payload)

            # --- Generate Medical Report ---
            # Assumes generate_medical_report uses conversation_history for clinical details (age, gender, symptoms etc.)
            # and patient_data["patient_info"] for basic demographics.
            report_patient_data = {
                "diagnosis": diagnosis_text,
                "patient_info": current_user_info
            }
            final_report_markdown = generate_medical_report(conversation_history, report_patient_data)
            
            conversation_history.append({
                "role": "assistant",
                "content": f"Generated Diagnosis: {diagnosis_text}"
            })
            conversation_history.append({
                "role": "assistant",
                "content": f"Generated Report (markdown): {final_report_markdown}" # Log report for audit
            })

            summary_for_speech = f"I have completed the diagnosis. The key finding is: {diagnosis_text}. Please review the detailed report."
            if len(diagnosis_text) > 150: # Keep spoken summary relatively brief
                summary_for_speech = f"I have completed the diagnosis and generated a report. Please review the detailed report for findings."
            elif not diagnosis_text:
                 summary_for_speech = "I have completed the consultation and generated a report for you. Please review the details."
 
            return JSONResponse({
                "message": "Consultation complete. Diagnosis and report generated.",
                "user_text": patient_response_text,
                "diagnosis_text": diagnosis_text,
                "report_markdown": final_report_markdown,
                "final_response_text": summary_for_speech,
                "status": "complete"
            })

    except Exception as e:
        print(f"Error in process_response: {str(e)}")
        conversation_history.append({
            "role": "system",
            "content": f"Error processing response: {str(e)}"
        })
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "status": "error"}
        )

@app.post("/generate-diagnosis/")
async def generate_diagnosis(request_data: dict = Body(...)):
    """
    Generate differential diagnosis based on patient responses
    
    Payload generate-diagnosis:
    {
        "audio_bytes": "<base64_encoded_audio>",
        "previous_questions": "Follow-up questions",
        "Patient_Info": {
            "name": "John Doe",
            "age": 30,
            "gender":"male",
            "symptoms": "fever, cough",
            "medical_history": "No known allergies"
        },
        "user_info": {
            "name": "John Doe",
            "email":"abc@xyz.com"
        }  
    }
    """
    try:
        # Decode audio to text
        audio_bytes = base64.b64decode(request_data['audio_bytes'])
        patient_response = speech_to_text(audio_bytes)
        
        # Update conversation history
        conversation_history.append({
            "role": "user",
            "content": patient_response
        })
        
        # Generate differential diagnosis
        diagnosis = generate_differential_diagnosis({
            "symptoms": patient_response,
            "history": conversation_history,
            "previous_questions": request_data.get('previous_questions', '')
        })
        
        # Convert diagnosis to speech
        # diagnosis_audio = text_to_speech(diagnosis)
        # diagnosis_audio_base64 = base64.b64encode(diagnosis_audio).decode('utf-8')
        
        return JSONResponse({
            "message": "Diagnosis generated successfully",
            "user_text": patient_response,
            "diagnosis": diagnosis
            # "audio_bytes": diagnosis_audio_base64
        })

    except Exception as e:
        print(f"Error in generate_diagnosis: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.post("/generate-prescription/")
async def generate_prescription(request_data: dict = Body(...)):
    """
    Generate prescription based on chosen diagnosis
    
    payload generate-prescription:
    {   
        "user_info": {
            "name": "John Doe",
            "email":"abc@xyz.com"
        },
        "Patient_Info": {
            "name": "John Doe",
            "age": 30,
            "gender":"male",
            "symptoms": "fever, cough",
            "medical_history": "No known allergies"
        },
        "follow_up_questions": "Follow-up questions",
        "answer": "Patient response",
        "chosen_diagnosis": "Diagnosis",
    }
            
    """
    try:
        # Generate medical report
        prescription = generate_medical_report(
            conversation_history=conversation_history,
            patient_data={
                "chosen_diagnosis": request_data.get('chosen_diagnosis'),
                "patient_info": request_data.get('patient_info', {})
            }
        )
        
        return JSONResponse({
            "message": "Prescription generated successfully",
            "prescription": prescription
        })

    except Exception as e:
        print(f"Error in generate_prescription: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.post("/generate-report/")
async def generate_report(request_data: dict = Body(...)):
    """
    Generate markdown report for PDF conversion

    payload generate-report:
    {   
        "user_info": {
            "name": "John Doe",
            "email":"abc@xyz.com"
        },
        "Patient_Info": {
            "name": "John Doe",
            "age": 30,
            "gender":"male",
            "symptoms": "fever, cough",
            "medical_history": "No known allergies"
        },
        "prescription": "Prescription"
    }
            
    """

    try:
        # Generate detailed markdown report
        report = generate_medical_report(
            conversation_history=conversation_history,
            patient_data={
                "diagnosis": request_data.get('diagnosis'),
                "prescription": request_data.get('prescription'),
                "patient_info": request_data.get('patient_info', {}),
                "doctor_info": request_data.get('doctor_info', {})
            }
        )
        
        return JSONResponse({
            "message": "Report generated successfully",
            "markdown_content": report
        })

    except Exception as e:
        print(f"Error in generate_report: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.post("/process-expo-av-audio/")
async def process_expo_av_audio(request_data: dict = Body(...)):
    """
    Process audio recorded with expo-av, convert to base64 and handle transcription
    
    Payload process-expo-av-audio:
    {
        "audio_base64": "<base64_encoded_audio_from_expo_av>",
        "mime_type": "audio/wav", // or audio/m4a, audio/mp4, etc.
        "previous_question": "Previous AI question",
        "user_info": {
            "name": "John Doe",
            "email": "abc@xyz.com"
        },
        "conversation_stage": "followup" // or "greeting", "diagnosis", "report"
    }
    """
    global conversation_history
    try:
        audio_base64 = request_data.get('audio_base64', '')
        mime_type = request_data.get('mime_type', 'audio/wav')
        previous_question = request_data.get('previous_question', '')
        user_info = request_data.get('user_info', {})
        conversation_stage = request_data.get('conversation_stage', 'followup')
        
        if not audio_base64:
            raise ValueError("audio_base64 is required")
        
        # Decode base64 audio
        audio_bytes = base64.b64decode(audio_base64)
        
        # Transcribe audio using improved speech_to_text function
        transcribed_text = speech_to_text(audio_bytes)
        
        # Update conversation history with user's response
        conversation_history.append({
            "role": "user",
            "content": transcribed_text,
            "user_info": user_info
        })
        
        # Process based on conversation stage
        if conversation_stage == "followup":
            # Generate follow-up questions
            followup_payload = {
                "Assistant": previous_question,
                "user": transcribed_text
            }
            generated_questions = generate_followup_questions(followup_payload)
            
            if generated_questions and generated_questions.strip():
                conversation_history.append({
                    "role": "assistant",
                    "content": generated_questions
                })
                
                return JSONResponse({
                    "message": "Audio processed successfully. Follow-up questions generated.",
                    "transcription": transcribed_text,
                    "questions": generated_questions,
                    "status": "questions_pending",
                    "conversation_stage": conversation_stage
                })
            else:
                # No more questions, proceed to diagnosis
                diagnosis_payload = {
                    "symptoms": transcribed_text,
                    "history": conversation_history,
                    "previous_questions": previous_question,
                    "Patient_Info": user_info
                }
                diagnosis_text = generate_differential_diagnosis(diagnosis_payload)
                
                # Generate medical report
                report_data = {
                    "diagnosis": diagnosis_text,
                    "patient_info": user_info
                }
                report_markdown = generate_medical_report(conversation_history, report_data)
                
                conversation_history.append({
                    "role": "assistant",
                    "content": f"Diagnosis: {diagnosis_text}"
                })
                
                summary_text = f"Based on our conversation, I have completed the diagnosis. Please review the detailed report."
                
                return JSONResponse({
                    "message": "Audio processed successfully. Consultation complete.",
                    "transcription": transcribed_text,
                    "diagnosis_text": diagnosis_text,
                    "report_markdown": report_markdown,
                    "final_response_text": summary_text,
                    "status": "complete",
                    "conversation_stage": "complete"
                })
                
        elif conversation_stage == "diagnosis":
            # Generate diagnosis directly
            diagnosis_payload = {
                "symptoms": transcribed_text,
                "history": conversation_history,
                "previous_questions": previous_question,
                "Patient_Info": user_info
            }
            diagnosis_text = generate_differential_diagnosis(diagnosis_payload)
            
            conversation_history.append({
                "role": "assistant",
                "content": f"Diagnosis: {diagnosis_text}"
            })
            
            return JSONResponse({
                "message": "Audio processed successfully. Diagnosis generated.",
                "transcription": transcribed_text,
                "diagnosis": diagnosis_text,
                "status": "diagnosis_complete",
                "conversation_stage": conversation_stage
            })
            
        else:
            # Default fallback
            return JSONResponse({
                "message": "Audio processed successfully.",
                "transcription": transcribed_text,
                "status": "transcribed",
                "conversation_stage": conversation_stage
            })
        
    except Exception as e:
        print(f"Error in process_expo_av_audio: {str(e)}")
        conversation_history.append({
            "role": "system",
            "content": f"Error processing expo-av audio: {str(e)}"
        })
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "status": "error"}
        )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)