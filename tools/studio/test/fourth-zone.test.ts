import { describe, expect, it } from 'vitest';
import { loadDatabase } from '../load-data.ts';
import { validateDatabase } from '../../sim-core/src/data.ts';
import { TurnSimulation } from '../../sim-core/src/turn.ts';
import { SkillPolicy } from '../../sim-core/src/policy.ts';
import { Rng } from '../../sim-core/src/rng.ts';
import { createGrill, deriveStats, effectiveHeat, overallDoneness, runtimeZoneIndex, scoreItem, rewardTuning } from '../../sim-core/src/cooking.ts';
const db = loadDatabase();
const make = (r = 4, id?: string, evo = 3, upgrades: Record<string, number> = {}) =>
  new TurnSimulation(db, { playerLevel: 44, restaurantIndex: r, levelId: 'a04', seed: 55,
    upgradeLevels: upgrades, churrasqueiraId: id, churrasqueiraLevel: evo, overrides: { autoSpawn: false } });
const fornalha = 'fornalha_dragao_manso';

describe('A-04: owner contract — Premium AND Fornalha, extra medium, not a hotter profile', () => {
  it.each([0,1,2,3,4,5,6])('default restaurant %i creates its declared zone count', r => {
    const s = make(r);
    expect(s.grill.zones).toHaveLength(db.restaurantByIndex.get(r)!.grill.zoneCount);
    expect(s.grill.zones.map(z => z.heat)).toEqual(r < 4 ? [0.55,1,1.55] : [0.55,1,1.55,1]);
  });
  for (const ch of db.churrasqueiras!.churrasqueiras) for (const evo of ch.evolutions) {
    it(`${ch.id} evo${evo.level}: boundary3→4→5, only Fornalha expands`, () => {
      for (const r of [3,4,5,6]) {
        const s = make(r, ch.id, evo.level, { grill_size: 2 });
        const n = ch.id === fornalha && r >= 4 ? 4 : evo.zoneCount;
        expect(s.grill.zones).toHaveLength(n); expect(s.stats.zoneCount).toBe(n);
        expect(s.stats.slotsPerZone).toBe(evo.slotsPerZone + 2);
        const legacy = evo.zoneCount === 1 ? [evo.heatBase] : (evo.zoneCount === 2 ? [.55,1.55] : [.55,1,1.55])
          .map(h => Math.min(1.7, h * evo.heatBase));
        expect(s.grill.zones.slice(0, evo.zoneCount).map(z => z.heat)).toEqual(legacy);
        if (n === 4) expect(s.grill.zones[3]!.heat).toBe(Math.min(1.7, evo.heatBase));
      }
    });
  }
  it('resolves stable low/medium/high IDs; extra exists only on expanded grills', () => {
    for (const n of [1,2,3,4]) {
      const s = n === 4 ? make() : make(0, db.churrasqueiras!.churrasqueiras[n-1]!.id);
      expect(runtimeZoneIndex(s.grill, db, 'low')).toBe(0);
      expect(runtimeZoneIndex(s.grill, db, 'medium')).toBe(n === 1 ? 0 : 1);
      expect(runtimeZoneIndex(s.grill, db, 'high')).toBe(n === 4 ? 2 : n-1);
      expect(runtimeZoneIndex(s.grill, db, 'medium_extra')).toBe(n === 4 ? 3 : -1);
      expect(runtimeZoneIndex(s.grill, db, 'none')).toBe(-1);
    }
  });
  it('preserves all original effective heats/upgrade bonuses and gives extra the medium bonus', () => {
    for (const id of [undefined, fornalha]) {
      const before = make(3, id, 3, { grill_heat: 4 }), after = make(4, id, 3, { grill_heat: 4 });
      for (const efficiency of [1, .6, .25]) {
        before.grill.charcoalEfficiency = after.grill.charcoalEfficiency = efficiency;
        for (let z=0; z<3; z++) expect(effectiveHeat(after.grill,z,db)).toBe(effectiveHeat(before.grill,z,db));
        expect(effectiveHeat(after.grill,3,db)).toBe(effectiveHeat(after.grill,1,db));
      }
    }
  });
  it('rejects unsupported counts rather than silently clamping missing table zones', () => {
    for (const count of [0,5,2.5,NaN]) {
      expect(() => createGrill({ ...deriveStats(db, db.restaurants.restaurants[0]!, {}), zoneCount: count }, db)).toThrow(/zoneCount/);
    }
  });
  it('fourth slot accepts, heats, flips, moves and serves a physically cooked plate', () => {
    const s = make(4, fornalha), ing = db.ingredientById.get('linguica_toscana')!;
    const c = s.spawnScriptedCustomer('comum', [ing.id], 90), f = s.takeFromStock(ing);
    expect(s.place(f, 3)).toBe(true);
    expect(s.grill.zones[3]!.items).toContain(f);
    for (let i=0; i<4000 && overallDoneness(f)<.78; i++) {
      s.tick(.01);
      if (!f.flips && f.sides[0]! >= .78) expect(s.flip(f)).toBe(true);
    }
    expect(f.burned).toBe(false); expect(f.timeOnGrill).toBeGreaterThan(0);
    expect(s.move(f, 1)).toBe(true); expect(s.grill.zones[3]!.items).not.toContain(f);
    expect(s.move(f, 3)).toBe(true);
    expect(s.serve(c, f)?.quality).toBe('perfect');
    expect(c.state).toBe('served'); expect(s.grill.zones[3]!.items).toEqual([]);
    expect(s.result()).toEqual(s.result());
  });
  it('enforces capacity/invalid indexes on fourth zone, without losing a plate on failed moves', () => {
    const s = make(4,fornalha);
    for(let i=0;i<s.stats.slotsPerZone;i++) expect(s.place(s.takeFromStock(db.ingredients.items[0]!),3)).toBe(true);
    const f=s.takeFromStock(db.ingredients.items[0]!); expect(s.place(f,0)).toBe(true);
    expect(s.move(f,3)).toBe(false); expect(f.zoneIndex).toBe(0);
    expect(s.place(f,4)).toBe(false); expect(s.place(f,-1)).toBe(false);
    s.discard(s.grill.zones[3]!.items[0]!); expect(s.move(f,3)).toBe(true);
  });
  it('bot really places into extra capacity when all original zones are full', () => {
    const s = make(4,fornalha);
    // Distinct fillers keep each ingredient inside its six-unit stock capacity.
    const fillers=['costela','cupim','picanha'];
    for(let z=0;z<3;z++) for(let i=0;i<s.stats.slotsPerZone;i++)
      expect(s.place(s.takeFromStock(db.ingredientById.get(fillers[z]!)!),z)).toBe(true);
    const c=s.spawnScriptedCustomer('comum',['linguica_toscana'],90);
    const bot=new SkillPolicy(new Rng(4),{skill:1}); s.tick(.1,a=>bot.act(a));
    expect(s.grill.zones[3]?.items.some(f=>f.ingredient.id==='linguica_toscana')).toBe(true);
    for(let i=0;i<600 && c.state==='waiting';i++) s.tick(.1,a=>bot.act(a));
    expect(c.state).toBe('served');
  });
  it.each(['costela','cupim'])('%s still reaches a perfect window in every zone, including medium extra', id => {
    for(let z=0;z<4;z++) {
      const s=make(4,fornalha),f=s.takeFromStock(db.ingredientById.get(id)!);
      expect(s.place(f,z)).toBe(true);
      let perfect=false;
      for(let i=0;i<5000 && !f.burned;i++) {
        s.tick(.05); if(!f.flips && f.sides[0]!>=.6)s.flip(f);
        if(scoreItem(db,f,{target:0,toleranceScale:1,patienceRemaining:1,combo:0,tipMult:1,xpMult:1,tuning:rewardTuning(db.economy)}).quality==='perfect'){perfect=true;break;}
      }
      expect(perfect,`${id} zone${z}`).toBe(true);
    }
  });
});

