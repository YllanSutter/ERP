export const DEFAULT_WORKSPACE_COLOR = '#5e63e8';

export function getWorkspaceTheme(color: unknown): Record<string, string> {
  const hex = typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)
    ? color
    : DEFAULT_WORKSPACE_COLOR;
  const rgb = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  const mix = (target: number, amount: number) =>
    rgb.map((channel) => Math.round(channel + (target - channel) * amount));
  const luminance = (channels: number[]) => channels.reduce((sum, channel, index) => {
    const value = channel / 255;
    const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);

  // Solid action buttons use white text. Darken bright choices enough for readable labels.
  let solid = mix(0, 0.18);
  for (let amount = 0.23; luminance(solid) > 0.179; amount += 0.05) {
    solid = mix(0, amount);
  }

  return {
    '--brand-50': mix(255, 0.94).join(' '),
    '--brand-100': mix(255, 0.87).join(' '),
    '--brand-200': mix(255, 0.72).join(' '),
    '--brand-300': mix(255, 0.53).join(' '),
    '--brand-400': mix(255, 0.29).join(' '),
    '--brand-500': rgb.join(' '),
    '--brand-600': solid.join(' '),
    '--brand-700': solid.map((channel) => Math.round(channel * 0.84)).join(' '),
    '--brand-800': solid.map((channel) => Math.round(channel * 0.67)).join(' '),
    '--brand-900': solid.map((channel) => Math.round(channel * 0.51)).join(' '),
    '--brand-950': solid.map((channel) => Math.round(channel * 0.34)).join(' '),
  };
}
