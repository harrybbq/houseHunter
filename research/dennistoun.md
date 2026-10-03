# Dennistoun (G31): for-sale flats, as of 2026-09-29

**Headline:** no G31 listing not already reviewed reaches **Perfect** or **Strong**. There is one **Possible**: Finlay Drive, ground floor. Its "2 beds" is soft, because the listing really has one bedroom plus a dining room. The nearest miss is **28 Craigpark Drive 1/1**: good street, two real doubles, EPC C. It fails on a windowless internal galley kitchen and a size of 721 sq ft.

Rightmove search: OUTCODE^935 (G31), flats, 2+ beds, max £225k. `resultCount` = 24. That is one page of 24 unique IDs. The same 24 come back with and without the property-type filter. 8 of the 24 were skipped as already reviewed, per criteria.md. 16 were evaluated (all 16 are in dennistoun.json). 6 property pages were fetched, and 4 floorplans plus 1 EPC image were viewed.

## Ranked table

| Tier | Address | Rightmove ID + URL | Price | Beds | Floor | Kitchen verdict (source) | Sq ft listing / floorplan | Bed 2 dims | Tenement? | EPC / CT | Extras |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Possible | Finlay Drive, G31 2QU. Ground floor, no position code given | 92228091 https://www.rightmove.co.uk/properties/92228091 | Offers Over £150,000 | 2 listed (really 1 bed + dining room) | Ground (text: "ground floor tenement") | Window. Small scullery kitchen (1.95×1.60 m) off the dining room, with a window at the sink (**floorplan**). Text says "scullery kitchen". | ? / ? (no GIA on plan) | Dining room 5.20×3.68 m, or "Bedroom" 4.41×2.34 m (**floorplan**) | Yes (text: "traditional… tenement") | C 69 (EPC image viewed) / B | Private front garden (text); shower room with cubicle, walk-in unconfirmed (floorplan); bay lounge 5.58×3.79 |
| Fails (nearest miss) | Flat 1/1, 28 Craigpark Drive, G31 2NP | 92512158 https://www.rightmove.co.uk/properties/92512158 | Offers Over £199,000 | 2 | 1st (1/1 from the **floorplan title**; text says "first floor") | Windowless. Internal galley 3.01×1.91 m off the hall, no window drawn (**floorplan**, which matches the text "internal galley style kitchen") | 721 / 721.2 | 3.83×3.34 m (**floorplan**); both rooms are doubles | Yes (text: traditional tenement, tiled close) | C (text) / B | Bay living/dining 4.85×3.78; bath with shower over; communal lawned rear garden |
| Fails | Broompark Drive, G31 2DA. Ground floor | 174682310 https://www.rightmove.co.uk/properties/174682310 | Fixed Price £150,000 | 2 | Ground (text) | Window. Kitchen 2.13×3.99 m with a window (**floorplan**) | ? / 663 | 3.68×2.78 m (**floorplan**) | Unlikely / ? (the text never says tenement; the private balcony suggests a later build; exterior not checked) | ? / B | Balcony terrace; wet-room shower (text) |
| Fails | Onslow Drive, G31 | 93380646 https://www.rightmove.co.uk/properties/93380646 | Offers Over £150,000 | 2 | Ground (text). The plan is labelled "1st floor", which is a labelling discrepancy | Window. Kitchen 1.70×3.63 m with a window (**floorplan** + text) | 581 / ~560 (52 m²) | 3.44×2.04 m (**floorplan**) | No (text: "modern residential building") | ? (image not viewed) / D | Underground parking; shared gardens |
| Fails | Whitehill Place | 93367437 https://www.rightmove.co.uk/properties/93367437 | Offers Over £154,000 | 2 | 4th (text) | Kitchen connects to the lounge (text only) | 911 / ? | ? | No (modern development, lift) | C (text "EER band C") / ? | En-suite, parking |
| Fails | Sannox Gardens | 93275841 https://www.rightmove.co.uk/properties/93275841 | Offers Over £155,000 | 3 | Top floor, exact level ? | Separate fitted kitchen, window ? (text) | 958 / ? | ? | ? | ? / B | Balcony |

## Notes per candidate

