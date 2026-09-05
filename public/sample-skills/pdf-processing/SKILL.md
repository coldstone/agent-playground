---
name: pdf-processing
description: Extract text, tables and metadata from PDF documents, and fill in PDF forms. Use when the user uploads a PDF, asks about the contents of a PDF, needs a PDF converted to text or Markdown, or wants a form filled programmatically.
license: MIT
compatibility: Requires a Python runtime with pypdf installed for the bundled scripts.
metadata:
  author: Agent Playground
  version: 1.2.0
---

# PDF processing

Follow these steps whenever a task involves reading or producing PDF files.

## 1. Establish what kind of PDF it is

Ask for the file if it has not been provided. Then decide which of the three cases applies:

- **Digital text PDF** — the text layer is present; extraction is exact.
- **Scanned PDF** — pages are images; the text layer is missing or unreliable.
- **Form PDF** — the document contains AcroForm fields that can be listed and filled.

Read [references/REFERENCE.md](references/REFERENCE.md) for the details of each case. Form fields
in particular are covered by
[references/REFERENCE.md#form-pdf-acroform](references/REFERENCE.md#form-pdf-acroform), including
the field-name conventions used by common form generators. Consult the
[PDF 1.7 specification](https://www.adobe.com/devnet/pdf/pdf_reference.html) when a document does
something the reference does not cover.

## 2. Extract the content

For a digital text PDF, extract page by page and keep the page boundaries: downstream answers
are much easier to cite when every chunk knows its page number.

For a scanned PDF, say plainly that OCR is required and offer to describe the pages instead of
guessing at their contents.

## 3. Preserve structure

Tables lose their meaning when flattened into prose. Convert them to Markdown tables and keep
the header row. Footnotes stay attached to the paragraph that references them.

## 4. Reproduce the script logic

[scripts/extract.py](scripts/extract.py) shows the extraction routine this skill expects. Read it
and reproduce the steps in your answer or run the equivalent yourself; do not assume it has been
executed.

## 5. Report honestly

State which pages were read, which were skipped, and whether anything was unreadable. When the
answer depends on a table or a figure, quote the page number.

## Output template

[assets/template.txt](assets/template.txt) holds the summary layout to use when the user asks for
a digest of a document rather than a specific answer.
