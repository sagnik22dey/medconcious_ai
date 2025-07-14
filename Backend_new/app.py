from fastapi import FastAPI, Body, BackgroundTasks
from helper_functions import *
from helper_functions.db_handler import SupabaseHandler
from helper_functions.Gemini_handler import (
    transcribe_audio_with_gemini,
)  # Explicitly import
from dotenv import load_dotenv
import json
from datetime import datetime

load_dotenv()

app = FastAPI()

supabase_handler = SupabaseHandler()


@app.post("/initialize")
async def initialize_chat(background_tasks: BackgroundTasks, payload: dict = Body(...)):
    """
    Expected payload:
    {
        "voice_data": "base64_encoded_audio_data"
    }

    output:
    error output:
    {
        "status": "error",
        "message": "Error message in base64 encoded audio format"
    }

    success output:
    {
        "status": "success",
        "questions": [q1, q2, ...]
    }

    """

    voice = payload.get("voice_data")
    base64_to_audio_file(voice, "user_voice.mp3")
    data = Process_voice_with_Gemini(voice, validation_prompt)
    print(data)

    # Define background tasks
    def process_initial_data(email: str, voice_data: str, patient_data: dict):
        # Transcribe user's initial voice input
        user_transcript = transcribe_audio_with_gemini(voice_data)

        # Prepare conversation history entry
        conversation_entry = {
            "email": email,
            "conversation_history": {
                "AI": "Hi Welcome to Medconcious Chat, Please state your patient's Name, Age , Gender and the Symptoms they are experiencing. Share any additional Information that will help the diagnosis",
                "Doctor": user_transcript,
            },
        }
        # Insert conversation history
        history_response = supabase_handler.conversation_history(conversation_entry)
        if history_response:
            print(
                f"Conversation history inserted successfully: {history_response.data}"
            )
        else:
            print("Failed to insert conversation history.")

        # Construct patient data for Supabase
        patient_data_to_insert = {
            "email": email,
            "age": patient_data.get("age"),
            "gender": patient_data.get("Gender"),
            "symptoms": patient_data.get("symptoms"),
            "additional_info": patient_data.get("additional_info", None),
        }

        # Insert patient information into Supabase
        patient_insert_response = supabase_handler.insert_patient_info(
            patient_data_to_insert
        )
        if patient_insert_response:
            print(f"Patient info inserted successfully: {patient_insert_response.data}")
        else:
            print("Failed to insert patient info.")

    # Add the processing to background tasks
    background_tasks.add_task(
        process_initial_data, payload.get("email", ""), voice, data
    )

    if data.get("age") == None:
        print("Age not provided or invalid.")
        return {
            "status": "error",
            "message": text_to_speech("Age not provided or invalid."),
        }

    if data.get("Gender") == None:
        print("Gender not provided.")
        return {
            "status": "error",
            "message": text_to_speech("Please provide patient Gender details."),
        }

    if data.get("symptoms") == None:
        print("Symptoms not provided or invalid.")
        return {
            "status": "error",
            "message": text_to_speech("Symptoms not provided or invalid."),
        }
    # Construct patient data for Supabase
    patient_data_to_insert = {
        "email": payload.get("email", ""),  # Assuming email is in the payload
        "age": data.get("age"),
        "gender": data.get("Gender"),
        "symptoms": data.get("symptoms"),
        "additional_info": data.get("additional_info", None),
    }

    # Insert patient information into Supabase
    response = supabase_handler.insert_patient_info(patient_data_to_insert)
    if response:
        print(f"Patient info inserted successfully: {response.data}")
    else:
        print("Failed to insert patient info.")

    feedback_questions = generate_with_gemini(str(data), QUESTION_GENERATION_PROMPT_B2B)
    feedback_questions = feedback_questions.get("questions", [])
    speech_data = text_to_speech_concurrent(
        feedback_questions, language=data.get("detected_language", "English")
    )
    audio_list = speech_data.get("data", [])

    datafinal = {"status": "success", "questions": audio_list, "user_data": data}
    with open("user_data.json", "w") as f:
        json.dump(datafinal, f, indent=4)
    return datafinal


# @app.post("/generate_diagnosis")
# async def generate_diagnosis(
#     background_tasks: BackgroundTasks, payload: list = Body(...)
# ):
#     # Expected payload: [{"question": audio_base64, "answer": audio_base64}, ...]

#     # Extract email from the first question/answer pair if available, or use a default
#     email = ""
#     if (
#         payload
#         and isinstance(payload, list)
#         and len(payload) > 0
#         and "email" in payload[0]
#     ):
#         email = payload[0].get("email", "")

#     # Define background task for processing diagnosis data
#     def process_diagnosis_data(email: str, qa_pairs: list):
#         full_conversation_text = ""
#         for item in qa_pairs:
#             question_transcript = transcribe_audio_with_gemini(item.get("question", ""))
#             answer_transcript = transcribe_audio_with_gemini(item.get("answer", ""))
#             full_conversation_text += f"AI: {question_transcript}\n"
#             full_conversation_text += f"Doctor: {answer_transcript}\n"

#         # Store the full conversation in conversation_history
#         if email:
#             conversation_entry = {
#                 "email": email,
#                 "conversation_history": {
#                     "follow_up_conversation": full_conversation_text
#                 },
#             }
#             history_response = supabase_handler.conversation_history(conversation_entry)
#             if history_response:
#                 print(
#                     f"Follow-up conversation history inserted successfully: {history_response.data}"
#                 )
#             else:
#                 print("Failed to insert follow-up conversation history.")

#         # Process with Gemini for diagnosis
#         # This part assumes DIFFERENTIAL_DIAGONOSIS_GENERATION_PROMPT uses patient_details
#         # If the prompt needs the full conversation, it should be passed here.
#         # For now, let's assume it needs the user_data that was passed previously.
#         # This part of the prompt needs to be updated to reflect the new conversation structure.
#         # For simplicity, let's just use the full_conversation_text as part of the prompt.

#         # You might need to retrieve patient_details from the database using the email
#         # or have the frontend send it again. For now, I'll pass the full_conversation_text.
#         diagnosis_prompt = DIFFERENTIAL_DIAGONOSIS_GENERATION_PROMPT.replace(
#             "[[patient_details]]", full_conversation_text
#         )
#         diagnosis_data = Process_voice_with_Gemini(
#             "", prompt=diagnosis_prompt
#         )  # No voice input here, just text prompt

#         # You might want to store diagnosis_data in the database as well
#         print(f"Diagnosis generated: {diagnosis_data}")

#     # Add the processing to background tasks
#     background_tasks.add_task(process_diagnosis_data, email, payload)

#     # Return a success response immediately, as diagnosis is in background
#     return {
#         "status": "success",
#         "message": "Diagnosis processing initiated in background.",
#     }

@app.post("/generate_diagnosis")
async def generate_diagnosis(payload: dict = Body(...)):
    with open("user_data.json", "w") as f:
        json.dump(payload, f)
    file = "user_data.json"
    object = json.load(open(file, "r"))
    data = object.get("questions", [])
    diagnosis = Process_parts_with_Gemini(data, DIFFERENTIAL_DIAGONOSIS_GENERATION_PROMPT.replace("[[patient_details]]", str(object.get("user_data", {}))))
    # diagnosis = Process_parts_with_Gemini(payload, DIFFERENTIAL_DIAGONOSIS_GENERATION_PROMPT.replace("[[patient_details]]", str(payload.get("user_data", {}))))
    return diagnosis


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
