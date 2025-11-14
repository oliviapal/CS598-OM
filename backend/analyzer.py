from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from typing import Dict, Any, Iterable, Optional

import numpy as np
import torch
import tensorflow as tf
from transformers import AutoModelForSequenceClassification, AutoTokenizer, TextClassificationPipeline

MODEL_TOXIC = "unitary/toxic-bert"
MODEL_EMOTION = "bhadresh-savani/bert-base-uncased-emotion"
MODEL_EMPATHY = "paragon-analytics/bert_empathy"
MODEL_POLITENESS = "Genius1237/xlm-roberta-large-tydip"


_vader_analyzer = None
_pipe_toxic = None
_pipe_emotion = None
_empathy_tokenizer = None
_empathy_model = None
_politeness_tokenizer = None
_politeness_model = None


def _vader():
    global _vader_analyzer
    if _vader_analyzer is None:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        _vader_analyzer = SentimentIntensityAnalyzer()
    return _vader_analyzer


def _toxic():
    global _pipe_toxic
    if _pipe_toxic is None:
        tok = AutoTokenizer.from_pretrained(MODEL_TOXIC)
        mdl = AutoModelForSequenceClassification.from_pretrained(MODEL_TOXIC)
        _pipe_toxic = TextClassificationPipeline(model=mdl, tokenizer=tok, return_all_scores=True, top_k=None)
    return _pipe_toxic


def _emotion():
    global _pipe_emotion
    if _pipe_emotion is None:
        tok = AutoTokenizer.from_pretrained(MODEL_EMOTION)
        mdl = AutoModelForSequenceClassification.from_pretrained(MODEL_EMOTION)
        _pipe_emotion = TextClassificationPipeline(model=mdl, tokenizer=tok, return_all_scores=True, top_k=None)
    return _pipe_emotion


def _empathy():
    """Load empathy model"""
    global _empathy_tokenizer, _empathy_model
    if _empathy_tokenizer is None or _empathy_model is None:
        _empathy_tokenizer = AutoTokenizer.from_pretrained(MODEL_EMPATHY)
        _empathy_model = AutoModelForSequenceClassification.from_pretrained(MODEL_EMPATHY)
    return _empathy_tokenizer, _empathy_model


def _politeness():
    """Load politeness model"""
    global _politeness_tokenizer, _politeness_model
    if _politeness_tokenizer is None or _politeness_model is None:
        _politeness_tokenizer = AutoTokenizer.from_pretrained(MODEL_POLITENESS)
        _politeness_model = AutoModelForSequenceClassification.from_pretrained(MODEL_POLITENESS)
    return _politeness_tokenizer, _politeness_model


LIWC_LEX = {
    "social": {
        "we", "us", "our", "friend", "friends", "together", "team", "community", "talk", "share", "support"
    },
    "cognitive": {
        "think", "consider", "because", "why", "therefore", "however", "maybe", "perhaps", "understand", "know"
    },
}


def score_toxicity(text: str) -> float:
    """Score text for toxicity using unitary/toxic-bert"""
    pipe = _toxic()
    scores = pipe(text)[0]
    toxic_like = [s["score"] for s in scores if "toxic" in s["label"].lower()]
    if toxic_like:
        return float(np.clip(np.mean(toxic_like), 0.0, 1.0))
    return float(np.clip(max(s["score"] for s in scores), 0.0, 1.0))


def score_empathy(text: str) -> float:
    """Score text for empathy using paragon-analytics/bert_empathy"""
    tokenizer, model = _empathy()
    encoded_input = tokenizer(text, return_tensors='pt')
    output = model(**encoded_input)
    scores = output[0][0].detach().numpy()
    scores = tf.nn.softmax(scores)
    return float(scores.numpy()[1])


def score_politeness(text: str) -> float:
    """Score text for politeness using Genius1237/xlm-roberta-large-tydip"""
    tokenizer, model = _politeness()
    encoded_input = tokenizer(text, return_tensors='pt')
    output = model(**encoded_input)
    
    logits = output.logits[0]
    probs = torch.nn.functional.softmax(logits, dim=0)
    
    # Find the "polite" class index
    for idx, label in model.config.id2label.items():
        if label.lower() == 'polite':
            return float(probs[idx].item())
    
    # Fallback
    prediction = torch.argmax(output.logits).item()
    predicted_label = model.config.id2label[prediction]
    if predicted_label.lower() == 'polite':
        return float(probs[prediction].item())
    else:
        return float(1.0 - probs[prediction].item())


