---
name: local-handoff
description: Use when a task needs a real browser on a live website (Claude in Chrome, the built-in browser, or plain fetches to a site), such as property portal research, logged-in pages, or scraping a site, and this session runs in the cloud where those tools or that site aren't reachable. Instead of giving up or using worse sources, hand the work to a local session by writing it a complete, self-contained prompt for the user to paste in.
---

# Local handoff for browser work

Cloud sessions run in a container with no Claude in Chrome, no built-in browser, and an egress policy that often blocks sites like property portals. Never fake the result, quietly switch to worse sources, or stop at "I can't". Do the parts that work here, and hand the browser part to a local session.

## 1. Check before deciding

Hand off only when the check below actually fails. If the tools or the site work, just do the task.

- **Am I in the cloud?** `CLAUDE_CODE_REMOTE=true` in the environment, or `/root/.ccr/` exists.
- **Is there a browser tool?** Run ToolSearch for `claude-in-chrome` and for `Claude_Browser`. If either loads, or an `enable__…` tool for one is listed, read the `chrome-browser` or `built-in-browser` skill and use it. No handoff needed.
- **Is the site reachable?** `curl -sS -o /dev/null -w "%{http_code}" -A "Mozilla/5.0" https://<site>/`. A proxy `CONNECT 403` or `connect_rejected` means the site is blocked by policy. A 200 with no browser tool means a plain fetch may be enough, as long as the site's terms allow it.

If you can't reach the site from here, read `read_documentation` topic `environment.network` with `situation: "blocked"`. The user then gets a settings card, in case they would rather allow the host for this environment.

## 2. Do everything that doesn't need the browser first

Do the code, config, parsing, tests and docs here, then commit and push to a branch. The local session should only have to browse and write up results. It shouldn't redo your work.

## 3. Write the prompt

Put it in a file in the repo, e.g. `research/<topic>-prompt.md`, with one or two lines for the user above a `---` rule. Commit and push it, and print it in your reply in a code block so it can be copied. The local session has **none of this conversation**, so the prompt must stand on its own:

1. **Setup:** the exact `git checkout` / `pull` of your pushed branch, and which files to read first: the criteria, an existing output to copy the format from, and the skip lists.
2. **Tooling:** name the tool (`mcp__claude-in-chrome__*`) and tell it to read the `chrome-browser` skill before its first browser step.
3. **Scope:** the sites, searches, filters, and any IDs to look up rather than guess.
4. **Rules:**
   - Rate limits (at least 3 s between loads on the same site) and a page budget (about 40).
   - Sequential, in a new tab, leaving the user's tabs alone.
   - Never log in, buy, message anyone or submit forms.
   - Stop and report on a CAPTCHA or block.
   - Respect the repo's site-terms notes.
5. **Extraction:** where the structured data lives (embedded JSON, JS globals), so it reads data instead of the screen, and when to look at images like floorplans.
6. **Output contract:** exact file paths, schema (point to an existing file to copy field for field), naming and tagging rules, and to use `null` rather than guess.
7. **Finish:** merge or build scripts, run tests, commit to the named branch and push.
8. **Report back:** what to summarise, and the counts (pages used, items evaluated, blockers).

## 4. Tell the user

Be brief: why this session can't do it (name the blocker you hit), where the prompt file is, which branch it uses, and that they should paste it into a local Claude Code session with Claude in Chrome connected. Offer to review the results here once that session pushes.
