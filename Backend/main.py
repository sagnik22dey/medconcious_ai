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

# Store conversation history and current stage
conversation_history: List[Dict] = []
current_stage: str = "initiate_chat"  # Tracks current workflow stage
stage_data: Dict = {}  # Stores data accumulated through stages

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
    Process patient response and determine next stage based on LLM flags.
    
    Workflow: initiate_chat -> process_response -> generate_diagnosis -> generate_prescription -> generate_report
    
    Payload process-response:
    {
        "audio_bytes": "<base64_encoded_audio>",
        "previous_question": "Give me the patient Name, Age, Gender and Symptoms",
        "user_info": { # Basic identification info
            "name": "John Doe",
            "email":"abc@xyz.com"
        },
        "current_stage": "process_response" # Optional, will be determined automatically
    }
    """
    global conversation_history, current_stage, stage_data
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
            audio_format = request_data.get('audio_format', 'audio/m4a')
            patient_response_text = speech_to_text(audio_bytes_val, audio_format)
        
        # Update conversation history with user's response
        conversation_history.append({
            "role": "user",
            "content": patient_response_text,
            "user_info": current_user_info
        })
        
        # Generate follow-up questions with stage progression flag
        followup_payload = {
            "Assistant": previous_question_text,
            "user": patient_response_text,
            "conversation_history": conversation_history
        }
        
        followup_result = generate_followup_questions(followup_payload)
        
        # Parse the result to check for ready_for_diagnosis flag
        import json
        try:
            if isinstance(followup_result, str):
                followup_data = json.loads(followup_result)
            else:
                followup_data = followup_result
        except:
            # Fallback for old format
            followup_data = {"content": followup_result, "ready_for_diagnosis": False}
        
        ready_for_diagnosis = followup_data.get("ready_for_diagnosis", False)
        
        if not ready_for_diagnosis and followup_data.get("content"):
            # More questions needed
            content = followup_data["content"]
            if isinstance(content, list):
                questions_text = " ".join(str(q) for q in content)
            elif isinstance(content, str):
                questions_text = content
            else:
                questions_text = str(content)
            
            conversation_history.append({
                "role": "assistant",
                "content": questions_text
            })
            
            return JSONResponse({
                "message": "Response processed successfully. Please answer the following questions.",
                "user_text": patient_response_text,
                "questions": questions_text,
                "current_stage": "process_response",
                "next_stage": "process_response",  # Stay in same stage
                "status": "questions_pending"
            })
        else:
            # Ready for diagnosis - advance to next stage
            current_stage = "generate_diagnosis"
            stage_data["user_responses"] = [msg for msg in conversation_history if msg["role"] == "user"]
            
            return JSONResponse({
                "message": "Sufficient information gathered. Ready for diagnosis.",
                "user_text": patient_response_text,
                "current_stage": "process_response",
                "next_stage": "generate_diagnosis",
                "status": "ready_for_diagnosis",
                "stage_data": {
                    "patient_summary": followup_data.get("patient_summary", {}),
                    "total_responses": len([msg for msg in conversation_history if msg["role"] == "user"])
                }
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
    Generate differential diagnosis and determine if ready for prescription stage.
    
    Payload generate-diagnosis:
    {
        "user_info": {
            "name": "John Doe",
            "email":"abc@xyz.com"
        },
        "audio_bytes": "<optional_base64_encoded_audio>",
        "text_input": "<optional_text_input>",
        "stage_data": {
            "patient_summary": {...},
            "conversation_history": [...]
        }
    }
    """
    global conversation_history, current_stage, stage_data
    try:
        current_user_info = request_data.get('user_info', {})
        
        # Handle optional additional input
        additional_input = ""
        if request_data.get('audio_bytes'):
            audio_bytes = base64.b64decode(request_data['audio_bytes'])
            audio_format = request_data.get('audio_format', 'audio/m4a')
            additional_input = speech_to_text(audio_bytes, audio_format)
        elif request_data.get('text_input'):
            additional_input = request_data['text_input']
        
        if additional_input:
            conversation_history.append({
                "role": "user",
                "content": additional_input,
                "user_info": current_user_info
            })
        
        # Generate differential diagnosis with stage progression flag
        diagnosis_payload = {
            "symptoms": additional_input or "Based on conversation history",
            "history": conversation_history,
            "previous_questions": "",
            "Patient_Info": current_user_info
        }
        
        diagnosis_result = generate_differential_diagnosis(diagnosis_payload)
        
        # Parse diagnosis result to check for ready_for_prescription flag
        import json
        try:
            if isinstance(diagnosis_result, str):
                diagnosis_data = json.loads(diagnosis_result)
            else:
                diagnosis_data = diagnosis_result
        except:
            # Fallback for old format
            diagnosis_data = {
                "differential_diagnosis": diagnosis_result,
                "ready_for_prescription": True,  # Default to ready
                "primary_diagnosis": "Diagnosis needs review"
            }
        
        ready_for_prescription = diagnosis_data.get("ready_for_prescription", True)
        primary_diagnosis = diagnosis_data.get("primary_diagnosis", "See differential diagnosis")
        
        # Update conversation history
        conversation_history.append({
            "role": "assistant",
            "content": f"Diagnosis generated: {primary_diagnosis}"
        })
        
        # Store diagnosis data for next stage
        stage_data["diagnosis_data"] = diagnosis_data
        
        if ready_for_prescription:
            # Advance to prescription stage
            current_stage = "generate_prescription"
            next_stage = "generate_prescription"
            status = "ready_for_prescription"
            message = "Diagnosis completed. Ready to generate prescription."
        else:
            # Stay in diagnosis stage, may need more information
            next_stage = "generate_diagnosis"
            status = "diagnosis_uncertain"
            message = "Diagnosis generated but requires further evaluation before prescription."
        
        return JSONResponse({
            "message": message,
            "user_text": additional_input,
            "diagnosis_data": diagnosis_data,
            "primary_diagnosis": primary_diagnosis,
            "confidence_level": diagnosis_data.get("confidence_level", "Medium"),
            "current_stage": "generate_diagnosis",
            "next_stage": next_stage,
            "status": status,
            "ready_for_prescription": ready_for_prescription
        })

    except Exception as e:
        print(f"Error in generate_diagnosis: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "status": "error"}
        )

