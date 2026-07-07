# /backend/file_processor.py
import base64
from pathlib import Path

IMAGE_EXTS = {".png", ".jpg", ".jpeg"}
MAX_TEXT_CHARS = 8000

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover
    try:
        from PyPDF2 import PdfReader
    except ImportError:
        PdfReader = None


def is_image_file(filename: str) -> bool:
    return Path(filename).suffix.lower() in IMAGE_EXTS


def _extract_txt(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except Exception as e:  # noqa: BLE001
        return f"[Could not read text file: {e}]"


def _extract_pdf(path: Path) -> str:
    if PdfReader is None:
        return "[PDF support unavailable: install pypdf]"
    try:
        reader = PdfReader(str(path))
        parts = [(page.extract_text() or "") for page in reader.pages]
        return "\n".join(parts).strip()
    except Exception as e:  # noqa: BLE001
        return f"[Could not read PDF: {e}]"


def _encode_image(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def process_upload(tmp_path: Path, filename: str) -> dict:
    """Return {'kind': 'image'|'text'|'unsupported', 'text': str, 'image_b64': str|None}."""
    ext = Path(filename).suffix.lower()

    if ext in IMAGE_EXTS:
        return {"kind": "image", "image_b64": _encode_image(tmp_path), "text": ""}

    if ext == ".pdf":
        text = _extract_pdf(tmp_path)
    elif ext == ".txt":
        text = _extract_txt(tmp_path)
    else:
        return {"kind": "unsupported", "image_b64": None, "text": ""}

    if len(text) > MAX_TEXT_CHARS:
        text = text[:MAX_TEXT_CHARS] + "\n[...truncated...]"
    return {"kind": "text", "image_b64": None, "text": text}