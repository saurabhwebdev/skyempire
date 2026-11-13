import { z } from 'zod';

export const TierSchema = z.enum(['startup', 'regional', 'national']);
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
