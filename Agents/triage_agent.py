from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
import os
import json
import re

API_KEY = "AIzaSyCgpK3zf809vEztHyfd5bKHGvZVBzLVT34"

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=API_KEY,
    temperature=0.7,
)


SYSTEM_PROMPT = """
You are a medical emergency triage agent.

Strict rules:
- Respond ONLY with valid JSON.
- No markdown, no code fences, no explanation.
- severity_score must be an integer from 1 to 10.
- severity_level must be exactly one of: Low, Moderate, Critical.
- confidence must be exactly one of: High, Medium, Low.

JSON format:
{
  "emergency_type": "",
  "severity_score": 0,
  "severity_level": "",
  "required_specialist": "",
  "confidence": ""
}
"""

def run_triage(user_input):
    try:
        response = llm.invoke([
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_input)
        ])

        raw = response.content.strip()

        if not raw:
            return {"error": "Empty response from LLM"}

        # Strip markdown fences if present
        raw = re.sub(r"```json|```", "", raw).strip()

        result = json.loads(raw)

        # Validate required fields
        required = ["emergency_type", "severity_score", "severity_level", "required_specialist"]
        for field in required:
            if field not in result:
                return {"error": f"Missing field in triage response: {field}", "raw": raw}

        return result

    except json.JSONDecodeError as e:
        return {"error": "Invalid JSON from LLM", "raw_output": raw}
    except Exception as e:
        return {"error": str(e)}
