# Guia Operacional e Checklist: Google Play Console

**Jogo:** CHURRASCO! O Mestre da Brasa  
**Package Name:** `com.studiobrasa.churrascomestredabrasa`  
**Destino de Publicação:** Google Play Console (Android)  
**Versão Inicial de Release:** V0.9 / 1.0.0 (Bundle Version Code: 1)  
**Data:** 2026-09-27  

---

## 1. Pré-Requisitos da Conta e Configuração Inicial

### 1.1 Verificação de Conta de Desenvolvedor
- [ ] Conta Google Play Console ativa com verificação de identidade aprovada (documento oficial + comprovante de endereço).
- [ ] Número D-U-N-S verificado (caso a conta seja corporativa/organização).
- [ ] Perfil para pagamentos configurado na Google Payments Merchant Center (para recebimento de receitas de IAP).
- [ ] Endereço de e-mail de contato público para suporte e Política de Privacidade publicados em domínio próprio (`https://studiobrasa.com/privacy`).

### 1.2 Regra Obrigatória de Closed Testing (20 Testadores / 14 Dias)
> **Atenção à Política do Google Play:** Contas pessoais criadas a partir de novembro de 2023 devem obrigatoriamente executar um teste fechado com **no mínimo 20 testadores** que tenham optado ativamente por participar por pelo menos **14 dias contínuos** antes de solicitar acesso à faixa de Produção.

- [ ] Criar um Grupo do Google (Google Group) para gerenciamento unificado dos testadores:
  - Exemplo de grupo: `churrasco-testers@googlegroups.com`.
  - Configurar permissões do grupo para que qualquer pessoa com o link de convite possa entrar.
- [ ] Recrutar 20 a 30 testadores voluntários (garantir margem acima de 20 para evitar quedas no período).
- [ ] Obter a confirmação de que os testadores usam dispositivos Android com Android 8.0+ (API 26 a 36).

---

## 2. Geração e Assinatura do Artefato (.AAB)

### 2.1 Preparação do Keystore de Produção
O binário final deve ser assinado com sua chave de upload (*Upload Key*), enquanto o Google Play gerencia a chave de distribuição final via *Play App Signing*.

Variáveis de ambiente necessárias na máquina ou no runner de CI/CD:
```bash
export CHURRASCO_KEYSTORE_PATH="/caminho/seguro/churrasco-release.keystore"
export CHURRASCO_KEYSTORE_PASS="SuaSenhaDoKeystoreSegura"
export CHURRASCO_KEYALIAS_NAME="churrasco_upload_key"
export CHURRASCO_KEYALIAS_PASS="SuaSenhaDoAliasSegura"
```

### 2.2 Comando de Build em Modo Batch (Unity)
Executar o método automatizado implementado em `Assets/Scripts/Editor/BuildPipeline.cs`:
```bash
unity -quit -batchmode -nographics \
  -projectPath . \
  -executeMethod Churrasco.Editor.BuildPipeline.BuildAndroidAab \
  -logFile build_android.log
```

### 2.3 Verificação Pós-Build do Artefato
- [ ] Arquivo gerado em `Builds/Android/churrasco-mestre-da-brasa-release.aab`.
- [ ] Tamanho do arquivo verificado: **≤ 90 MB** (orçamento rígido de publicação).
- [ ] Conferir hash SHA-256 do arquivo gerado e arquivar nos registros de auditoria.

---

## 3. Checklist do Formulário de Segurança de Dados (Data Safety)

O preenchimento na Google Play Console deve corresponder rigorosamente às declarações em `marketing/store_listings.json` e `docs/16-PRIVACY.md`.

### 3.1 Coleta e Compartilhamento de Dados
| Pergunta do Console | Resposta Obrigatória | Justificativa |
| :--- | :--- | :--- |
| O app coleta ou compartilha dados de usuários? | **Sim (Apenas telemetria anônima e desempenho)** | Uso de Firebase Crashlytics e métricas de jogabilidade sem PII. |
| Todos os dados de usuário são coletados e criptografados em trânsito? | **Sim** | Todo o tráfego utiliza conexões seguras HTTPS / TLS 1.3. |
| O app oferece uma forma de os usuários solicitarem a exclusão de seus dados? | **Sim** | URL de exclusão fornecida: `https://studiobrasa.com/delete-data`. |

### 3.2 Tipos de Dados Detalhados
- **Localização:** NÃO coletada.
- **Informações pessoais (Nome, E-mail, Telefone, Endereço, CPF):** NÃO coletadas.
- **Informações financeiras (Cartão de crédito, contas):** NÃO coletadas pelo app (o Google Play Billing processa os pagamentos externamente; o app recebe apenas o token criptográfico de validação).
- **Saúde e condicionamento físico:** NÃO coletados.
- **Mensagens / Fotos / Vídeos / Áudio:** NÃO coletados.
- **Arquivos e documentos:** NÃO coletados.
- **Atividade no app (Interações no jogo):**
  - **Coletado:** Sim (Eventos de telemetria de nível e economia via Firebase Analytics).
  - **Compartilhado com terceiros:** Não.
  - **Finalidade:** Análise do app (Analytics) e prevenção de fraude.
  - **Vinculado ao usuário:** Não (Associado unicamente a um UUID anônimo de instalação).
