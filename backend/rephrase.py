from transformers import T5Tokenizer, T5ForConditionalGeneration
import torch

device = "mps" if torch.backends.mps.is_available() else "cpu"

tokenizer = T5Tokenizer.from_pretrained("google/flan-t5-base")
rephrase_model = T5ForConditionalGeneration.from_pretrained("declare-lab/flan-alpaca-base").to(device)

def get_rephrased_text(input_text: str) -> str:
    prompt = f"""You are the user who is trying to polish the input to make it more polite and non-toxic:
    Input: {input_text}
    Output: """

    input_ids = tokenizer(prompt, return_tensors="pt").input_ids.to(device)

    outputs = rephrase_model.generate(input_ids)
    return tokenizer.decode(outputs[0])

if __name__ == "__main__":
    test_input = "Your service is terrible and I hate it!"
    rephrased_output = get_rephrased_text(test_input)
    print("Original:", test_input)
    print("Rephrased:", rephrased_output)