@app.post("/generate-prescription/")
async def generate_prescription(request_data: dict = Body(...)):
    """
    Generate prescription based on diagnosis and determine if ready for final report.
    
    payload generate-prescription:
    {
        "user_info": {
            "name": "John Doe",
            "email":"abc@xyz.com"
        },
        "chosen_diagnosis": "Primary diagnosis name",
        "diagnosis_data": {
            "differential_diagnosis": [...],
            "primary_diagnosis": "...",
            "confidence_level": "High/Medium/Low"
        },
        "additional_notes": "Optional additional input from patient"
    }
    """
    global conversation_history, current_stage, stage_data
    try:
        from static.helper_files.prompts import PRESCRIPTION_GENERATION_PROMPT
        from static.helper_files.llm import generate_llm_response
        from static.helper_files.functions import parse_text_to_json
        
        current_user_info = request_data.get('user_info', {})
        chosen_diagnosis = request_data.get('chosen_diagnosis', '')
        diagnosis_data = request_data.get('diagnosis_data', stage_data.get('diagnosis_data', {}))
        additional_notes = request_data.get('additional_notes', '')
        
        if additional_notes:
            conversation_history.append({
                "role": "user",
                "content": additional_notes,
                "user_info": current_user_info
            })
        
        # Prepare prescription generation payload
        prescription_payload = {
            "diagnosis": chosen_diagnosis or diagnosis_data.get('primary_diagnosis', ''),
            "patient_info": current_user_info,
            "diagnosis_data": diagnosis_data,
            "conversation_history": conversation_history
        }
        
        # Generate prescription using the new prompt
        prompt = f"system instruction:{PRESCRIPTION_GENERATION_PROMPT}\n\nPrescription Data: {prescription_payload}"
        
        prescription_result = generate_llm_response(prompt=prompt)
        
        # Parse prescription result to check for ready_for_report flag
        import json
        try:
            if isinstance(prescription_result, str):
                prescription_data = json.loads(prescription_result)
            else:
                prescription_data = prescription_result
        except:
            # Fallback for old format
            prescription_data = {
                "prescription": prescription_result,
                "ready_for_report": True,  # Default to ready
                "confidence_level": "Medium"
            }
        
        ready_for_report = prescription_data.get("ready_for_report", True)
        
        # Update conversation history
        conversation_history.append({
            "role": "assistant",
            "content": f"Prescription generated for {chosen_diagnosis}"
        })
        
        # Store prescription data for next stage
        stage_data["prescription_data"] = prescription_data
        
        if ready_for_report:
            # Advance to final report stage
            current_stage = "generate_report"
            next_stage = "generate_report"
            status = "ready_for_report"
            message = "Prescription completed. Ready to generate final report."
        else:
            # Stay in prescription stage, may need modifications
            next_stage = "generate_prescription"
            status = "prescription_review_needed"
            message = "Prescription generated but may need review or modification."
        
        return JSONResponse({
            "message": message,
            "prescription_data": prescription_data,
            "prescription_summary": prescription_data.get("prescription", {}),
            "confidence_level": prescription_data.get("confidence_level", "Medium"),
            "current_stage": "generate_prescription",
            "next_stage": next_stage,
            "status": status,
            "ready_for_report": ready_for_report
        })

    except Exception as e:
        print(f"Error in generate_prescription: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "status": "error"}
        )

