"""Document parsers for supported MIME types."""

from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader

SUPPORTED_TEXT_MIMES = {
  'text/plain',
  'text/markdown',
  'text/x-markdown',
}
SUPPORTED_PDF_MIMES = {
  'application/pdf',
}


class UnsupportedFormatError(Exception):
  pass


def _parse_text(path: Path) -> str:
  return path.read_text(encoding='utf-8', errors='replace')


def _parse_pdf(path: Path) -> str:
  reader = PdfReader(str(path))
  pages: list[str] = []
  for page in reader.pages:
    text = page.extract_text() or ''
    if text:
      pages.append(text)
  return '\n\n'.join(pages)


def parse_document(path: Path, mime_type: str) -> str:
  normalized = mime_type.lower().split(';')[0].strip()
  suffix = path.suffix.lower()

  if normalized in SUPPORTED_TEXT_MIMES or suffix in {'.txt', '.md', '.markdown'}:
    return _parse_text(path)
  if normalized in SUPPORTED_PDF_MIMES or suffix == '.pdf':
    return _parse_pdf(path)

  raise UnsupportedFormatError(f'Unsupported document format: {mime_type} ({suffix})')
