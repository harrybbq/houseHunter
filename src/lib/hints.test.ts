import { describe, it, expect } from 'vitest';
import type { Criteria } from '../types';
import criteriaJson from '../../data/criteria.json';
import {
  areaFor,
  bed2Width,
  bed2Dimensions,
  councilTaxFromText,
  detectExcluded,
  detectExtras,
  detectTenement,
  epcFromText,
  htmlToText,
  kitchenHint,
  parseFloor,
  parsePrice,
  sqftFromText,
} from './hints';

const criteria = criteriaJson as Criteria;

describe('parseFloor', () => {
  it.each([
    ['0/1', 0, '0/1'],
    ['1/2', 1, '1/2'],
    ['2/1', 2, '2/1'],
    ['3/L', 3, '3/L'],
    ['4/2 top floor flat', 3, '4/2'],
    ['Flat 1/2, 406 Victoria Road', 1, '1/2'],
    ['Floorplan 1/2, 405 Victoria Road', 1, '1/2'],
    ['Position: 0/R', 0, '0/R'],
  ])('position code %s', (text, floor, position) => {
    expect(parseFloor(text)).toEqual({ floor, position });
  });

  it.each([
    ['Main door flat with its own entrance', 0],
    ['A raised ground floor flat in a sandstone tenement', 0],
    ['elevated ground floor apartment', 0],
    ['garden level flat', 0],
    ['Spacious first floor flat', 1],
    ['a first-floor apartment', 1],
    ['A bright second floor flat', 2],
    ['on the third floor of this building', 3],
    ['Top floor flat in a four-storey red sandstone tenement', 3],
  ])('phrase "%s" → %s', (text, floor) => {
    expect(parseFloor(text).floor).toBe(floor);
    expect(parseFloor(text).position).toBeNull();
  });

  it('avoids false positives', () => {
    expect(parseFloor('Only 1/2 mile from Queens Park station').floor).toBeNull();
    expect(parseFloor('1/2 hour to the city').floor).toBeNull();
    expect(parseFloor('Added on 22/09/2026').floor).toBeNull();
    expect(parseFloor('The flat is reached via the first-floor landing of the close').floor).toBeNull();
    expect(parseFloor('Top floor flat').floor).toBeNull(); // no evidence of building height
    expect(parseFloor('Top floor of a two-storey building, tenement style').floor).toBeNull();
    // A 3-storey tenement's top floor is the 2nd — "tenement" alone doesn't settle it.
    expect(parseFloor('Top floor flat in a traditional sandstone tenement').floor).toBeNull();
    expect(parseFloor('').floor).toBeNull();
    expect(parseFloor(null).floor).toBeNull();
  });

  it('prefers the position code over phrases', () => {
    expect(parseFloor('Top floor flat 3/1 with main door feel').floor).toBe(3);
  });
});

describe('kitchenHint', () => {
  it('dining / breakfasting kitchens → window', () => {
    expect(kitchenHint('Generous dining kitchen with space for a table').verdict).toBe('window');
    expect(kitchenHint('breakfasting kitchen').verdict).toBe('window');
    expect(kitchenHint('a substantial dining-sized kitchen sits at the heart of the home').verdict).toBe('window');
  });

  it('explicit window near kitchen → window', () => {
    const r = kitchenHint('Kitchen with window overlooking the rear gardens');
    expect(r.verdict).toBe('window');
    expect(r.cues.length).toBeGreaterThan(0);
  });

  it('ignores a window belonging to another room', () => {
    const r = kitchenHint('Bay windowed lounge with cornicing and fireplace, a fitted kitchen.');
    expect(r.verdict).toBeNull();
  });

  it('open plan', () => {
    expect(kitchenHint('Open plan kitchen/dining room').verdict).toBe('open-dining');
    expect(kitchenHint('Open-plan living room and kitchen').verdict).toBe('open-living');
  });

  it('kitchen/diner → open-dining', () => {
    expect(kitchenHint('Modern kitchen/diner').verdict).toBe('open-dining');
  });

  it('warning cues → unsure', () => {
    expect(kitchenHint('Galley kitchen').verdict).toBe('unsure');
    expect(kitchenHint('Traditional scullery kitchen').verdict).toBe('unsure');
    expect(kitchenHint('Bay lounge with kitchen off lounge').verdict).toBe('unsure');
    expect(kitchenHint('Lounge with adjacent kitchen').verdict).toBe('unsure');
  });

  it('only windowless when clearly stated', () => {
    expect(kitchenHint('Galley kitchen with no window').verdict).toBe('windowless');
    expect(kitchenHint('Internal kitchen').verdict).toBe('windowless');
    expect(kitchenHint('Windowless kitchen off the lounge').verdict).toBe('windowless');
  });

  it('null when nothing is said', () => {
    expect(kitchenHint('Fitted kitchen with gas hob').verdict).toBeNull();
    expect(kitchenHint('').verdict).toBeNull();
  });
});

