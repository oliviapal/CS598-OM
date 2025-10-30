from transformers import T5Tokenizer, T5ForConditionalGeneration
import torch

device = "mps" if torch.backends.mps.is_available() else "cpu"

tokenizer = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("declare-lab/flan-alpaca-base").to(device)
# model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base").to(device)

prompt = """You are a powerful tool to help user rephrase their input to make them more polite and non-toxic:

Input: I hate you. You sucks.
"""

input_ids = tokenizer(prompt, return_tensors="pt").input_ids.to(device)

outputs = model.generate(input_ids)
print(tokenizer.decode(outputs[0]))