describe('A-04: malformed zone/expansion contracts fail semantic validation', () => {
  it('rejects a restaurant promising an undefined zone', () => {
    const d=structuredClone(db); d.restaurants.restaurants[4]!.grill.zoneCount=5;
    expect(validateDatabase(d).join('\n')).toMatch(/zoneCount/);
  });
  it('rejects duplicate zone IDs and noncontiguous indices', () => {
    const d=structuredClone(db); d.grill.zones[1]!.id='low';d.grill.zones[1]!.index=4;
    expect(validateDatabase(d).join('\n')).toMatch(/zone/);
  });
});

describe('A-04: auxiliary zones and hardware expansion references are validated', () => {
  it('ships exactly the approved contract, not a universal equipment expansion', () => {
    expect(db.grill.zones[3]).toMatchObject({ id:'medium_extra',index:3,heatMultiplier:1,auxiliaryOf:'medium' });
    expect(db.churrasqueiraById.get(fornalha)!.restaurantExpansion).toEqual({ restaurantIndex:4,zoneCount:4 });
    expect(db.churrasqueiras!.churrasqueiras.filter(ch=>ch.restaurantExpansion).map(ch=>ch.id)).toEqual([fornalha]);
  });
  it.each(['heat','source','order','missingRestaurant','missingZone','fraction','notExpansion','missingAuxiliary','emptyAuxiliary','sourceHeatMismatch'])('rejects broken %s contract', kind => {
    const d=structuredClone(db), extra=d.grill.zones[3]!, expansion=d.churrasqueiraById.get(fornalha)!.restaurantExpansion!;
    if(kind==='heat')extra.heatMultiplier=NaN;
    if(kind==='missingAuxiliary')delete extra.auxiliaryOf;
    if(kind==='emptyAuxiliary')extra.auxiliaryOf='' as typeof extra.auxiliaryOf;
    if(kind==='sourceHeatMismatch')extra.heatMultiplier=1.55;
    if(kind==='source')extra.auxiliaryOf='nonexistent' as typeof extra.auxiliaryOf;
    if(kind==='order')d.grill.zones[1]!.auxiliaryOf='low';
    if(kind==='missingRestaurant')expansion.restaurantIndex=100;
    if(kind==='missingZone')expansion.zoneCount=5;
    if(kind==='fraction')expansion.zoneCount=3.5;
    if(kind==='notExpansion')expansion.zoneCount=2;
    expect(validateDatabase(d).join('\n')).toMatch(/zone|expansion/i);
  });
});

it('A-04: the generic grill constructor agrees with the same primary/auxiliary heat mapping', () => {
  const stats=deriveStats(db,db.restaurants.restaurants[0]!,{});
  for(const [n,heats] of [[1,[.55]],[2,[.55,1.55]],[3,[.55,1,1.55]],[4,[.55,1,1.55,1]]] as const) {
    const g=createGrill({...stats,zoneCount:n},db);
    expect(g.zones.map(z=>z.heat)).toEqual(heats);
  }
});
