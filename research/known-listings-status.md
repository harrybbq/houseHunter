# Known listings: status re-check (29 Sep 2026)

I fetched all 17 pages raw from Rightmove, one at a time with 4 s gaps; every page returned HTTP 200. I also downloaded all 17 floorplans and 4 EPC graphs, one at a time with 3 s gaps, and looked at them.

- **Status** comes from `propertyData.tags`: `UNDER_OFFER` or `SOLD_STC`. The other 15 are published and not archived.
- **"Was" prices:** criteria.md only records prices for the 3 benchmarks. For the others I give the "Reduced on" date from `listingHistory`, but the old price isn't in the page data.
- **Parser note:** the page variable is now `window.__PAGE_MODEL` (double underscore), not `window.PAGE_MODEL`.
- **Fixture:** raw HTML saved to `research/fixtures/rightmove-property-93437829.html`.

| ID | Address | Status | Price now (was) | New info |
|---|---|---|---|---|
| 93437829 | Victoria Rd, Queens Park G42 8RW (benchmark) | For sale | O/O £210,000 (£210k, unchanged) | Floorplan title says **1/2, 405** Victoria Road; criteria says 406. Floorplan kitchen is **3.31 × 4.92 m**, not 3.91 × 4.93. Floorplan GIA 1,087 sq ft; no sq ft on the listing. Bed 2 is 4.58 × 2.95 m. EPC D, CT C, freehold. Single glazing. |
| 93216738 | 1/2, 501 Alexandra Pde G31 3EW (benchmark) | For sale | O/O £210,000 (£210k, unchanged) | Matches notes: dining kitchen 5.3 × 3.3 m with 2 windows, bed 2 4.2 × 2.8 m. EPC C. Tenure and CT not given. No sq ft anywhere. |
| 93472476 | St Andrews Rd G41 1PD (benchmark) | For sale | O/O £190,000 (£190k, unchanged) | Listing says 980 sq ft; floorplan says 987. Kitchen/diner 5.39 × 3.51 m with window. Bed 2 4.57 × 3.77 m. EPC D, CT C, freehold. Walk-in shower confirmed. |
| 93575736 | 1/2, 14 Circus Dr G31 2JH | For sale | O/O £210,000 | 1st floor (1/2). Kitchen/dining 6 × 3.3 m with 2 windows. Bed 2 4 × 3 m. Bay. EPC C. Tenure, CT and sq ft not given. |
| 92944677 | 191 Onslow Dr G31 2QE | For sale | O/O £215,000 | Ground floor. Listing says **1,550 sq ft (144 m²)**, but the floorplan says **778 sq ft (72 m²)**. The listing figure seems to include the basement, which has planning permission (23/01972/FUL) for a duplex. Kitchen is small (1.89 × 2.78 m) off the living/dining room and has a window. Bed 2 3.30 × 4.04 m. Private south-facing garden. CT B, freehold. No EPC shown. |
| 91906875 | Craigpark Dr G31 2TB | For sale | O/O £200,000 (reduced 21/09/2026) | **Floor still unknown.** No position code in the address, description, floorplan or photo captions. Floorplan has no dimensions or sq ft, but shows the **kitchen has a window**. Bay lounge. EPC **C (72)**, CT B, freehold. |
| 93495504 | Bathgate St G31 1DX | For sale | O/O £155,000 | **Size still unknown.** No sq ft on the listing or floorplan, and the floorplan has no dimensions. Ground floor (per text). Rear kitchen has a window and room for a dining table. Bed 2 has an en-suite. No bay. EPC **D (67)**, CT B, freehold. |
| 173408006 | Whitehill St G31 2LN | For sale | O/O £185,000 (reduced 22/07/2026) | Ground floor. Floorplan 807 sq ft. Kitchen 4.17 × 2.25 m with window. **Bed 2 is only 2.05 m wide (a single).** Key features quote "Rental approx £1200–£1250" and the text targets investors (BTL-style marketing). EER E. Electric heaters in use. |
| 92753979 | 0/1 Meadowpark St G31 2SJ | **Sold STC** | O/O £179,000 | Listing says 882 sq ft; floorplan says 780 (−11.6%). Kitchen 3.11 × 1.82 m, open off the lounge, with no window shown. Bed 2 2.57 m wide. |
| 90483714 | 1/3, 8 Brisbane St G42 9HX | For sale | O/O £185,000 | 1st floor. Small open-plan kitchen (2.7 × 1.8 m) off the lounge. Bed 2 4.3 × 3 m. Utility room. EPC C. Tenure, CT and sq ft not given. |
| 93443301 | Coplaw St G42 7JE | For sale | O/O £150,000 | Ground floor, but a **conversion**. Listing says 850 sq ft; floorplan says 798 (−6.1%). Galley-shaped kitchen (6.2 × 1.9 m) with window. Bed 2 exactly 2.40 m. **CT band E.** Two bathrooms, parking. |
| 93311106 | Albert Ave G42 8RB | For sale | O/O £225,000 (at cap) | **Floor not stated anywhere.** Kitchen 3.92 × 3.37 m with window. Bed 2 3.92 × 3.10 m. Bay. EPC **C (79)**, CT C, freehold. No sq ft. |
| 92295759 | Garthland Dr G31 2RF | For sale | O/O £179,500 (reduced 17/09/2026) | Floor not stated. **Kitchen 2.35 × 1.90 m with no window on the floorplan.** Bed 2 2.87 m wide. En-suite. EPC **E (49)**, CT B. Needs modernising. |
| 93402309 | 0/1, 89 Armadale St G31 2PS | For sale | O/O £140,000 | Kitchen 2.7 × 2 m off the lounge with **no window**. **Bed 2 2.3 m wide (single).** EPC **G**. Electric heating. Needs investment. |
| 92094774 | 0/2, 64 Laurel St G11 7RD | For sale | O/O £175,000 (reduced 02/09/2026) | **603 sq ft** (listing and floorplan): fails. Kitchen shows no window. The text gives CT as both C and B; the listing field says B. EPC C. |
| 93499341 | 1/1, 15 Byres Rd G11 5RD | For sale | O/O £175,000 | 1st floor. **721 sq ft**, just under the limit. Small kitchen (2.61 × 1.82 m) open to the lounge. Bed 2 2.84 m. EER D, CT C, freehold. |
| 92677773 | 47 Crow Rd G11 7SH | **Under offer** | O/O £165,000 | Floorplan **624 sq ft**. Enclosed kitchen with no window. Bed 2 2.40 m. CT C. |