- **Informações do app e desempenho (Logs de falhas, diagnóstico):**
  - **Coletado:** Sim (Crashlytics).
  - **Compartilhado com terceiros:** Não.
  - **Finalidade:** Diagnóstico e correção de falhas técnicas.
  - **Vinculado ao usuário:** Não.
- **Identificadores de dispositivo ou outros IDs:**
  - **Coletado:** Sim (ID de instalação gerado internamente e ID de anúncio Google AdMob caso consentido).
  - **Compartilhado:** Sim (Apenas com a rede AdMob para fins de publicidade).
  - **Finalidade:** Publicidade e análise.

---

## 4. Configuração da Ficha da Loja Principal (Store Listing) & ASO

Copiar os textos diretamente de `marketing/store_listings.json`:

### 4.1 Ficha em Português do Brasil (`pt-BR` — Principal)
- **Nome do app (≤ 30 caracteres):**  
  `CHURRASCO! Mestre da Brasa` (26 caracteres)
- **Descrição curta (≤ 80 caracteres) — Escolha uma das variantes para teste A/B:**
  - *Variante A (Foco em Habilidade):*  
    `Domine a brasa, acerte o ponto da picanha e seja o maior churrasqueiro!` (71 caracteres)
  - *Variante B (Foco em Progressão):*  
    `Do quintal à maior churrascaria do Brasil. Construa seu império da brasa!` (73 caracteres)
  - *Variante C (Foco em Identidade Cultural):*  
    `Picanha, linguiça e pão de alho. O autêntico churrasco brasileiro virou jogo!` (77 caracteres)
- **Descrição completa (≤ 4.000 caracteres):** Copiar o texto completo contido no bloco `pt-BR.fullDescription`.
- **Palavras-chave ASO:** `churrasco`, `picanha`, `brasa`, `culinaria`, `churrascaria`, `restaurante`, `cozinha`, `gerenciamento`, `idle`, `offline`, `brasil`.

### 4.2 Ficha em Inglês (`en-US`)
- **App name:** `CHURRASCO! Master of BBQ` (24 caracteres)
- **Short description:**  
  `Master the coals, grill perfect picanha and become the ultimate grill master!` (77 caracteres)
- **Full description:** Copiar de `en-US.fullDescription`.

### 4.3 Ficha em Espanhol Latino-Americano (`es-419`)
- **Nombre de la app:** `CHURRASCO! Maestro Brasa` (24 caracteres)
- **Descripción breve:**  
  `¡Domina las brasas, logra el punto de la picaña y sé el mejor parrillero!` (73 caracteres)
- **Descripción completa:** Copiar de `es-419.fullDescription`.

### 4.4 Ativos Gráficos Obrigatórios
- [ ] **Ícone do aplicativo:** 512 × 512 px, formato PNG de 32 bits com canal alfa (máx. 1 MB).
- [ ] **Gráfico de recursos (Feature Graphic):** 1024 × 500 px, formato JPEG ou PNG de 24 bits (sem alfa).
- [ ] **Capturas de tela (Screenshots de Celular):** No mínimo 4 capturas reais em orientação retrato (aspecto 9:16, resolução recomendada 1080 × 1920 ou 1080 × 2400) utilizando as imagens exportadas em `prototype/shots/` (ex: `01-splash.png`, `12-grill-cooking.png`, `17-cupim-perfect-window.png`, `26-fourth-zone-unlocked.png`, `38-upgrade-catalog.png`).

---

## 5. Configuração dos Produtos na Google Play Billing (IAP)

No menu **Monetização › Produtos integrados ao app (In-App Products)**, cadastrar os produtos com os mesmos IDs validados na arquitetura do jogo:

| Product ID (SKU) | Nome de Exibição | Preço Base Sugerido | Descrição |
| :--- | :--- | :--- | :--- |
| `brasa.embers.small.v1` | Punhado de Brasas | R$ 4,90 (US$ 0.99) | Pacote inicial com 50 Brasas premium. |
| `brasa.embers.medium.v1` | Saco de Brasas | R$ 14,90 (US$ 2.99) | Pacote intermediário com 180 Brasas premium. |
| `brasa.embers.large.v1` | Carroça de Brasas | R$ 39,90 (US$ 7.99) | Grande reserva com 550 Brasas premium. |
| `starter_pack` | Pacote do Mestre Churrasqueiro | R$ 9,90 (US$ 1.99) | Oferta única de boas-vindas com moedas e brasas. |
| `remove_ads` | Passe Sem Interrupções | R$ 19,90 (US$ 3.99) | Remove anúncios intersticiais permanentemente. |
| `season_pass_premium` | Passe da Temporada Ouro | R$ 24,90 (US$ 4.99) | Acesso à trilha premium de recompensas sazonais. |

