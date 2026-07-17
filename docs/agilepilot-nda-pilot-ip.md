# AgilePilot — NDA & Pilot IP Pack (for solicitor review)

**Status:** Draft for legal counsel — **not executed legal advice**  
**Entity:** Capstone Software Solutions (confirm full legal name, company number, registered address)  
**Counterparty (typical):** Octopus Energy Limited / Kraken Technologies Limited / affiliate  
**Governing law (preferred):** England and Wales  
**Date:** 2026-07-16

> Instruct a UK commercial solicitor before sending any template to Octopus.  
> This pack is a **brief + clause checklist** so counsel can draft quickly and cheaply.

---

## 1. What to instruct the solicitor to produce

| Document | When used | Priority |
|----------|-----------|----------|
| **Mutual NDA (MNDA)** | Before demos, architecture deep-dives, security questionnaires, data rooms | **P0 — this week** |
| **Pilot MSA + SOW** | Paid 8–12 week pilot | P1 — before pilot kickoff |
| **DPA / data processing schedule** | If any personal data is processed for Octopus customers | P1 with pilot |
| **Order form / commercial schedule** | Fees, term, renewal | With pilot MSA |

**Budget signal for counsel:** standard mutual NDA + pilot MSA with IP licence schedule is a well-trodden path; share this brief to reduce hours.

---

## 2. Mutual NDA — commercial terms we want

### 2.1 Parties & purpose

- **Purpose limited to:** evaluating a potential commercial partnership for white-label / OEM load-shifting software (AgilePilot / Capstone Load-Shift Platform).
- **Not** a general “all business discussions forever” NDA without purpose.

### 2.2 Mutual confidentiality

- Both parties disclose confidential information.
- Capstone’s confidential information includes: architecture, source code, algorithms, pricing models, roadmap, customer lists, security documentation, pilot metrics, non-public demos.
- Their confidential information includes: product roadmaps, customer volumes, commercial terms, non-public API credentials, internal processes.

### 2.3 Exclusions (standard)

Public knowledge, independently developed, rightfully received from third party, required by law (with notice where legal).

### 2.4 Term

- **Confidentiality period:** 3–5 years from disclosure (or 2 years after last disclosure — solicitor to advise).
- **Agreement term:** 1–2 years for evaluation discussions, renewable.

### 2.5 Residuals / reverse engineering (important for tech)

Ask solicitor to include:

- No reverse engineering of software provided under NDA.
- Careful residuals clause: if they insist on residuals, **narrow** it (general skills only; not code, schemas, or documentation). Prefer **no residuals** for source code.

### 2.6 No licence / no obligation

- NDA does **not** grant IP licence.
- No obligation to deal or exclusivity unless separately agreed.
- No public announcement of discussions without written consent.

### 2.7 Non-solicit (optional but valuable)

Limited **employee non-solicit** (not full non-compete):

- 12 months from end of discussions / pilot.
- Applies to employees who had material contact on the evaluation.
- UK restraint of trade: keep narrow (roles, geography UK, duration) so it is more likely enforceable.
- This is **not** a substitute for IP ownership; it only raises the cost of “hire our people to rebuild.”

### 2.8 Return / destruction

On request or end of purpose: return or destroy confidential materials (with standard archival exception for legal hold).

### 2.9 Remedies

Acknowledge irreparable harm; injunctive relief available without prejudice to damages.

---

## 3. Pilot MSA + SOW — IP & commercial clauses we want

### 3.1 Background IP (Capstone)

> All Intellectual Property Rights in the Platform, adapters, documentation, and any materials Capstone owned or developed **before** the Pilot, or developed **outside** the Pilot SOW, remain vested in Capstone.

**List Background IP examples in schedule:**

- `@rte/agilepilot` and provider adapters  
- Tariff normalisation and savings models  
- Multi-tenant SaaS patterns in Red Tape Engine  
- Security designs and threat models  
- Brand names (AgilePilot, Capstone Load-Shift Platform)

### 3.2 Foreground IP (created during pilot)

**Preferred position (push hard):**

- Capstone owns all Foreground IP in software and documentation created under the pilot.
- Octopus receives a **non-exclusive, non-transferable, worldwide licence** for the term of the commercial agreement to use the white-label instance for its customers and (if agreed) Kraken licensees.
- Licence scope defined: production use for X accounts / Y markets; no right to sublicense source.

**Fallback if they demand ownership of custom work:**

