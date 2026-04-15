import {
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

const FONT = "Calibri";
const FONT_SIZE_BODY = 22; // half-points: 22 = 11pt

export async function generateCVDocx(cvText: string): Promise<Buffer> {
  const lines = cvText.split(/\n/);
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      // Empty line → spacer
      paragraphs.push(new Paragraph({ spacing: { after: 120 } }));
      continue;
    }

    // Detect bullet points (lines starting with - or •)
    const bulletMatch = trimmed.match(/^[-•]\s*(.*)/);
    if (bulletMatch) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [
            new TextRun({
              text: bulletMatch[1],
              font: FONT,
              size: FONT_SIZE_BODY,
            }),
          ],
          spacing: { after: 60 },
        }),
      );
      continue;
    }

    // Detect section headings (all-caps lines or short lines ending without punctuation)
    const isHeading =
      trimmed === trimmed.toUpperCase() &&
      trimmed.length > 2 &&
      trimmed.length < 60 &&
      /^[A-Z\s&/]+$/.test(trimmed);

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: trimmed,
            font: FONT,
            size: isHeading ? 26 : FONT_SIZE_BODY, // 13pt for headings
            bold: isHeading,
          }),
        ],
        spacing: { after: isHeading ? 160 : 80 },
      }),
    );
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: FONT_SIZE_BODY },
        },
      },
    },
    sections: [{ children: paragraphs }],
  });

  return Packer.toBuffer(doc);
}

export async function generateCoverLetterDocx(
  coverLetterText: string,
): Promise<Buffer> {
  const rawParagraphs = coverLetterText.split(/\n\n+/);

  const paragraphs = rawParagraphs.map(
    (text) =>
      new Paragraph({
        children: [
          new TextRun({
            text: text.trim(),
            font: FONT,
            size: FONT_SIZE_BODY,
          }),
        ],
        spacing: { after: 240 },
      }),
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: FONT_SIZE_BODY },
        },
      },
    },
    sections: [{ children: paragraphs }],
  });

  return Packer.toBuffer(doc);
}
