const R = 6371;
const toRad = Math.PI / 180;

/** Great-circle distance in km (haversine). */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
