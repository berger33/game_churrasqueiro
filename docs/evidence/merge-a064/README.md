# Integração autorizada — A-03 até A-06.4

2026-09-27. O dono solicitou merge completo do trabalho desta sessão e limpeza das branches
antigas. Para evitar apagar trabalho não integrado, confirmou explicitamente
`old_branch_cleanup=preserve_unmerged`: **preservar PRs #7 e #8 e suas branches**.

- Branch de trabalho: `arena/01a0e099-game-churrasqueiro`, sem trocar/criar outra branch.
- Fetch inicial: HEAD e origin/main=e50ce1523fa3d04119dc454e3edb050070641c10.
- Escopo: todo o patch local A-03/A-04/A-05/A-06.1–4, incluindo o rebalanceamento tardio
  autorizado. A-06.5 não foi iniciada. Não incorporar os PRs #7/#8 neste merge.
- Validação local:672 testes/29 arquivos;14/15 gates, C# SKIP;157+44 vetores;53 capturas;
  campanha1500=18/18, repetição idêntica e duas seeds adicionais também18/18.
- Evidência: [../a06/step4/reopened/README.md](../a06/step4/reopened/README.md).
- Antes da publicação, `git ls-remote --heads origin` encontrou somente main e as duas
  branches protegidas. Não há branch antiga já integrada restante para excluir.
- PR7: `arena/01a0daed-game-churrasqueiro`,1874270c0464c24e659e5edac9a0a03b00569d37.
- PR8: `arena/01a0de76-game-churrasqueiro`,021cc2f2718cfff451659409432f1431c2318a5d.

**Estado deste registro inicial:** publicação/CI/merge ainda pendentes. O CI remoto executa
C# com dotnet; SKIP local não autoriza ignorar falha remota ou afirmar paridade/Unity.
A branch ativa da sessão e main serão preservadas.

## PR e exceção mínima autorizada

- Patch publicado no [PR15](https://github.com/berger33/game_churrasqueiro/pull/15),
  commit71d77541d6198e283d5e410e2e97147ed65b31d9.
- [CI36300660583](https://github.com/berger33/game_churrasqueiro/actions/runs/36300660583):
  gates TS/UI/economia passaram; C# compilou/bind13 tabelas e falhou em1 regra já portadas:
  `econ.effectiveHeat`. Anotações originais em red-ci-annotations.json.
- O dono autorizou `merge_csharp_fix=minimal_fix`: corrigir somente a divergência pontual
  de calor e sua regressão, sem relaxar gate nem portar os sistemas novos; merge só com CI verde.
- Nova regressão C# exige calor zero ao esgotar/repor, mesmo com eficiência residual/upgrade,
  em1/3/4 zonas; saco novo volta a aquecer. A regra TS e os vetores existentes não mudam.
- Logs históricos de vitest preservam whitespace bruto. `git diff --check` do código/docs
  (excluindo apenas logs brutos de evidência) está limpo; logs não foram adulterados por estética.
- Download do log de Actions retornou EOF no endpoint de armazenamento; usamos as anotações
  originais do check via GitHub API, sem tratar ausência do arquivo como ausência de falha.
