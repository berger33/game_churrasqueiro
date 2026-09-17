# 16 — Privacy (§67)

## 1. Data we collect

| Data | Why | Shared with |
|---|---|---|
| Anonymous install UUID | Save continuity, dedupe | Firebase |
| Gameplay events (see taxonomy) | Balance, funnel, retention | Firebase Analytics |
| Device model, OS, language, quality tier | Performance and compatibility | Firebase |
| Approximate country | Regional balance | Firebase / AdMob |
| Advertising identifier | Ads, only with consent | AdMob (via UMP) |
| Purchase records | Entitlements and refunds | Google Play |

**We do not collect:** name, e-mail, phone, CPF, precise location, contacts, photos, or
anything a child might type. There is no account and no sign-in.

## 2. Legal basis

- **Brazil (LGPD):** legitimate interest for gameplay analytics; **explicit consent** for
  personalised advertising, collected through Google's UMP.
- **EEA/UK (GDPR):** same, via UMP; consent is required before any ad SDK initialises.
- Advertising id is only read after consent. If consent is refused, non-personalised ads may
  still be shown where permitted, and gameplay analytics continue (legitimate interest).

## 3. Consent flow

```
first launch → UMP form (region-dependent)
   ├─ consent granted  → AdMob init with personalised ads
   ├─ consent refused  → AdMob init non-personalised (or no ads where required)
   └─ not required     → AdMob init, no form
```

The form is **non-blocking for the first frame** — the game boots while consent is being
requested, and no gameplay is gated on it.

## 4. Children

Target audience declared 13+. Not child-directed. No COPPA/Families obligations are taken on,
and the store listing must stay consistent with that.

## 5. Data Safety form (Play Console)

- Data collected: analytics, device id, purchase history, advertising id
- Encrypted in transit: **yes**
- Data can be deleted: **yes** — uninstalling deletes the local save; a data-deletion request
  URL is published in the privacy policy
- No data shared for purposes other than the declared ones

## 6. Privacy policy requirements

Must state: what is collected, why, who receives it, retention, how to request deletion,
how to opt out of personalised ads, contact address, and the effective date. Published at a
stable URL and linked from the store listing and in-game Settings.

## 7. Third-party review checklist (§2)

Before any new SDK: compatibility · licence · cost · maintenance status · APK size delta ·
privacy policy. Recorded in [12-BUILD.md](12-BUILD.md#7-size-budget).
