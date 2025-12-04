from email.mime import text
import json
import os
from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "Qwen/Qwen2.5-7B-Instruct"

model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype="auto",
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained(model_name)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(BASE_DIR, "prompts/system.txt"), "r") as f:
    SYSTEM_PROMPT = f.read()
    f.close()

with open(os.path.join(BASE_DIR, "prompts/specific.txt"), "r") as f:
    specific_prompt = f.read()
    f.close()
    
with open(os.path.join(BASE_DIR, "prompts/synthesized.txt"), "r") as f:
    synthesized_prompt = f.read()
    f.close()
    
with open(os.path.join(BASE_DIR, "prompts/instructions.json"), "r") as f:
    instructions = json.load(f)
    f.close()

def generate_prompt(user_input: str, goal: list, scores: dict = None) -> str:
    if goal == ["synthesized"] and scores is not None:
        prompt = synthesized_prompt.replace("<<USER_INPUT>>", user_input)
        prompt = prompt.replace("<<TOXICITY_SCORE>>", f"{scores.get('toxicity', 'NaN')}")
        prompt = prompt.replace("<<EMPATHY_SCORE>>", f"{scores.get('empathy', 'NaN')}")
        prompt = prompt.replace("<<POLITENESS_SCORE>>", f"{scores.get('politeness', 'NaN')}")
        prompt = prompt.replace("<<PRO_SOCIAL_SCORE>>", f"{scores.get('prosocial', 'NaN')}")
    else:
        instructions_prompt = ""
        if "toxicity" in goal:
            instructions_prompt += instructions["toxicity_instruction"] + " "
        if "empathy" in goal:
            instructions_prompt += instructions["empathy_instruction"] + " "
        if "politeness" in goal:
            instructions_prompt += instructions["politeness_instruction"] + " "
        if "pro_social" in goal:
            instructions_prompt += instructions["prosocial_instruction"] + " "
        prompt = specific_prompt.replace("<<USER_INPUT>>", user_input)
        prompt = prompt.replace("<<TASK_INSTRUCTION>>", instructions_prompt.strip())
    return prompt

def get_rephrased_text(user_prompt: str) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ]
    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True
    )
    model_inputs = tokenizer([text], return_tensors="pt").to(model.device)

    generated_ids = model.generate(
        **model_inputs,
        max_new_tokens=512
    )
    generated_ids = [
        output_ids[len(input_ids):] for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
    ]

    response = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]
    return response

if __name__ == "__main__":
    test_input = "Your service is terrible and I hate it!"
    rephrased_output = get_rephrased_text(test_input)
    print("Original:", test_input)
    print("Rephrased:", rephrased_output)