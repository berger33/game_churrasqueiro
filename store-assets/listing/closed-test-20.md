# Closed Test — 20 testers
Track: Play Console > Testing > Closed testing > New track
Testers: Google Group ou lista de e-mails (20). País: Brasil apenas.

Checklist pré-upload:
- [ ] AAB ≤90MB (bundletool get-size total)
- [ ] package com.berger.churrascomestredabrasa final
- [ ] google-services.json real na raiz (não commitar, CI injeta)
- [ ] AdMob REAL ids em credentials.json (test ids só em DEBUG)
- [ ] 7 produtos IAP criados ATIVOS em Play Console > Monetize > Products (1 não-consumível starter, 1 no-ads, 3 moedas, 2 pass)
- [ ] Listing: ícone 512, feature 1024x500, 5 screenshots 1080x1920, título 30 chars, descrição curta 80 chars, full <4000
- [ ] Privacy policy URL pública (hosteie store-assets/listing/privacy-ptBR.md)
- [ ] Content rating IARC questionário (casual, sem violência)
- [ ] Data safety form: Analytics, Crashlytics, Billing, AdMob (LGPD notice)

Dia 0: convide 20, envie link opt-in. Peça feedback em 3 turnos + daily D1.
Métricas alvo: ANR <0.5%, crash <1%, tutorial_complete >85%.

Promote to production após 14 dias e 20+ installs sem ANR.
