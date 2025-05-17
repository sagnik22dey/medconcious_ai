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
conversation_history = []

@app.post("/initiate-chat/")
async def initiate_chat(patient_info: dict = Body(...)):
    """
    Initialize chat with patient greeting
    """
    try:
        # Generate greeting using patient info
        greeting_text = generate_greeting(patient_info)
        
        # Convert greeting to speech
        greeting_audio = text_to_speech(greeting_text)
        greeting_audio_base64 = base64.b64encode(greeting_audio).decode('utf-8')
        
        return JSONResponse({
            "message": "Greeting generated successfully",
            "text": greeting_text,
            "audio_bytes": greeting_audio_base64
        })

    except Exception as e:
        print(f"Error in initiate_chat: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.post("/process-response/")
async def process_response(request_data: dict = Body(...)):
    """
    Process patient response and generate follow-up questions
    """
    try:
        # Decode audio to text
        audio_bytes = base64.b64decode(request_data['audio_bytes'])
        patient_response = speech_to_text(audio_bytes)
        
        # Update conversation history
        conversation_history.append({
            "role": "user",
            "content": patient_response,
            "user_info": request_data.get('user_info', {})
        })
        
        # Generate follow-up questions
        questions = generate_followup_questions({
            "Assistant": request_data.get('previous_question', ''),
            "user": patient_response
        })
        
        # Convert questions to speech
        questions_audio = text_to_speech(questions)
        questions_audio_base64 = base64.b64encode(questions_audio).decode('utf-8')
        
        return JSONResponse({
            "message": "Response processed successfully",
            "user_text": patient_response,
            "questions": questions,
            "audio_bytes": questions_audio_base64
        })

    except Exception as e:
        print(f"Error in process_response: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.post("/generate-diagnosis/")
async def generate_diagnosis(request_data: dict = Body(...)):
    """
    Generate differential diagnosis based on patient responses
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
        diagnosis_audio = text_to_speech(diagnosis)
        diagnosis_audio_base64 = base64.b64encode(diagnosis_audio).decode('utf-8')
        
        return JSONResponse({
            "message": "Diagnosis generated successfully",
            "user_text": patient_response,
            "diagnosis": diagnosis,
            "audio_bytes": diagnosis_audio_base64
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