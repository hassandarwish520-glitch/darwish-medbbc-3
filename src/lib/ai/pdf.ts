import { normalizeText } from "./source-text";

type PdfParseModule = {
  PDFParse?: new (options: { data: Buffer | Uint8Array }) => {
    getText: (options?: unknown) => Promise<{ text?: string }>;
    destroy?: () => Promise<void> | void;
  };
};

export async function extractPdfTextFromBuffer(data: Buffer | Uint8Array) {
  try {
    const mod = (await import("pdf-parse")) as PdfParseModule;
    if (typeof mod.PDFParse !== "function") return "";

    const parser = new mod.PDFParse({ data });
    try {
      const result = await parser.getText();
      return normalizeText(result?.text || "");
    } finally {
      await parser.destroy?.();
    }
  } catch {
    return "";
  }
}
