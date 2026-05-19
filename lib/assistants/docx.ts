import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  PageOrientation,
  PageBreak,
} from 'docx';
import type { CompanyData } from '@/lib/db/user-company';

export type DocxLogo = { buffer: Buffer; mime: 'image/png' | 'image/jpeg' };

export type DocxCoverData = {
  title: string;
  category?: string | null;
  company?: CompanyData | null;
};

// Sub-projeto 25 — markdown → .docx conversion (v2).
//
// Adds:
//   - Proper docx Tables (parsed from markdown pipe tables) instead of
//     flattening every row to a paragraph.
//   - A cover page section (centered logo, title, buyer block) followed
//     by an explicit page break before the body.
//   - Tolerant edge handling: pipe tables with mismatched col counts
//     still render; rows are filled to the widest row.
//
// Scope still capped at: headings, lists, inline bold, paragraphs,
// pipe tables. Code blocks and links pass through as text.

type Inline = { text: string; bold: boolean };

function parseInlineRuns(line: string): Inline[] {
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

function runsFromInline(line: string, opts: { size?: number } = {}): TextRun[] {
  const runs = parseInlineRuns(line);
  if (runs.length === 0) return [new TextRun('')];
  return runs.map(
    (r) => new TextRun({ text: r.text, bold: r.bold, ...(opts.size ? { size: opts.size } : {}) }),
  );
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

// ── Table parsing ────────────────────────────────────────────────────────

function isTableRowLine(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isTableDelimiterLine(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitRow(line: string): string[] {
  // Trim outer pipes then split — preserves empty cells.
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((c) => c.trim());
}

function buildDocxTable(rows: string[][], headerRow: string[] | null): Table {
  const colCount = Math.max(headerRow?.length ?? 0, ...rows.map((r) => r.length));
  const allRows: { cells: string[]; header: boolean }[] = [];
  if (headerRow) allRows.push({ cells: headerRow, header: true });
  for (const r of rows) allRows.push({ cells: r, header: false });

  // Compact font for wide tables (≥10 cols) — keeps the table readable
  // when the column count makes default size overflow the page.
  const cellFontSize = colCount >= 10 ? 14 : 18; // half-points (7pt / 9pt)
  const cellWidthPct = Math.floor(100 / colCount);

  // Build the docx runs for a single cell. Header cells force bold; body
  // cells respect inline **bold** markers from the source markdown.
  function cellRuns(text: string, isHeader: boolean): TextRun[] {
    const parsed = parseInlineRuns(text);
    if (parsed.length === 0) {
      return [new TextRun({ text: '', size: cellFontSize, bold: isHeader })];
    }
    return parsed.map(
      (r) =>
        new TextRun({
          text: r.text,
          size: cellFontSize,
          bold: isHeader || r.bold,
        }),
    );
  }

  const docxRows = allRows.map(
    (r) =>
      new TableRow({
        tableHeader: r.header,
        children: Array.from({ length: colCount }, (_, i) => {
          const cellText = r.cells[i] ?? '';
          return new TableCell({
            children: [
              new Paragraph({
                children: cellRuns(cellText, r.header),
                spacing: { after: 0 },
              }),
            ],
            width: { size: cellWidthPct, type: WidthType.PERCENTAGE },
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
          });
        }),
      }),
  );

  return new Table({
    rows: docxRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
      left: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
      right: { style: BorderStyle.SINGLE, size: 4, color: '808080' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
    },
  });
}

// ── Cover page ───────────────────────────────────────────────────────────

function buildCoverPage(
  cover: DocxCoverData,
  logo: DocxLogo | undefined,
): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];

  // Vertical spacer pushes the logo down ~1/4 page.
  out.push(new Paragraph({ children: [new TextRun('')], spacing: { after: 1200 } }));

  if (logo) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: logo.buffer,
            transformation: { width: 280, height: 110 },
            type: logo.mime === 'image/png' ? 'png' : 'jpg',
          }),
        ],
        spacing: { after: 600 },
      }),
    );
  }

  out.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'REQUISIÇÃO DE PROPOSTA', bold: true, size: 44 })],
      spacing: { after: 200 },
    }),
  );

  if (cover.category) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: cover.category, size: 28, color: '666666' })],
        spacing: { after: 800 },
      }),
    );
  } else {
    out.push(new Paragraph({ children: [new TextRun('')], spacing: { after: 800 } }));
  }

  // Buyer block — only emitted when at least one field is set.
  const c = cover.company;
  const buyerRows: { label: string; value: string }[] = [];
  if (c?.company_name) buyerRows.push({ label: 'Empresa', value: c.company_name });
  if (c?.company_legal_name)
    buyerRows.push({ label: 'Razão social', value: c.company_legal_name });
  if (c?.company_cnpj) buyerRows.push({ label: 'CNPJ', value: c.company_cnpj });
  if (c?.company_address) buyerRows.push({ label: 'Endereço', value: c.company_address });
  if (c?.company_email) buyerRows.push({ label: 'E-mail', value: c.company_email });
  if (c?.company_phone) buyerRows.push({ label: 'Telefone', value: c.company_phone });
  buyerRows.push({
    label: 'Data de emissão',
    value: new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
  });

  if (buyerRows.length > 0) {
    out.push(
      new Table({
        rows: buyerRows.map(
          (r) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: r.label, bold: true, size: 20 })],
                      spacing: { after: 0 },
                    }),
                  ],
                  width: { size: 30, type: WidthType.PERCENTAGE },
                  margins: { top: 60, bottom: 60, left: 80, right: 80 },
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: r.value, size: 20 })],
                      spacing: { after: 0 },
                    }),
                  ],
                  width: { size: 70, type: WidthType.PERCENTAGE },
                  margins: { top: 60, bottom: 60, left: 80, right: 80 },
                }),
              ],
            }),
        ),
        width: { size: 70, type: WidthType.PERCENTAGE },
        alignment: AlignmentType.CENTER,
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        },
      }),
    );
  }

  // Page break before the body.
  out.push(
    new Paragraph({
      children: [new PageBreak()],
    }),
  );

  return out;
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Convert markdown text to a docx Buffer.
 * Tolerant: never throws on imperfect markdown.
 *
 * `opts.logo` is rendered on the cover page (when present).
 * `opts.cover` provides the title + category + buyer block for the
 * cover. When omitted, falls back to a minimal title-only cover.
 * `opts.kraljicChartPng`, when supplied, is inserted as a full-width
 * image right after the first `## Matriz` heading found in the body.
 * No-op when the heading isn't present.
 * `opts.abcChartPng`, similarly, is inserted after the first `## Curva`
 * heading (case-insensitive) for ABC reports.
 */
