# LinkedIn Draft Sidecar — Agent Spawn Prompt

Copy everything below the line into a new Cursor/Claude window.

---

## Mission

Build a **LinkedIn Draft Sidecar** — a small always-on-top desktop panel that drafts connection notes, follow-ups, and InMails using Grok/xAI. **Human-in-the-loop only.** The user reviews and manually clicks Send on LinkedIn. No automation, no bots, no ToS violations.

## Context

- **Owner:** William Massey / Capstone Software Solutions Ltd
- **Stack preference:** Electron (extend existing Reach desktop at `~/projects/reach/desktop/`) OR standalone app in `~/red-tape-engine/apps/sidecar/`
- **AI:** xAI Grok API (`XAI_API_KEY`, model `grok-3-mini` for speed)
- **Integrations (Phase 2):** Reach CRM API (`reach.capstonesoftware.co.uk`), HouseSignal from Red Tape Engine
- **Products to draft for:** TradeTap, Footnote, Engage, Property Clarity, Insolvency Clarity, other Capstone products

## Non-Negotiables

1. **NEVER auto-send on LinkedIn** — no Puppeteer/Playwright clicking Connect/Send
2. **NEVER store LinkedIn credentials**
3. **Copy-to-clipboard is the primary action** — one click, user pastes into LinkedIn
4. **Draft only** — Grok generates, human approves
5. UK English, plain-spoken, no AI slop words (leverage, delve, cutting-edge)
6. Character limits enforced: connection note ≤300 chars, InMail subject ≤200, InMail body ≤1900

## UI Spec

```
┌─ LinkedIn Sidecar ────────────── □ ─┐
│ Product: [TradeTap ▼]              │
│ Intent:  [Connection ▼]            │
│                                     │
│ Name:    [________________]         │
│ Company: [________________]         │
│ Role:    [________________]         │
│ Notes:   [optional context____]     │
│                                     │
│ [Generate 3 Variants]               │
│                                     │
│ ┌─ Variant A (recommended) ───────┐ │
│ │ Hi Sarah — noticed Smith & Co │ │
│ │ has trade clients...           │ │
│ │ [Copy] [Shorter] [More casual] │ │
│ └────────────────────────────────┘ │
│ ┌─ Variant B ─────────────────────┐ │
│ └────────────────────────────────┘ │
│ ┌─ Variant C ─────────────────────┐ │
│ └────────────────────────────────┘ │
│                                     │
│ Chars: 287/300 ✓                   │
└─────────────────────────────────────┘
```

- **Always-on-top** narrow panel (~380px wide), dockable right side of screen
- Dark theme matching Red Tape Engine dashboard (#0a0e14 bg, #00d4aa accent)
- Keyboard shortcut: `⌘⇧L` to show/hide (global, via Electron)
- Remembers last product + intent

## Draft Types

| Intent | Max chars | Grok system prompt focus |
|--------|-----------|--------------------------|
| Connection request | 300 | Warm, specific, one hook, no pitch dump |
| Follow-up (accepted) | 1000 | Reference connection, soft CTA |
| InMail | 1900 | Subject + body, value-first |
| Comment on post | 500 | Insightful, not salesy |
| Reply to message | 1000 | Conversational, move toward demo |

## Product Context (bake into prompts)

Load from JSON config `products.json`:

```json
{
  "tradetap": {
    "name": "TradeTap",
    "hook": "missed-call recovery for trade clients",
    "cta": "15-min demo",
    "proof": "£50/mo white-label margin per client",
    "demo": "https://red-tape-engine.onrender.com"
  },
  "footnote": {
    "name": "Footnote",
    "hook": "HMRC-cited UK tax answers in seconds",
    "cta": "free trial",
    "proof": "evidence-gated citations on every answer",
    "demo": "https://footnote.capstonesoftware.co.uk"
  }
}
```

## Tech Stack

```
Option A (preferred): Extend Reach desktop
  ~/projects/reach/desktop/
  Add second BrowserWindow — sidecar panel
  Shares Electron shell, separate HTML entry

Option B: Standalone
  ~/red-tape-engine/apps/sidecar/
  Electron + Vite + vanilla TS
```

**Dependencies:** electron, electron-store, xAI fetch (no SDK needed)

## Grok Prompt Template

```typescript
const system = `You draft LinkedIn messages for UK B2B sales.
Rules: UK English, plain-spoken, no hype, no fabricated stats.
Product: ${product.name} — ${product.hook}
Never mention you are AI. Never use: leverage, delve, cutting-edge, game-changer.
Return JSON: { variants: [{ label: "A", text: "...", tone: "direct|warm|curious" }] }`;

const user = `Intent: ${intent}
Recipient: ${name}, ${role} at ${company}
Context: ${notes || "No extra context"}
Char limit: ${limit}`;
```

## Phase 1 Done Criteria

- [ ] Electron window opens, always-on-top, global hotkey
- [ ] Product selector with TradeTap + Footnote preloaded
- [ ] Manual name/company/role input → 3 Grok variants
- [ ] Copy button + char counter with limit warning
- [ ] Works offline gracefully (shows error if no XAI_API_KEY)
- [ ] README with build instructions (`npm run dist:mac`)

## Phase 2 (if time)

- [ ] Pull lead context from Reach API (`GET /api/leads/:id`) when ID pasted
- [ ] "Import from clipboard" — parse "Name | Title at Company" from LinkedIn copy
- [ ] History of last 20 drafts (electron-store)
- [ ] Quick-switch products with `⌘1` `⌘2` `⌘3`

## Files to Create

```
apps/sidecar/
  package.json
  electron/main.ts
  electron/preload.ts
  src/index.html
  src/app.ts
  src/grok.ts
  src/products.json
  README.md
```

## Do NOT

- Build a Chrome extension (LinkedIn DOM changes break it constantly)
- Use Playwright/Puppeteer against linkedin.com
- Auto-fill LinkedIn forms
- Store or request LinkedIn session cookies

## Reference Repos

- Reach desktop shell: `~/projects/reach/desktop/`
- TradeTap outreach copy: `~/red-tape-engine/sales/accountant-tradetap-outreach.md`
- Red Tape Engine live demo: https://red-tape-engine.onrender.com

Build Phase 1 first. Ship a working copy-to-clipboard sidecar before any Reach API integration.