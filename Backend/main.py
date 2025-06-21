from fastapi import FastAPI, Body, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import base64
import asyncio
import json
from typing import List, Dict
from dotenv import load_dotenv, find_dotenv
import os
import tempfile
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

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Store conversation history
conversation_history: List[Dict] = []

async def process_audio_stream(audio_base64: str, file_name: str):
    """
    A generator function that processes audio and yields progress updates.
    """
    global conversation_history
    try:
        # 1. Save the audio file
        yield json.dumps({"status": "saving", "message": "Saving audio file..."}) + "\n"
        audio_bytes = base64.b64decode(audio_base64)
        output_dir = "audio_files"
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        file_path = os.path.join(output_dir, file_name)
        with open(file_path, "wb") as f:
            f.write(audio_bytes)
        yield json.dumps({"status": "saved", "message": "Audio saved.", "filePath": file_path}) + "\n"
        await asyncio.sleep(0.1)
        await asyncio.sleep(0)  # Flush buffer

        # 2. Transcribe audio to text
        yield json.dumps({"status": "transcribing", "message": "Transcribing audio..."}) + "\n"
        patient_response_text = speech_to_text(file_path)
        if not patient_response_text or not patient_response_text.strip():
            yield json.dumps({"status": "error", "error": "Could not understand audio. Please try again."}) + "\n"
            return

        yield json.dumps({"status": "transcribed", "user_text": patient_response_text}) + "\n"
        await asyncio.sleep(0.1)
        await asyncio.sleep(0)  # Flush buffer

        # 3. Update conversation history
        previous_question_text = "Give me the patient Name, Age, Gender and Symptoms" # Example, can be passed in
        current_user_info = {"name": "John Doe", "email": "abc@xyz.com"} # Example
        
        conversation_history.append({
            "role": "user",
            "content": patient_response_text,
            "user_info": current_user_info
        })

        # 4. Generate follow-up questions
        yield json.dumps({"status": "generating_questions", "message": "Generating follow-up questions..."}) + "\n"
        followup_payload = {
            "Assistant": previous_question_text,
            "user": patient_response_text
        }
        generated_questions_text = generate_followup_questions(followup_payload)
        await asyncio.sleep(0.1)

        if generated_questions_text and generated_questions_text.strip():
            conversation_history.append({
                "role": "assistant",
                "content": generated_questions_text
            })
            yield json.dumps({
                "status": "questions_pending",
                "questions": generated_questions_text,
                "message": "Response processed. Please answer the questions."
            }) + "\n"
            await asyncio.sleep(0)  # Flush buffer
        else:
            # 5. No more questions, generate diagnosis and report
            yield json.dumps({"status": "generating_diagnosis", "message": "Generating diagnosis..."}) + "\n"
            diagnosis_payload = {
                "symptoms": patient_response_text,
                "history": conversation_history,
                "previous_questions": previous_question_text,
                "Patient_Info": current_user_info
            }
            diagnosis_text = generate_differential_diagnosis(diagnosis_payload)
            await asyncio.sleep(0.1)

            yield json.dumps({"status": "generating_report", "message": "Generating medical report..."}) + "\n"
            report_patient_data = {
                "diagnosis": diagnosis_text,
                "patient_info": current_user_info
            }
            final_report_markdown = generate_medical_report(conversation_history, report_patient_data)
            
            summary_for_speech = f"I have completed the diagnosis. The key finding is: {diagnosis_text}. Please review the detailed report."

            yield json.dumps({
                "status": "complete",
                "message": "Consultation complete.",
                "diagnosis_text": diagnosis_text,
                "report_markdown": final_report_markdown,
                "final_response_text": summary_for_speech
            }) + "\n"
            await asyncio.sleep(0)  # Flush buffer

    except Exception as e:
        print(f"Error in process_audio_stream: {str(e)}")
        yield json.dumps({"status": "error", "error": str(e)}) + "\n"

