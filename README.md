# HouseHunter

A personal, local-only map of Glasgow flats for sale. It scores each flat against my "Sweet Spot" criteria: a traditional tenement, ground or first floor, a kitchen with a window or open-plan, 2 proper doubles, about 850+ sq ft, and up to £225k.

## Run

```bash
npm install
npm run dev      # opens http://localhost:5190
npm test         # parser + scoring tests
```

## How it works
- **Map + filters + list:** markers are coloured by tier (Perfect / Strong / Possible / Fails).
- **Add by URL:** paste a Rightmove, Zoopla, OnTheMarket, s1homes or ESPC link. The local dev server fetches that one page, parses it and adds it. Pasting the same URL again refreshes it without losing your manual verdicts.
- **Refresh all:** re-checks every saved listing, one at a time and 3–5 s apart. It runs only when you click it; there's no background schedule. It updates price, status, photos, EPC and council tax band, and marks listings whose page has gone as *removed*. Your verdicts and measurements are never overwritten. Price and status changes are logged in each listing's notes and summarised when it finishes. Cancel any time. Aim for about weekly.
- **Floorplan check:** listing text often gets the kitchen and floor wrong. Open a listing and use the verdict buttons (keys 1–5) after looking at the floorplan. Manual verdicts always win.
- **Criteria:** thresholds, weights and areas live in `data/criteria.json`, and are editable in Settings.

## Data and privacy
- Listings are saved to `data/listings.json` (gitignored). **Back up** with Settings → Export, or by copying that file.
- Nothing is sent anywhere except the listing pages you ask it to fetch, plus OpenStreetMap map tiles.

## Site terms
Property portals' terms (e.g. Rightmove's) prohibit scrapers and automated access. The app never polls or crawls. It fetches a single page only when you paste its link. Use it sparingly and for personal use only.

## Research
`research/` holds the criteria brief, agent-gathered shortlists per area, a status check of previously reviewed flats, and market context (closing premiums, LBTT, Home Report down-valuations).