def score_sentiment(text: str) -> Dict[str, float]:
    """Score sentiment using VADER"""
    v = _vader()
    s = v.polarity_scores(text)
    return {
        "pos": float(s.get("pos", 0.0)),
        "neu": float(s.get("neu", 0.0)),
        "neg": float(s.get("neg", 0.0)),
        "compound": float(np.clip(s.get("compound", 0.0), -1.0, 1.0)),
    }


def score_emotions(text: str) -> Dict[str, float]:
    """Score emotions using bhadresh-savani/bert-base-uncased-emotion"""
    pipe = _emotion()
    raw = pipe(text)[0]
    total = sum(x["score"] for x in raw) or 1.0
    return {x["label"].lower(): float(x["score"] / total) for x in raw}


def nrclex_counts(text: str) -> Dict[str, int]:
    """Get NRC emotion lexicon counts"""
    try:
        from nrclex import NRCLex
        doc = NRCLex(text)
        return {k: int(v) for k, v in doc.raw_emotion_scores.items()}
    except Exception:
        return {}


def liwc_like(text: str) -> Dict[str, float]:
    """LIWC-like features: social and cognitive language"""
    toks = [t.lower() for t in re.findall(r"\b\w+\b", text)]
    n = len(toks) or 1
    out = {}
    for cat, vocab in LIWC_LEX.items():
        out[cat] = float(sum(1 for t in toks if t in vocab) / n)
    return out


def score_prosocial(tox: float, emp: float, pol: float, compound_sent: float) -> float:
    """
    Estimate prosocial behavior from other metrics.
    Prosocial = low toxicity + high empathy + high politeness + positive sentiment
    """
    # Convert sentiment from [-1, 1] to [0, 1]
    s = (compound_sent + 1.0) / 2.0
    
    # Weighted combination
    prosocial = (
        (1.0 - tox) * 0.3 +  # Low toxicity is prosocial
        emp * 0.3 +           # High empathy is prosocial
        pol * 0.3 +           # High politeness is prosocial
        s * 0.1               # Positive sentiment helps
    )
    
    return float(np.clip(prosocial, 0.0, 1.0))


def toxicity_label(score: float) -> str:
    """Convert toxicity score to label"""
    if score < 0.2:
        return "low"
    elif score < 0.5:
        return "medium"
    elif score < 0.8:
        return "high"
    else:
        return "severe"


def empathy_label(score: float) -> str:
    """Convert empathy score to label"""
    if score < 0.3:
        return "low"
    elif score < 0.7:
        return "medium"
    else:
        return "high"


def politeness_label(score: float) -> str:
    """Convert politeness score to label"""
    if score < 0.4:
        return "low"
    elif score < 0.7:
        return "medium"
    else:
        return "high"


def prosocial_label(score: float) -> str:
    """Convert prosocial score to label"""
    if score < 0.3:
        return "low"
    elif score < 0.7:
        return "medium"
    else:
        return "high"


def decide_rewrite_multidimensional(
    toxicity: float, 
    empathy: float, 
    politeness: float, 
    prosocial: float,
    tox_threshold: float = 0.50,
    empathy_threshold: float = 0.30,
    politeness_threshold: float = 0.40,
    prosocial_threshold: float = 0.40
) -> tuple[bool, list[str], dict[str, str]]:
    """
    Determine if rewrite is needed and which dimensions to improve.
    Order: toxicity → empathy → politeness → prosocial
    
    Returns:
        (should_rewrite, ordered_dimensions, explanations)
    """
    dimensions_to_improve = []
    explanations = {}
    
    # Order matters: toxicity → empathy → politeness → prosocial
    if toxicity >= tox_threshold:
        dimensions_to_improve.append("toxicity")
        explanations["toxicity"] = f"toxicity score {toxicity:.2f} exceeds threshold {tox_threshold:.2f}"
    
    if empathy < empathy_threshold:
        dimensions_to_improve.append("empathy")
        explanations["empathy"] = f"empathy score {empathy:.2f} below threshold {empathy_threshold:.2f}"
    
    if politeness < politeness_threshold:
        dimensions_to_improve.append("politeness")
        explanations["politeness"] = f"politeness score {politeness:.2f} below threshold {politeness_threshold:.2f}"
    
    if prosocial < prosocial_threshold:
        dimensions_to_improve.append("prosocial")
        explanations["prosocial"] = f"prosocial score {prosocial:.2f} below threshold {prosocial_threshold:.2f}"
    
    should_rewrite = len(dimensions_to_improve) > 0
    return should_rewrite, dimensions_to_improve, explanations


