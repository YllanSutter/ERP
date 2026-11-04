export const LAYOUT_TILE_GAP = 12;

export const LAYOUT_WIDTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: `${index + 1}fr`,
}));

export const LAYOUT_HEIGHT_OPTIONS = Array.from({ length: 5 }, (_, index) => ({
  value: 200 * (index + 1) + LAYOUT_TILE_GAP * index,
  label: `${index + 1}fr`,
}));

export function getLayoutTileHeight(height: number) {
  return height === 400 ? LAYOUT_HEIGHT_OPTIONS[1].value : height;
}

export function getLayoutSizeOptions(options: ReadonlyArray<{ value: number; label: string }>, current: number, label: string) {
  return options.some(({ value }) => value === current)
    ? options
    : [...options, { value: current, label }];
}
