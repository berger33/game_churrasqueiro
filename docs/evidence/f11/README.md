# Evidência F11 — Integração Segura de Serviços (Firebase, Crashlytics, AdMob, Billing, UMP/LGPD)

**Data:** 2026-09-27 UTC  
**Branch:** `arena/01a0e1a4-game-churrasqueiro`  
**Base:** `a900445` (`main` pós-PR #16)  
**PRs preservados:** #7 e #8 abertos e intactos  

---

## 1. Resumo Executivo

A **Fase F11 (Integração Segura de Serviços)** implementou a infraestrutura de serviços de produção para **CHURRASCO! O Mestre da Brasa**, cobrindo telemetria, crash reporting, monetização moderada, faturamento no Google Play, privacidade conforme LGPD/GDPR e a resolução atômica do débito técnico B-07:

1. **Firebase Telemetry, Crashlytics & Remote Config:**
   - **Camada de Abstração (`FirebaseService.cs`):** Interface `IFirebaseService` com suporte a inicialização assíncrona não-bloqueante (§34, §66). Operação transparente em modo offline quando credenciais reais estão ausentes ou sem rede.
   - **Blindagem de Privacidade e Zero PII (§67):** UUID de instalação estritamente anônimo (`anonymous_install_uuid_only`). Filtro de parâmetros proibidos que elimina tentativas de envio de dados pessoais (`email`, `phone`, `cpf`, `address`, `device_id_raw`, `gps`, etc.) antes do despacho.
   - **Contrato de Telemetria (`AnalyticsContract`):** Validação estrita dos 50 eventos mapeados em `analytics.json`.
   - **Crashlytics:** Registro de exceções (`RecordException`), chaves customizadas de depuração e trilhas de navegação (breadcrumbs) sem impacto no ciclo de vida da aplicação.
   - **Remote Config (`RemoteConfigService.cs`):** Carregamento imediato de padrões embutidos (`remoteconfig_defaults.json`), fetch assíncrono com timeout de 8 segundos (§62, §66) e getters tipados para todas as constantes e escalares do jogo (`difficulty_scalar`, `charcoal_duration_seconds`, `vip_chance`, etc.).

2. **Google Mobile Ads (AdMob) & UMP (LGPD / GDPR):**
   - **Consentimento UMP (`AdService.cs`, `PrivacyService.cs`):** Gerenciamento de status de consentimento (`ConsentStatus`) com inicialização não-bloqueante no primeiro frame. Aviso LGPD para o Brasil e consentimento explícito prévio para EEA/UK (§67).
   - **Rewarded Ads (8 Placements canônicos de `ads.json`):**
     - `double_offline` (cap 4/dia, cd 0m)
     - `double_turn` (cap 6/dia, cd 0m)
     - `unburn_plate` (cap 3/dia, cd 2m)
     - `revive_turn` (cap 2/dia, cd 0m)
     - `call_vip` (cap 2/dia compartilhado com natural, cd 60m)
     - `extra_chest` (cap 2/dia, cd 0m)
     - `speed_upgrade` (cap 3/dia, cd 0m)
     - `reroll_reward` (cap 3/dia, cd 0m)
   - **Anti-Fraude de Recompensas (`RewardTokenVault`):** Tokens de recompensa descartáveis de uso único com TTL de 3.600 s (1 hora) e trava de no máximo 1 callback simultâneo (§35).
   - **Política Restritiva de Interstitials (§36):** Único placement aprovado: `turn_result_to_lobby_only`. Gating estrito: supressão durante estados críticos (`cooking`, `active_order`, `critical_action`, `tutorial`), pulo dos primeiros 6 turnos e primeiras 2 sessões, supressão de 24h após IAP e de 10 min após Rewarded, limite de 3 por sessão e 8 por dia, intervalo mínimo de 180 s e probabilidade de 60%.

3. **Google Play Billing v7 & Resolução Atômica do Débito B-07:**
   - **Saneamento do Débito B-07 (SKUs IAP):** Os pacotes de moedas que entregam brasas foram atômica e formalmente renomeados de `brasa.coins.*` para `brasa.embers.*` (`brasa.embers.small.v1`, `brasa.embers.medium.v1`, `brasa.embers.large.v1`), mantendo consistência entre `shared/data/iap.json`, `Assets/Data/iap.json`, `.env.example`, `credentials.json.example`, `SecureConfig.cs`, `monetization.test.ts` e `docs/07-MONETIZATION.md`.
   - **Regras Éticas de Monetização (§98):** Sem dark patterns, exigência de confirmação explícita do usuário antes da compra, exibição de preços reais da loja, sem falsa escassez e restauração de compras permanentemente disponível (`RestorePurchases`).
   - **Gating Ético do Starter Pack (§39):** Ofertado apenas após 4 turnos concluídos E primeiro upgrade realizado, com cooldown de 24h após qualquer transação.
   - **Validação de Recibos e Resiliência Offline:** Política de retentativas com backoff exponencial (3 tentativas: 500 ms, 2.000 ms, 8.000 ms). Fallback gracioso offline (`grant_pending_flag`) com conciliação automática na próxima inicialização sem perda de compras e sem pagamento duplo (`GrantTokenVault`).

4. **Gerenciamento Seguro de Configurações (`SecureConfig.cs`):**
   - Cascata de configuração: `credentials.json` (StreamingAssets) → Variáveis de Ambiente → Defaults embutidos (IDs de teste públicos da Google).
   - Mascaramento em logs para impedir vazamento acidental de chaves no console ou ferramentas de diagnóstico.
   - Alerta sonoro/visual em builds de Release caso identificadores de teste permaneçam configurados.

---

## 2. Testes e Validação de Conformidade

- **Nova Suíte Vitest:** `tools/studio/test/f11-services.test.ts` (15 novos testes unitários cobrindo Firebase, PII, Remote Config, AdMob, anti-fraude, UMP, Play Billing v7, Débito B-07, regras éticas e tolerância offline).
- **Resultado da Suíte Completa:** **717 testes / 34 arquivos vitest** aprovados com 100% de sucesso (`npm test`).
- **CI Gates Locais:** **14 de 15 gates** executados e aprovados com sucesso (`npm run gates`).
  - `validate`: PASS (22 tabelas validadas com sucesso).
  - `check-schema`: PASS (22 schemas JSON draft-07 íntegros).
  - `verify-data-sync`: PASS (sincronização estrita de `shared/data/` e `Assets/Data/`).
  - `check-art-registry`: PASS (244 runtime sprites preservados).
  - `check-csharp`: SKIP local por ausência de SDK .NET no contêiner Debian (verificado para CI remoto).
- **Evidências Brutas Gravadas:**
  - `docs/evidence/f11/green-tests.log`: log completo da execução de 717 testes verdes.
  - `docs/evidence/f11/green-gates.log`: log completo dos 14/15 gates locais PASS.

---

## 3. Preservação de Diretrizes e Decisões

- **PRs #7 e #8:** mantidos abertos e inalterados sem qualquer merge destrutivo.
- **Segurança de Segredos:** nenhuma credencial real, chave de API de produção ou keystore privada foi adicionada ao Git.
- **Isolamento de Domínios:** `Churrasco.Services` encapsula chamadas a SDKs externos enquanto o simulador (`Churrasco.Core`) permanece puro e livre de dependências de engine ou SDKs de terceiros.
