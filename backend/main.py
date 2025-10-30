from typing import Union
from fastapi import FastAPI
from pydantic import BaseModel

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
    return {
        "item_id": req.item_id,
        "received_text": req.user_input,
        "improve_toxicity": req.improve_toxicity,
        "improve_prosocial": req.improve_prosocial
    }
