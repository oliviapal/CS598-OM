from typing import Union
from fastapi import FastAPI
from pydantic import BaseModel
from rephrase import get_rephrased_text

app = FastAPI()

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
    if req.improve_toxicity:
        rephrased_text = get_rephrased_text(req.user_input)
        return {"item_id": req.item_id, "original_text": req.user_input, "rephrased_text": rephrased_text}

