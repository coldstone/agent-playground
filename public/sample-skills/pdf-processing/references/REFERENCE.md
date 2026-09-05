# PDF reference

Background material for the `pdf-processing` skill. Load this file only when a task actually
needs one of the sections below; the workflow itself lives in [SKILL.md](../SKILL.md).

## Contents

- [Document classes](#document-classes)
  - [Digital text PDF](#digital-text-pdf)
  - [Scanned PDF](#scanned-pdf)
  - [Form PDF (AcroForm)](#form-pdf-acroform)
- [Page geometry](#page-geometry)
- [Metadata](#metadata)
- [Common failure modes](#common-failure-modes)

## Document classes

### Digital text PDF

Produced by a word processor or a typesetting system. Every glyph carries its character code, so
extraction is lossless. Watch for two traps:

- **Column order.** Multi-column layouts are stored in drawing order, not reading order. Sort the
  text blocks by column before concatenating, otherwise sentences interleave.
- **Ligatures.** `ﬁ`, `ﬂ` and friends are single glyphs. Normalize them before matching text.

### Scanned PDF

Each page is a single image, usually JPEG or CCITT G4. A text layer may exist if the producer ran
OCR; when it does, treat it as a hint rather than as ground truth. Confidence is typically lowest
on tables, handwriting and anything rotated.

### Form PDF (AcroForm)

Fields live in the document catalog and are addressed by name. Three field types cover almost
everything encountered in practice:

| Type | Widget | Value |
| --- | --- | --- |
| `/Tx` | text box | string |
| `/Btn` | checkbox or radio | `/Yes`, `/Off` or an export value |
| `/Ch` | dropdown or list | string from the option list |

Field names are hierarchical: `applicant.address.postcode`. Generators differ in how they build
the hierarchy — Acrobat uses dots, LibreOffice tends to flatten everything into one level, and
generators driven by a template often prefix every field with the form id.

## Page geometry

Coordinates start at the bottom-left corner and are measured in points (1/72 inch). A US Letter
page is 612 x 792, A4 is 595 x 842. A page can carry a `/Rotate` entry of 90, 180 or 270; text
extracted without applying it comes out sideways.

## Metadata

Two places hold metadata and they disagree often:

1. The **document info dictionary** — `Title`, `Author`, `Subject`, `Keywords`, `CreationDate`.
2. The **XMP packet** — an RDF/XML blob, usually more complete and more recently written.

When both exist and conflict, prefer XMP but report the difference if the user asks about
provenance.

## Common failure modes

- **Encrypted documents.** An empty owner password still permits reading in most viewers; a user
  password does not. Say so rather than returning empty pages.
- **Linearized files truncated mid-download.** The trailer is missing; page count is unknown.
- **Embedded fonts without a `ToUnicode` map.** Glyphs extract as meaningless code points; this
  looks like mojibake but no re-encoding can repair it.
- **Tagged vs untagged.** Only tagged PDFs carry a reading order that can be trusted for
  accessibility-grade extraction.
