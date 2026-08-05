/**
 * Multi-format document parser — no AI required.
 * Extracts raw text from: PDF, DOCX, PPTX, EPUB, ZIP(HTML), MHTML, HTML, HTM, TXT, MD
 * Format is auto-detected from filename extension and file magic bytes.
 */

// ─── ZIP binary reader (no external dependency) ───────────────────────────────
// Reads the ZIP central directory to enumerate entries, then decompresses
// individual entries on demand using Node.js built-in zlib.

import { inflateRawSync } from "node:zlib";

interface ZipEntry {
  name: string;
  compression: number; // 0=stored, 8=deflate
  compressedSize: number;
  uncompressedSize: number;
  dataOffset: number;
}

function readUInt16LE(buf: Buffer, offset: number) {
  return buf[offset] | (buf[offset + 1] << 8);
}
function readUInt32LE(buf: Buffer, offset: number) {
  return (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0;
}

function readZipEntries(buf: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];

  // Scan local file headers (PK\x03\x04)
  let pos = 0;
  while (pos < buf.length - 30) {
    if (buf[pos] !== 0x50 || buf[pos + 1] !== 0x4b || buf[pos + 2] !== 0x03 || buf[pos + 3] !== 0x04) {
      pos++;
      continue;
    }
    const compression = readUInt16LE(buf, pos + 8);
    const compressedSize = readUInt32LE(buf, pos + 18);
    const uncompressedSize = readUInt32LE(buf, pos + 22);
    const nameLen = readUInt16LE(buf, pos + 26);
    const extraLen = readUInt16LE(buf, pos + 28);
    const name = buf.slice(pos + 30, pos + 30 + nameLen).toString("utf-8");
    const dataOffset = pos + 30 + nameLen + extraLen;
    entries.push({ name, compression, compressedSize, uncompressedSize, dataOffset });
    pos = dataOffset + compressedSize;
  }
  return entries;
}

function extractZipEntry(buf: Buffer, entry: ZipEntry): Buffer {
  const data = buf.slice(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  if (entry.compression === 0) return data; // stored
  if (entry.compression === 8) return inflateRawSync(data); // deflate
  return data;
}

// ─── XML text extraction (minimal parser) ────────────────────────────────────

function stripXml(xml: string): string {
  return xml
    .replace(/<w:br[^/]*/gi, "\n")  // Word line breaks
    .replace(/<a:br[^/]*/gi, "\n")  // PowerPoint line breaks
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<\/a:p>/gi, "\n")
    .replace(/<\/w:tr>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Format parsers ───────────────────────────────────────────────────────────

/** DOCX: ZIP containing word/document.xml */
function extractDocx(buf: Buffer): string {
  try {
    const entries = readZipEntries(buf);
    const docEntry = entries.find(e => e.name === "word/document.xml");
    if (!docEntry) return "";
    const xml = extractZipEntry(buf, docEntry).toString("utf-8");
    return stripXml(xml);
  } catch {
    return "";
  }
}

/** PPTX: ZIP containing ppt/slides/slide*.xml */
function extractPptx(buf: Buffer): string {
  try {
    const entries = readZipEntries(buf);
    const slideEntries = entries
      .filter(e => /^ppt\/slides\/slide\d+\.xml$/i.test(e.name))
      .sort((a, b) => {
        const na = parseInt(a.name.match(/\d+/)?.[0] ?? "0");
        const nb = parseInt(b.name.match(/\d+/)?.[0] ?? "0");
        return na - nb;
      });
    return slideEntries
      .map(e => {
        const xml = extractZipEntry(buf, e).toString("utf-8");
        return stripXml(xml);
      })
      .join("\n\n---\n\n");
  } catch {
    return "";
  }
}

/** EPUB: ZIP containing OEBPS/*.xhtml or *.html */
function extractEpub(buf: Buffer): string {
  try {
    const entries = readZipEntries(buf);
    const htmlEntries = entries
      .filter(e => /\.(xhtml|html|htm)$/i.test(e.name) && !/toc|nav|cover|copyright/i.test(e.name))
      .slice(0, 30); // cap to avoid huge books
    return htmlEntries
      .map(e => {
        const html = extractZipEntry(buf, e).toString("utf-8");
        return extractHtml(html);
      })
      .join("\n\n");
  } catch {
    return "";
  }
}

/** ZIP of HTML: extract all HTML files */
function extractZipHtml(buf: Buffer): string {
  try {
    const entries = readZipEntries(buf);
    const htmlEntries = entries.filter(e => /\.(html|htm)$/i.test(e.name));
    if (!htmlEntries.length) {
      // Try to find any text files
      const txtEntries = entries.filter(e => /\.(txt|md|json)$/i.test(e.name));
      return txtEntries.map(e => extractZipEntry(buf, e).toString("utf-8")).join("\n\n");
    }
    return htmlEntries
      .map(e => {
        const html = extractZipEntry(buf, e).toString("utf-8");
        return extractHtml(html);
      })
      .join("\n\n");
  } catch {
    return "";
  }
}

/** HTML/HTM: strip tags, decode entities, preserve structure */
function extractHtml(html: string): string {
  // Remove script, style, nav, header, footer blocks
  let text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, "");

  // Add meaningful line breaks for block elements
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|section|article|main|li|tr|td|th|h[1-6]|blockquote|pre|dt|dd)>/gi, "\n")
    // Do NOT convert headings to "## " — that text leaks into question stems
    .replace(/<h[1-6]\b[^>]*>/gi, "\n")
    // Do NOT add "• " prefix to list items — breaks "A. text" choice detection
    .replace(/<li\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

/** MHTML: multipart MIME — extract the HTML part */
function extractMhtml(text: string): string {
  const boundaryMatch = text.match(/boundary="?([^";\r\n]+)"?/i);
  if (!boundaryMatch) {
    // No boundary — try to extract HTML directly
    const htmlMatch = text.match(/<html[\s\S]*<\/html>/i);
    return htmlMatch ? extractHtml(htmlMatch[0]) : text;
  }

  const boundary = "--" + boundaryMatch[1].trim();
  const parts = text.split(boundary).slice(1); // skip preamble

  for (const part of parts) {
    const headers = part.split(/\r?\n\r?\n/)[0] || "";
    const body = part.slice(headers.length + 2);

    if (!/Content-Type:\s*text\/html/i.test(headers)) continue;

    let decoded = body;
    if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(headers)) {
      decoded = body.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    } else if (/Content-Transfer-Encoding:\s*base64/i.test(headers)) {
      try {
        decoded = Buffer.from(body.replace(/\s/g, ""), "base64").toString("utf-8");
      } catch { /* keep as-is */ }
    }

    return extractHtml(decoded);
  }

  return text.replace(/<[^>]+>/g, " ").trim();
}

