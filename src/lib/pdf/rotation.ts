import { degrees, type PDFPage } from 'pdf-lib';
import type { PageConfig } from './store';

const RIGHT_ANGLES = [0, 90, 180, 270] as const;

function readPageRotation(page: PDFPage): number {
  try {
    const rotationObj = page.getRotation();
    if (typeof rotationObj === 'object' && rotationObj && 'angle' in rotationObj) {
      return Number(rotationObj.angle) || 0;
    }
    return typeof rotationObj === 'number' ? rotationObj : 0;
  } catch {
    return 0;
  }
}

function snapToRightAngle(angle: number): (typeof RIGHT_ANGLES)[number] {
  const normalized = ((angle % 360) + 360) % 360;
  return RIGHT_ANGLES.reduce((best, candidate) => {
    const bestDelta = Math.min(
      Math.abs(best - normalized),
      360 - Math.abs(best - normalized)
    );
    const candidateDelta = Math.min(
      Math.abs(candidate - normalized),
      360 - Math.abs(candidate - normalized)
    );
    return candidateDelta < bestDelta ? candidate : best;
  }, 0 as (typeof RIGHT_ANGLES)[number]);
}

export function applyPageRotation(page: PDFPage, config: PageConfig): void {
  const currentRotation = readPageRotation(page);
  const userRotation = typeof config.rotation === 'string'
    ? parseInt(config.rotation, 10)
    : (typeof config.rotation === 'number' ? config.rotation : 0);

  const normalizedUserRotation = ((userRotation % 360) + 360) % 360;
  const desiredRotation = ((currentRotation + normalizedUserRotation) % 360 + 360) % 360;
  page.setRotation(degrees(snapToRightAngle(desiredRotation)));
}
