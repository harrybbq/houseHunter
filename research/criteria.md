# HouseHunter: Sweet Spot criteria (as of Sep 2026)

A first-time buyer taking out a solo mortgage in Glasgow wants a traditional tenement flat to live in. Condition doesn't matter; they're open to renovating.

## Hard filters (a listing fails if it misses any of these)
- Asking price up to **£225,000**. Scottish listings are usually "offers over", so record the qualifier as well.
- **2 or more bedrooms.**
- **Floor: ground or first.**
  - Second floor passes only if the flat is otherwise perfect (flag it as a "2nd-floor exception").
  - Third floor or higher always fails.
  - Glasgow position codes: `0/1` is the ground floor (the first digit is the floor), `1/2` is the first floor, `2/1` is the second floor.
  - The code sometimes appears only in the floorplan title.
  - "Main door", "garden level" and "raised/elevated ground" all mean ground floor.
- **Kitchen:** has a window, OR is open-plan to a living or dining room.
  - An enclosed windowless kitchen is a fail, or at best a warning.
  - Useful words: "dining kitchen", "breakfasting kitchen", "kitchen/diner", "open plan", "window" near "kitchen".
  - Warning words: "galley", "scullery", "kitchen off lounge", "adjacent kitchen".
  - **Check the floorplan, not just the text.**
- **Exclude:** auction, tenanted or sitting tenant, "cash buyers only", retirement, shared ownership, buy-to-let marketing.
- **Size:** smaller than about 725 sq ft is effectively a fail.

## Soft preferences (affect ranking only)
- **Old tenement preferred:** sandstone, Victorian, Edwardian or traditional. Conversions and new builds rank lower.
- **Size:** the target is about 850–900+ sq ft. Under about 700 sq ft is poor. If the floorplan figure differs from the listing's, trust the floorplan and flag any gap over 5%.
- **Two proper double bedrooms.** A bedroom 2 narrower than about 2.4 m counts as a single or study.
- **Nice to have:** walk-in shower, private garden, EPC C or better, council tax band B–C. A bay window is only a small bonus.
- **Pattern to watch:** bay-fronted tenements often have a small windowless kitchen off the lounge. Flats with a real dining kitchen that has a window more often have **no** bay.

## Areas, in order of preference
1. Queen's Park / Southside: **G41, G42** (Battlefield, Shawlands, Strathbungo, Pollokshields, Crosshill, Mount Florida)
2. Dennistoun: **G31**. The "Drives" (Circus, Craigpark, Onslow, Finlay) are premium streets.
3. Partick: **G11**. Flats are often small (600–720 sq ft) at this price.
4. Hillhead: **G12**. Tenements are usually over £225k.
5. Kelvindale: **G12**. Mostly 1930s or purpose-built, so check whether it's a tenement.

## Benchmarks ("this is what I'm after")
- **406 Victoria Road 1/2** (Rightmove 93437829): O/O £210k, 1,087 sq ft, dining kitchen 3.91×4.93 m with a window, bay lounge. "Beautiful."
- **501 Alexandra Parade 1/2** (93216738): O/O £210k, first floor, red sandstone, dining kitchen 5.3×3.3 m with windows and an island. "Brilliant."
- **St Andrews Road, Pollokshields** (93472476): O/O £190k, first floor, 980 sq ft, dining kitchen, two doubles, walk-in shower.

## Already reviewed (skip these in new searches)
93437829, 93216738, 93472476, 93575736 (14 Circus Dr), 92944677 (Onslow Dr), 91906875 (Craigpark Dr), 93495504 (Bathgate St), 173408006 (Whitehill St), 92753979 (Meadowpark St), 90483714 (Brisbane St), 93443301 (Coplaw St), 93311106 (Albert Ave), 92295759 (Garthland Dr), 93402309 (Armadale St), 92094774 (Laurel St), 93499341 (Byres Rd), 92677773 (Crow Rd)

## Rules for fetching
- Low volume and sequential only. Wait at least 3 seconds between requests to the same site, and make no more than about 40 page fetches per agent.
- Fetch search result pages, plus individual property pages only for plausible candidates.
- Rightmove property pages embed their data as `window.PAGE_MODEL = {"data":"[...]"}`, a flattened devalue-style array. Parse the JSON string and resolve the integer references recursively from index 0; `propertyData` sits in the root.
- Search pages embed `<script id="__NEXT_DATA__">`, with results at `props.pageProps.searchResults.properties[]`.
- Useful fields: `text.description`, `keyFeatures`, `prices`, `address`, `bedrooms`, `sizings`, `floorplans[].url`, `images`, `livingCosts.councilTaxBand`, `tenure`, `listingHistory`.
- Look at floorplan images (download them and view them) to judge the kitchen window, bedroom 2 width and floorplan sq ft whenever possible.
