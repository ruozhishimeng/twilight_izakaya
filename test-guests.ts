import { GUESTS } from './src/data/gameData.js';
console.log(GUESTS.map(g => ({
  id: g.id,
  name: g.name,
  phasesCount: g.phases.length,
  firstPhaseTurns: g.phases[0]?.turns.length,
  firstPhaseIntro: g.phases[0]?.intro
})));
