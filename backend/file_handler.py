# /backend/file_handler.py
import base64
from pathlib import Path

IMAGE_EXTS = {".png", ".jpg", ".jpeg"}
MAX_TEXT_CHARS = 8_000

try:
    from pypdf import PdfReader
except ImportError:
    try:
        from PyPDF2 import PdfReader  # type: ignore[no-redef]
    except ImportError:
        PdfReader = None  # type: ignore[assignment,misc]


def is_image(filename: str) -> bool:
    return Path(filename).suffix.lower() in IMAGE_EXTS


def extract_text(path: Path, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return _read_pdf(path)
    return _read_txt(path)


def _read_txt(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace").strip()
    except Exception as exc:
        return f"[Could not read text file: {exc}]"


def _read_pdf(path: Path) -> str:
    if PdfReader is None:
        return "[PDF support unavailable — run: pip install pypdf]"
    try:
        reader = PdfReader(str(path))
        pages = [p.extract_text() or "" for p in reader.pages]
        text = "\n\n".join(pages).strip()
        return text or "[PDF is scanned/image-only — no extractable text]"
    except Exception as exc:
        return f"[Could not read PDF: {exc}]"


def encode_image_b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def truncate_text(text: str, max_chars: int = MAX_TEXT_CHARS) -> str:
    if len(text) <= max_chars:
        return text
    return (
        text[:max_chars]
        + f"\n\n[...truncated — showing first {max_chars:,} of {len(text):,} chars...]"
    )