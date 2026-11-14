/** sRGB equivalents of the OKLCH tokens (deck.gl and MapLibre need RGB). */
export type RGBA = [number, number, number, number];
export const MAP = { water: '#0b0f15', land: '#1a1e24', border: '#2c3138' };
export const ACCENT: RGBA = [64, 170, 230, 255];
export const AIRPORT: RGBA = [150, 160, 175, 200];
export const AIRPORT_ACTIVE: RGBA = [215, 222, 232, 255];
export const RIVAL_PALETTE: RGBA[] = [
  [214, 151, 76, 255], [77, 174, 193, 255], [93, 175, 115, 255], [220, 200, 95, 255],
  [92, 128, 205, 255], [206, 110, 82, 255], [196, 128, 177, 255], [130, 136, 146, 255],
];

export function hexToRgba(hex: string, alpha = 255): RGBA {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}

/** Weather overlay: soft halos, one hue per condition (dark-map tuned; labels carry meaning too). */
export const WEATHER_COLORS: Record<string, RGBA> = {
  wind: [120, 190, 200, 70],
  rain: [80, 140, 230, 80],
  thunderstorm: [175, 110, 230, 110],
  snow: [225, 235, 250, 110],
  fog: [160, 165, 175, 100],
  cyclone: [235, 90, 80, 140],
};