async def process_text_input(user_text: str, previous_question: str, user_info: dict):
    """
    Processes user text input and yields progress updates.
    """
    global conversation_history
    try:
        # 1. Update conversation history
        conversation_history.append({
            "role": "user",
            "content": user_text,
            "user_info": user_info
        })

        # 2. Generate follow-up questions
        yield json.dumps({"status": "generating_questions", "message": "Generating follow-up questions..."}) + "\n"
        followup_payload = {
            "Assistant": previous_question,
            "user": user_text
        }
        generated_questions_text = generate_followup_questions(followup_payload)
        await asyncio.sleep(0.1)

        if generated_questions_text and generated_questions_text.strip():
            conversation_history.append({
                "role": "assistant",
                "content": generated_questions_text
            })
            yield json.dumps({
                "status": "questions_pending",
                "questions": generated_questions_text,
                "message": "Response processed. Please answer the questions."
            }) + "\n"
        else:
            # 3. No more questions, generate diagnosis and report
            yield json.dumps({"status": "generating_diagnosis", "message": "Generating diagnosis..."}) + "\n"
            diagnosis_payload = {
                "symptoms": user_text,
                "history": conversation_history,
                "previous_questions": previous_question,
                "Patient_Info": user_info
            }
            diagnosis_text = generate_differential_diagnosis(diagnosis_payload)
            await asyncio.sleep(0.1)

            yield json.dumps({"status": "generating_report", "message": "Generating medical report..."}) + "\n"
            report_patient_data = {
                "diagnosis": diagnosis_text,
                "patient_info": user_info
            }
            final_report_markdown = generate_medical_report(conversation_history, report_patient_data)
            
            summary_for_speech = f"I have completed the diagnosis. The key finding is: {diagnosis_text}. Please review the detailed report."

            yield json.dumps({
                "status": "complete",
                "message": "Consultation complete.",
                "diagnosis_text": diagnosis_text,
                "report_markdown": final_report_markdown,
                "final_response_text": summary_for_speech
            }) + "\n"

    except Exception as e:
        print(f"Error in process_text_input: {str(e)}")
        yield json.dumps({"status": "error", "error": str(e)}) + "\n"

@app.post("/upload-audio/")
async def upload_audio_and_process_stream(request_data: dict = Body(...)):
    """
    Upload an audio file, save it, and then stream the processing results.
    """
    file_name = request_data.get('fileName')
    audio_base64 = request_data.get('audio_base64')

    if not file_name or not audio_base64:
        raise HTTPException(status_code=400, detail="fileName and audio_base64 are required.")

    return StreamingResponse(
        process_audio_stream(audio_base64, file_name),
        media_type="application/x-ndjson"
    )

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
        greeting_audio = text_to_speech(greeting_text)
        greeting_audio_base64 = base64.b64encode(greeting_audio).decode('utf-8')
        
        # Add AI's greeting to history
        conversation_history.append({
            "role": "assistant",
            "content": greeting_text,
            # "user_info": user_info # user_info associated with the assistant's greeting context
        })
        
        return JSONResponse({
            "message": "Greeting generated successfully. Conversation history cleared.",
            "text": greeting_text,
            "audio_bytes": greeting_audio_base64
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


@app.post("/process-text/")
async def process_text(request_data: dict = Body(...)):
    """
    Process text input from the user and stream back the results.
    """
    user_text = request_data.get('user_text')
    previous_question = request_data.get('previous_question')
    user_info = request_data.get('user_info')

    if not user_text:
        raise HTTPException(status_code=400, detail="user_text is required.")

    return StreamingResponse(
        process_text_input(user_text, previous_question, user_info),
        media_type="application/x-ndjson"
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
        audio_base64 = request_data['audio_bytes']
        audio_bytes = base64.b64decode(audio_base64)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_audio:
            tmp_audio_path = tmp_audio.name
            tmp_audio.write(audio_bytes)
        
        try:
            patient_response = speech_to_text(tmp_audio_path)
        finally:
            os.remove(tmp_audio_path)
        
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