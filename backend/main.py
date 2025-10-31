from typing import Union
from fastapi import FastAPI
from pydantic import BaseModel
from rephrase import get_rephrased_text
from fastapi.middleware.cors import CORSMiddleware

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
    improve_toxicity: Union[bool, None] = None
    improve_prosocial: Union[bool, None] = None

@app.post("/rephrase")
async def rephrase_item(req: RephraseRequest):
    print(f"""[INFO] Received rephrase request:
          item_id: {req.item_id}
          user_input: {req.user_input}
          improve_toxicity: {req.improve_toxicity}
          improve_prosocial: {req.improve_prosocial}""")
    if req.improve_toxicity:
        rephrased_text = get_rephrased_text(req.user_input).replace("<pad>", "").replace("</s>", "").strip()
        print(f"[INFO] Rephrased text: {rephrased_text}")
        return {"item_id": req.item_id, "original_text": req.user_input, "rephrased_text": rephrased_text}

