from typing import Union
from fastapi import FastAPI
from pydantic import BaseModel
from rephrase import get_rephrased_text
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
    item_id: Union[str, None] = None
    user_input: str
    input_label: Union[str, None] = None
    rephrase_reasons: Union[str, None] = None

@app.post("/rephrase")
async def rephrase_item(req: RephraseRequest):
    print(f"""[INFO] Received rephrase request:
          item_id: {req.item_id}
          user_input: {req.user_input}
          input_label: {req.input_label}
          rephrase_reasons: {req.rephrase_reasons}""")
    rephrased_text = get_rephrased_text(req.user_input, req.input_label, req.rephrase_reasons).replace("<pad>", "").replace("</s>", "").strip()
    print(f"[INFO] Rephrased text: {rephrased_text}")
    return {"item_id": req.item_id, "original_text": req.user_input, "rephrased_text": rephrased_text}

@app.post("/analyze")
async def analyze_item(req: RephraseRequest):
    print(f"""[INFO] Received analyze request:
          item_id: {req.item_id}
          user_input: {req.user_input}""")
    analysis = analyze_text(req.user_input)
    print(f"[INFO] Analysis results: {analysis}")
    return {
        "item_id": req.item_id, 
        "original_text": req.user_input,
        "toxicity": analysis["tone_risk_label"],
        "sentiment": "Negative" if analysis["sentiment"]["compound"] < -0.05 else "Positive" if analysis["sentiment"]["compound"] > 0.05 else "Neutral",
        "thoughtfulness": "Neutral" if analysis["liwc_like"]["cognitive"] <= 0 else "Thoughtful",
        "proSocial": "High" if analysis["prosocial_estimate"] > 0.7 else "Medium" if analysis["prosocial_estimate"] > 0.3 else "Low",
        "verdict": analysis["verdict"]
    }