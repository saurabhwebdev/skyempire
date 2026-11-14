import { cn } from '@skyempire/ui';
import { useState } from 'react';
import { photoOf } from '../lib/aircraftMedia';
import { catalog } from '../lib/catalog';
import { AircraftSilhouette } from './AircraftSilhouette';

/** Real photo of the type (falls back to the silhouette). `credit` adds the required author/licence line. */
export function AircraftPhoto({ typeId, className, credit = false, eager = false }: { typeId: string; className?: string; credit?: boolean; eager?: boolean }) {
  const p = photoOf(typeId);
  const [failed, setFailed] = useState(false);
  const name = catalog.aircraftTypes[typeId]?.name ?? typeId;
  if (!p || failed) {
    return <div className={cn('flex items-center justify-center bg-surface-2 p-4', className)}><AircraftSilhouette typeId={typeId} className="h-1/2 w-full text-muted" /></div>;
  }
  return (
    <figure className="flex flex-col gap-1.5">
      <img src={p.url} alt={`${name} in flight or on the ground`} loading={eager ? 'eager' : 'lazy'} decoding="async" width={960} height={640}
        onError={() => setFailed(true)} className={cn('w-full bg-surface-2 object-cover', className)} />
      {credit && (
        <figcaption className="text-[11px] text-faint">
          Photo: {p.author} ·{' '}
          <a href={p.source} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-muted">{p.license}</a>
          {' '}· Wikimedia Commons
        </figcaption>
      )}
    </figure>
  );
}
