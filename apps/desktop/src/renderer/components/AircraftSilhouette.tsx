import { silhouetteSvg } from '../lib/silhouettes';

/** Inline silhouette tinted with currentColor. */
export function AircraftSilhouette({ typeId, view = 'side', className }: { typeId: string; view?: 'side' | 'top'; className?: string }) {
  const svg = silhouetteSvg(typeId, view);
  if (!svg) return null;
  return <span aria-hidden className={className} style={{ display: 'inline-block', lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: svg.replace('<svg ', '<svg width="100%" height="100%" ') }} />;
}