@app.post("/generate-report/")
async def generate_report(request_data: dict = Body(...)):
    """
    Generate final comprehensive medical report and complete the consultation workflow.

    payload generate-report:
    {
        "user_info": {
            "name": "John Doe",
            "email":"abc@xyz.com"
        },
        "diagnosis_data": {
            "primary_diagnosis": "...",
            "differential_diagnosis": [...]
        },
        "prescription_data": {
            "prescription": {...},
            "medications": [...]
        },
        "additional_notes": "Optional final notes"
    }
    """
    global conversation_history, current_stage, stage_data
    try:
        from static.helper_files.prompts import FINAL_REPORT_GENERATION_PROMPT
        from static.helper_files.llm import generate_llm_response
        
        current_user_info = request_data.get('user_info', {})
        diagnosis_data = request_data.get('diagnosis_data', stage_data.get('diagnosis_data', {}))
        prescription_data = request_data.get('prescription_data', stage_data.get('prescription_data', {}))
        additional_notes = request_data.get('additional_notes', '')
        
        if additional_notes:
            conversation_history.append({
                "role": "user",
                "content": additional_notes,
                "user_info": current_user_info
            })
        
        # Prepare comprehensive report generation payload
        report_payload = {
            "patient_info": current_user_info,
            "conversation_history": conversation_history,
            "diagnosis_data": diagnosis_data,
            "prescription_data": prescription_data,
            "consultation_summary": {
                "total_interactions": len([msg for msg in conversation_history if msg["role"] == "user"]),
                "stages_completed": ["initiate_chat", "process_response", "generate_diagnosis", "generate_prescription", "generate_report"],
                "primary_diagnosis": diagnosis_data.get('primary_diagnosis', 'Not specified'),
                "prescription_provided": bool(prescription_data)
            }
        }
        
        # Generate final comprehensive report
        prompt = f"system instruction:{FINAL_REPORT_GENERATION_PROMPT}\n\nReport Data: {report_payload}"
        
        report_result = generate_llm_response(prompt=prompt)
        
        # Parse report result
        import json
        try:
            if isinstance(report_result, str):
                report_data = json.loads(report_result)
            else:
                report_data = report_result
        except:
            # Fallback for old format
            report_data = {
                "medical_report": report_result,
                "consultation_complete": True,
                "summary": "Consultation completed successfully"
            }
        
        # Mark consultation as complete
        current_stage = "completed"
        consultation_complete = report_data.get("consultation_complete", True)
        
        # Update conversation history with final report
        conversation_history.append({
            "role": "assistant",
            "content": "Final medical report generated. Consultation completed."
        })
        
        # Store final report data
        stage_data["final_report"] = report_data
        
        return JSONResponse({
            "message": "Comprehensive medical report generated successfully. Consultation completed.",
            "report_data": report_data,
            "medical_report": report_data.get("medical_report", {}),
            "summary": report_data.get("summary", ""),
            "next_steps": report_data.get("next_steps", ""),
            "current_stage": "generate_report",
            "next_stage": "completed",
            "status": "consultation_complete",
            "consultation_complete": consultation_complete,
            "workflow_summary": {
                "stages_completed": ["initiate_chat", "process_response", "generate_diagnosis", "generate_prescription", "generate_report"],
                "total_user_interactions": len([msg for msg in conversation_history if msg["role"] == "user"]),
                "final_diagnosis": diagnosis_data.get('primary_diagnosis', 'See report'),
                "prescription_provided": bool(prescription_data),
                "report_format": report_data.get("report_format", "json")
            }
        })

    except Exception as e:
        print(f"Error in generate_report: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "status": "error"}
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
        transcribed_text = speech_to_text(audio_bytes, mime_type)
        
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
            
            # Handle both old string format and new dict format
            if isinstance(generated_questions, dict):
                questions_content = generated_questions.get("content", [])
                if isinstance(questions_content, list):
                    questions_text = " ".join(str(q) for q in questions_content)
                else:
                    questions_text = str(questions_content)
                
                # Check if ready for diagnosis
                ready_for_diagnosis = generated_questions.get("ready_for_diagnosis", False)
                if ready_for_diagnosis:
                    # Move to diagnosis stage instead of asking more questions
                    questions_text = "Based on your responses, I have sufficient information to proceed with diagnosis."
            else:
                questions_text = str(generated_questions) if generated_questions else ""
                ready_for_diagnosis = False
            
            if questions_text and questions_text.strip():
                conversation_history.append({
                    "role": "assistant",
                    "content": questions_text
                })
                
                return JSONResponse({
                    "message": "Audio processed successfully. Follow-up questions generated.",
                    "transcription": transcribed_text,
                    "questions": questions_text,
                    "status": "questions_pending" if not ready_for_diagnosis else "ready_for_diagnosis",
                    "conversation_stage": conversation_stage,
                    "ready_for_diagnosis": ready_for_diagnosis
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

@app.post("/process-text/")
async def process_text(request_data: dict = Body(...)):
    """
    Fallback endpoint for text-only processing when speech-to-text is unavailable
    
    Payload process-text:
    {
        "user_text": "Patient's typed response",
        "previous_question": "Previous AI question",
        "user_info": {
            "name": "John Doe",
            "email": "abc@xyz.com"
        }
    }
    """
    global conversation_history, current_stage, stage_data
    try:
        user_text = request_data.get('user_text', '')
        previous_question = request_data.get('previous_question', '')
        current_user_info = request_data.get('user_info', {})
        
        if not user_text.strip():
            raise ValueError("user_text is required")
        
        # Update conversation history with user's response
        conversation_history.append({
            "role": "user",
            "content": user_text,
            "user_info": current_user_info
        })
        
        # Generate follow-up questions with stage progression flag
        followup_payload = {
            "Assistant": previous_question,
            "user": user_text,
            "conversation_history": conversation_history
        }
        
        followup_result = generate_followup_questions(followup_payload)
        
        # Parse the result to check for ready_for_diagnosis flag
        import json
        try:
            if isinstance(followup_result, str):
                followup_data = json.loads(followup_result)
            else:
                followup_data = followup_result
        except:
            # Fallback for old format
            followup_data = {"content": followup_result, "ready_for_diagnosis": False}
        
        ready_for_diagnosis = followup_data.get("ready_for_diagnosis", False)
        
        if not ready_for_diagnosis and followup_data.get("content"):
            # More questions needed
            content = followup_data["content"]
            if isinstance(content, list):
                questions_text = " ".join(str(q) for q in content)
            elif isinstance(content, str):
                questions_text = content
            else:
                questions_text = str(content)
            
            conversation_history.append({
                "role": "assistant",
                "content": questions_text
            })
            
            return JSONResponse({
                "message": "Text processed successfully. Please answer the following questions.",
                "user_text": user_text,
                "questions": questions_text,
                "current_stage": "process_response",
                "next_stage": "process_response",
                "status": "questions_pending"
            })
        else:
            # Ready for diagnosis - advance to next stage
            current_stage = "generate_diagnosis"
            stage_data["user_responses"] = [msg for msg in conversation_history if msg["role"] == "user"]
            
            return JSONResponse({
                "message": "Sufficient information gathered. Ready for diagnosis.",
                "user_text": user_text,
                "current_stage": "process_response",
                "next_stage": "generate_diagnosis",
                "status": "ready_for_diagnosis",
                "stage_data": {
                    "patient_summary": followup_data.get("patient_summary", {}),
                    "total_responses": len([msg for msg in conversation_history if msg["role"] == "user"])
                }
            })

    except Exception as e:
        print(f"Error in process_text: {str(e)}")
        conversation_history.append({
            "role": "system",
            "content": f"Error processing text: {str(e)}"
        })
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "status": "error"}
        )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)