# Document templates

Drop the exported `.docx` files here, named to match each template's `docxFilePath`
in `scripts/seedTemplates.js` (e.g. `offer-letter.docx`).

## How to prepare each Google Doc

1. Write the letter in Google Docs as usual.
2. Wherever a value should be filled in per-employee, insert a placeholder tag
   matching the `key` of the corresponding field in `scripts/seedTemplates.js`,
   wrapped in single braces: `{employeeName}`, `{designation}`, `{ctcAnnual}`, etc.
   - Insert these via **Edit → Find and replace** (type a plain word like `NAME`,
     replace all with `{employeeName}`) rather than typing braces directly.
     Typing them by hand risks Google Docs' autocorrect splitting the tag across
     multiple text runs, which breaks matching when the file is processed.
3. **File → Download → Microsoft Word (.docx)** — not `.odt`.
4. Save the file here with the matching name and re-run `npm run seed:templates`
   if you changed which fields the template uses.

Tags use single braces (`{tag}`), not double braces (`{{tag}}`).