export async function mdToDocxBuffer(
  md: string,
  title: string,
  opts: {
    logo?: DocxLogo;
    cover?: DocxCoverData;
    kraljicChartPng?: Buffer;
    abcChartPng?: Buffer;
  } = {},
): Promise<Buffer> {
  // Strip the literal logo-placeholder line — handled by the cover page.
  const cleaned = md
    .split('\n')
    .filter((l) => !/\[INSERIR LOGO DO CLIENTE\]/i.test(l))
    .join('\n');
  const lines = cleaned.split('\n');

  const body: (Paragraph | Table)[] = [];
  let orderedCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trimEnd();

    // Table detection: row line followed by a delimiter line on the next.
    if (
      isTableRowLine(line) &&
      i + 1 < lines.length &&
      isTableDelimiterLine(lines[i + 1]!)
    ) {
      const headerCells = splitRow(line);
      i += 2; // skip header row + delimiter
      const dataRows: string[][] = [];
      while (i < lines.length && isTableRowLine(lines[i]!)) {
        dataRows.push(splitRow(lines[i]!));
        i++;
      }
      body.push(buildDocxTable(dataRows, headerCells));
      // Spacer after the table.
      body.push(new Paragraph({ children: [new TextRun('')], spacing: { after: 120 } }));
      i -= 1; // for-loop will i++ after this iter
      continue;
    }

    if (!line.match(/^\d+\.\s/) && orderedCounter > 0) orderedCounter = 0;

    if (line.length === 0) {
      body.push(new Paragraph({ children: [new TextRun('')] }));
      continue;
    }

    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) {
      body.push(headingParagraph(3, h3[1]!));
      continue;
    }
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      body.push(headingParagraph(2, h2[1]!));
      // Insert the Kraljic chart image right after the first Matriz heading
      // we encounter in the markdown body. Heuristic: any h2 starting with
      // "Matriz" (case-insensitive). Only injected once per document.
      if (
        opts.kraljicChartPng &&
        /^matriz/i.test(h2[1]!.trim()) &&
        !(body as { __kraljicInserted?: boolean }).__kraljicInserted
      ) {
        body.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: opts.kraljicChartPng,
                transformation: { width: 560, height: 380 },
                type: 'png',
              }),
            ],
            spacing: { after: 200 },
          }),
        );
        (body as { __kraljicInserted?: boolean }).__kraljicInserted = true;
      }
      // ABC: insert the curve image right after the first heading that
      // mentions "curva" (case-insensitive). Same one-shot guard.
      if (
        opts.abcChartPng &&
        /curva|pareto/i.test(h2[1]!.trim()) &&
        !(body as { __abcInserted?: boolean }).__abcInserted
      ) {
        body.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: opts.abcChartPng,
                transformation: { width: 600, height: 340 },
                type: 'png',
              }),
            ],
            spacing: { after: 200 },
          }),
        );
        (body as { __abcInserted?: boolean }).__abcInserted = true;
      }
      continue;
    }
    const h1 = line.match(/^#\s+(.*)$/);
    if (h1) {
      body.push(headingParagraph(1, h1[1]!));
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      body.push(bulletParagraph(bullet[1]!));
      continue;
    }

    const ordered = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (ordered) {
      orderedCounter += 1;
      body.push(numberedParagraph(ordered[2]!, orderedCounter));
      continue;
    }

    // Horizontal rule line (---), skip.
    if (/^\s*-{3,}\s*$/.test(line)) continue;

    body.push(plainParagraph(line));
  }

  const cover: DocxCoverData = opts.cover ?? { title };
  const coverPage = buildCoverPage(cover, opts.logo);

  const doc = new Document({
    creator: 'ProcurementGPT',
    title,
    sections: [
      {
        properties: { page: { size: { orientation: PageOrientation.PORTRAIT } } },
        children: [...coverPage, ...body],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
