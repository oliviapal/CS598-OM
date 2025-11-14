from typing import Union
from fastapi import FastAPI
from pydantic import BaseModel
from rephrase import get_rephrased_text, generate_prompt
from fastapi.middleware.cors import CORSMiddleware
from analyzer import analyze_text

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (for development)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def read_root():
    return {"Hello": "World"}

# define request body model for REPHRASE endpoint
class RephraseRequest(BaseModel):
    user_input: str
    improve_toxicity: Union[bool, None] = None
    improve_politeness: Union[bool, None] = None
    improve_empathy: Union[bool, None] = None
    improve_prosocial: Union[bool, None] = None


@app.post("/rephrase")
async def rephrase_item(req: RephraseRequest):
    print(f"""[INFO] Received rephrase request:
          user_input: {req.user_input}
          improve_toxicity: {req.improve_toxicity}
          improve_politeness: {req.improve_politeness}
          improve_empathy: {req.improve_empathy}
          improve_prosocial: {req.improve_prosocial}""")
    goals = []
    if req.improve_toxicity:
        goals.append("toxicity")
    if req.improve_politeness:
        goals.append("politeness")
    if req.improve_empathy:
        goals.append("empathy")
    if req.improve_prosocial:
        goals.append("pro_social")
    rephrased_text = get_rephrased_text(generate_prompt(req.user_input, goals))
    return {"original_text": req.user_input, "rephrased_text": rephrased_text}

@app.post("/analyze")
async def analyze_item(req: RephraseRequest):
    print(f"""[INFO] Received analyze request:
          user_input: {req.user_input}""")
    analysis = analyze_text(req.user_input)
    print(f"[INFO] Analysis results: {analysis}")
    return {
        "original_text": req.user_input,
        "toxicity": analysis["tone_risk_label"],
        "sentiment": "Negative" if analysis["sentiment"]["compound"] < -0.05 else "Positive" if analysis["sentiment"]["compound"] > 0.05 else "Neutral",
        "thoughtfulness": "Neutral" if analysis["liwc_like"]["cognitive"] <= 0 else "Thoughtful",
        "proSocial": "High" if analysis["prosocial_estimate"] > 0.7 else "Medium" if analysis["prosocial_estimate"] > 0.3 else "Low",
        "verdict": analysis["verdict"]
    }