@dataclass
class Verdict:
    label: str
    reasons: Dict[str, Any]


def judge_text(metrics: Dict[str, Any], 
               tox_hi: float = 0.7, 
               tox_med: float = 0.4,
               tox_lo: float = 0.2,
               empathy_hi: float = 0.7,
               empathy_lo: float = 0.3,
               politeness_hi: float = 0.7,
               politeness_lo: float = 0.4,
               prosocial_hi: float = 0.7, 
               prosocial_lo: float = 0.3) -> Verdict:
    """Enhanced judgment considering all dimensions"""
    tox = metrics["toxicity"]
    emp = metrics["empathy"]
    pol = metrics["politeness"]
    pro = metrics["prosocial"]
    emo = metrics.get("emotion_distribution", {})

    # Convert scores to labels
    tox_label = toxicity_label(tox)
    emp_label = empathy_label(emp)
    pol_label = politeness_label(pol)
    pro_label = prosocial_label(pro)

    # Critical issues first
    if tox >= tox_hi:
        return Verdict(
            label="concerning tone",
            reasons={
                "toxicity": tox_label,
                "empathy": emp_label,
                "politeness": pol_label,
                "top_emotions": sorted(emo.items(), key=lambda kv: kv[1], reverse=True)[:3],
            },
        )
    
    # Medium toxicity with other issues
    if tox >= tox_med and (emp < empathy_lo or pol < politeness_lo):
        return Verdict(
            label="potentially harsh",
            reasons={
                "toxicity": tox_label,
                "empathy": emp_label,
                "politeness": pol_label,
                "prosocial": pro_label,
            },
        )
    
    # Low empathy specifically
    if emp < empathy_lo and tox < tox_med:
        return Verdict(
            label="lacks empathy",
            reasons={
                "empathy": emp_label,
            },
        )
    
    # Low politeness specifically
    if pol < politeness_lo and tox < tox_med:
        return Verdict(
            label="could be more polite",
            reasons={
                "politeness": pol_label,
            },
        )
    
    # Excellent communication - high empathy AND politeness AND low toxicity
    if emp >= empathy_hi and pol >= politeness_hi and tox < tox_lo:
        return Verdict(
            label="excellent communication",
            reasons={
                "empathy": emp_label,
                "politeness": pol_label,
                "toxicity": tox_label,
                "prosocial": pro_label,
            },
        )
    
    # High empathy specifically
    if emp >= empathy_hi and tox < tox_med:
        return Verdict(
            label="highly empathetic",
            reasons={
                "empathy": emp_label,
            },
        )
    
    # High politeness specifically
    if pol >= politeness_hi and tox < tox_med:
        return Verdict(
            label="very polite",
            reasons={
                "politeness": pol_label,
            },
        )
    
    # High prosocial - good!
    if pro >= prosocial_hi and tox < tox_med:
        return Verdict(
            label="constructive & prosocial",
            reasons={
                "prosocial": pro_label,
                "empathy": emp_label,
                "politeness": pol_label,
            },
        )
    
    # Low prosocial
    if pro <= prosocial_lo:
        return Verdict(
            label="needs more constructiveness",
            reasons={
                "prosocial": pro_label,
            },
        )
    
    # Default: neutral/mixed
    return Verdict(
        label="neutral / mixed",
        reasons={
            "toxicity": tox_label,
            "empathy": emp_label,
            "politeness": pol_label,
            "prosocial": pro_label,
        },
    )


