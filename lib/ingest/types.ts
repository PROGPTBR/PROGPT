export type JobStatus = 'queued' | 'running' | 'done' | 'error';
export type JobStage =
  | 'parsing'
  | 'chunking'
  | 'embedding'
  | 'inserting'
  | 'deduplicated'
  | null;

export type IngestJob = {
  id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string;
  status: JobStatus;
  stage: JobStage;
  progress: number;
  chunks_count: number | null;
  article_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

export type FigureKind = 'flow' | 'chart' | 'diagram';

export type TextBlock = { type: 'text'; page: number; content: string };
export type TableBlock = {
  type: 'table';
  page: number;
  markdown: string;
  caption?: string;
};
export type FigureBlock = {
  type: 'figure';
  page: number;
  description: string;
  caption?: string;
  figureKind: FigureKind;
};
export type Block = TextBlock | TableBlock | FigureBlock;

export type ParsedSource =
  | { kind: 'blocks'; blocks: Block[]; pageCount?: number }
  | { kind: 'text'; text: string; pageCount?: number };

export type ChunkKind = 'text' | 'table' | 'figure';

export type ChunkRow = {
  content: string;
  metadata: {
    kind: ChunkKind;
    page?: number;
    caption?: string;
    figureKind?: FigureKind;
  };
};
