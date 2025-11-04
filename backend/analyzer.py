from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from typing import Dict, Any, Iterable, Optional

import numpy as np

# -------------------- Model identifiers (override to local dirs if needed) --------------------
MODEL_TOXIC = "unitary/toxic-bert"
MODEL_EMOTION = "bhadresh-savani/bert-base-uncased-emotion"

# Lazy globals 
_vader = None
_pipe_toxic = None
_pipe_emotion = None

# Default rewrite trigger threshold (toxicity ≥ threshold → rewrite)
REWRITE_TOX_THRESHOLD = 0.50


def _lazy_vader():
    global _vader
    if _vader is None:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        _vader = SentimentIntensityAnalyzer()
    return _vader


def _lazy_toxic():
    global _pipe_toxic
    if _pipe_toxic is None:
        from transformers import AutoModelForSequenceClassification, AutoTokenizer, TextClassificationPipeline
        tok = AutoTokenizer.from_pretrained(MODEL_TOXIC)
        mdl = AutoModelForSequenceClassification.from_pretrained(MODEL_TOXIC)
        _pipe_toxic = TextClassificationPipeline(model=mdl, tokenizer=tok, return_all_scores=True, top_k=None)
    return _pipe_toxic


def _lazy_emotion():
    global _pipe_emotion
    if _pipe_emotion is None:
        from transformers import AutoModelForSequenceClassification, AutoTokenizer, TextClassificationPipeline
        tok = AutoTokenizer.from_pretrained(MODEL_EMOTION)
        mdl = AutoModelForSequenceClassification.from_pretrained(MODEL_EMOTION)
        _pipe_emotion = TextClassificationPipeline(model=mdl, tokenizer=tok, return_all_scores=True, top_k=None)
    return _pipe_emotion


# -------------------- LIWC-like tiny lexicons (extend as needed) --------------------
LIWC_LEX = {
    "social": {
        "we", "us", "our", "friend", "friends", "together", "team", "community", "talk", "share", "support"
    },
    "cognitive": {
        "think", "consider", "because", "why", "therefore", "however", "maybe", "perhaps", "understand", "know"
    },
}


#  Core scorers 

def score_toxicity(text: str) -> float:
    pipe = _lazy_toxic()
    scores = pipe(text)[0]  # list of {label, score}
    toxic_like = [s["score"] for s in scores if "toxic" in s["label"].lower()]
    if toxic_like:
        return float(np.clip(np.mean(toxic_like), 0.0, 1.0))
    return float(np.clip(max(s["score"] for s in scores), 0.0, 1.0))


def score_sentiment(text: str) -> Dict[str, float]:
    v = _lazy_vader()
    s = v.polarity_scores(text)
    return {
        "pos": float(s.get("pos", 0.0)),
        "neu": float(s.get("neu", 0.0)),
        "neg": float(s.get("neg", 0.0)),
        "compound": float(np.clip(s.get("compound", 0.0), -1.0, 1.0)),
    }


def score_emotions(text: str) -> Dict[str, float]:
    pipe = _lazy_emotion()
    raw = pipe(text)[0]
    total = sum(x["score"] for x in raw) or 1.0
    return {x["label"].lower(): float(x["score"] / total) for x in raw}


def nrclex_counts(text: str) -> Dict[str, int]:
    try:
        from nrclex import NRCLex
        doc = NRCLex(text)
        return {k: int(v) for k, v in doc.raw_emotion_scores.items()}
    except Exception:
        return {}


def liwc_like(text: str) -> Dict[str, float]:
    toks = [t.lower() for t in re.findall(r"\b\w+\b", text)]
    n = len(toks) or 1
    out = {}
    for cat, vocab in LIWC_LEX.items():
        out[cat] = float(sum(1 for t in toks if t in vocab) / n)
    return out


def tone_risk_label(tox: float) -> str:
    if tox < 0.2:
        return "Low"
    if tox < 0.5:
        return "Medium"
    if tox < 0.8:
        return "High"
    return "Severe"


def prosocial_estimate(tox: float, compound_sent: float) -> float:
    # map compound −1..1 → 0..1
    s = (compound_sent + 1.0) / 2.0
    # combine with toxicity penalty
    p = ((1.0 - tox) ** 2 + s) / 2.0
    return float(np.clip(p, 0.0, 1.0))