- **Finlay Drive (92228091), Possible.** It is on a premium "Drive", ground floor, traditional tenement, cheap at O/O £150k, EPC C and band B. The kitchen passes on a window (floorplan), but it is a tiny scullery off a large dining room. The key features say "One Good Sized Bedroom" and the plan labels only one bedroom. Getting two bedrooms means using the 5.20×3.68 dining room as bed 2. That makes the 4.41×2.34 room the single/study (2.34 m is under 2.4 m) and leaves the flat without a dining room. Size is unknown because the plan has no GIA. My own sum of the stated room dimensions is about 65 m² (~700 sq ft). That excludes walls, closets and bay depth, so it is not a size figure, but it suggests the flat is borderline against the 725 floor. Worth a look for the renovation angle, for example knocking the scullery through into the dining room to make a dining kitchen.
- **28 Craigpark Drive 1/1 (92512158), Fails.** The street, first-floor position, EPC C, band B and two genuine doubles are all right. The kitchen, though, is an enclosed internal galley with no window, and the floorplan confirms it. At 721 sq ft (listing and plan agree) it is also just under the 725 cutoff. Both problems are structural, so it can't be rescued. This is the bay-fronted, windowless-kitchen pattern the criteria warn about.
- **Broompark Drive (174682310), Fails.** Kitchen window and a proper-width bed 2, but only 663 sq ft on the floorplan. It is probably not a traditional tenement.
- **Onslow Drive (93380646), Fails.** Modern block, ~560–581 sq ft, and bed 2 is only 2.04 m wide.
- **Whitehill Place (93367437) and Sannox Gardens (93275841), Fail** on floor (4th floor and top floor) and are not traditional tenements.

## Rejects (search results only, not fetched)

- 93398913, Quarryknowe Street, O/O £85k: modern (built circa 2003), 2nd floor, not a tenement.
- 93170601, Hanson Park, O/O £170k: 3rd floor, modern development.
- 91423158, Hanson Park, Fixed £160k: top floor, modern development.
- 93066258, Flat 3/2, 62 Garthland Drive, O/O £195k: 3rd floor (3/2).
- 92496966, Flat 3/1, 591 Duke Street, O/O £175k: 3rd floor (3/1), though it does have a large dining kitchen.
- 91657323, Hillfoot Street, O/O £175k: 3rd floor.
- 88241010, Alexandra Parade, O/O £175k: top floor.
- 88837938, Cumbernauld Road, O/O £139,950: top floor.
- 92241402, Cumbernauld Road, Fixed £145k: sitting tenant, investor-only.
- 91341024, Duke Street, Fixed £95k: cash purchase only, buy-to-let marketing, modern.

## Skipped per criteria.md (already reviewed)

93575736 (14 Circus Dr 1/2), 93495504 (Bathgate St), 93402309 (89 Armadale St 0/1), 91906875 (Craigpark Dr), 92295759 (Garthland Dr), 93216738 (501 Alexandra Pde 1/2), 92944677 (Onslow Dr), 173408006 (Whitehill St). 92753979 (Meadowpark St) no longer appears in the G31 search.

## Off-Rightmove sweep

- **Web search leads map back to known listings.** Circus Dr £210k (25 Sep) is 93575736. Onslow £150k (21 Sep) is 93380646. The Alexandra Parade first-floor flat listed 16 Sep is very likely 501 Alexandra Pde (already reviewed). Finlay Dr £235k and Alexandra Pde £230k Fixed (top floor) are over budget.
- **Onslow Drive O/O £190k (Allen & Harris, first floor, red sandstone).** Both A&H listing URLs (DEN107712, DEN107658) now redirect to the general sales index, so they are withdrawn or sold. The Slater Hogg Onslow O/O £190k is second floor and was not found live.
- **s1homes Dennistoun flats page:** nothing new that qualifies. Roebank St (1/F, £130k) and Appin Rd (1/F, £109,950) are both **1-bed**. Culloden St is 2nd floor, £115k, beds ?. The rest are top floor, modern (Hanson Park) or already covered.
- **ESPC 2/1, 499 Duke Street** (2nd floor): the listing URL now redirects to ESPC's Dennistoun results, which show only a commercial unit. Off the market.
- **PrimeLocation and OnTheMarket** returned bot-check/captcha pages. I did not try to get past them, so Zoopla-group-only listings are unverified.

Fetches used: ~20 (1 typeahead, 2 Rightmove searches, 6 property pages, 5 images, 2 A&H, 1 PrimeLocation, 1 OTM, 1 s1homes, 1 ESPC) plus 4 web searches.
