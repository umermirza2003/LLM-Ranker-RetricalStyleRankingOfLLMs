"""
CrossEncoder ranking microservice (Hugging Face transformers).
Loads cross-encoder/ms-marco-MiniLM-L6-v2 once at startup.

Run (from repo root or server/python):
  pip install -r requirements.txt
  python ranking_service.py

Env:
  CROSS_ENCODER_MODEL (default cross-encoder/ms-marco-MiniLM-L6-v2)
  RANKING_PORT (default 5055)
  HF_TOKEN or HUGGING_FACE_HUB_TOKEN (optional; put in server/python/.env)
"""
import os
import sys

from flask import Flask, jsonify, request

from hf_hub_auth import hf_pretrained_kwargs

try:
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
except ImportError:
    print(
        "Missing dependencies. Run: pip install -r requirements.txt",
        file=sys.stderr,
    )
    sys.exit(1)

MODEL_NAME = os.environ.get("CROSS_ENCODER_MODEL", "cross-encoder/ms-marco-MiniLM-L6-v2")
PORT = int(os.environ.get("RANKING_PORT", "5055"))
_HF_KW = hf_pretrained_kwargs()

print(f"[ranking_service] Loading {MODEL_NAME} (transformers)...", flush=True)
if _HF_KW:
    print("[ranking_service] Using HF_TOKEN / HUGGING_FACE_HUB_TOKEN for Hub downloads.", flush=True)
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, **_HF_KW)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME, **_HF_KW)
model.eval()

if torch.cuda.is_available():
    model = model.to("cuda")

print("[ranking_service] Model ready.", flush=True)

app = Flask(__name__)


def score_pairs(query: str, response_texts: list) -> list:
    """Same scoring head logic as rank_transformers_service.score_pairs."""
    if not query or not response_texts:
        return []
    enc = tokenizer(
        [query] * len(response_texts),
        response_texts,
        padding=True,
        truncation=True,
        max_length=512,
        return_tensors="pt",
    )
    if torch.cuda.is_available():
        enc = {k: v.to("cuda") for k, v in enc.items()}
    with torch.no_grad():
        logits = model(**enc).logits
    if logits.dim() == 2 and logits.shape[-1] == 1:
        scores = logits.squeeze(-1)
    else:
        scores = logits[:, 0]
    return [float(x) for x in scores.detach().cpu().tolist()]


def score_llm_responses(query, llm_responses, sort_results=True):
    """
    Score multiple LLM responses for a given query.

    Parameters:
      - query (str): The question
      - llm_responses (list of dict): [{"llm": "...", "response": "..."}, ...]
      - sort_results: if True, sort by score descending (default). If False, keep input order.

    Returns:
      - List of results with scores
    """
    if not query or not llm_responses:
        return []

    texts = [item["response"] for item in llm_responses]
    pair_scores = score_pairs(query, texts)

    results = []
    for i, item in enumerate(llm_responses):
        s = pair_scores[i] if i < len(pair_scores) else 0.0
        results.append(
            {
                "llm": item["llm"],
                "response": item["response"],
                "score": float(s),
            }
        )

    if sort_results:
        results.sort(key=lambda x: x["score"], reverse=True)
    return results


@app.post("/rank")
def rank():
    data = request.get_json(silent=True) or {}
    query = (data.get("query") or "").strip() if isinstance(data.get("query"), str) else ""
    responses = data.get("responses")

    if not isinstance(responses, list):
        return jsonify({"error": 'Expected JSON body with "query" and "responses" array.'}), 400

    normalized = []
    for item in responses:
        if not isinstance(item, dict):
            continue
        llm = item.get("llm")
        resp = item.get("response")
        if llm is None:
            continue
        normalized.append(
            {
                "llm": str(llm),
                "response": resp if isinstance(resp, str) else str(resp or ""),
            }
        )

    if not query:
        return jsonify({"error": "query is required."}), 400

    preserve_order = bool(data.get("preserve_order"))

    try:
        results = score_llm_responses(query, normalized, sort_results=not preserve_order)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"results": results})


@app.get("/health")
def health():
    return jsonify({"ok": True, "model": MODEL_NAME})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=PORT, threaded=True)