describe('detectExcluded', () => {
  const kw = criteria.excludeKeywords;
  it('finds keywords', () => {
    expect(detectExcluded('For sale by online auction', kw)).toBe('auction');
    expect(detectExcluded('Sold with a sitting tenant', kw)).toBe('sitting tenant');
    expect(detectExcluded('CASH BUYERS ONLY', kw)).toBe('cash buyers only');
    expect(detectExcluded('Ideal buy to let opportunity', kw)).toBe('buy to let');
    expect(detectExcluded('Retirement flat for over 60s', kw)).toBe('retirement');
  });
  it('ignores negations and partial words', () => {
    expect(detectExcluded('The property is not tenanted', kw)).toBeNull();
    expect(detectExcluded('Untenanted, vacant possession', kw)).toBeNull();
    expect(detectExcluded('Lovely first floor flat', kw)).toBeNull();
  });
});

describe('detectTenement', () => {
  it('positive', () => {
    expect(detectTenement('Red sandstone tenement')).toBe(true);
    expect(detectTenement('Victorian flat with period features')).toBe(true);
    expect(detectTenement('Accessed via a secure close')).toBe(true);
  });
  it('negative overrides', () => {
    expect(detectTenement('Modern new build flat')).toBe(false);
    expect(detectTenement('Purpose-built 1930s flat')).toBe(false);
    expect(detectTenement('Ex-local authority flat')).toBe(false);
    expect(detectTenement('Traditional conversion of a villa')).toBe(false);
  });
  it('unknown', () => {
    expect(detectTenement('Close to Queens Park and the station')).toBeNull();
    expect(detectTenement('For a short period of time')).toBeNull();
  });
});

describe('detectExtras', () => {
  it('finds extras', () => {
    expect(detectExtras('Bathroom with walk-in shower. Private rear garden. Bay window.')).toEqual({
      walkInShower: true,
      garden: true,
      bay: true,
    });
    expect(detectExtras('Main door flat with its own garden').garden).toBe(true);
  });
  it('communal garden is not a private garden', () => {
    expect(detectExtras('Externally there is a communal rear garden').garden).toBeUndefined();
  });
});

describe('bed2Width', () => {
  it('metric', () => {
    expect(bed2Width('Bedroom 1 5.1m x 4.0m. Bedroom 2 4.58m x 2.95m. Kitchen 3.91m x 4.93m')).toBe(2.95);
    expect(bed2Dimensions('Bedroom Two: 4.58 x 2.95 m')?.dims).toBe('4.58 x 2.95 m');
  });
  it('imperial', () => {
    expect(bed2Width(`Bedroom 2 12'0" x 7'10"`)).toBeCloseTo(2.39, 2);
    expect(bed2Width('Second bedroom 13ft 2in x 9ft 8in')).toBeCloseTo(2.95, 2);
  });
  it('does not borrow the next room’s dimensions', () => {
    expect(bed2Width('Bedroom 2. Kitchen 3.91m x 4.93m')).toBeNull();
    expect(bed2Width('No dimensions here')).toBeNull();
  });
});

describe('areaFor', () => {
  it('maps outcodes', () => {
    expect(areaFor('G42 8RW', 'Victoria Road, Glasgow', criteria)).toBe('southside');
    expect(areaFor('G41', null, criteria)).toBe('southside');
    expect(areaFor('G31', null, criteria)).toBe('dennistoun');
    expect(areaFor(null, 'Alexandra Parade, Glasgow G31 3BZ', criteria)).toBe('dennistoun');
    expect(areaFor('G1', null, criteria)).toBeNull();
    expect(areaFor(null, null, criteria)).toBeNull();
  });
  it('splits G12 by address', () => {
    expect(areaFor('G12', 'Cleveden Road, Glasgow', criteria)).toBe('kelvindale');
    expect(areaFor('G12', 'Kelvindale Road, Glasgow', criteria)).toBe('kelvindale');
    expect(areaFor('G12 9LY', 'Great George Street, Hillhead', criteria)).toBe('hillhead');
    expect(areaFor('G12', 'Byres Road', criteria)).toBe('hillhead');
  });
});

describe('misc text facts', () => {
  it('parses prices', () => {
    expect(parsePrice('£210,000')).toBe(210000);
    expect(parsePrice('Offers over £189,995')).toBe(189995);
    expect(parsePrice('£210k')).toBe(210000);
    expect(parsePrice('POA')).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
  });
  it('EPC, council tax and size from text', () => {
    expect(epcFromText('EPC Rating: D<br />Council Tax Band: C')).toBe('D');
    expect(epcFromText('EPC Rating Graph')).toBeNull();
    expect(councilTaxFromText('EPC Rating: D<br />Council Tax Band: C')).toBe('C');
    expect(sqftFromText('Extending to approx 1,087 sq ft')).toBe(1087);
    expect(sqftFromText('approx 101 sq m')).toBe(1087);
  });
  it('strips html', () => {
    expect(htmlToText('a<br />b &amp; c&nbsp;d')).toBe('a\nb & c d');
  });
});
