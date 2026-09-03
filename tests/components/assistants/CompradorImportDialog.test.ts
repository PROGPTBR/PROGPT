import { describe, expect, it, vi } from 'vitest';
import { importAllFiles } from '@/components/assistants/CompradorImportDialog';

function fakeFile(name: string): File {
  return new File(['conteúdo'], name, { type: 'application/pdf' });
}

describe('importAllFiles', () => {
  it('calls onImported once per successful file, in order', async () => {
    const files = [fakeFile('fornecedor-a.pdf'), fakeFile('fornecedor-b.pdf'), fakeFile('fornecedor-c.pdf')];
    const importFn = vi.fn(async (f: File) => ({
      text: `texto de ${f.name}`,
      filename: f.name,
      truncated: false,
    }));
    const onImported = vi.fn();

    const result = await importAllFiles(files, onImported, importFn);

    expect(result).toEqual({ ok: 3, truncatedFilenames: [], failed: [] });
    expect(onImported).toHaveBeenCalledTimes(3);
    expect(onImported).toHaveBeenNthCalledWith(1, 'texto de fornecedor-a.pdf');
    expect(onImported).toHaveBeenNthCalledWith(2, 'texto de fornecedor-b.pdf');
    expect(onImported).toHaveBeenNthCalledWith(3, 'texto de fornecedor-c.pdf');
  });

  it('continues past a failing file and reports it, without aborting the batch', async () => {
    const files = [fakeFile('ok-1.pdf'), fakeFile('corrompido.pdf'), fakeFile('ok-2.pdf')];
    const importFn = vi.fn(async (f: File) => {
      if (f.name === 'corrompido.pdf') throw new Error('parse_failed');
      return { text: `texto de ${f.name}`, filename: f.name, truncated: false };
    });
    const onImported = vi.fn();

    const result = await importAllFiles(files, onImported, importFn);

    expect(result.ok).toBe(2);
    expect(result.failed).toEqual([{ filename: 'corrompido.pdf', message: 'parse_failed' }]);
    expect(onImported).toHaveBeenCalledTimes(2);
    expect(onImported).toHaveBeenCalledWith('texto de ok-1.pdf');
    expect(onImported).toHaveBeenCalledWith('texto de ok-2.pdf');
  });

  it('collects truncated filenames separately from failures', async () => {
    const files = [fakeFile('grande.pdf')];
    const importFn = vi.fn(async (f: File) => ({ text: 'texto', filename: f.name, truncated: true }));
    const onImported = vi.fn();

    const result = await importAllFiles(files, onImported, importFn);

    expect(result).toEqual({ ok: 1, truncatedFilenames: ['grande.pdf'], failed: [] });
  });

  it('reports progress for each file before importing it', async () => {
    const files = [fakeFile('a.pdf'), fakeFile('b.pdf')];
    const importFn = vi.fn(async (f: File) => ({ text: 'x', filename: f.name, truncated: false }));
    const onProgress = vi.fn();

    await importAllFiles(files, vi.fn(), importFn, onProgress);

    expect(onProgress).toHaveBeenNthCalledWith(1, 0, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, 1, 2);
  });

  it('returns a no-op result for an empty file list', async () => {
    const importFn = vi.fn();
    const result = await importAllFiles([], vi.fn(), importFn);
    expect(result).toEqual({ ok: 0, truncatedFilenames: [], failed: [] });
    expect(importFn).not.toHaveBeenCalled();
  });
});
