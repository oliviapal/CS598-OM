from typing import Union
from fastapi import FastAPI
from pydantic import BaseModel
from rephrase import get_rephrased_text, generate_prompt
from fastapi.middleware.cors import CORSMiddleware
from analyzer import analyze_text_simple, _toxicity_improve, _others_improve

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
    initial_analysis = analyze_text_simple(req.user_input)
    print(f"[INFO] Analysis results: {initial_analysis}")
    if(initial_analysis["should_rewrite"]):
        # start the rephrasing process
        count = 0
        success = False
        text_to_rephrase = req.user_input
        while count < 4:
            print("[INFO] Starting rephrasing process based on analysis results.")
            rephrased_text = get_rephrased_text(generate_prompt(
                text_to_rephrase,
                ["synthesized"],
                {
                    "toxicity": initial_analysis["toxicity"],
                    "empathy": initial_analysis["empathy"],
                    "politeness": initial_analysis["politeness"],
                    "pro_social": initial_analysis["prosocial"]
                }
            ))
            print(f"[INFO] Rephrased text (attempt {count + 1}): {rephrased_text}")
            # analyze the rephrased text
            new_analysis = analyze_text_simple(rephrased_text)
            if not new_analysis["should_rewrite"]:
                success = True
                break
            if (  # check if there is any improvement
                _toxicity_improve(initial_analysis["toxicity"], new_analysis["toxicity"]) or
                _others_improve(initial_analysis["empathy"], new_analysis["empathy"]) or
                _others_improve(initial_analysis["politeness"], new_analysis["politeness"]) or
                _others_improve(initial_analysis["prosocial"], new_analysis["prosocial"])
            ):
                success = True
                break
            text_to_rephrase = rephrased_text
            count += 1
        # after max 4 attempts
        if not success:
            print("[WARN] Rephrasing attempts exhausted without satisfactory improvement.")
            rephrased_text = "Sorry, we couldn't improve the text after multiple attempts. Please try rephrasing it manually."
            new_analysis = {
                "toxicity": "N/A",
                "empathy": "N/A",
                "politeness": "N/A",
                "prosocial": "N/A"
            }
    else:
        rephrased_text = "No rephrasing needed."
        new_analysis = {
            "toxicity": "N/A",
            "empathy": "N/A",
            "politeness": "N/A",
            "prosocial": "N/A"
        }
            
    return {
        "original_text": req.user_input,
        "old_toxicity": initial_analysis["toxicity"],
        "old_empathy": initial_analysis["empathy"],
        "old_politeness": initial_analysis["politeness"],
        "old_proSocial": initial_analysis["prosocial"],
        "new_toxicity": new_analysis["toxicity"],
        "new_empathy": new_analysis["empathy"],
        "new_politeness": new_analysis["politeness"],
        "new_proSocial": new_analysis["prosocial"],
        "rephrased_text": rephrased_text
    }