def analyze_text(text: str) -> Dict[str, Any]:
    """
    Comprehensive text analysis for toxicity, empathy, politeness, and prosocial behavior.
    
    Args:
        text: Input text to analyze
        
    Returns:
        Dictionary with all metrics and rewrite recommendations
    """
    text = (text or "").strip()
    if not text:
        raise ValueError("Empty text")

    # Core scoring
    toxicity = score_toxicity(text)
    empathy = score_empathy(text)
    politeness = score_politeness(text)
    sentiment = score_sentiment(text)
    emotions = score_emotions(text)
    nrc = nrclex_counts(text)
    liwc = liwc_like(text)
    
    # Prosocial is derived from other metrics
    prosocial = score_prosocial(toxicity, empathy, politeness, sentiment.get("compound", 0.0))

    metrics = {
        "toxicity": toxicity,
        "empathy": empathy,
        "politeness": politeness,
        "prosocial": prosocial,
        "toxicity_label": toxicity_label(toxicity),
        "empathy_label": empathy_label(empathy),
        "politeness_label": politeness_label(politeness),
        "prosocial_label": prosocial_label(prosocial),
        "sentiment": sentiment,
        "emotion_distribution": emotions,
        "nrclex": nrc,
        "liwc_like": liwc,
    }

    # Multi-dimensional rewrite decision
    should_rw, dimensions, explanations = decide_rewrite_multidimensional(
        toxicity, empathy, politeness, prosocial
    )
    
    metrics["rewrite_text"] = {
        "should_rewrite": bool(should_rw),
        "dimensions_to_improve": dimensions,
        "explanations": explanations,
        "thresholds": {
            "toxicity": 0.50,
            "empathy": 0.30,
            "politeness": 0.40,
            "prosocial": 0.40
        }
    }

    # Overall verdict
    verdict = judge_text(metrics)
    metrics["verdict"] = {
        "label": verdict.label,
        "reasons": verdict.reasons,
    }
    
    return metrics


def analyze_text_simple(text: str) -> Dict[str, Any]:
    """
    Simplified output with just labels
    """
    result = analyze_text(text)
    
    return {
        "toxicity": result["toxicity_label"],
        "empathy": result["empathy_label"],
        "politeness": result["politeness_label"],
        "prosocial": result["prosocial_label"],
        "verdict": result["verdict"]["label"],
        "should_rewrite": result["rewrite_text"]["should_rewrite"],
        "dimensions_to_improve": result["rewrite_text"]["dimensions_to_improve"]
    }


def analyze_text_with_iteration(text: str, iteration_num: int = 1, previous_metrics: Optional[Dict] = None) -> Dict[str, Any]:
    """
    Analyze text with iteration tracking for use in rephraser loop.
    
    Args:
        text: Text to analyze
        iteration_num: Current iteration number (1-indexed)
        previous_metrics: Metrics from previous iteration (if any)
        
    Returns:
        Metrics with improvement tracking
    """
    current_metrics = analyze_text(text)
    
    # Add iteration metadata
    current_metrics["iteration_info"] = {
        "iteration_number": iteration_num,
        "max_iterations": 4,
    }
    
    # Calculate improvement if we have previous metrics
    if previous_metrics:
        current_metrics["improvement"] = {
            "toxicity": previous_metrics["toxicity"] - current_metrics["toxicity"],
            "empathy": current_metrics["empathy"] - previous_metrics["empathy"],
            "politeness": current_metrics["politeness"] - previous_metrics["politeness"],
            "prosocial": current_metrics["prosocial"] - previous_metrics["prosocial"],
        }
        
        # Determine if we've improved enough
        current_metrics["iteration_info"]["improved"] = any(
            v > 0.05 for v in current_metrics["improvement"].values()
        )
    
    return current_metrics


def _read_jsonl(fp: str, text_field: str) -> Iterable[str]:
    """Read JSONL file and yield text fields"""
    with open(fp, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            obj = json.loads(line)
            if text_field not in obj:
                continue
            t = obj[text_field]
            if isinstance(t, str):
                yield t


def main():
    ap = argparse.ArgumentParser(description="Text analyzer with toxicity, empathy, politeness, and prosocial scoring")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--text", type=str, help="Raw text to analyze")
    g.add_argument("--file", type=str, help="UTF‑8 text file")
    g.add_argument("--jsonl", type=str, help="Path to JSONL with a text field")
    
    ap.add_argument("--text-field", type=str, default="text", help="Field name for JSONL")
    
    # Output format options
    output_group = ap.add_mutually_exclusive_group()
    output_group.add_argument("--simple", action="store_true", help="Output only labels")
    output_group.add_argument("--details", action="store_true", help="Output detailed analysis with pretty formatting")

    args = ap.parse_args()

    payloads: Iterable[str]
    if args.text is not None:
        payloads = [args.text]
    elif args.file is not None:
        with open(args.file, "r", encoding="utf-8") as f:
            payloads = [f.read()]
    else:
        payloads = _read_jsonl(args.jsonl, args.text_field)

    for text in payloads:
        # Choose output format
        if args.simple:
            out = analyze_text_simple(text)
            print(json.dumps(out, indent=2, ensure_ascii=False))
        elif args.details:
            out = analyze_text(text)
            print(json.dumps(out, indent=2, ensure_ascii=False))
        else:
            # Default: compact full output
            out = analyze_text(text)
            print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
