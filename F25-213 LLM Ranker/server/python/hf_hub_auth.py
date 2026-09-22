"""
Load Hugging Face Hub token from env / server/python/.env for from_pretrained(...).
Uses HF_TOKEN or HUGGING_FACE_HUB_TOKEN (same as Hugging Face docs).
"""
import os
from pathlib import Path


def _load_dotenv():
    try:
        from dotenv import load_dotenv

        env_path = Path(__file__).resolve().parent / ".env"
        if env_path.is_file():
            load_dotenv(env_path)
    except ImportError:
        pass


_load_dotenv()


def hf_pretrained_kwargs():
    """Keyword args for AutoTokenizer.from_pretrained / AutoModel.from_pretrained."""
    raw = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    token = raw.strip() if raw and str(raw).strip() else None
    if token:
        return {"token": token}
    return {}
