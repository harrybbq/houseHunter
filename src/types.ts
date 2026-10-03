// Shared contract between parsers, scoring, data files and UI.
// Unknown values are null — never guess.

export type Floor = 0 | 1 | 2 | 3 | null; // 3 = third floor or higher; null = unknown

export type KitchenVerdict =
  | 'window'
  | 'open-living'
  | 'open-dining'
  | 'windowless'
  | 'unsure';

export type VerdictSource = 'floorplan' | 'text' | 'manual' | null;

export type Tier = 'Perfect' | 'Strong' | 'Possible' | 'Fails';

export type ListingStatus = 'for-sale' | 'under-offer' | 'sold-stc' | 'removed' | 'unknown';

export interface Listing {
  id: string;                 // "rm-93437829" or "manual-<timestamp>"
  source: 'rightmove' | 'espc' | 's1homes' | 'onthemarket' | 'zoopla' | 'manual';
  url: string | null;
  address: string;
  position: string | null;    // Glasgow position code e.g. "1/2"
  area: string | null;        // key from Criteria.areas
  postcode: string | null;    // outcode at least, e.g. "G42"
  lat: number | null;
  lng: number | null;

  price: number | null;
  qualifier: string | null;   // "Offers Over", "Fixed Price", ...
  beds: number | null;

  floor: Floor;
  floorSource: VerdictSource;
  kitchen: KitchenVerdict | null;
  kitchenSource: VerdictSource;
  kitchenDims: string | null;          // "3.91 x 4.93 m"
  sqftListing: number | null;
  sqftFloorplan: number | null;
  bed2Dims: string | null;             // "4.58 x 2.95 m"
  bed2WidthM: number | null;           // narrower dimension of bedroom 2
  tenement: boolean | null;

  epc: string | null;                  // "C"
  councilTaxBand: string | null;       // "B"
  tenure: string | null;
  extras: {
    walkInShower?: boolean;
    garden?: boolean;
    bay?: boolean;
  };
  excludedReason: string | null;       // auction / tenanted / cash only / retirement / shared ownership / BTL

  imageUrls: string[];
  floorplanUrls: string[];
  status: ListingStatus;
  benchmark: boolean;
  notes: string;
  asOf: string;                        // ISO date the data was captured
}

export interface AreaDef {
  name: string;
  outcodes: string[];
  rank: number;                        // 1 = most preferred
  notes?: string;
}

export interface Criteria {
  maxPrice: number;
  minBeds: number;
  minSqftHard: number;                 // below this = fail
  targetSqft: number;                  // full size points at/above this
  poorSqft: number;                    // near-zero size points below this
  bed2MinWidthM: number;
  allowSecondFloorException: boolean;
  allowWindowlessException: boolean;
  requireTenement: boolean;            // false = soft preference
  excludeKeywords: string[];
  areas: Record<string, AreaDef>;
  weights: {
    kitchen: number;
    floor: number;
    tenement: number;
    size: number;
    bed2: number;
    area: number;
    price: number;
  };
  bonuses: {
    walkInShower: number;
    garden: number;
    epcCOrBetter: number;
    ctBandBC: number;
    bay: number;
  };
}

export interface ScoreLine {
  rule: string;
  points: number;
  max: number;
  pass: boolean | null;                // null = unknown / not a hard rule
  why: string;
}

export interface Score {
  total: number;                       // 0–100
  tier: Tier;
  hardFails: string[];
  warnings: string[];
  lines: ScoreLine[];
}
