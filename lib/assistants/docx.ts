import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
} from 'docx';

// Sub-projeto 20 — markdown → .docx conversion.
//
// The LLM emits markdown; we render it server-side to a .docx Buffer for
// download. Tolerant to imperfect markdown — falls back to plain paragraphs
// rather than throwing on edge cases (the LLM occasionally produces broken
// table syntax or stray ** runs, which a strict parser would reject).
//
// Scope (v1): headings (#, ##, ###), unordered lists (-, *), ordered lists
// (1., 2.), inline bold (**text**), plain paragraphs. Tables, code blocks,
// and links are flattened to plain text — good enough for the RFP output
// we observe; can be extended in a future sub-projeto if admin asks.

type Inline = { text: string; bold: boolean };

function parseInlineRuns(line: string): Inline[] {
  // Split on **bold** spans. Anything not matched is plain text.
  const out: Inline[] = [];
  let remaining = line;
  while (remaining.length > 0) {
    const m = remaining.match(/\*\*([^*]+)\*\*/);
    if (!m || m.index === undefined) {
      out.push({ text: remaining, bold: false });
      break;
    }
    if (m.index > 0) out.push({ text: remaining.slice(0, m.index), bold: false });
    out.push({ text: m[1]!, bold: true });
    remaining = remaining.slice(m.index + m[0].length);
  }
  return out.filter((r) => r.text.length > 0);
}

function runsFromInline(line: string): TextRun[] {
  const runs = parseInlineRuns(line);
  if (runs.length === 0) return [new TextRun('')];
  return runs.map((r) => new TextRun({ text: r.text, bold: r.bold }));
}

function headingParagraph(level: 1 | 2 | 3, text: string): Paragraph {
  const headingMap = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
  } as const;
  return new Paragraph({
    heading: headingMap[level],
    children: runsFromInline(text),
    spacing: { before: 240, after: 120 },
  });
}

function bulletParagraph(text: string): Paragraph {
  return new Paragraph({
    children: runsFromInline(text),
    bullet: { level: 0 },
    spacing: { after: 80 },
  });
}

function numberedParagraph(text: string, num: number): Paragraph {
  // No real list numbering — we prepend the number into the text. For v1
  // this avoids the docx numbering config dance which is brittle.
  return new Paragraph({
    children: [new TextRun({ text: `${num}. ` }), ...runsFromInline(text)],
    spacing: { after: 80 },
  });
}

function plainParagraph(text: string): Paragraph {
  return new Paragraph({
    children: runsFromInline(text),
    spacing: { after: 120 },
  });
}

/**
 * Convert markdown text to a docx Buffer.
 * Tolerant: never throws on imperfect markdown.
 */
export async function mdToDocxBuffer(md: string, title: string): Promise<Buffer> {
  const lines = md.split('\n');
  const children: Paragraph[] = [];

  // Title page
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: title, bold: true, size: 36 })],
      spacing: { after: 400 },
    }),
  );

  let orderedCounter = 0;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Reset ordered counter when we leave an ordered list block.
    if (!line.match(/^\d+\.\s/) && orderedCounter > 0) orderedCounter = 0;

    if (line.length === 0) {
      children.push(new Paragraph({ children: [new TextRun('')] }));
      continue;
    }

    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) {
      children.push(headingParagraph(3, h3[1]!));
      continue;
    }
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      children.push(headingParagraph(2, h2[1]!));
      continue;
    }
    const h1 = line.match(/^#\s+(.*)$/);
    if (h1) {
      children.push(headingParagraph(1, h1[1]!));
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      children.push(bulletParagraph(bullet[1]!));
      continue;
    }

    const ordered = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (ordered) {
      orderedCounter += 1;
      children.push(numberedParagraph(ordered[2]!, orderedCounter));
      continue;
    }

    // Skip table delimiter rows ("|---|---|") and the horizontal rules
    // ("---" by itself). Render any other line as a paragraph (including
    // table content rows, which we flatten — good enough for v1).
    if (/^\s*\|?\s*-{3,}.*$/.test(line)) continue;

    plainParagraph(line);
    children.push(plainParagraph(line));
  }

  const doc = new Document({
    creator: 'ProcurementGPT',
    title,
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}
