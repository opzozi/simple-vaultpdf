import type { PDFDocumentProxy } from 'pdfjs-dist';

const MIN_USABLE_CHARS = 30;

interface PdfTextItem {
  str: string;
  transform: number[];
  width?: number;
  height?: number;
}

function isTextItem(item: unknown): item is PdfTextItem {
  return typeof item === 'object'
    && item !== null
    && 'str' in item
    && 'transform' in item
    && Array.isArray((item as PdfTextItem).transform);
}

function letterCount(text: string): number {
  return (text.match(/\p{L}|\p{N}/gu) || []).length;
}

interface LinePart {
  x: number;
  width: number;
  str: string;
  height: number;
}

interface Line {
  y: number;
  parts: LinePart[];
}

function itemGeometry(item: PdfTextItem) {
  const x = item.transform[4] ?? 0;
  const y = item.transform[5] ?? 0;
  const height = Math.abs(item.height || item.transform[3] || 10);
  const width = item.width || Math.max(item.str.length * height * 0.45, height);
  return { x, y, width, height };
}

function dedupeOverlappingItems(items: PdfTextItem[]): PdfTextItem[] {
  const kept: PdfTextItem[] = [];

  for (const item of items) {
    const str = item.str.trim();
    if (!str) continue;

    const { x, y, width, height } = itemGeometry(item);
    const isDuplicate = kept.some((other) => {
      if (other.str.trim() !== str) return false;
      const o = itemGeometry(other);
      return Math.abs(o.y - y) <= height * 0.6 && Math.abs(o.x - x) <= Math.max(width, o.width) * 0.6;
    });

    if (!isDuplicate) {
      kept.push(item);
    }
  }

  return kept;
}

function collapseDoubledString(text: string): string {
  let current = text;
  while (current.length >= 4 && current.length % 2 === 0) {
    const half = current.length / 2;
    const left = current.slice(0, half);
    const right = current.slice(half);
    if (left !== right) break;
    current = left;
  }
  return current;
}

function reconstructText(items: PdfTextItem[]): string {
  const uniqueItems = dedupeOverlappingItems(items);
  const lines: Line[] = [];

  for (const item of uniqueItems) {
    const str = item.str;
    if (!str) continue;

    const { x, y, width, height } = itemGeometry(item);
    const yTolerance = Math.max(2, height * 0.45);

    let line = lines.find((candidate) => Math.abs(candidate.y - y) <= yTolerance);
    if (!line) {
      line = { y, parts: [] };
      lines.push(line);
    }
    line.parts.push({ x, width, str, height });
  }

  lines.sort((a, b) => b.y - a.y);

  return lines
    .map((line) => {
      const parts = [...line.parts].sort((a, b) => a.x - b.x);
      let text = '';
      let previousEnd = Number.NEGATIVE_INFINITY;
      let lastStr = '';
      let lastX = Number.NEGATIVE_INFINITY;

      for (const part of parts) {
        const sameAsPrevious = part.str.trim() === lastStr.trim() && lastStr.length > 0;
        const overlapping = part.x < previousEnd - 1 || Math.abs(part.x - lastX) <= part.height;
        if (sameAsPrevious && overlapping) {
          continue;
        }

        const gap = part.x - previousEnd;
        const spaceWidth = Math.max(part.height * 0.25, 1.5);
        if (text && gap > spaceWidth && !text.endsWith(' ') && !part.str.startsWith(' ')) {
          text += ' ';
        }
        text += part.str;
        previousEnd = part.x + part.width;
        lastStr = part.str;
        lastX = part.x;
      }

      return collapseDoubledString(text.replace(/[ \t]+/g, ' ').trim());
    })
    .filter(Boolean)
    .join('\n');
}

export function isUsableTextLayer(text: string): boolean {
  return letterCount(text) >= MIN_USABLE_CHARS;
}

export async function extractNativePageText(
  pdfDocument: PDFDocumentProxy,
  pageNumber: number
): Promise<{ text: string; usable: boolean }> {
  const page = await pdfDocument.getPage(pageNumber);
  const content = await page.getTextContent();
  const items: PdfTextItem[] = [];
  for (const item of content.items) {
    if (isTextItem(item)) {
      items.push(item);
    }
  }
  const text = reconstructText(items);

  return {
    text,
    usable: isUsableTextLayer(text),
  };
}
