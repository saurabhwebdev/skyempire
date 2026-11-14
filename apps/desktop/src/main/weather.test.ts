import { describe, expect, it, vi } from 'vitest';
import { conditionFromWmo, LiveWeather } from './weather';

const pts = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `A${i}`, lat: i, lon: i }));
const daily = (codes: number[], gusts = [10, 10, 10]) => ({ daily: { time: ['d0', 'd1', 'd2'], weather_code: codes, wind_gusts_10m_max: gusts } });
const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

describe('conditionFromWmo', () => {
  it('maps WMO codes and gusts to game weather', () => {
    expect(conditionFromWmo(0, 10)).toBe('clear');
    expect(conditionFromWmo(3, 65)).toBe('wind');
    expect(conditionFromWmo(61, 20)).toBe('rain');
    expect(conditionFromWmo(81, 20)).toBe('rain');
    expect(conditionFromWmo(73, 20)).toBe('snow');
    expect(conditionFromWmo(86, 20)).toBe('snow');
    expect(conditionFromWmo(45, 5)).toBe('fog');
    expect(conditionFromWmo(95, 40)).toBe('thunderstorm');
    expect(conditionFromWmo(82, 130)).toBe('cyclone');
  });
});

describe('LiveWeather', () => {
  it('maps forecast day i onto game day gameDay + 1 + i', async () => {
    const fetchFn = vi.fn().mockReturnValue(ok(daily([0, 73, 45])));
    const lw = new LiveWeather(fetchFn, () => 0);
    expect(await lw.refresh(pts(1), 100)).toEqual({ 101: { A0: 'clear' }, 102: { A0: 'snow' }, 103: { A0: 'fog' } });
    const url = String(fetchFn.mock.calls[0]![0]);
    expect(url).toContain('https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&daily=weather_code,wind_gusts_10m_max&forecast_days=3&timezone=UTC');
    expect(fetchFn.mock.calls[0]![1].headers['User-Agent']).toMatch(/^SkyEmpire\//);
  });
  it('throttles to one refresh a minute', async () => {
    let now = 0;
    const fetchFn = vi.fn().mockImplementation(() => ok(daily([0, 0, 0])));
    const lw = new LiveWeather(fetchFn, () => now);
    expect(await lw.refresh(pts(1), 1)).not.toBeNull();
    now = 59_000;
    expect(await lw.refresh(pts(1), 2)).toBeNull();
    now = 61_000;
    expect(await lw.refresh(pts(1), 3)).not.toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
  it('sends batches of 50 points and keeps good batches when one is malformed', async () => {
    const fetchFn = vi.fn()
      .mockReturnValueOnce(ok(Array.from({ length: 50 }, () => daily([61, 61, 61]))))
      .mockReturnValueOnce(ok({ error: true, reason: 'bad' }));
    const res = await new LiveWeather(fetchFn, () => 0).refresh(pts(60), 0);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(Object.keys(res![1]!)).toHaveLength(50);
    expect(res![1]!.A55).toBeUndefined();
  });
  it('returns null and never throws when offline', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    await expect(new LiveWeather(fetchFn, () => 0).refresh(pts(3), 0)).resolves.toBeNull();
  });
  it('treats HTTP errors as no data', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 429, json: () => Promise.resolve({}) } as Response);
    await expect(new LiveWeather(fetchFn, () => 0).refresh(pts(3), 0)).resolves.toBeNull();
  });
  it('skips points whose daily data is incomplete', async () => {
    const fetchFn = vi.fn().mockReturnValue(ok([daily([0, 0, 0]), { daily: { weather_code: [0] } }]));
    const res = await new LiveWeather(fetchFn, () => 0).refresh(pts(2), 0);
    expect(res![1]).toEqual({ A0: 'clear' });
  });
  it('does nothing with no points', async () => {
    const fetchFn = vi.fn();
    expect(await new LiveWeather(fetchFn, () => 0).refresh([], 0)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
