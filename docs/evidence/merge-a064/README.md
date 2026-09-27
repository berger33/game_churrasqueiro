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
