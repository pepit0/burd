export interface ScreenPoint {
  x: number;
  y: number;
}

let guideTabCenter: ScreenPoint | null = null;

export function setGuideTabCenter(point: ScreenPoint | null): void {
  guideTabCenter = point;
}

export function getGuideTabCenter(): ScreenPoint | null {
  return guideTabCenter;
}