## Still worth pursuing
1. **93437829 Victoria Rd 1/2**: benchmark, unchanged. Check the 405 vs 406 house number and the kitchen size (3.31 m, not 3.91 m).
2. **93216738 Alexandra Pde 1/2**: benchmark, unchanged.
3. **93472476 St Andrews Rd**: benchmark, unchanged; 987 sq ft on the floorplan.
4. **93575736 Circus Dr 1/2**: 1st floor with a large dining kitchen. Size unknown; ask the agent for sq ft.
5. **91906875 Craigpark Dr**: kitchen has a window, EPC C, now reduced to £200k. **Ask the agent which floor it is on.**
6. **93311106 Albert Ave**: good kitchen, EPC C, at the £225k cap. **Ask the agent the floor and sq ft.**
7. **93495504 Bathgate St**: ground floor, kitchen with window, £155k. **Ask the agent for sq ft.** Newer-style layout, no bay.
8. **92944677 Onslow Dr**: ground floor with a private garden, but only 778 sq ft on the floorplan (not 1,550) and a small kitchen. Marginal.

Dropped or weak:
- **Unavailable:** 92753979 (sold STC) and 92677773 (under offer).
- **Too small:** 92094774 (603 sq ft) and 93499341 (721 sq ft, open galley kitchen).
- **Windowless kitchen:** 92295759 and 93402309 (the latter also has a single bed 2 and EPC G).
- **Single bed 2 / BTL marketing:** 173408006.
- **Conversion, CT E:** 93443301.
- **Size unknown, kitchen tiny and open:** 90483714.
