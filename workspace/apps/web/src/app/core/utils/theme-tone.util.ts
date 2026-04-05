export type ThemeTone =
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

function normalizeHexColor(color?: string | null): string | null {
  if (!color) return null;

  const value = color.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)) return null;

  if (value.length === 3) {
    return value
      .split('')
      .map((char) => char + char)
      .join('')
      .toLowerCase();
  }

  return value.toLowerCase();
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;

  if (delta !== 0) {
    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }
  }

  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  const saturation = max === 0 ? 0 : delta / max;
  const value = max;

  return [hue, saturation, value];
}

function resolveTone(color?: string | null): ThemeTone {
  const hex = normalizeHexColor(color);
  if (!hex) return 'neutral';

  const [hue, saturation, value] = rgbToHsv(...hexToRgb(hex));

  if (value < 0.18 || saturation < 0.14) return 'neutral';
  if (hue < 20 || hue >= 345) return 'danger';
  if (hue < 55) return 'warning';
  if (hue < 165) return 'success';
  if (hue < 255) return 'info';
  if (hue < 330) return 'accent';

  return 'primary';
}

export function getThemeToneClass(color?: string | null): string {
  return `td-tone-${resolveTone(color)}`;
}

export function getThemeTextToneClass(color?: string | null): string {
  return `td-text-${resolveTone(color)}`;
}

