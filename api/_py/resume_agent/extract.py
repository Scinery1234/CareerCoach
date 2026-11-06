"""Text from uploaded resumes, job descriptions, certificates and notes."""
import io
import zipfile

MAX_CHARS = 30000
# A .docx is a zip: a tiny file can unpack to a huge one. Bound what it unpacks to.
MAX_UNPACKED = 20 * 1024 * 1024
MAX_PARTS = 400
TOO_BIG = "That file is too large to read. Save it as a plain Word file or paste the text instead."


def _check_zip(content):
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as z:
            infos = z.infolist()
            if len(infos) > MAX_PARTS or sum(i.file_size for i in infos) > MAX_UNPACKED:
                raise ValueError(TOO_BIG)
    except zipfile.BadZipFile as e:
        raise ValueError("That doesn’t look like a Word file. Upload a .docx, PDF or text file.") from e


def extract_text(filename, content):
    """Plain text from a .docx, .pdf, .txt, .md or .rtf upload. ValueError for anything else."""
    name = (filename or "").lower()
    if name.endswith(".docx"):
        from docx import Document
        _check_zip(content)
        try:
            doc = Document(io.BytesIO(content))
            lines = []
            total = 0
            for p in doc.paragraphs:
                if p.text.strip():
                    lines.append(p.text)
                    total += len(p.text)
                if total > MAX_CHARS:
                    break
            if total <= MAX_CHARS:
                for t in doc.tables:
                    for row in t.rows:
                        cells = []
                        for cell in row.cells:
                            txt = " ".join(p.text for p in cell.paragraphs if p.text.strip())
                            if txt and txt not in cells:
                                cells.append(txt)
                        if cells:
                            lines.append(" | ".join(cells))
        except ValueError:
            raise
        except Exception as e:  # noqa: BLE001  (lxml and python-docx raise many kinds)
            raise ValueError("We couldn’t read that Word file. Try saving it again, or paste the text.") from e
        return "\n".join(lines)[:MAX_CHARS]
    if name.endswith(".pdf"):
        from pypdf import PdfReader
        try:
            reader = PdfReader(io.BytesIO(content))
            if reader.is_encrypted:
                reader.decrypt("")
            text = "\n".join(t for t in (pg.extract_text() or "" for pg in reader.pages) if t)
        except Exception as e:  # noqa: BLE001
            raise ValueError("We couldn’t open that PDF. If it’s password protected, remove the password or paste the text.") from e
        return text[:MAX_CHARS]
    if name.endswith((".txt", ".md", ".rtf")):
        return content.decode("utf-8", errors="ignore")[:MAX_CHARS]
    raise ValueError("Upload a Word (.docx), PDF or text file.")
