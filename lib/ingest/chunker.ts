const MAX_CHUNK_CHARS = 3200; // ~800 tokens × 4 chars/token (matches Python ingest)
const OVERLAP_CHARS = 400;    // ~100 tokens overlap

export function chunkText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const paragraphs = trimmed
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer: string[] = [];
  let bufferLen = 0;

  const flush = () => {
    const joined = buffer.join('\n\n').trim();
    buffer = [];
    bufferLen = 0;
    if (!joined) return;
    if (joined.length <= MAX_CHUNK_CHARS) {
      chunks.push(joined);
      return;
    }
    let start = 0;
    while (start < joined.length) {
      const end = Math.min(start + MAX_CHUNK_CHARS, joined.length);
      chunks.push(joined.slice(start, end));
      if (end === joined.length) break;
      start = end - OVERLAP_CHARS;
    }
  };

  for (const p of paragraphs) {
    const sep = buffer.length > 0 ? 2 : 0; // '\n\n' length
    const prospective = bufferLen + p.length + sep;
    if (buffer.length > 0 && prospective > MAX_CHUNK_CHARS) flush();
    buffer.push(p);
    bufferLen += p.length + sep;
  }
  flush();

  return chunks;
}
