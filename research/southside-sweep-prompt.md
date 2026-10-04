# Prompt: Southside sweep (Shawlands + Pollokshields)

Paste everything below the line into a **local** Claude Code session, started in your houseHunter checkout, with the Claude in Chrome extension connected. A cloud session can't run this because its network policy blocks Rightmove.

---

Run a Southside property research sweep for houseHunter using Claude in Chrome (the `mcp__claude-in-chrome__*` tools). Read the `chrome-browser` skill before your first browser step.

**Setup**
1. `git fetch origin && git checkout claude/expand-search-areas && git pull`. This branch adds the `shawlands` and `pollokshields` areas you'll be tagging.
2. Read `research/criteria.md` (hard filters, soft preferences, benchmarks, the "Already reviewed" list, fetching rules) and `data/criteria.json`.
3. Read `research/dennistoun.md` and the first entry of `research/dennistoun.json`. Your output has to match them in structure and field names exactly.
4. Read `research/known-listings.json`. Skip every ID in it and every ID in the criteria.md "Already reviewed" list.

**Scope**
- Rightmove for-sale searches, flats only, 2+ beds, max £225,000, for these outcodes:
  - **G41**: Shawlands, Pollokshields and Strathbungo
  - **G43**: south Shawlands. It also covers Pollokshaws and Newlands, so judge each street.
  - **G42**: Battlefield, Crosshill, Mount Florida and Queen's Park. Do this last, if your fetch budget allows.
- Get each outcode's `OUTCODE^nnnn` identifier from Rightmove's own location search. Don't guess it. Record the IDs in the .md, as the West End sweep did with 924 and 925.
- Prioritise Shawlands and Pollokshields. Check OnTheMarket and s1homes once each, for G41 and G43 flats that aren't on Rightmove.

**Browsing rules**
- Work in a new tab and leave the user's existing tabs alone. One tab at a time, strictly sequential.
- Wait at least 3 seconds between page loads on the same site. No more than about 40 page loads in total.
- Search results pages come first. Only open a property page for a plausible candidate.
- **Never** log in, save searches, message agents, accept anything beyond cookie consent, or fill in forms.
- If a CAPTCHA or a block page appears, stop and tell the user. Don't work around it.
- Get structured data with the browser's JavaScript tool rather than by reading the screen:
  - On search pages, read `<script id="__NEXT_DATA__">` → `props.pageProps.searchResults.properties[]`.
  - On property pages, read `window.PAGE_MODEL`. It's a devalue-style flattened array; resolve it from index 0. `propertyData` is in the root.
- Open the floorplan image for every plausible candidate. Use it to judge the kitchen window, bedroom 2's width, the floorplan sq ft and the position code. Trust the floorplan over the listing text.

**Classify each listing**
- Use `area`:
  - `shawlands`: the address names Shawlands, or it's G43, or a clearly Shawlands street (Kilmarnock Rd, Moss-side Rd, Skirving St, Deanston Dr, Minard Rd, Mount Stuart St)
  - `pollokshields`: names Pollokshields, or a clearly Pollokshields street (Albert Dr, Maxwell Dr, St Andrews Dr/Rd, Kenmure St, Leslie St, Herriet St, Keir St, Darnley St, Shields Rd)
  - `southside`: everything else in G41 or G42
- Assign a tier (Perfect / Strong / Possible / Fails) using the definitions in `research/westend.md`.
- Use `kitchenSource` / `floorSource` values `text`, `floorplan` or `manual`, as in the existing files. Use `null` for anything you couldn't confirm, never a guess. Put your reasoning in `notes`, starting with `Tier: X.`.

**Outputs**
1. `research/southside.json`: an array of listings, field for field like `research/dennistoun.json`. Set `asOf` to today's date.
2. `research/southside.md`, laid out like `research/dennistoun.md`:
   - a headline
   - the search IDs and counts
   - a ranked table
   - notes per candidate
   - rejects
   - skipped (already reviewed)
   - the off-Rightmove sweep

   Compare the best candidates with the three benchmarks in criteria.md.
3. Run `node scripts/merge-research.mjs`. It already lists `southside` as a source.
4. Run `npm test`, then commit to `claude/expand-search-areas` and push.

**Report back** with the number of listings evaluated, the Perfect and Strong ones (address, price, Rightmove link, one line on why), how many page loads you used, and anything that blocked you.
