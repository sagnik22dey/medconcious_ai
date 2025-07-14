from .Gemini_handler import generate_with_gemini, validation_prompt, Process_voice_with_Gemini, Process_parts_with_Gemini
from .tts import text_to_speech, audio_bytes_to_base64, base64_to_audio_file, text_to_speech_concurrent

QUESTION_GENERATION_PROMPT_B2B = '''
# Clinical Assessment Question Generator

## Instructions

Based on the provided patient data, generate essential diagnostic questions tailored to the specific patient. Extract all available information and generate clinically relevant questions.
Note that Patient himself / someone in place of them will answer these question and we will do a diagnosis based on the answers provided by them.


## Output Requirements

Your response must strictly adhere to the following JSON format:

```json
{
  "questions": [question1, question2, ...]
}
```

## Important Notes

- Focus on clinical efficiency - generate only the minimum number of questions necessary for comprehensive assessment
- Ensure questions follow standard clinical interviewing practices
- The questions should be directly relevant to the patient data provided
- you can ask at most 5 questions and at least 3 questions.
'''

DIFFERENTIAL_DIAGONOSIS_GENERATION_PROMPT = """# Clinical Differential Diagnosis Generator

## Instructions

Generate a comprehensive differential diagnosis based on the provided patient information. Your output MUST be in valid JSON format exactly as specified below.

## Output Format Requirements

Your response must be a single valid JSON object with the following structure:

```json
{
  "patient_information": {
    "name": "Patient name",
    "age": "Patient age",
    "gender": "Patient gender",
    "main_symptoms": ["Symptom 1", "Symptom 2"],
  },
  "differential_diagnosis": [
    {
      "disease": "Disease name",
      "probability": 75,
      "reasoning": {
        "present_symptoms": ["Symptom 1", "Symptom 2"],
        "symptoms_requiring_verification": ["Symptom 1", "Symptom 2"],
        "recommended_medications": [
          {
            "name": "Drug name",
            "use": "Purpose",
            "dosage": "Instructions",
            "side_effects": ["Effect 1", "Effect 2"],
            "efficacy": "Efficacy description"
          }
        ],
        "therapies": ["Therapy 1", "Therapy 2"] (only if applicable),
        "diagnostic_tests": ["Test 1", "Test 2"] (only if applicable),
        "home_remedies": ["Remedy 1", "Remedy 2"] (only if applicable)
      }
    },
    ...
  ],
}
```
This is the details of the patient:
[[patient_details]]
"""
