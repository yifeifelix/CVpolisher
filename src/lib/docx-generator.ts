import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

const FONT = "Calibri";
const FONT_SIZE_BODY = 22; // half-points: 22 = 11pt
const FONT_SIZE_TITLE = 36; // half-points: 36 = 18pt

export async function generateCVDocx(
  bullets: { original: string; polished: string }[],
): Promise<Buffer> {
  const titleParagraph = new Paragraph({
    heading: HeadingLevel.TITLE,
    children: [
      new TextRun({
        text: "Curriculum Vitae",
        font: FONT,
        size: FONT_SIZE_TITLE,
        bold: true,
      }),
    ],
    spacing: { after: 400 },
  });

  const spacer = new Paragraph({
    children: [new TextRun({ text: "", font: FONT, size: FONT_SIZE_BODY })],
    spacing: { after: 200 },
  });

  const bulletParagraphs = bullets.map(
    (b) =>
      new Paragraph({
        bullet: { level: 0 },
        children: [
          new TextRun({
            text: b.polished,
            font: FONT,
            size: FONT_SIZE_BODY,
          }),
        ],
        spacing: { after: 120 },
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
    sections: [
      {
        children: [titleParagraph, spacer, ...bulletParagraphs],
      },
    ],
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
    sections: [
      {
        children: paragraphs,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
