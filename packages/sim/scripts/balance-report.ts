/** Balance report. Usage: node packages/sim/scripts/balance-report.ts [years=2] [seeds=1] */
import { loadCatalog } from '@skyempire/data';
import { margin, simulate } from '../src/balance/bots';

const years = Number(process.argv[2] ?? 2);
const seeds = Number(process.argv[3] ?? 1);
const catalog = loadCatalog('world');
const pct = (x: number | undefined) => `${((x ?? 0) * 100).toFixed(1)}%`;

for (let seed = Number(process.argv[4] ?? 1); seed < Number(process.argv[4] ?? 1) + seeds; seed++) {
  for (const style of ['balanced', 'cheap'] as const) {
    const t0 = Date.now();
    const r = simulate(catalog, seed, years * 360, style);
    const ai = Object.entries(r.yearly)
      .filter(([id]) => id !== r.state.playerId)
      .flatMap(([, ys]) => ys.slice(1).map(margin))
      .sort((a, b) => a - b);
    const at = (q: number) => ai[Math.floor(ai.length * q)];
    const p = r.yearly[r.state.playerId] ?? [];
    const pl = r.state.airlines[r.state.playerId]!;
    const fleet = Object.values(r.state.aircraft).filter((a) => a.ownerId === pl.id).length;
    console.log(
      [
        `seed ${seed} ${style.padEnd(8)}`,
        `AI margin median ${pct(at(0.5))} (p10 ${pct(at(0.1))}, p90 ${pct(at(0.9))}), bankrupt ${r.bankruptAi}`,
        `player margins ${p.map((y) => `${Math.round(margin(y) * 100)}%`).join(' ')}`,
        `value ${r.playerValueByYear.map((v) => `${Math.round(v / 1e6)}M`).join(' ')}`,
        `fleet ${fleet} tier ${pl.tier} (regional d${r.tierDay.regional ?? '-'}, national d${r.tierDay.national ?? '-'})`,
        r.state.gameOver ? 'BANKRUPT' : 'alive',
        `${Math.round((Date.now() - t0) / 1000)}s`,
      ].join(' | '),
    );
  }
}
