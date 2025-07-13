from fastapi import FastAPI, Body
from helper_functions import *
from dotenv import load_dotenv
import json

load_dotenv()

app = FastAPI()


@app.post("/initialize")
async def initialize_chat(payload: dict = Body(...)):
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


@app.post("/generate_diagnosis")
async def generate_diagnosis(payload: dict = Body(...)):
    voice = payload.get("voice_data")
    data = Process_voice_with_Gemini(voice, prompt=DIFFERENTIAL_DIAGONOSIS_GENERATION_PROMPT.replace("[[patient_details]]", str(payload.get("user_data", {}))))
    return data


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
