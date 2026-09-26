# Prompt de retomada — próximo passo após lote 07

Continuar o `game_churrasqueiro` a partir do `main` atualizado após o merge do PR #12, que inclui a aprovação do lote 07 e este handoff. Trabalhe na branch atribuída à nova sessão, baseada nesse `main`; não altere `main` diretamente nem reutilize a branch da sessão anterior.

## Estado confirmado

- Lotes 01–02 e 04–07 aprovados. Runtime do protótipo: **211 sprites, 3,44 MB WebP**.
- Lote 07: 10/10 imagens, 34/34 sprites `approved`; masters e runtime versionados. A aprovação valida a arte, não integra as novas telas de coleção, eventos, loja/IAP, Brasa Pass, mapa/rota ou conquistas.
- Lote 03 continua aguardando decisão do dono. Não mude seu registro/status, não integre seus assets e não o trate como aprovado.
- Chapa evo 3 e fornalha evo 2–3 do lote 06 têm desvios explicitamente autorizados; não os altere e não afrouxe `holeValidation`.
- O mapa do lote 07 tem divisões internas ilustrativas, não limites cartográficos oficiais; a miniatura inox da coleção não tem a manivela do prompt. Foram aceitos pelo dono junto com o lote completo.
- Registro técnico e revisão: `art/review/lote-07.md`, `art/review/lote-07-checks.json`, `art/review/lote-07.jpg`, `art/review/lote-07-preview.jpg`.
- Runtime contém assets aprovados, mas não é prova de integração funcional. A montagem do lote 07 é estática, não screenshot do jogo.

## Tarefa imediata — docs/23 §1.4: `check-art-registry`

Implementar um gate de CI com verificações efetivas (não asserts que possam ser neutralizados):

1. Todo arquivo asset sob `Assets/Art` tem exatamente uma linha no `Assets/Art/ASSET_REGISTRY.csv` e todo caminho do registro aponta para um arquivo existente.
2. Detectar nomes duplicados, linhas malformadas e status inválidos. Respeitar `sprites.manifest.json` e os metadados já existentes sem reescrever notas/CRLF do CSV.
3. O runtime (`prototype/assets/art/index.json` e os WebP listados) só contém sprites com status `approved`; todo item listado existe e dimensões/IDs conferem com o manifesto.
4. Incluir testes positivos e negativos que demonstrem que o gate falha quando: um master não tem linha; uma linha aponta para arquivo inexistente; um asset `pending` entra no runtime; há registro duplicado. Não editar dados reais para passar os testes.
5. Registrar o comando no runner `tools/studio/run-gates.mjs` e nos docs aplicáveis. Rodar o teste do gate, `npm run gates` e verificar a lista/ordem de gates. Não alterar arte, gameplay, simulação ou `holeValidation`.
6. `check-csharp` pode ser SKIP localmente se `dotnet` não estiver disponível, mas o CI deve executá-lo. Não declarar todos os gates verdes sem evidência do CI.

Antes de mexer, leia `docs/22-ARTE_2D_PLANO.md` §§3, 7 e 11; `docs/23-PLANO_IMPLEMENTACAO.md` §§0, 1.4 e 8; `docs/04-ART_STYLE.md` §11; e inspecione os gates existentes. Se a implementação exigir alguma alteração de contrato do registro, explique-a e atualize a documentação antes de mudar os dados.

## Depois do gate

- Atualize o passo 1.4 do docs/23 com os resultados reais e a branch/PR.
- Não comece automaticamente o passo 1.5, as telas do metajogo nem o lote 08. O passo 0.1 (decisão do lote 03) permanece bloqueado pelo dono; o 0.3 exige atualizar `18-STATUS.md` quando autorizado/concluído.
- Faça commit e push somente na branch atribuída à sessão. Peça revisão antes de qualquer merge.

## Persistência / segurança

- Confira `git status`, branch e base antes de editar; preserve trabalho local. Após wipe, faça fetch explícito da branch da sessão e compare o estado antes de qualquer `reset --hard`.
- Não mude status de assets sem decisão explícita do dono. Não reprocese lote 07 nem regenere artes já versionadas.
- Masters, spec, prompts, relatórios e handoffs são versionados; raws e referências continuam ignorados.
- Não incorporar branches/PRs antigos de experimentos. Não apagar nem mesclar branches alheias sem conferir seus PRs e autorização explícita.
