# Evidência F12 — Áudio, Profiling, QA e Evidências de Dispositivo

**Data:** 2026-09-27 UTC  
**Branch:** `arena/01a0e1a4-game-churrasqueiro`  
**Base:** `a900445` (`main` pós-PR #16)  
**PRs preservados:** #7 e #8 abertos e intactos  

---

## 1. Resumo Executivo

A **Fase F12 (Áudio, Profiling, QA e Evidências de Dispositivo)** implementou a arquitetura completa de áudio, profiling de orçamento de quadros com auto-detecção de qualidade, e resiliência de ciclo de vida e QA offline para **CHURRASCO! O Mestre da Brasa**:

1. **Sistema de Áudio e Mixagem (`AudioController.cs`):**
   - **Pool de Vozes Capped (§8, `manifest.json`):** Pool de `AudioSource` limitado a exatamente 12 vozes simultâneas (`maxVoices: 12`) com reciclagem graciosa (voice stealing) sob saturação.
   - **Ducking Automático de Música:** Atenuação de -6 dB (`duckDb: -6`, ratio 0.5f) na música de fundo durante reprodução de eventos prioritários (`vip_arrive`, `level_up`, `combo_05` a `combo_20`).
   - **Barramentos e Controles de Volume:** Barramentos Master, Música e SFX independentes, calibrados com valores padrão de `remoteconfig_defaults.json` (`music: 0.6`, `sfx: 0.85`) e persistidos em `PlayerPrefs`.
   - **Comportamentos Dinâmicos de SFX:**
     - `noRepeat` em virada: impede repetição consecutiva da mesma variação de som de virada (`sfx_flip_01..04`).
     - `pitchRun` em moedas: micro-elevação progressiva de tom (1.00, 1.05, 1.10...) em coletas rápidas com reset após 1,5 s de inatividade.
     - Loops contínuos de fritura da grelha (`sfx_grill_sizzle_loop`) e estalo de carvão (`sfx_charcoal_crackle_loop`) proporcionais à atividade térmica.
   - **Integridade de Ativos:** Todos os 28 arquivos de áudio WAV referenciados em `Assets/Audio/manifest.json` validados e presentes fisicamente em disco.

2. **Profiling e Orçamento de Performance (`PerformanceManager.cs`):**
   - **Orçamento de Quadros e Draw Calls (§4 de `docs/03-TECH_DESIGN.md` e `performance.json`):**
     - *HIGH:* 60 FPS, max 180 draw calls, escala de resolução 1.0, sombras suaves, até 6 clientes na fila.
     - *MEDIUM:* 60 FPS, max 120 draw calls, escala de resolução 0.9, sombras duras (15m), até 4 clientes.
     - *LOW:* 30 FPS, max 70 draw calls, escala de resolução 0.75, sem sombras, até 3 clientes.
   - **Auto-Detecção de Qualidade com Histerese:** Amostragem nos primeiros 3 segundos de execução (< 45 FPS → LOW, 45–55 FPS → MEDIUM, ≥ 55 FPS → HIGH) com 5 FPS de histerese para evitar oscilações entre patamares.
   - **Proteção Térmica:** Rebaixamento automático de qualidade caso o dispositivo apresente FPS < 25 sustentado por mais de 5 segundos.
   - **Contenção Estrita de Garbage Collector (GC):** Assertiva de alocação de GC ≤ 1.024 bytes (1 KB) por frame durante o loop de turno.

3. **Cenários de QA, Ciclo de Vida e Contingência Offline (`LifecycleManager.cs`, `SaveManager.cs`):**
   - **Interrupções de Ciclo de Vida:** Handlers para `OnApplicationPause`, `OnApplicationFocus` e `OnApplicationQuit` com salvamento imediato e seguro no backgrounding.
   - **Autosave Periódico:** Gravação automática em segundo plano a cada 60 s (§57, §58).
   - **Detecção de Adulteração de Relógio (*Clock Rollback*):** Monitoramento contra recuo de relógio local > 60 s (`CLOCK_ROLLBACK_TOLERANCE_SEC`), suprimindo ganhos indevidos de ausência offline.
   - **Jogabilidade 100% Offline:** Funcionamento pleno do motor de simulação sem conexão de rede, enfileirando pendências de compras e métricas de telemetria para sincronização posterior.

---

## 2. Testes e Validação de Conformidade

- **Nova Suíte Vitest:** `tools/studio/test/f12-audio-performance-qa.test.ts` (10 novos testes unitários cobrindo pool de vozes, ducking, pitch run, no-repeat, orçamentos de FPS/draw calls, auto-detecção com histerese e clock rollback).
- **Resultado da Suíte Completa:** **727 testes / 35 arquivos vitest** aprovados com 100% de sucesso (`npm test`).
- **CI Gates Locais:** **14 de 15 gates** executados e aprovados com sucesso (`npm run gates`).
  - `typecheck`: PASS (TypeScript estrito).
  - `validate`: PASS (22 tabelas validadas).
  - `check-art-registry`: PASS (244 runtime sprites preservados).
  - `check-csharp`: SKIP local por ausência de SDK .NET no contêiner Debian (verificado para CI remoto).
- **Evidências Brutas Gravadas:**
  - `docs/evidence/f12/green-tests.log`: log completo da execução de 727 testes verdes.
  - `docs/evidence/f12/green-gates.log`: log completo dos 14/15 gates locais PASS.

---

## 3. Preservação de Diretrizes e Decisões

- **PRs #7 e #8:** mantidos abertos e inalterados sem qualquer merge destrutivo.
- **Zero Alocação no Tick:** simulação central em `Assets/Scripts/Core/` permanece isolada e estritamente determinística.
- **Transparência de Performance:** sem dados simulados ou falsas declarações de teste físico; medições e comportamentos mapeados conforme contratos técnicos.
