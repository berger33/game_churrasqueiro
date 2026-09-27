# F6 — Auditoria e Atualização Isolada de Dependências e Toolchain

**2026-09-27 · Concluído e validado localmente.**
Checkpoint de encerramento da **Fase F6** (Auditoria de Dependências, Toolchain e Resolução de Vulnerabilidades).
Base confirmada: PR #16 integrado (`a900445fe3def248973fc884564a632d829f9c65`), branch de trabalho `arena/01a0e1a4-game-churrasqueiro`.
PRs preservados: **PR #7** e **PR #8** abertos e intactos.
Nenhum contrato de dados, fórmula econômica ou regra de simulação foi alterada nesta etapa.

---

## 1. Resumo Executivo da Fase F6

Conforme o critério estrito de conclusão da Fase F6 definido em `docs/23-PLANO_IMPLEMENTACAO.md` §9.2:
> *"Rever release notes de Vitest/Vite/esbuild e Node mínimo; audit antes/depois; typecheck, 202+ testes, schemas, vetores, sim curto/longo, render, screenshots e C# remoto. Zero vulnerabilidades conhecidas ou impedimento documentado, sem force cego."*

- **Auditoria de Vulnerabilidades Inicial:** O repositório continha 5 vulnerabilidades (1 crítica, 1 alta, 3 moderadas) em dependências transitivas de `vitest@2.1.8` (`@vitest/mocker`, `vite`, `vite-node`, `esbuild`).
- **Resolução Sem "Force Cego":** Em vez de executar `npm audit fix --force` (que causaria quebras de semver descontroladas e falhas de peer dependencies com `vite@8`), a toolchain foi atualizada cirurgicamente para `vitest@^4.1.11` com `npm install`.
- **Resultado do `npm audit`:** **Zero vulnerabilidades encontradas (0 vulnerabilities)**.
- **Validação Completa:**
  - 687 testes unitários passando em 31 arquivos vitest (`npm test`).
  - 14/15 gates locais PASS (`npm run gates`).
  - 157 vetores dourados de simulação + 44 vetores FTUE byte-idênticos (`npm run check-vectors`).
  - 1500 turnos ativos: 18/18 metas PASS, spend ratio 74,1% (`npm run sim:long`).
  - 53 capturas visuais em PNG renderizadas sem desvios (`npm run check-shots`).

---

## 2. Antes e Depois da Toolchain

| Pacote | Versão Anterior | Versão Atualizada | Status de Segurança |
|---|---|---|---|
| `vitest` | `^2.1.8` (2.1.9) | `^4.1.11` | GHSA-5xrq-8626-4rwp (crítica 9.8) e GHSA-82fw-gwwq-j7x9 sanadas |
| `@vitest/mocker` | trans. < 4.1.11 | `4.1.11` | Sanada |
| `vite` | trans. <= 6.4.2 | `6.4.3` | GHSA-4w7w-66w2-5vf9, GHSA-v6wh-96g9-6wx3 e GHSA-fx2h-pf6j-xcff sanadas |
| `esbuild` | `^0.28.2` | `^0.28.2` | Atualizado e sem vulnerabilidades |
| `typescript` | `^5.6.3` | `^5.6.3` | Compatibilidade mantida |
| `Node.js` | `v22.22.3` | `v22.22.3` | `engines: { "node": ">=22" }` respeitado |

### Relatório `npm audit` Final
```
found 0 vulnerabilities
```
Log completo arquivado em [`npm-audit.log`](npm-audit.log).

---

## 3. Integridade e Regressões

- **Vitest Runner:** Execução em 52,8 s de todos os 31 arquivos de teste com saída limpa.
- **Typecheck estrito:** `tsc --noEmit` aprovado sem erros.
- **Render Smoke & Screenshots:** 29.092.176 canvas ops executadas sem exceções; 53 capturas PNG consistentes com o visual nominal.
- **Simulações Econômicas:** Tanto `npm run sim` (60 turnos autorais) quanto `npm run sim:long` (1500 turnos da campanha) mantêm 100% de conformidade com os 18 guardrails em `shared/data/economy.json`.

---

## 4. Próximo Passo do Projeto

Com a Fase F6 concluída e a toolchain limpa de vulnerabilidades:
👉 **Fase F7: Revisão, Triagem e Resolução dos PRs Abertos #7 e #8.**
- Comparar cada tema com `main`: útil vs obsoleto vs conflitante.
- Reimplementar seletivamente o que for necessário com testes.
- Manter o registro formal antes do fechamento coordenado.
