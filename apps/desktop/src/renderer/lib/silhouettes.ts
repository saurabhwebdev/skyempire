// Real aircraft silhouettes generated from published dimensions (packages/data/scripts/build-silhouettes.ts).
const files = import.meta.glob('../../../../../packages/data/src/silhouettes/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const byName = new Map(Object.entries(files).map(([path, svg]) => [path.split('/').pop()!.replace('.svg', ''), svg]));

export function silhouetteSvg(typeId: string, view: 'side' | 'top'): string | null {
  return byName.get(`${typeId}-${view}`) ?? null;
}