/** Markdown: strip markers, preserve structure */
function extractMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1") // italic
    .replace(/`{3}[\s\S]*?`{3}/g, "") // code blocks
    .replace(/`(.+?)`/g, "$1") // inline code
    .replace(/!\[.*?\]\(.*?\)/g, "") // images
    .replace(/\[(.+?)\]\(.*?\)/g, "$1") // links
    .replace(/^[-*+]\s+/gm, "• ") // unordered lists
    .replace(/^\d+\.\s+/gm, "") // ordered lists
    .replace(/^>\s+/gm, "") // blockquotes
    .replace(/[-]{3,}/g, "") // horizontal rules
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type ParsedDoc = {
  text: string;
  format: string;
  isEmpty: boolean;
};

/**
 * Parse a document buffer into plain text.
 * @param buf - The raw file bytes
 * @param filename - Used to detect format (extension)
 * @param rawTextFallback - For PDF: pass the already-extracted PDF text here
 */
export function parseDocumentBuffer(buf: Buffer, filename: string, rawTextFallback = ""): ParsedDoc {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  // Check for ZIP magic bytes (PK header) regardless of extension
  const isPk = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;

  let text = "";
  let format = ext;

  if (ext === "pdf") {
    text = rawTextFallback;
    format = "pdf";
  } else if (ext === "docx" || (isPk && ext !== "zip" && ext !== "pptx" && ext !== "epub")) {
    text = extractDocx(buf);
    format = "docx";
  } else if (ext === "pptx") {
    text = extractPptx(buf);
    format = "pptx";
  } else if (ext === "epub") {
    text = extractEpub(buf);
    format = "epub";
  } else if (ext === "zip") {
    text = extractZipHtml(buf);
    format = "zip";
  } else if (ext === "mhtml" || ext === "mht") {
    text = extractMhtml(buf.toString("utf-8"));
    format = "mhtml";
  } else if (ext === "html" || ext === "htm") {
    text = extractHtml(buf.toString("utf-8"));
    format = "html";
  } else if (ext === "md" || ext === "markdown") {
    text = extractMarkdown(buf.toString("utf-8"));
    format = "markdown";
  } else if (ext === "txt") {
    text = buf.toString("utf-8");
    format = "txt";
  } else if (isPk) {
    // Unknown zip-based format — try DOCX then PPTX then generic ZIP
    text = extractDocx(buf) || extractPptx(buf) || extractZipHtml(buf);
    format = "zip-auto";
  } else {
    // Try to decode as UTF-8 text / HTML
    const raw = buf.toString("utf-8");
    if (/<html/i.test(raw)) {
      text = extractHtml(raw);
      format = "html-auto";
    } else {
      text = raw;
      format = "text-auto";
    }
  }

  return { text: text.trim(), format, isEmpty: !text.trim() };
}