def decide_rewrite(toxicity: float, threshold: float = None) -> tuple[bool, Optional[str]]:
    """Binary gate for rewrite decision.
    If toxicity ≥ threshold, request rewrite and explain why.
    """
    th = REWRITE_TOX_THRESHOLD if threshold is None else float(threshold)
    if toxicity >= th:
        return True, f"toxicity too high ({toxicity:.2f} ≥ {th:.2f})"
    return False, None


#  Verdict rules 
@dataclass
class Verdict:
    label: str
    reasons: Dict[str, Any]


def judge_text(metrics: Dict[str, Any], tox_hi: float = 0.7, tox_med: float = 0.4,
               prosocial_hi: float = 0.7, prosocial_lo: float = 0.3) -> Verdict:
    tox = metrics["toxicity"]
    comp = metrics["sentiment"]["compound"]
    pro = metrics["prosocial_estimate"]
    emo = metrics.get("emotion_distribution", {})

    if tox >= tox_hi:
        return Verdict(
            label="Concerning Tone",
            reasons={
                "toxicity": tox,
                "note": "High hostility/derogatory signals; consider reframing before posting.",
                "top_emotions": sorted(emo.items(), key=lambda kv: kv[1], reverse=True)[:3],
            },
        )
    if tox >= tox_med and comp < 0:
        return Verdict(
            label="Potentially Harsh",
            reasons={
                "toxicity": tox,
                "sentiment_compound": comp,
                "note": "Moderate toxicity with negative sentiment; tone may be perceived as harsh.",
            },
        )
    if pro >= prosocial_hi:
        return Verdict(
            label="Constructive / Pro‑social",
            reasons={
                "prosocial_estimate": pro,
                "note": "Low toxicity and supportive/neutral sentiment.",
            },
        )
    if pro <= prosocial_lo:
        return Verdict(
            label="Needs Care",
            reasons={
                "prosocial_estimate": pro,
                "note": "Signals suggest limited pro‑social impact; add context, soften tone, or propose solutions.",
            },
        )
    return Verdict(
        label="Neutral / Mixed",
        reasons={
            "toxicity": tox,
            "sentiment_compound": comp,
            "prosocial_estimate": pro,
            "note": "Balanced signals; message likely acceptable but could be clearer/warmer.",
        },
    )


# -------------------- Public API --------------------

def analyze_text(text: str) -> Dict[str, Any]:
    text = (text or "").strip()
    if not text:
        raise ValueError("Empty text")

    toxicity = score_toxicity(text)
    sentiment = score_sentiment(text)
    emotions = score_emotions(text)
    nrc = nrclex_counts(text)
    liwc = liwc_like(text)
    pro = prosocial_estimate(toxicity, sentiment.get("compound", 0.0))
    risk = tone_risk_label(toxicity)

    metrics = {
        "toxicity": toxicity,
        "tone_risk_label": risk,
        "sentiment": sentiment,
        "emotion_distribution": emotions,
        "nrclex": nrc,
        "liwc_like": liwc,
        "prosocial_estimate": pro,
    }

    # Rewrite decision (feeds your rephraser)
    should_rw, reason = decide_rewrite(toxicity)
    metrics["rewrite_text"] = {
        "should_rewrite": bool(should_rw),
        "reason": reason,
        "threshold": REWRITE_TOX_THRESHOLD,
    }

    verdict = judge_text(metrics)
    metrics["verdict"] = {
        "label": verdict.label,
        "reasons": verdict.reasons,
    }
    return metrics


# -------------------- CLI --------------------

def _read_jsonl(fp: str, text_field: str) -> Iterable[str]:
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
    ap = argparse.ArgumentParser(description="Standalone text analyzer (toxicity, sentiment, emotions, NRCLex, LIWC-like)")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--text", type=str, help="Raw text to analyze")
    g.add_argument("--file", type=str, help="UTF‑8 text file (entire contents as one doc)")
    g.add_argument("--jsonl", type=str, help="Path to JSONL with a text field")
    ap.add_argument("--text-field", type=str, default="text", help="Field name containing text when using --jsonl")
    ap.add_argument("--pretty", action="store_true", help="Pretty‑print JSON output")

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
        out = analyze_text(text)
        if args.pretty:
            print(json.dumps(out, indent=2, ensure_ascii=False))
        else:
            print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