**Importante:** Ativar todos os produtos como "Ativo" e adicionar os e-mails dos 20 testadores na seção **Licença de Teste** do console para que possam simular compras reais sem débito financeiro no cartão de crédito.

---

## 6. Configuração da Faixa de Teste Fechado (Closed Testing)

### 6.1 Criação da Faixa
1. Acesse **Versão › Teste › Teste fechado**.
2. Clique em **Criar faixa** e defina o nome: `Teste Fechado - Brasil Alpha`.
3. Em **Países/regiões**, selecione Brasil (e demais regiões se desejado).
4. Em **Testadores**, vincule a lista de e-mails ou o Google Group criado (`churrasco-testers@googlegroups.com`).
5. Copie o **Link de adesão na Web** e o **Link de adesão no Android** fornecidos pela Play Console.

### 6.2 Criação da Release e Upload do AAB
1. Na faixa de teste fechado, clique em **Criar nova versão**.
2. Faça o upload do arquivo `churrasco-mestre-da-brasa-release.aab`.
3. Verifique se a chave de assinatura Play App Signing foi vinculada automaticamente.
4. Preencha as Notas da Versão (*Release Notes*):
```text
pt-BR:
Primeira versão de testes de CHURRASCO! O Mestre da Brasa.
- Domine os pontos da carne em 7 estabelecimentos.
- 16 cortes de carne autênticos brasileiros e 27 trilhas de melhorias.
- Participe e envie seu feedback pela Play Store!

en-US:
Initial closed beta for CHURRASCO! Master of BBQ.
- Master the grill across 7 Brazilian steakhouses.
- 16 authentic meat cuts and 27 upgrade paths.
- Join the test and share your feedback!
```
5. Clique em **Salvar**, **Revisar versão** e **Iniciar lançamento no teste fechado**.

---

## 7. Protocolo de Acompanhamento dos 14 Dias

Durante os 14 dias obrigatórios de teste fechado, a equipe deve monitorar diariamente:
- [ ] **Métrica de Ativação:** Garantir que todos os 20 testadores tenham aberto o link, instalado o app e iniciado pelo menos 1 turno.
- [ ] **Painel do Android Vitals:**
  - Taxa de falhas (Crash Rate) < 1,0% (meta interna: < 0,2%).
  - Taxa de ANR (App Not Responding) < 0,4% (meta interna: < 0,1%).
- [ ] **Telemetria de Eventos (Firebase):**
  - Confirmação do disparo dos eventos do funil FTUE: `tutorial_start` → `tutorial_complete` → `first_turn_complete`.
- [ ] **Feedback Direto dos Testadores:**
  - Coletar impressões sobre curva de dificuldade, fluidez a 60 FPS e balanceamento de moedas.

Ao completar 14 dias com 20 testadores ativos, o botão **Solicitar acesso à Produção** será liberado na Play Console. Responda às perguntas sobre como o feedback dos testadores foi utilizado para aprimorar o app e envie a solicitação.

---

## 8. Rollout Gradual de Produção e Plano de Rollback

Após a aprovação para produção:

### 8.1 Cadência de Rollout em Estágios
1. **Dia 1:** Iniciar com **1%** dos usuários.
2. **Dia 2:** Expandir para **2%** caso o Android Vitals permaneça com 0 crashes.
3. **Dia 3:** Expandir para **5%**.
4. **Dia 5:** Expandir para **10%**.
5. **Dia 7:** Expandir para **20%**.
6. **Dia 10:** Expandir para **50%**.
7. **Dia 14:** Lançamento total (**100%**).

### 8.2 Protocolo de Interrupção e Rollback de Emergência
Se a taxa de falhas ultrapassar 1,0% ou um bug crítico de progressão for reportado:
1. **Pausar o Rollout:** Na Play Console, clique imediatamente em **Pausar lançamento da versão**.
2. **Acionar Kill-Switches Remotos (sem necessidade de novo build):**
   - No Firebase Remote Config, altere os parâmetros conforme o subsistema afetado:
     - Problemas de anúncios: definir `kill_switch_ads = true`.
     - Falhas em compras: definir `kill_switch_iap = true`.
     - Erros em eventos ao vivo: definir `kill_switch_events = true`.
   - Clique em **Publicar alterações** (efeito em menos de 8 segundos nos clientes ativos).
3. **Hotfix e Correção:** Identificar o crash nos logs do Crashlytics, corrigir no repositório, incrementar o `bundleVersionCode` e submeter uma versão corretiva.
