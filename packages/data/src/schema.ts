import { z } from 'zod';

export const TierSchema = z.enum(['startup', 'regional', 'national', 'global']);
export const PersonalitySchema = z.enum(['budget', 'legacy', 'regional', 'gulf', 'expander']);

export const AircraftTypeSchema = z.object({
  id: z.string().min(3).max(4),
  icao: z.string().length(4),
  name: z.string(),
  manufacturer: z.string(),
  class: z.enum(['turboprop', 'regional', 'narrowbody', 'longNarrowbody', 'widebody']),
  maxSeats: z.number().int().positive(),
  rangeKm: z.number().positive(),
  cruiseKmh: z.number().positive(),
  fuelKgPerH: z.number().positive(),
  priceUsd: z.number().int().positive(),
  leasePerMonth: z.number().int().positive(),
  maintPerH: z.number().int().positive(),
  crewPerH: z.number().int().positive(),
  minRunwayM: z.number().int().positive(),
  turnaroundMin: z.number().int().positive(),
  mtowT: z.number().positive(),
  comfort: z.number().min(0).max(100),
  tier: TierSchema,
  usedOnly: z.boolean().optional(),
  sources: z.array(z.string()).min(1),
});

export const AirportSchema = z.object({
  id: z.string().length(3),
  icao: z.string(),
  name: z.string(),
  city: z.string(),
  country: z.string().length(2),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  sizeClass: z.number().int().min(1).max(6),
  population: z.number().nonnegative(),
  wealth: z.number().min(0.3).max(2),
  tourism: z.number().min(0).max(1),
  business: z.number().min(0).max(1),
  runwayM: z.number().int().positive(),
  slotCapacity: z.number().int().positive(),
  landingFeePerTonne: z.number().nonnegative(),
  paxFee: z.number().nonnegative(),
});

export const AirlineDataSchema = z.object({
  iata: z.string().length(2),
  icao: z.string().length(3),
  name: z.string(),
  country: z.string().length(2),
  wikidata: z.string().regex(/^Q\d+$/),
  hubId: z.string().length(3),
  personality: PersonalitySchema,
  sizeRank: z.number().int().positive(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fleetTypes: z.array(z.string()).min(1),
  sources: z.array(z.string()).min(1),
});

/** Real-world facts shown on the aircraft page (v0.3), from Wikipedia. */
export const AircraftDetailsSchema = z.object({
  lengthM: z.number().positive(),
  spanM: z.number().positive(),
  heightM: z.number().positive(),
  engines: z.string().min(3),
  firstFlight: z.string().regex(/^\d{4}-\d{2}$/),
  typicalSeats: z.string().min(1),
  /** Economy seats per row. */
  abreast: z.number().int().min(3).max(11),
  denseAbreast: z.number().int().min(4).max(11).optional(),
  source: z.string().url(),
});
export type AircraftDetails = z.infer<typeof AircraftDetailsSchema>;

/** A freely licensed Wikimedia Commons photo (credit required for CC BY / CC BY-SA). */
export const AircraftPhotoSchema = z.object({
  file: z.string().regex(/^[A-Z0-9]{3,4}\.webp$/),
  title: z.string(),
  author: z.string().min(1),
  license: z.string().regex(/^(CC BY(-SA)? [\d.]+|CC0|Public domain)/i),
  licenseUrl: z.string(),
  source: z.string().url(),
});
export type AircraftPhoto = z.infer<typeof AircraftPhotoSchema>;
