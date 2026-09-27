# Evidência F10 — Meta, Localização e Acessibilidade

**Data:** 2026-09-27 UTC  
**Branch:** `arena/01a0e1a4-game-churrasqueiro`  
**Base:** `a900445` (`main` pós-PR #16)  
**PRs preservados:** #7 e #8 abertos e intactos  

---

## 1. Resumo Executivo

A **Fase F10 (Meta, Localização e Acessibilidade)** implementou as camadas de metaprogressão, expandiu a cobertura de localização para 100% dos dados referenciados em múltiplos idiomas e introduziu suporte a acessibilidade motora e visual para **CHURRASCO! O Mestre da Brasa**:

1. **Localização Global Expandida (pt-BR, en-US, es-419):**
   - **100% das 381 chaves referenciadas por dados traduzidas:** todas as tabelas de ingredientes, churrasqueiras, upgrades (27 trilhas), restaurantes, funcionários, conquistas (58), missões, rota e passe foram traduzidas em inglês (`en-US.json`) e espanhol latino-americano (`es-419.json`).
   - **Cobertura total subiu de 22,0% para 80,8%** (495 de 613 chaves totais em cada idioma secundário, com fallback seguro para pt-BR nas chaves de interface específicas).
   - **Zero chaves órfãs:** nenhuma chave em `en-US` ou `es-419` existe fora da base canônica `pt-BR.json`, cumprindo rigorosamente a especificação §56 e o gate `check-l10n`.

2. **Metaprogressão e Livro do Mestre (`meta.ts` e `MetaProgression.cs`):**
   - **Coleção e Maestria (Livro do Mestre):**
     - Fórmula de maestria por potência conforme `collection.json`: $\text{XP} = \text{round}(30 \times \text{nível}^{1.5})$.
     - Patamares de maestria: Nível 1 (*Iniciante*), Nível 5 (*Assador*), Nível 10 (*Especialista*), Nível 20 (*Mestre*).
     - Recompensas por nível: 40 moedas por nível e 3 brasas a cada 5 níveis.
   - **Avaliador de Conquistas:**
     - Mapeamento e avaliação idempotente de 58 conquistas em 5 categorias contra contadores de telemetria/estatísticas (`turnsPlayed`, `perfectCooks`, `customersServed`, `coinsEarned`, `burnRate`, etc.).
     - Proteção estrita contra resgate duplo.
   - **Sistema de Missões (Diárias e Semanais):**
     - Rastreamento de metas e progresso em tempo real com deltas de turno.
     - Mecânica de reroll com brasas (1 gratuito ao dia) e bônus de conclusão ao completar a trinca diária ou semanal.
   - **Passe da Brasa (Season Pass):**
     - Progressão em 50 patamares (1.000 XP/patamar), com trilha gratuita (sem travas essenciais) e trilha premium.
   - **Rota da Brasa (Mapa Regional):**
     - 16 paradas cobrindo Sudeste, Sul, Nordeste, Centro-Oeste e Norte.
     - Sistema de custos em Pontos de Brasa e validação de desafios de parada.

3. **Opções de Acessibilidade (`AccessibilitySettings.cs`):**
   - **Ponto visual sem dependência exclusiva de cor:** introdução de símbolos gráficos universais para os 8 estágios de doneness (○ cru, ◔ aquecendo, ◑ meio cozido, ◕ quase pronto, ★ perfeito, ▲ passado, ▲▲ queimando, ✖ queimado), auxiliando jogadores daltônicos.
   - **Modo de Redução de Movimento (*Reduced Motion*):** desabilita tremores de câmera, atenua partículas de fumaça/brasa e suaviza transições.
   - **Alvos de Toque Aumentados (*Large Touch Targets*):** amplia as áreas clicáveis de espetos, grelhas e bancadas de preparo em 25–50% para telas compactas e acessibilidade motora.
   - **Modo de Alto Contraste (*High Contrast*):** reforça legibilidade de textos e barras de paciência.

---

## 2. Testes e Validação de Conformidade

- **Nova suíte de testes Vitest:** `tools/studio/test/f10-meta-l10n.test.ts` (8 novos testes unitários cobrindo tradução, ausência de órfãos, fórmulas de maestria, avaliação de conquistas, missões, passe e rota).
- **Resultado da suíte completa:** **702 testes / 33 arquivos vitest** aprovados com 100% de sucesso (`npm test`).
- **CI Gates Locais:** **14 de 15 gates** executados e aprovados com sucesso (`npm run gates`).
  - `check-l10n`: PASS com 80,8% de cobertura e zero chaves referenciadas pendentes.
  - `check-csharp`: SKIP local por ausência do SDK .NET no contêiner Debian (verificado no CI remoto).
- **Evidências brutas geradas:**
  - `docs/evidence/f10/green-tests.log`: log completo de 702 testes passando.
  - `docs/evidence/f10/green-gates.log`: log completo de 14/15 gates locais PASS.

---

## 3. Preservação de Diretrizes e Decisões

- **PRs #7 e #8:** mantidos abertos e inalterados sem qualquer merge destrutivo.
- **Pureza do Core C#:** `Assets/Scripts/Core/MetaProgression.cs` mantido sob `netstandard2.1` / C# 9.0 com zero dependência de `UnityEngine` e total paridade com `meta.ts`.
- **Integridade de Dados:** nenhuma chave original de `pt-BR.json` foi removida ou modificada; nenhum dado numérico de balanceamento foi alterado.
