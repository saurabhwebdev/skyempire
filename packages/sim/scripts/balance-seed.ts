/** One balanced-bot run: node balance-seed.ts <seed> [years=2]. Run many seeds in parallel and average — single seeds are noisy. */
import { loadCatalog } from '@skyempire/data';
import { margin, simulate } from '../src/balance/bots';

const seed = Number(process.argv[2] ?? 1);
const years = Number(process.argv[3] ?? 2);
const t0 = Date.now();
const r = simulate(loadCatalog('world'), seed, years * 360, 'balanced');
const ai = Object.entries(r.yearly).filter(([id]) => id !== r.state.playerId).flatMap(([, ys]) => ys.slice(1).map(margin)).sort((a, b) => a - b);
const p = r.yearly[r.state.playerId] ?? [];
console.log(JSON.stringify({ seed, aiMedian: ai[Math.floor(ai.length / 2)], bankrupt: r.bankruptAi, player: p.map(margin), regionalDay: r.tierDay.regional, alive: !r.state.gameOver, s: Math.round((Date.now() - t0) / 1000) }));
