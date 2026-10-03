// Score a listing against the buyer's criteria. Pure and deterministic.
// Unknown values never fail a hard rule; they get partial points and a warning.
import type { Criteria, Listing, Score, ScoreLine, Tier } from '../types';

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (f: number) => `${Math.round(f * 100)}%`;
const fmtMoney = (n: number) => `£${n.toLocaleString('en-GB')}`;

function line(rule: string, weight: number, frac: number, pass: boolean | null, why: string): ScoreLine {
  return { rule, points: r2(weight * clamp01(frac)), max: weight, pass, why };
}

/** Size fraction: ≥ target → 1; poor..target → 0.3..1 linear; below poor → 0..0.2. */
function sizeFraction(sqft: number, c: Criteria): number {
  if (sqft >= c.targetSqft) return 1;
  if (sqft >= c.poorSqft) {
    const span = c.targetSqft - c.poorSqft;
    return span > 0 ? 0.3 + 0.7 * ((sqft - c.poorSqft) / span) : 1;
  }
  // Below poor: 20% at poorSqft, falling to 0% at 75% of poorSqft.
  const floor = c.poorSqft * 0.75;
  return 0.2 * clamp01((sqft - floor) / (c.poorSqft - floor));
}

export function scoreListing(l: Listing, c: Criteria): Score {
  const warnings: string[] = [];
  const hard: { rule: string; reason: string }[] = [];
  const w = c.weights;

  // ---------------------------------------------------------------- kitchen
  let kitchenLine: ScoreLine;
  switch (l.kitchen) {
    case 'window':
      kitchenLine = line('Kitchen', w.kitchen, 1, true, `Kitchen has a window (${l.kitchenSource ?? 'unknown source'})`);
      break;
    case 'open-dining':
      kitchenLine = line('Kitchen', w.kitchen, 1, true, `Kitchen open-plan to dining (${l.kitchenSource ?? 'unknown source'})`);
      break;
    case 'open-living':
      kitchenLine = line('Kitchen', w.kitchen, 0.8, true, 'Kitchen open-plan to living room: 80%');
      break;
    case 'windowless':
      kitchenLine = line('Kitchen', w.kitchen, 0, false, 'Enclosed windowless kitchen: 0');
      break;
    case 'unsure':
      kitchenLine = line('Kitchen', w.kitchen, 0.4, null, 'Kitchen window uncertain: 40%');
      warnings.push('kitchen uncertain — check floorplan for a window');
      break;
    default:
      kitchenLine = line('Kitchen', w.kitchen, 0.4, null, 'Kitchen unknown: 40%');
      warnings.push('kitchen unknown — check floorplan for a window');
  }
  if (l.kitchen && l.kitchenSource === 'text' && l.kitchen !== 'unsure') {
    warnings.push('kitchen verdict is from listing text only — confirm on floorplan');
  }

  // ---------------------------------------------------------------- floor
  const pos = l.position ? ` (${l.position})` : '';
  let floorLine: ScoreLine;
  if (l.floor === 0 || l.floor === 1) {
    floorLine = line('Floor', w.floor, 1, true, `${l.floor === 0 ? 'Ground' : 'First'} floor${pos}`);
  } else if (l.floor === 2) {
    floorLine = line('Floor', w.floor, 0.33, false, `Second floor${pos}: 33%`);
  } else if (l.floor === 3) {
    floorLine = line('Floor', w.floor, 0, false, `Third floor or higher${pos}: 0`);
    hard.push({ rule: 'Floor', reason: `Third floor or higher${pos}` });
  } else {
    floorLine = line('Floor', w.floor, 0.5, null, 'Floor unknown: 50%');
    warnings.push('floor unknown — check floorplan');
  }

  // ---------------------------------------------------------------- tenement
  let tenLine: ScoreLine;
  if (l.tenement === true) tenLine = line('Tenement', w.tenement, 1, true, 'Traditional tenement');
  else if (l.tenement === false) {
    tenLine = line('Tenement', w.tenement, 0, c.requireTenement ? false : null, 'Not a traditional tenement: 0');
    if (c.requireTenement) hard.push({ rule: 'Tenement', reason: 'Not a traditional tenement (tenement required)' });
  } else {
    tenLine = line('Tenement', w.tenement, 0.5, null, 'Building type unknown: 50%');
    warnings.push('tenement status unknown');
  }

  // ---------------------------------------------------------------- size
  const sqft = l.sqftFloorplan ?? l.sqftListing;
  const sqftSrc = l.sqftFloorplan != null ? 'floorplan' : 'listing';
  let sizeLine: ScoreLine;
  if (sqft == null) {
    sizeLine = line('Size', w.size, 0.5, null, 'Size unknown: 50%');
    warnings.push('size unknown — check floorplan');
  } else {
    const f = sizeFraction(sqft, c);
    const failsSize = sqft < c.minSqftHard;
    sizeLine = line(
      'Size',
      w.size,
      f,
      !failsSize,
      `${sqft.toLocaleString('en-GB')} sq ft (${sqftSrc}); target ${c.targetSqft}: ${pct(f)}`,
    );
    if (failsSize) hard.push({ rule: 'Size', reason: `${sqft} sq ft is below the ${c.minSqftHard} sq ft minimum` });
  }
  if (l.sqftFloorplan != null && l.sqftListing != null && l.sqftListing > 0) {
    const diff = Math.abs(l.sqftFloorplan - l.sqftListing) / l.sqftListing;
    if (diff > 0.05) {
      warnings.push(
        `floorplan size ${l.sqftFloorplan} sq ft differs from listing ${l.sqftListing} sq ft by ${Math.round(diff * 100)}% — using floorplan`,
      );
    }
  }

  // ---------------------------------------------------------------- bedroom 2
  let bedLine: ScoreLine;
  if (l.bed2WidthM == null) {
    bedLine = line('Bedroom 2', w.bed2, 0.5, null, 'Bedroom 2 width unknown: 50%');
    warnings.push('bedroom 2 width unknown');
  } else if (l.bed2WidthM >= c.bed2MinWidthM) {
    bedLine = line('Bedroom 2', w.bed2, 1, true, `Bedroom 2 is ${l.bed2WidthM} m wide (≥ ${c.bed2MinWidthM} m): proper double`);
  } else {
    bedLine = line('Bedroom 2', w.bed2, 0.3, null, `Bedroom 2 only ${l.bed2WidthM} m wide (< ${c.bed2MinWidthM} m): single/study, 30%`);
  }

  // ---------------------------------------------------------------- area
  let areaLine: ScoreLine;
  const areaDef = l.area ? c.areas[l.area] : undefined;
  if (areaDef) {
    const ranks = Object.values(c.areas).map((a) => a.rank);
    const best = Math.min(...ranks);
    const worst = Math.max(...ranks);
    const f = worst === best ? 1 : 1 - 0.6 * ((areaDef.rank - best) / (worst - best));
    areaLine = line('Area', w.area, f, null, `${areaDef.name} (rank ${areaDef.rank}): ${pct(f)}`);
  } else {
    areaLine = line('Area', w.area, 0.3, null, l.area ? `Area "${l.area}" not in criteria: 30%` : 'Area unknown / not preferred: 30%');
    if (!l.area) warnings.push('area unknown or outside preferred areas');
  }

  // ---------------------------------------------------------------- price
  let priceLine: ScoreLine;
  if (l.price == null) {
    priceLine = line('Price', w.price, 0.5, null, 'Price unknown: 50%');
    warnings.push('price unknown');
  } else if (l.price > c.maxPrice) {
    priceLine = line('Price', w.price, 0, false, `${fmtMoney(l.price)} is over the ${fmtMoney(c.maxPrice)} limit`);
    hard.push({ rule: 'Price', reason: `${fmtMoney(l.price)} is over the ${fmtMoney(c.maxPrice)} limit` });
  } else {
    const headroom = (c.maxPrice - l.price) / c.maxPrice;
    const f = clamp01(headroom / 0.15);
    const q = l.qualifier ? `${l.qualifier} ` : '';
    priceLine = line('Price', w.price, f, true, `${q}${fmtMoney(l.price)}: ${Math.round(headroom * 100)}% under max (15%+ = full): ${pct(f)}`);
  }

  // ---------------------------------------------------------------- other hard rules
  if (l.beds == null) warnings.push('bedrooms unknown');
  else if (l.beds < c.minBeds) hard.push({ rule: 'Beds', reason: `${l.beds} bedroom(s), need at least ${c.minBeds}` });

  if (l.excludedReason) hard.push({ rule: 'Excluded', reason: `Excluded: ${l.excludedReason}` });

  const ruleLines = [kitchenLine, floorLine, tenLine, sizeLine, bedLine, areaLine, priceLine];

  // Windowless kitchen: fails unless the exception is on and every other rule is at full points.
  if (l.kitchen === 'windowless') {
    const othersFull = ruleLines.filter((x) => x !== kitchenLine).every((x) => x.points >= x.max);
    if (c.allowWindowlessException && othersFull && hard.length === 0) {
      warnings.push('windowless-kitchen exception: everything else is perfect');
      kitchenLine.why += ' (exception applied: everything else at full points)';
    } else {
      hard.push({
        rule: 'Kitchen',
        reason: c.allowWindowlessException
          ? 'Enclosed windowless kitchen (exception needs every other rule at full points)'
          : 'Enclosed windowless kitchen',
      });
    }
  }

  // Second floor: fails unless the exception applies.
  if (l.floor === 2) {
    const others = ruleLines.filter((x) => x !== floorLine);
    const got = others.reduce((s, x) => s + x.points, 0);
    const max = others.reduce((s, x) => s + x.max, 0);
    const ratio = max > 0 ? got / max : 0;
    const goodKitchen = l.kitchen === 'window' || l.kitchen === 'open-dining';
    const reasons: string[] = [];
    if (!c.allowSecondFloorException) reasons.push('exception disabled');
    if (hard.length > 0) reasons.push('other hard rules fail');
    if (!goodKitchen) reasons.push('kitchen is not window / open-dining');
    if (ratio < 0.85) reasons.push(`rest of score ${pct(ratio)} < 85%`);
    if (reasons.length === 0) {
      floorLine.pass = true;
      floorLine.why += ` — 2nd-floor exception (rest scores ${pct(ratio)})`;
      warnings.push('2nd-floor exception');
    } else {
      hard.push({ rule: 'Floor', reason: `Second floor${pos}, no exception: ${reasons.join('; ')}` });
    }
  }

  // ---------------------------------------------------------------- bonuses
  const bonusLines: ScoreLine[] = [];
  const b = c.bonuses;
  const bonus = (rule: string, pts: number, why: string) => bonusLines.push({ rule, points: pts, max: pts, pass: null, why });
  if (l.extras?.walkInShower) bonus('Bonus: walk-in shower', b.walkInShower, 'Walk-in shower');
  if (l.extras?.garden) bonus('Bonus: garden', b.garden, 'Private / own garden');
  if (l.extras?.bay) bonus('Bonus: bay window', b.bay, 'Bay window');
  if (l.epc && /^[ABC]$/i.test(l.epc.trim())) bonus('Bonus: EPC', b.epcCOrBetter, `EPC ${l.epc.toUpperCase()} (C or better)`);
  if (l.councilTaxBand && /^[BC]$/i.test(l.councilTaxBand.trim()))
    bonus('Bonus: council tax', b.ctBandBC, `Council tax band ${l.councilTaxBand.toUpperCase()}`);

  const lines = [...ruleLines, ...bonusLines];
  const total = Math.min(100, Math.round(lines.reduce((s, x) => s + x.points, 0)));
  const hardFails = hard.map((h) => h.reason);

  // "Two proper doubles" is core to the brief: a known-narrow bedroom 2 caps the tier at Strong.
  const bed2Narrow = l.bed2WidthM !== null && l.bed2WidthM < c.bed2MinWidthM;
  // Same for a known non-tenement: it can rank well but isn't the target property.
  const notTenement = l.tenement === false;

  let tier: Tier;
  if (hardFails.length > 0) tier = 'Fails';
  else if (
    total >= 85 &&
    !bed2Narrow &&
    !notTenement &&
    (l.kitchen === 'window' || l.kitchen === 'open-dining') &&
    (l.kitchenSource === 'floorplan' || l.kitchenSource === 'manual')
  )
    tier = 'Perfect';
  else if (total >= 70) tier = 'Strong';
  else tier = 'Possible';

  if (tier !== 'Fails' && total >= 85 && tier !== 'Perfect') {
    warnings.push(
      bed2Narrow
        ? `scores Perfect-level but bedroom 2 is only ${l.bed2WidthM} m wide (single/study)`
        : notTenement
        ? 'scores Perfect-level but is not a traditional tenement'
        : 'scores Perfect-level but kitchen is not confirmed from floorplan/manual check',
    );
  }

  return { total, tier, hardFails, warnings, lines };
}
