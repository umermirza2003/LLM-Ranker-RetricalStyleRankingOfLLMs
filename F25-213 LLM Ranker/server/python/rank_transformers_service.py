"""
CrossEncoder ranking via Hugging Face Transformers (reads responses from SQLite by batch_id).

Model is loaded once at startup.

  pip install -r requirements.txt
  python rank_transformers_service.py

Env:
  RANK_TRANSFORMERS_PORT (default 5056)
  HF_TOKEN or HUGGING_FACE_HUB_TOKEN (optional; server/python/.env via hf_hub_auth)

"""
import os
import sqlite3
from pathlib import Path
from typing import List

import torch
from flask import Flask, jsonify, request
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from hf_hub_auth import hf_pretrained_kwargs

MODEL_NAME = os.environ.get("CROSS_ENCODER_HF_MODEL", "cross-encoder/ms-marco-MiniLM-L6-v2")
PORT = int(os.environ.get("RANK_TRANSFORMERS_PORT", "5056"))
_HF_KW = hf_pretrained_kwargs()

print(f"[rank_transformers] Loading {MODEL_NAME} ...", flush=True)
if _HF_KW:
    print("[rank_transformers] Using HF_TOKEN / HUGGING_FACE_HUB_TOKEN for Hub downloads.", flush=True)
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, **_HF_KW)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME, **_HF_KW)
model.eval()

if torch.cuda.is_available():
    model = model.to("cuda")

print("[rank_transformers] Model ready.", flush=True)

app = Flask(__name__)


def ensure_llm_response_columns(conn: sqlite3.Connection) -> None:
    """Keep Python reader-compatible with migrated Node schema."""
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='llm_responses'"
    ).fetchone()
    if not row:
        return
    cols = [r[1] for r in conn.execute("PRAGMA table_info(llm_responses)").fetchall()]
    names = set(cols)
    if "batch_id" not in names:
        conn.execute("ALTER TABLE llm_responses ADD COLUMN batch_id TEXT DEFAULT ''")
        names.add("batch_id")
        conn.commit()
    if "score" not in names:
        conn.execute("ALTER TABLE llm_responses ADD COLUMN score REAL")
        conn.commit()
    if "score_source" not in names:
        conn.execute("ALTER TABLE llm_responses ADD COLUMN score_source TEXT")
        conn.commit()


def score_pairs(query: str, response_texts: List[str]) -> List[float]:
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


@app.post("/rank-from-db")
def rank_from_db():
    data = request.get_json(silent=True) or {}
    batch_id = data.get("batchId") or data.get("batch_id")
    db_path = data.get("dbPath") or data.get("db_path")
    if not batch_id:
        return jsonify({"error": "batchId is required"}), 400
    if not db_path or not isinstance(db_path, str):
        return jsonify({"error": "dbPath (absolute path to responses.db) is required"}), 400
    path = db_path.strip()
    if not os.path.isfile(path):
        return jsonify({"error": f"Database file not found: {path}"}), 404

    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    ensure_llm_response_columns(conn)

    rows = conn.execute(
        """
        SELECT id, query, llm_id, llm_name, response
        FROM llm_responses
        WHERE batch_id = ?
        ORDER BY id
        """,
        (batch_id,),
    ).fetchall()
    conn.close()

    if not rows:
        return jsonify({"error": "No rows found for this batchId"}), 404

    query_text = rows[0]["query"]
    texts = [str(r["response"] or "") for r in rows]
    names = [str(r["llm_name"] or "") for r in rows]

    try:
        scores = score_pairs(query_text, texts)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    results = []
    for i, r in enumerate(rows):
        results.append(
            {
                "llm": names[i],
                "response": texts[i],
                "score": float(scores[i]) if i < len(scores) else 0.0,
            }
        )

    results.sort(key=lambda x: x["score"], reverse=True)
    return jsonify({"query": query_text, "results": results})


@app.get("/health")
def health():
    return jsonify({"ok": True, "model": MODEL_NAME})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=PORT, threaded=True)
