#!/usr/bin/env python3
"""Extract the text of a PDF page by page.

Dummy sample script bundled with the pdf-processing skill. Agent Playground cannot execute
scripts; it is here so the model can read the logic and reproduce it.
"""

import sys

from pypdf import PdfReader


def extract(path: str) -> None:
    reader = PdfReader(path)
    for number, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        print(f"--- page {number} ---")
        print(text if text else "[no text layer: page is probably a scan]")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: extract.py <file.pdf>", file=sys.stderr)
        raise SystemExit(2)
    extract(sys.argv[1])