- Capstone owns platform core; Octopus owns only **configuration, branding, and custom reports** created solely for them.
- Capstone retains right to use general learnings and non-customer-specific improvements in the product.

**Avoid:**

- Full assignment of entire codebase to Octopus for a pilot fee.  
- Work-for-hire over all Capstone employees’ time.

### 3.3 Licence grant (to Octopus)

- Object code / SaaS access for pilot period.  
- No source code escrow unless commercial deal closes (then optional escrow with release conditions).  
- No reverse engineering; no competitive analysis for building a clone **using Capstone confidential materials** (pair with NDA).

### 3.4 Licence grant (to Capstone)

- Octopus grants Capstone a limited licence to use their trademarks **only** for co-branded pilot UI and agreed case study (opt-in).  
- Licence to use any pilot feedback in aggregated, anonymised form for product improvement.

### 3.5 Non-circumvent / independent development

- Acknowledge Octopus may independently develop similar features.  
- Restrict use of Capstone confidential information in such development.  
- Optional: if commercial terms are declined after pilot, **cooling-off** on using pilot-specific confidential designs for 12 months (solicitor: enforceability review).

### 3.6 Data protection

- Roles: Capstone as processor or independent controller depending on data flow — solicitor to map.  
- v1 pilot should minimise personal data (preferences, region; avoid full smart meter series unless necessary).  
- UK GDPR DPA schedule; sub-processors listed (e.g. Render EU, if applicable).  
- Security schedule referencing SOC2 path / pen-test commitment if claimed.

### 3.7 Commercial

| Item | Suggested pilot terms |
|------|------------------------|
| Duration | 8–12 weeks |
| Fee | Paid pilot (not free) — signals seriousness; suggest £15k–£40k depending on scope |
| Success criteria | Written in SOW (e.g. white-label slots API live, N savings reports, security questionnaire complete) |
| Exit | Either convert to OEM SaaS order form or wind down; data return |
| Publicity | Case study only with written approval |

### 3.8 Liability

- Capstone liability capped at fees paid in pilot (or 12 months fees later).  
- Carve-outs: IP infringement, confidentiality breach, fraud, death/personal injury — solicitor standard.  
- No unlimited liability for indirect damages.

### 3.9 Audit / security

- Right for Octopus to security questionnaire + reasonable audit once per year in production.  
- Capstone provides pen-test summary under NDA when available.

---

## 4. What Capstone should prepare for the data room (post-NDA)

- [ ] Architecture diagram (no secrets)  
- [ ] Security overview + threat model (`docs/agilepilot-threat-model.md`)  
- [ ] Data flow diagram (what PII, where stored)  
- [ ] Sub-processor list  
- [ ] Sample API contract (OpenAPI or CONTRACTS.md extract)  
- [ ] Insurance certificates (PI / cyber if held)  
- [ ] Company details (Companies House)  

---

## 5. Email to solicitor (copy-paste)

```
Subject: Mutual NDA + pilot MSA for energy software OEM discussions

Hi [Name],

We (Capstone Software Solutions) are entering partnership discussions with a large UK energy supplier / platform vendor around white-label load-shifting software.

Please draft:

1. Mutual NDA (England & Wales) — evaluation of commercial partnership; 3–5 year confidentiality; no IP licence; optional limited employee non-solicit; tight residuals on source code.
2. Later (or skeleton now): Pilot MSA + SOW with Capstone retaining Background IP and Foreground IP in the platform; customer gets SaaS licence only; DPA schedule; liability cap at pilot fees.

Attached: commercial brief (agilepilot-nda-pilot-ip.md) with preferred positions.

Target: NDA usable within 5–7 working days if possible.

Thanks,
William
```

---

## 6. Do / don’t until NDA is signed

| Do | Don’t |
|----|--------|
| Send one-pager and public website | Share source, architecture deep-dives, security internals |
| High-level product demo on public rates | Share non-public roadmaps or customer data |
| Discuss commercial interest | Free multi-week “build for free so they can evaluate” |
| Register EDF/Octopus developer accounts | Put their confidential API keys in git or chat |

---

## 7. Related docs

- Strategy: `docs/agilepilot-enterprise.md`  
- One-pager: `docs/agilepilot-one-pager.md`  
- Threat model: `docs/agilepilot-threat-model.md`  
- Warm intros: `docs/agilepilot-warm-intro.md`  
