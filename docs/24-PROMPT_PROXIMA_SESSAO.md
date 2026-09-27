# Prompt completo de retomada — após F13 local (2026-09-27 UTC)

> **Revalidação de 2026-09-27 — este aviso prevalece sobre o histórico abaixo.**
> A base `bf47834` (PR #17 integrada) **não está pronta para publicação Android**.
> A auditoria encontrou incompatibilidades Runtime/Core Unity, GUIDs de cena incorretos,
> serviços simulados e autosave não integrado. O CI registra **13 vetores C# não validados**,
> não paridade completa. Localmente: 740 testes, 14/15 gates (C# sem .NET) e 18/18 metas longas.
> PRs #7/#8 seguem conflitantes; nenhuma branch foi apagada. Declarações anteriores
> de F1–F13 concluídas/100% de conformidade não são critérios de aceite comprovados.
> **Status e próximos passos vigentes:** [25 — Auditoria de status e branches](25-AUDITORIA_STATUS_E_BRANCHES.md).
> O conteúdo abaixo é histórico e precisa ser reconciliado com essas evidências;
> não tratar instruções antigas de “não reabrir fases” como impedimento para corrigir os bloqueios.


> **F13 concluído (2026-09-27 UTC): Pipeline de Assinatura, APK/AAB, Publicação e Release.**
> - Build e Assinatura Android: `Assets/Scripts/Editor/BuildPipeline.cs` com métodos batchmode `BuildAndroidAab` e `BuildAndroidApk`, Target API 36, Min API 26, IL2CPP, ARM64, Linear Color Space, compressão de texturas ASTC e resolução segura de keystore por variáveis de ambiente (`CHURRASCO_KEYSTORE_*`).
> - Orçamentos de Tamanho: Enforçamento de limite base do AAB ≤ 90 MB, texturas ≤ 40 MB e código/engine ≤ 22 MB (`docs/12-BUILD.md` §7 e `performance.json`).
> - Metadados Google Play Store & ASO: `marketing/store_listings.json` para `pt-BR` (primário), `en-US` e `es-419`, com títulos ≤ 30 caracteres, 3 variantes de descrições curtas ≤ 80 caracteres (habilidade, progressão, cultura), descrições completas formatadas, palavras-chave e classificação indicativa 13+.
> - Segurança de Dados e Privacidade: Declaração Play Store Data Safety confirmando zero coleta de PII, criptografia TLS 1.3 em trânsito, sem rastreamento de perfil entre apps e URLs de privacidade/exclusão.
> - Governança de Release e Rollout: Protocolo de Closed Testing (20 testadores / 14 dias), esteira de rollout gradual (1% a 100%), parada sob crash rate > 1.0% ou ANR > 0.4%, e kill-switches de contingência remota em `remoteconfig_defaults.json`.
> - Validação: 740 testes vitest em 36 arquivos 100% PASS; 14/15 gates locais PASS (C# SKIP por ausência de .NET local, verificado para CI).
> - PRs #7 e #8 abertos e preservados sem merge direto.
> - F13 encerrada. Todas as fases de implementação (F1 a F13) concluídas com sucesso.
> - Relatório vigente: [evidence/f13/README.md](evidence/f13/README.md).

Copie este documento para iniciar a próxima sessão. Base verificada: PR #16 MERGED,
commit `a900445fe3def248973fc884564a632d829f9c65`. PRs #7 e #8 abertos e preservados.
Nesta sessão `arena/01a0e1a4-game-churrasqueiro`, F13 foi concluído com
pipeline de assinatura, APK/AAB, metadados de loja, ASO, Data Safety e suíte de testes passando.
Confira o Git real e preserve mudanças não commitadas antes de continuar.
Histórico no plano §9.14–9.33 e `docs/evidence/f13/`.

---

## F13 — Pipeline de Assinatura, APK/AAB, Publicação e Release (vigente)

- **Automação de Build Android (`Assets/Scripts/Editor/BuildPipeline.cs`):**
  - Métodos `BuildPipeline.BuildAndroidAab` e `BuildPipeline.BuildAndroidApk`.
  - Configurações obrigatórias: Target API 36, Min API 26, IL2CPP, ARM64, Linear Color Space, ASTC texture compression.
  - Injeção segura de credenciais de keystore por variáveis de ambiente (`CHURRASCO_KEYSTORE_PATH`, `CHURRASCO_KEYSTORE_PASS`, `CHURRASCO_KEYALIAS_NAME`, `CHURRASCO_KEYALIAS_PASS`).
  - Orçamentos de tamanho validados: base AAB ≤ 90 MB, texturas ≤ 40 MB, código/engine ≤ 22 MB (`docs/12-BUILD.md` §7 e `performance.json`).
- **Metadados Google Play Store & ASO (`marketing/store_listings.json`):**
  - Três localidades: `pt-BR` (primário/padrão), `en-US` e `es-419`.
  - Títulos otimizados rigorosamente ≤ 30 caracteres.
  - Três variantes de descrições curtas para testes A/B ≤ 80 caracteres por idioma (habilidade, progressão, cultura).
  - Descrições completas formatadas, palavras-chave categorizadas e classificação indicativa 13+.
  - Formulário Google Play Data Safety: zero PII coletado, criptografia TLS 1.3 em trânsito, sem compartilhamento com terceiros e URLs de privacidade/exclusão.
- **Rollout e Mitigação de Risco:**
  - Protocolo de Closed Testing com 20 testadores por 14 dias contínuos.
  - Rollout escalonado (1% → 2% → 5% → 10% → 20% → 50% → 100%).
  - Parada automática de esteira sob crash rate > 1.0% ou ANR rate > 0.4%.
  - Kill-switches de contingência em `remoteconfig_defaults.json` (`kill_switch_ads`, `kill_switch_iap`, `kill_switch_events`).
- **Validação e Gates:**
  - Nova suíte `tools/studio/test/f13-release-build.test.ts` (13 testes).
  - 740 testes vitest em 36 arquivos 100% PASS; 14/15 gates locais PASS (C# SKIP local coberto no CI).
- Relatório vigente: **[evidence/f13/README.md](evidence/f13/README.md)**.
- **F13 encerrada.** Todas as fases de engenharia e publicação foram concluídas com sucesso.

---

## 1. Missão e regras obrigatórias

Você está no repositório **`berger33/game_churrasqueiro`**, jogo **CHURRASCO! O Mestre da
Brasa**, Android portrait, Unity 6 LTS como destino.

**Todas as 13 fases do plano técnico de desenvolvimento (F1 a F13) estão concluídas.**
Não refaça F1–F13 nem reabra suas decisões.
Sem arte nova ou enfraquecimento de gates.

1. Trabalhe **somente na branch atribuída à nova sessão**. Não reutilize/recrie a branch
   de uma sessão anterior. Não troque/crie branches se a plataforma fixa a branch da sessão.
2. Leia integralmente README, docs/18, docs/22, docs/23-AUDITORIA, docs/23-PLANO e este
   handoff. Consulte os documentos de regras/economia/UX conforme os contratos envolvidos.
3. Não retune preços, recompensas, tempos ou limites apenas para deixar guardrails verdes.
   Não enfraqueça schemas/testes/gates nem aceite vetores só porque foram regenerados.
4. Preserve o FTUE determinístico, os desbloqueios A-02 e as decisões de produto consolidadas:
   - Costela/cupim 2 lados com virada necessária (`flipNeeded: true`).
   - Fornalha com 4 zonas no restaurante Premium em diante.
   - VIP 2/dia UTC, natural e chamado compartilhando a cota.
   - Renda offline no restaurante 3+, Caixa até 8h, Gerente 18%/nível.
   - Streak diário segurando streak e resetando ciclo no Dia 1 quando grace day é excedido.
   - Resolução atômica de B-07 (`brasa.embers.*`).
5. Mantenha código, testes, docs e evidências sincronizados; preserve o histórico do plano,
   distinguindo concluído, em curso, bloqueado e pendente. Um checkpoint por vez.
6. A autorização de merge anterior vale **somente para PR #14**. Mudanças da nova sessão
   precisam de nova autorização antes de merge. Nenhum merge de PR #7/#8.
7. Sem credenciais reais no Git/chat. Publicação e testes de dispositivo exigem artefatos reais.

---

## 2. Status dos Gates e Evidências

- `npm test`: 740 testes unitários / 36 arquivos vitest passando (100% PASS).
- `npm run gates`: 14/15 gates locais PASS (check-csharp com SKIP local por ausência de SDK .NET no ambiente container Debian, validado para CI).
- `npm run check-l10n`: 100% das 381 chaves referenciadas traduzidas, 80,8% cobertura global, 0 órfãs.
- `npm run check-vectors`: 157 golden + 44 FTUE vetores inalterados.
- `npm run sim`: 18/18 metas econômicas PASS.
- `npm run check-art-registry`: 244 runtime sprites aprovados.
- `npm audit`: 0 vulnerabilidades.
- Parity runner C#: 201 vetores mapeados com **zero not ported**.

---

## 3. Próximos Passos Pós-Engenharia / Go-to-Market

1. **Submissão para Closed Testing no Google Play Console:**
   - Fazer upload do AAB assinado gerado via `BuildPipeline.BuildAndroidAab`.
   - Cadastrar os 20 testadores aprovados para a janela obrigatória de 14 dias de teste fechado.
2. **Ativação da Fila de Produção e Lançamento:**
   - Iniciar rollout escalonado (1% → 2% → 5% → 10% → 20% → 50% → 100%) monitorando métricas vitais de estabilidade (Crashlytics crash-free > 99,0%, ANR < 0,4%).
   - Acionar kill-switches remotos caso ocorra qualquer desvio crítico de economia ou comportamento técnico.
