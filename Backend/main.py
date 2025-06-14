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
    generate_medical_report
)

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
            }
    }
    """
    global conversation_history
    try:
        conversation_history.clear() # Clear history for a new chat session
        
        user_info = patient_info_payload.get("User_Info", {})
        greeting_text = generate_greeting(user_info) # Pass user_info
        
        # Convert greeting to speech
        # greeting_audio = text_to_speech(greeting_text)
        # greeting_audio_base64 = base64.b64encode(greeting_audio).decode('utf-8')
        
        # Add AI's greeting to history
        conversation_history.append({
            "role": "assistant",
            "content": greeting_text,
            # "user_info": user_info # user_info associated with the assistant's greeting context
        })
        
        return JSONResponse({
            "message": "Greeting generated successfully. Conversation history cleared.",
            "text": greeting_text
            # "audio_bytes": greeting_audio_base64
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
            
            # questions_audio = text_to_speech(generated_questions_text)
            # questions_audio_base64 = base64.b64encode(questions_audio).decode('utf-8')
            
            return JSONResponse({
                "message": "Response processed successfully. Please answer the following questions.",
                "user_text": patient_response_text,
                "questions": generated_questions_text,
                # "audio_bytes": questions_audio_base64,
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


            # final_audio = text_to_speech(summary_for_speech)
            # final_audio_base64 = base64.b64encode(final_audio).decode('utf-8')
 
            return JSONResponse({
                "message": "Consultation complete. Diagnosis and report generated.",
                "user_text": patient_response_text,
                "diagnosis_text": diagnosis_text,
                "report_markdown": final_report_markdown,
                "final_response_text": summary_for_speech,
                # "audio_bytes": final_audio_base64,
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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)