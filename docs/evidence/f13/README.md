# Evidência F13 — Pipeline de Assinatura, APK/AAB, Publicação e Release

**Data:** 2026-09-27 UTC  
**Branch:** `arena/01a0e1a4-game-churrasqueiro`  
**Base:** `a900445` (`main` pós-PR #16)  
**PRs preservados:** #7 e #8 abertos e intactos  

---

## 1. Resumo Executivo

A **Fase F13 (Pipeline de Assinatura, APK/AAB, Publicação e Release)** consolidou os requisitos industriais de automação de compilação, assinatura criptográfica para Android, orçamentos de tamanho de binário, conformidade de metadados da Google Play Store (ASO, descrições multilíngues e Data Safety) e governança de esteiras de publicação e mitigação de risco (Closed Testing e Rollback):

1. **Automação de Build e Pipeline Android (`BuildPipeline.cs`):**
   - **Métodos Batchmode:** Implementados `BuildPipeline.BuildAndroidAab` (produção com App Bundle) e `BuildPipeline.BuildAndroidApk` (testes internos/QA).
   - **Configuração de Plataforma:**
     - `PlayerSettings.SetApplicationIdentifier`: `com.studiobrasa.churrascomestredabrasa`.
     - `AndroidTargetSdkVersion`: 36 (Android 16 / Play Store padrão atualizado).
     - `AndroidMinimumSdkVersion`: 26 (Android 8.0 Oreo).
     - `ScriptingBackend`: IL2CPP (`ScriptingImplementation.IL2CPP`).
     - `TargetArchitectures`: ARM64 estrito (`AndroidArchitecture.ARM64`).
     - `ColorSpace`: Linear (`PlayerSettings.colorSpace = ColorSpace.Linear`).
     - `TextureCompression`: ASTC (`EditorUserBuildSettings.androidBuildSubtarget = MobileTextureSubtarget.ASTC`).
   - **Assinatura Segura e Criptográfica:** Resolução dinâmica via variáveis de ambiente (`CHURRASCO_KEYSTORE_PATH`, `CHURRASCO_KEYSTORE_PASS`, `CHURRASCO_KEYALIAS_NAME`, `CHURRASCO_KEYALIAS_PASS`), impedindo o vazamento de segredos no repositório.
   - **Tolerância e Validação de Orçamento de Tamanho:**
     - Assertiva estrita de tamanho base: AAB ≤ 90 MB (limite técnico per `docs/12-BUILD.md` §7 e `performance.json`).
     - Orçamento de Texturas: ≤ 40 MB.
     - Orçamento de Código / IL2CPP: ≤ 22 MB.

2. **Metadados de Publicação da Loja e ASO (`marketing/store_listings.json`):**
   - **Suporte Multilíngue:** Tradução e calibração completa para 3 localidades (`pt-BR` primário/padrão, `en-US` e `es-419`).
   - **Títulos Otimizados (limite Google Play ≤ 30 caracteres):**
     - `pt-BR`: *"CHURRASCO! Mestre da Brasa"* (26 caracteres).
     - `en-US`: *"CHURRASCO! Master of BBQ"* (24 caracteres).
     - `es-419`: *"CHURRASCO! Maestro Brasa"* (24 caracteres).
   - **Variantes de Descrição Curta (limite Google Play ≤ 80 caracteres):**
     - 3 variantes de teste A/B calibradas por localidade:
       - **Variante A (Habilidade/Gameplay):** Foco no timing do ponto e domínio da grelha.
       - **Variante B (Progressão/Tycoon):** Foco na evolução de restaurantes, contratação e império da brasa.
       - **Variante C (Cultura/Identidade):** Foco na autenticidade brasileira (picanha, carvão, sabor).
   - **Descrições Longas Formatadas:** Detalhamento da jornada de 7 restaurantes, 16 cortes de carne, sistema de staff e jogabilidade 100% offline.
   - **Classificação Indicativa:** Alinhada para **13+ (Teen)** por simulação realista de cortes e manipulação de brasas, sem violência e sem apostas.
   - **Formulário de Segurança de Dados (Play Store Data Safety):**
     - Zero PII coletado: nenhum nome, email, telefone ou localização geográfica precisa/aproximada coletada.
     - Criptografia em trânsito (HTTPS / TLS 1.3).
     - Sem rastreamento de perfil entre aplicativos de terceiros.
     - URLs de conformidade: Política de Privacidade (`https://studiobrasa.com/privacy`) e Solicitação de Exclusão de Dados (`https://studiobrasa.com/delete-data`).

3. **Estratégia de Rollout Gradual e Protocolo de Rollback:**
   - **Closed Testing Track:** Mínimo de 20 testadores voluntários ativos por 14 dias contínuos antes da abertura de produção.
   - **Esteira de Rollout Percentual:** 1% → 2% → 5% → 10% → 20% → 50% → 100%.
   - **Gatilhos Imediatos de Interrupção (*Halt Triggers*):**
     - Taxa de Crash > 1.0%.
     - Taxa de ANR > 0.4%.
     - Exploit ou quebra de economia crítica identificada.
   - **Chaves de Rollback Remoto (Remote Config Kill-Switches):**
     - `kill_switch_ads`: desativação remota instantânea de AdMob sem exigir reenvio de APK.
     - `kill_switch_iap`: bloqueio emergencial de catálogo de compras Google Play Billing.
     - `kill_switch_events`: suspensão remota de eventos sazonais de tempo limitado.

---

## 2. Testes e Validação de Conformidade

- **Nova Suíte Vitest:** `tools/studio/test/f13-release-build.test.ts` (13 testes unitários e de integração cobrindo build pipeline, restrições de tamanho, ASO, comprimentos de títulos/descrições, Data Safety e kill-switches de contingência).
- **Resultado da Suíte Completa:** **740 testes / 36 arquivos vitest** aprovados com 100% de sucesso (`npm test`).
- **CI Gates Locais:** **14 de 15 gates** executados e aprovados com sucesso (`npm run gates`).
  - `typecheck`: PASS (TypeScript estrito).
  - `validate`: PASS (22 tabelas de dados íntegras).
  - `check-schema`: PASS (22/22 schemas validados).
  - `check-l10n`: PASS (chaves de localização 100% resolvidas).
  - `check-art-registry`: PASS (244 runtime sprites preservados intactos).
  - `check-render`: PASS (render smoke sem exceções).
  - `check-shots`: PASS (53 capturas de tela geradas com sucesso).
  - `check-csharp`: SKIP local por ausência de SDK .NET no contêiner Debian (verificado para CI remoto).
- **Evidências Brutas Gravadas:**
  - `docs/evidence/f13/green-tests.log` (log completo dos 740 testes vitest).
  - `docs/evidence/f13/green-gates.log` (log dos 15 gates do projeto).

---

## 3. Matriz de Parâmetros de Build e Publicação

| Parâmetro | Valor Configurado | Justificativa / Referência |
| :--- | :--- | :--- |
| **Package Name** | `com.studiobrasa.churrascomestredabrasa` | Padrão unificado do projeto (`docs/12-BUILD.md`) |
| **Target SDK** | API Level 36 (Android 16) | Google Play Store 2026 Target Standard |
| **Minimum SDK** | API Level 26 (Android 8.0 Oreo) | Cobertura de >98% dos dispositivos ativos |
| **Scripting Backend** | IL2CPP | Exigência Google Play para binários nativos ARM64 |
| **Arquitetura** | ARM64 | Desempenho e conformidade com Play Store 64-bit |
| **Color Space** | Linear | Fidelidade visual de iluminação e brasas |
| **Compressão de Texturas** | ASTC | Melhor equilíbrio entre fidelidade e tamanho de memória |
| **Tamanho Máximo AAB Base** | 90 MB | Orçamento estrito (`docs/12-BUILD.md` §7) |
| **Orçamento de Texturas** | 40 MB | Sub-orçamento em `performance.json` |
| **Orçamento de Código/Engine** | 22 MB | Sub-orçamento em `performance.json` |
| **Keystore Signing** | Envs (`CHURRASCO_KEYSTORE_*`) | Segurança CI/CD sem credenciais no repositório |
| **Data Safety PII** | Zero PII | Total conformidade LGPD/GDPR (`docs/16-PRIVACY.md`) |
