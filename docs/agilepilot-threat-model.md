# AgilePilot — Threat Model (STRIDE-lite)

**Status:** Living document for enterprise data rooms (share under NDA)  
**Scope:** Capstone Load-Shift Platform / AgilePilot in Red Tape Engine  
**Hosting:** Render (Frankfurt) + related APIs  
**Date:** 2026-07-16  
**Classification:** Confidential once filled with environment specifics  

---

## 1. System summary

```
[Client / Partner] --HTTPS--> [RTE API] --HTTPS--> [Tariff providers: Octopus, EDF, …]
                              |
                              +--> [Postgres] usage_events, tenants
                              +--> [Stripe] (billing Path B)
```

**Assets:** API availability, tenant data isolation, API credentials, customer trust, IP (adapters/policies).

**Out of scope v1:** device remote control, full smart-meter half-hourly history, bank details.

---

## 2. Trust boundaries

| Boundary | Inside | Outside |
|----------|--------|---------|
| B1 | RTE process + env secrets | Internet clients |
| B2 | RTE | Octopus / EDF / NESO APIs |
| B3 | RTE | Stripe |
| B4 | Capstone operators | Production systems |

---

## 3. Data inventory (v1)

| Data | Sensitivity | Storage | Retention |
|------|-------------|---------|-----------|
| Tariff rates (public) | Low | Ephemeral / cache | Short |
| Tenant ID | Medium | Postgres | Account life |
| Slot history metadata (cheapest, avg, region, provider) | Low–medium | `usage_events` | Product-defined |
| User email (if signup) | High (PII) | Auth/billing tables | Account life + legal |
| `OCTOPUS_API_KEY` / `EDF_*` | High (secret) | Env only | Rotate on leak |
| Smart meter series | **Not in v1** | — | — |
| Bank details | **Never** | — | — |

---

## 4. STRIDE analysis

### Spoofing

| Threat | Mitigation |
|--------|------------|
| Attacker calls API as another tenant | Require auth on tenant-scoped routes; never trust client-supplied tenantId without session/API key binding |
| Stolen partner API key | Key rotation; per-partner keys; rate limits; revoke list |
| Fake tariff provider | TLS to known hosts; pin base URLs in config; no user-supplied provider URLs |

### Tampering

| Threat | Mitigation |
|--------|------------|
| Modify savings history | DB access control; no public write APIs for history |
| Man-in-the-middle | HTTPS only; HSTS at edge if available |
| Supply-chain deps | Lockfiles; `npm audit`; minimal deps in adapters |

### Repudiation

| Threat | Mitigation |
|--------|------------|
| Dispute over savings claims | Persist method metadata (baseline, kWh, provider, timestamp); clear “estimate” language in UX |
| Admin abuse | Operator access logs (target); named accounts only |

### Information disclosure

| Threat | Mitigation |
|--------|------------|
| Cross-tenant history leak | Integration tests: tenant A cannot read B; query always filter `tenantId` |
| Secrets in logs | Never log Authorization headers or full API keys; redact |
| Verbose errors | Generic client errors; detail server-side only |
| Demo mode leaking live keys | Separate env; fail closed if misconfigured |

### Denial of service

| Threat | Mitigation |
|--------|------------|
| Scraping slots endpoint | Rate limit per IP / API key; cache provider responses briefly |
| Provider outage cascade | Timeouts; circuit breaker; last-good cache or explicit degraded response |
| Expensive history queries | Cap `days` param; index `tenantId + vertical + action` |

### Elevation of privilege

| Threat | Mitigation |
|--------|------------|
| Enterprise mode bypass for affiliate spam | Server-side `enterprise` flag from partner auth, not only query string for OEM tenants |
| Platform admin key reuse | Separate `PLATFORM` vs tenant keys; least privilege |

---

## 5. Abuse cases (product)

| Abuse | Response |
|-------|----------|
| Using API only to re-sell raw rates without licence | ToS + rate limits; commercial licence for redistribution |
| Automated high-frequency polling | Cache + rate limit; document recommended poll interval (e.g. ≤1/30 min) |
| Social engineering Capstone for keys | Out-of-band verification; never send secrets over unsolicited email |

---

## 6. Security control checklist

### Implemented / in progress

- [x] Provider secrets via environment variables  
- [x] Multi-tenant `tenantId` scoping on history  
- [x] Demo fallback when provider keys missing (dev safety)  
- [x] Enterprise mode suppresses consumer affiliate copy  
- [ ] Rate limiting on `/api/agilepilot/*`  
- [ ] Auth binding tenantId to caller for all history routes  
- [ ] Structured audit log for admin  
- [ ] Dependency audit in CI  
- [ ] External pen-test (pre-production OEM)  

### Operational

- [ ] Secret rotation procedure documented  
- [ ] Incident response contact (`security@` or founder email)  
- [ ] Sub-processor list maintained  
- [ ] Backup / restore tested for Postgres  

---

## 7. Residual risks (accept or transfer)

| Risk | Treatment |
|------|-----------|
| Supplier changes API without notice | Subscribe to announcements; adapter isolation |
| Octopus independently ships similar product | Commercial + product moat (see enterprise strategy); not a pure security risk |
| Render platform compromise | Rely on provider SOC; minimise data; encrypt at rest (platform default) |
| Legal copy of non-secret ideas | NDA + IP licence structure |

---

## 8. Pre-pilot security questionnaire answers (draft)

Use under NDA; refine with actual policies.

| Question theme | Draft answer |
|----------------|--------------|
| Where is data hosted? | EU (Render Frankfurt) for production API/DB |
| Encryption in transit? | TLS for all public endpoints |
| Encryption at rest? | Platform-managed disk encryption |
| Multi-tenancy? | Logical isolation by tenant ID in shared DB; no shared secrets across tenants |
| Pen test? | Planned before production OEM; summary under NDA |
| Breach notification? | Without undue delay; target 72h to controller where we are processor |
| Sub-processors? | List: Render, Stripe (Path B), xAI if used for enrichment (currently not required for slots) |

---

## 9. Related docs

- Strategy: `docs/agilepilot-enterprise.md`  
- NDA/IP: `docs/agilepilot-nda-pilot-ip.md`  
- EDF: `docs/agilepilot-edf-onboarding.md`  
