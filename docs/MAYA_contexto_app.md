# Maya — Contexto Completo do Aplicativo

> Documento de contexto para a equipe de marketing e conteúdo.
> Escrito em linguagem simples, sem termos técnicos, para que qualquer pessoa (ou IA) entenda o produto sem precisar ler código.
> Última atualização: setembro de 2026.

---

## Índice

1. Visão Geral
2. Módulos e Funcionalidades (completo)
3. Telas e Fluxo de Navegação
4. O que mudou / foi adicionado recentemente
5. Modelo de Negócio Atual (o que já está implementado)
6. Roadmap / Em desenvolvimento

---

## 1. Visão Geral

### O que é a Maya

A Maya é um **aplicativo pessoal de bem-estar e crescimento pessoal**, que funciona no celular (instalável como se fosse um app nativo) e reúne, em um só lugar, o acompanhamento de hábitos, metas, finanças, sono, alimentação, leitura, atividade física e um diário pessoal — tudo acompanhado por uma **companheira virtual chamada Maya**, que conversa, percebe padrões nos dados e dá toques gentis e personalizados.

Em uma frase: **a Maya é uma companheira de bem-estar que ajuda a pessoa a se conhecer melhor, manter rotinas saudáveis e perseguir suas metas com constância e equilíbrio.**

### A proposta de valor central

A maioria das pessoas tem seus dados de vida espalhados (app de sono, app de dieta, planilha de metas, caderno de gratidão...) e não consegue enxergar **como uma coisa afeta a outra** (ex.: dormir mal afeta o humor e os gastos). A Maya une tudo isso e, com uma camada de inteligência, transforma dados em **conversa, reconhecimento e direção**:

- Ela percebe o que está acontecendo (ex.: "seu sono caiu nos últimos dias", "sua meta está parada").
- Ela acolhe e celebra, sem julgamento e sem cobrança.
- Ela sugere o próximo passo concreto, conectando o dia a dia aos objetivos de longo prazo.

### Para quem é

Pessoas (adultos) que querem cuidar melhor de si mesmas, criar rotinas e perseguir objetivos pessoais — mas que não têm tempo ou constância para isso. O público-alvo é **falante de português e espanhol**, em qualquer país (não é um app focado em um país específico).

### Posicionamento (importante para a copy)

- A Maya se posiciona como **bem-estar e crescimento pessoal** — **NÃO** como "saúde mental", e **não** é um serviço de terapia.
- **Evitar na comunicação:** palavras como "terapia", "diagnóstico", "tratamento", "psicólogo", "transtorno". A Maya é uma companheira de bem-estar, não uma profissional de saúde.
- **Foco em idioma, não em país:** o produto é pensado para quem fala português e espanhol, independentemente de onde mora (Brasil, Guatemala, Chile, EUA, etc.).
- A linguagem da Maya é **calorosa, acolhedora, leve e sem julgamento**. Ela nunca diz "você deve" ou "você precisa"; ela observa e sugere ("ideias, não obrigação").

### A "persona" da Maya

A Maya é a figura central do app. Ela:

- Tem um avatar próprio e aparece em destaque na tela inicial.
- Dá uma mensagem pessoal todos os dias, baseada em como o usuário está.
- Faz "toques" proativos (lembretes gentis) quando percebe algo importante.
- Conversa em texto (com envio de fotos), conhecendo o histórico e as metas da pessoa.
- **Aprende e lembra** fatos sobre o usuário ("tem uma filha chamada Sofia", "está estudando para concurso") e os reutiliza para ser mais pessoal.
- Ajusta o tom ao horário do dia (manhã, tarde, noite).

### A transformação que o app propõe

- **Antes:** dados espalhados, metas esquecidas, hábitos abandonados, sensação de estar "no piloto automático", sem enxergar o próprio progresso.
- **Depois:** uma visão unificada de si mesmo, metas com plano concreto, rotinas leves que se sustentam, reconhecimento dos próprios esforços e uma companheira que lembra o "porquê" de tudo.

### Plataforma

A Maya é uma **PWA** (aplicativo web progressivo): abre pelo navegador e pode ser **instalada na tela inicial do celular**, funcionando como um app nativo (ícone próprio, tela cheia, notificações, funcionamento offline). Não está nas lojas de aplicativos ainda — isso é planejado para depois.

### Idiomas

A Maya fala **3 idiomas**: Português, Espanhol e Inglês. O usuário escolhe o idioma no início e pode trocar depois.

---

## 2. Módulos e Funcionalidades

Esta seção descreve **todos** os módulos do app, em linguagem de produto. (A ordem reflete como eles aparecem no produto.)

### 2.1 A Maya (a companheira de IA)

#### Mensagem do dia (na tela inicial)
Todos os dias, ao abrir o app, a Maya aparece com uma **mensagem curta e pessoal** gerada para aquele dia. Ela celebra se o usuário dormiu bem e fez o check-in, acolhe se o dia foi difícil, ou cumprimenta se ainda não registrou nada. O clima visual da tela muda conforme o estado (celebração, cuidado ou saudação). É gerada **no máximo 1x por dia**.

#### Toque proativo ("nudge")
A Maya pode aparecer com um **lembrete gentil** de 1–2 frases apontando algo que os dados detectaram: "seu check-in está em risco de quebrar hoje", "dormiu mal nos últimos dias", "sua meta está parada", "tem tarefas da semana pendentes". Ela sugere uma ação (ir ao check-in, registrar refeição, escrever no diário). Máximo 1 por dia, liberado a partir de um horário razoável (não incomoda cedo), e não aparece se o usuário já conversou com ela naquele dia.

#### Lista de cuidados ("O que cuidar nos próximos dias")
Um card na home com **até 3 sugestões priorizadas de autocuidado**, calculadas por regras sobre os dados (ex.: sono em queda, humor baixo, meta parada). Cada item tem ícone, título, descrição e pode levar a uma ação. Atualiza na hora quando o usuário registra algo.

#### Conversa com a Maya (chat)
O coração do app. Uma conversa estilo mensageiro (como WhatsApp) onde o usuário conversa com a Maya sobre finanças, rotina, dias difíceis, metas — e pode **enviar fotos**. Ela responde com contexto do histórico, entende o ritmo da conversa (horário/data das mensagens) e, durante a conversa, **aprende fatos novos** sobre a pessoa.

#### Memórias
A Maya guarda **fatos pessoais** que aprende (na conversa, ou adicionados manualmente) e os reutiliza em todas as respostas para ser mais pessoal. Ex.: "gosta de caminhar à noite", "tem uma filha chamada Sofia".

#### Companheira de planejamento (Maya estrategista)
Ao planejar a semana, a Maya atua como conselheira: analisa o plano da semana, compara com a semana anterior, cruza com metas trimestrais, visões de longo prazo, diário e conversas recentes, e devolve um pacote estruturado — saudação, uma **opinião estratégica** (apontando o que a pessoa não está vendo), sugestões de prioridades da semana e sugestões de tarefas por área (marcadas como "manutenção" = hábito, ou "crescimento" = coisa nova).

> **O que usa IA:** a mensagem do dia, o toque proativo, o chat, a extração de memórias e a companheira de planejamento. Todos esses textos são gerados por IA e exigem **assinatura ativa**. (A lista de cuidados e os "sinais" são cálculo de regras sobre os dados, não geram texto.)

---

### 2.2 Check-in diário (o ritual de registro)

O **check-in** é o ritual central do app — o momento em que o usuário registra como está o dia, respondendo uma pergunta por tela, com barra de progresso no topo:

1. **Como se sente** — escolhe "chips" de emoção (positivas em um tom, negativas em outro) e pode escrever um texto livre.
2. **Água** — quantos copos bebeu (cada copo = 250 ml; a meta padrão é 4 copos = 1 litro).
3. **Sono** — se ainda não registrou, informa a que horas deitou/acordou e avalia a qualidade (1 a 5). Pode pular.
4. **Hábitos individuais** — responde Sim/Não a cada hábito habilitado (tomou remédio, conversou com alguém, fez algo criativo, leu, fez algo prazeroso, etc.).
5. **Meditação / respiração** — marca se meditou, orou (só se a pessoa indicou fé) ou respirou.
6. **Exercício** — marca se caminhou, correu, fez musculação.
7. **Gratidão** — escreve pelo que é grato e pode anexar fotos.
8. **Pensamentos** (opcional) — uma pergunta delicada sobre pensamentos difíceis. Se responder "sim", o app mostra na hora um acolhimento e o contato do CVV (188).
9. **Conclusão** — confirmação.

O check-in pode ser **editado depois** (até 7 dias; depois disso vira somente leitura, com um aviso de que a memória do humor é de curto prazo).

**Detalhe importante:** o check-in é **inteligente** — alguns hábitos são marcados automaticamente a partir de outros módulos: se o usuário registrou uma refeição, o "comi bem" se preenche; se registrou sono, "dormi bem"; se leu, "li"; se correu, "corri"; se concluiu tarefas ligadas a metas, "trabalhei nas minhas metas".

Também existe a **reflexão diária de metas** dentro do check-in: para cada meta ativa, o usuário indica "avançou / parcial / não", e a Maya reage com uma frase pronta de incentivo, mostrando a sequência (🔥) de cada meta.

---

### 2.3 Metas

O sistema de metas é uma "cascata" que conecta o longo prazo ao dia a dia. Glossário:

- **Meta** — um objetivo numa área da vida, de dois tipos: **"Destino"** (tem fim definido) ou **"Direção"** (contínuo, sem fim). Pode estar ativa, pausada, concluída ou arquivada. **Máximo de 5 metas ativas.**
- **Etapa** — um passo intermediário dentro da meta. Concluir etapas move o progresso (a meta tem um % calculado pelas etapas concluídas).
- **Ação** — um item ainda menor, dentro de uma etapa.
- **"Por que importa"** — a motivação emocional da meta, escrita pelo usuário.
- **Guardião / Recompensa / Punição** — compromissos opcionais: uma pessoa que cobra, uma recompensa se cumprir, uma punição se abandonar.
- **Motor** — hábitos recorrentes ligados à meta (ex.: "beber 2L de água", diário/semanal/mensal), para mantê-la viva no dia a dia.

**Criar meta** é um assistente em 3 passos (título + área + "por que importa" → tipo → primeira etapa + compromissos opcionais).

**Coach de metas (chat):** o usuário pode conversar com a Maya especificamente sobre suas metas. Ela recebe o contexto completo (progresso, "porquês", compromissos, prazos), celebra avanços, cobra metas paradas com carinho, ajuda a desbloquear e detecta metas inativas há 14+ dias.

---

### 2.4 OKRs trimestrais e Planejamento semanal

#### Ciclo trimestral (OKRs)
Um ciclo de 3 meses (ex.: "T3 2026") com um tema opcional. Dentro dele ficam os **resultados-chave** — cada um com uma medida (%, quantidade, kg, minutos, km ou R$), um valor atual e um valor-alvo. O progresso do trimestre é a média dos resultados. **Só pode existir um ciclo ativo por vez** (criar um novo fecha o anterior automaticamente). Quando o valor atual atinge o alvo, o resultado é concluído automaticamente. Ao fechar um ciclo, há uma **revisão** (nota, maior vitória, aprendizado e o que levar para o próximo).

#### Plano semanal (o "Hub da semana")
O planejamento de uma semana (segunda a domingo) com tarefas distribuídas por dia e por área. Elementos:

- **Pedras de foco** — até 3 prioridades principais da semana (I, II e III), o que "faz a semana valer a pena".
- **Tarefas** — por dia e horário, cada uma com uma área e tipo (**manutenção** = hábito/rotina, ou **crescimento** = coisa nova).
- **Indicador de carga** do dia (leve/médio/cheio/pesado).
- **Revisão semanal** — maior vitória, o que travou, aprendizado e nota (1–5).

Tem dois modos: **Visualizar** (o painel da semana) e **Planejar** (o assistente com a Maya, descrito em 2.1).

---

### 2.5 Roda da Vida

Um **gráfico circular com as 8 áreas da vida** (saúde, carreira, finanças, relacionamentos, desenvolvimento pessoal, família, lazer, espiritualidade), mostrando o que foi **planejado vs. concluído** em cada área na semana. Tem um botão de **compartilhar** que gera uma imagem bonita (com a roda e as prioridades da semana) para o usuário postar nas redes sociais. É a peça visual mais "compartilhável" do app.

> **Nota de escopo:** no lançamento, a Roda da Vida (que mede o volume planejado da semana) é uma coisa, e os hábitos do check-in são outra — não estão misturados.

---

### 2.6 Finanças

Controle financeiro pessoal:

- **Transações** (despesas e receitas) registradas manualmente (tipo, valor, categoria, subcategoria, descrição, data).
- **Registro por foto:** o usuário fotografa um recibo, nota, extrato ou fatura, e a IA **lê a imagem** e devolve as transações já pré-preenchidas para o usuário conferir e salvar.
- **Orçamento** por categoria/subcategoria, com limites mensais e opção de recorrência ("só este mês", "repetir por N meses", "para sempre").
- **Categorias próprias** com nome, emoji, cor e subcategorias (sem quebrar o histórico ao excluir — só oculta).
- **Múltiplas moedas** (Real, Dólar, Euro, Libra, Peso argentino, Peso chileno, Peso mexicano).

**O que mostra:** saldo do mês, totais de receitas/despesas, gráfico de tendência de 6 meses, gasto por categoria, status do orçamento (com alerta visual ao estourar) e **metas financeiras** (que se conectam ao sistema de metas do app).

> A análise de foto de recibo usa IA e exige assinatura ativa.

---

### 2.7 Nutrição / Refeições

- **Registrar refeição:** o usuário fotografa o prato (até 3 fotos) ou descreve em texto. A IA identifica os alimentos, estima **calorias, carboidratos, proteínas e gorduras**, classifica a refeição (equilibrada, pouca proteína, alto açúcar, etc.) e destaca **benefícios** dos alimentos.
- **Visões de Dia, Semana e Mês** com resumo de calorias, meta diária, distribuição de macros e uma **nota de qualidade (0–100)**.
- **Dicas personalizadas** que cruzam alimentação com sono e cansaço dos check-ins.
- **Correlação comida × humor/sono** (ex.: "nos dias em que você come mais proteína, sua energia é maior").
- **Relatórios semanal e mensal** (variedade alimentar, lacunas de nutrientes, sugestões — com botão para mandar itens à lista de compras).
- **Chat da nutricionista virtual** — conversa com contexto das últimas 30 refeições.

> Análise de foto, análise por texto e o chat usam IA e exigem assinatura ativa.

---

### 2.8 Sono

- **Registro manual:** hora de deitar, hora de acordar, qualidade (1–5), quantas vezes acordou, observação.
- **Registro passivo (automático):** o app tenta detectar o sono sozinho, sem pedir permissão de sensor (usando sinais do navegador, como quando o celular para de carregar à noite).
- **Configuração** de horário habitual e lembrete noturno; a "meta de sono" é calculada automaticamente.
- **Calculadora de ciclos de sono** (horários ideais para acordar).
- **O que mostra:** resumo semanal (duração média, qualidade, consistência 0–100), melhor noite, gráfico de tendência de 30 dias e uma **análise do "especialista do sono"** (resumo + pontos fortes, preocupações e padrões).

---

### 2.9 Leitura

- **Estante de livros** organizada em "Lendo", "Quero ler", "Concluídos" e "Abandonados" (título, autor, emoji de capa, gênero, páginas).
- **Registro de leitura** manual (páginas/minutos) ou por **cronômetro** (modo foco, que continua contando mesmo fora do app).
- **Meta diária** de leitura (páginas ou minutos).
- **Estatísticas:** sequência de dias, progresso do livro (%), resumo da semana e do mês.

---

### 2.10 Corrida

- **Rastreamento de corrida com GPS em tempo real:** o usuário aperta "iniciar", vê o trajeto sendo desenhado no mapa e acompanha tempo, distância e ritmo.
- A corrida **sobrevive a fechar o app** (é restaurada ao voltar).
- **Compartilhar:** gera uma imagem pronta para stories com o mapa do trajeto e as estatísticas (distância, tempo, ritmo médio, velocidade máxima).
- Histórico de corridas com detalhes.

---

### 2.11 Diário

- **Diário livre:** escrever à vontade, com humor (5 emoções), fotos, e atalhos de texto (inserir horário, emoji, foto, ou **link para outro registro**).
- **Diário de evolução:** um roteiro guiado com **6 perguntas de reflexão**.
- **Privacidade:** PIN de 4 dígitos para trancar o diário.
- **Rascunho automático** (o que está escrito é salvo a cada 10s e restaurado se sair sem concluir).
- Histórico organizado por mês, com indicadores visuais dos dias com registro.

---

### 2.12 Porquês

Os **"porquês"** são as razões profundas que movem a pessoa — o "norte" emocional (ex.: "porque quero ter saúde para acompanhar meus filhos"). O usuário escreve até **5 porquês**, cada um com texto e foto opcional. Um cartão **"Meu porquê"** aparece na home e gira automaticamente (a cada 30 minutos), mantendo a motivação presente.

---

### 2.13 Reflexões geradas por IA ("espelho" e "retrato")

- **Espelho da semana:** um texto de 3–5 parágrafos na voz do app, conectando padrões da semana (check-ins, refeições, diário). Tom acolhedor, sem julgamento. Existe **de domingo a quarta-feira** (reflete a semana que acabou).
- **Retrato mensal:** um texto honesto de 1–2 parágrafos sobre os últimos 30 dias, **anti-exagero** (se há poucos dados, diz que ainda é cedo; não força narrativa de transformação). Gerado 1x por mês.

---

### 2.14 Comunidade ⚠️ (construída, mas temporariamente desativada)

A comunidade existe por completo no produto, mas está **temporariamente desligada** (as telas levam de volta ao início). O que ela faz quando ativada:

- **Feed social anônimo** de apoio e inspiração, com posts em 4 categorias: **vitória, dica, reflexão, gratidão**.
- Publicação **anônima por padrão** (nome gerado como "Anônimo+4 dígitos"), com emoji de avatar opcional.
- **Curtir, comentar, denunciar** e perfil público.
- **"Me inspira":** a Maya (IA) escolhe 3 posts que combinam com o **momento emocional** da pessoa (lendo o humor recente), com botões "👍 ajudou / 👎 não ajudou".

> **Para a equipe de marketing:** a comunidade está desativada — **não prometer** como recurso disponível hoje. É um diferencial futuro.

---

### 2.15 Compras (lista de compras)

Listas de compras com nome e emoji (🛒 🍎 🏠), itens com quantidade, preço estimado e prioridade, barra de progresso, total estimado, reordenação por arrastar e modo de seleção em lote. Integra com a nutrição (mandar alimentos sugeridos para a lista).

---

### 2.16 Agenda

Agenda de tarefas e compromissos, com prioridade, horário, repetição, área e **vínculo a metas**. Concluir um item ligado a uma meta atualiza o check-in automaticamente ("trabalhei nas minhas metas" = sim). É o item **"Plano"** da barra de navegação.

---

### 2.17 Análise (a tela de "Insights")

O painel de indicadores do app, com **dois grandes blocos** e filtros de período (semana/mês/trimestre):

**Bem-estar 🌿**
- Score de bem-estar (0–100) com evolução em relação ao período anterior.
- Cinco áreas em destaque: **sono, humor, foco, movimento e pausa** (meditação/oração/respiração).
- Resumos de nutrição, movimento, pausa e leitura.
- Linha do tempo de humor (um emoji por dia) e mapa de calor de consistência.
- **Fatores de impacto:** os hábitos que mais "puxam" o bem-estar para cima ou para baixo.

**Crescimento pessoal 📈**
- **Nota de crescimento (0–100)**, média de 4 pilares: **Metas, OKRs, Equilíbrio e Ritmo**.
- Resumo de metas, progresso de OKRs, resumo financeiro, Roda da Vida (equilíbrio entre as 8 áreas) e gráfico do ritmo semanal.

> A tela de análise em si é toda calculada sobre os dados (não gera texto). Existe também uma análise **narrativa** gerada por IA (texto na voz da Maya lendo check-ins, diário e memórias), que exige assinatura ativa.

---

### 2.18 Especialistas (análises temáticas)

Além das telas, o app tem um sistema de **8 análises temáticas** geradas por IA em segundo plano, cada uma "lendo" os dados correspondentes e devolvendo **padrões, pontos fortes, preocupações e um resumo**:

1. Bem-estar emocional
2. Sono
3. Nutrição
4. Saúde física
5. Metas / produtividade
6. Finanças
7. Espiritualidade / conexão
8. Filosofia de vida / propósito

Essas análises aparecem em cards específicos (ex.: o card do "especialista do sono" na tela de sono) e são atualizadas automaticamente quando o usuário registra dados.

---

### 2.19 Conquistas, Jardim e Sequência

- **Conquistas:** medalhas/ícones desbloqueados automaticamente por marcos (dias de constância, totais).
- **Jardim:** uma planta que "cresce" conforme a sequência de dias seguidos (broto → planta → flores → jardim florido → lendário), mostrando também as conquistas.
- **Sequência e níveis:** o número de dias consecutivos (🔥) e o nível do usuário (Iniciante → Bronze → Prata → Ouro → Diamante → Lendário).

---

### 2.20 Visões de 5 anos

O usuário define uma **frase de visão** para cada área da vida (o "norte" de longo prazo). Essas visões alimentam o planejamento estratégico da Maya (conectando as sugestões da semana aos objetivos de 5 anos).

---

### 2.21 Perfil, Configurações e Admin

**Perfil:** foto, nome, e-mail, gênero, idioma, notificações (ativar/testar), instalar o app, alterar senha, o cartão "Meu plano" (status da assinatura) e sair. Salva automaticamente.

**Configurações:** as mesmas 4 perguntas de contexto do onboarding (usa medicação? tem fé? hobby criativo? quer acompanhar pensamentos difíceis?), que definem quais perguntas aparecem no check-in.

**Admin (só para administradores):** estatísticas internas (usuários, ativos, posts, check-ins, diários, uso de mapas) e moderação de denúncias.

---

## 3. Telas e Fluxo de Navegação

### Fluxo do zero ao uso

1. **Landing** (página de apresentação) → botões "Começar" (cadastro) e "Já tenho conta" (login).
2. **Cadastro** (e-mail + senha) ou **Login**.
3. **Onboarding** — 14 etapas (detalhado abaixo).
4. Ao concluir: **começa o teste grátis de 7 dias** (sem cartão) e o usuário cai no **Painel**.
5. No painel, a **barra inferior** dá acesso a tudo.
6. Ao fim do teste: o usuário é levado ao **Paywall** para assinar.

### Onboarding (14 etapas, na ordem)

1. **Boas-vindas + idioma** (Português / Español / English).
2. **Objetivo** (escolha única entre 7: sono, leveza, alimentação, metas, dinheiro, movimento, equilíbrio).
3. **Dores** ("o que mais te atrapalha", seleção múltipla).
4. **Prova social** (3 depoimentos com nome e idade).
5. **Cartões estilo "swipe"** (4 frases para concordar ou dispensar).
6. **Solução personalizada** (mostra, para cada dor escolhida, como a Maya resolve).
7. **Comparação "Com Maya × Sem Maya"** (tabela de benefícios).
8. **Áreas de interesse** (seleção múltipla, exige pelo menos uma).
9. **Sobre você** (gênero + 4 perguntas de contexto que ajustam o check-in).
10. **Processamento** (tela animada de preparação).
11. **Demonstração do check-in** (o usuário faz um check-in real: copos de água + 6 hábitos).
12. **Celebração** (mostra o que foi registrado).
13. **Notificações** (pede para ativar).
14. **Instalar o app** (PWA).

### Barra de navegação (5 itens)

1. **Início** (o painel/dashboard)
2. **Maya** (o chat com a companheira) — com pontinho de aviso quando há novidade dela
3. **Análise** (a tela de insights)
4. **Plano** (a agenda)
5. **Perfil**

> Há um item **"Comunidade"** que está desativado/oculto (previsto para voltar).

### Telas principais (além da barra)

- **Início (painel):** mensagem da Maya, resumo do dia, lista de cuidados, atalhos para módulos, os últimos dias, botão de check-in, progresso de hoje, carrossel de convites e evolução de 14 dias.
- **Check-in:** o ritual descrito em 2.2.
- **Histórico:** todos os check-ins por mês, com detalhe/edição de dias passados.
- **Metas:** painel em cascata + coach.
- **Planejamento (Hub da semana):** Roda da Vida, métricas, pedras de foco, tarefas.
- **Finanças, Nutrição, Sono, Leitura, Corrida, Diário, Porquês, Compras, Agenda, Análise:** conforme descrito na seção 2.
- **Assinar (Paywall):** a tela de assinatura.

> **Experiências em tela cheia** (a barra inferior some): novo diário, check-in, coach de metas, registrar nutrição/finanças, histórico de check-in, chat da Maya, leitor de leitura, cronômetro de leitura.

---

## 4. O que mudou / foi adicionado recentemente

As mudanças recentes, agrupadas por tema:

### 4.1 Tradução completa do app (PT / ES / EN)
O app inteiro foi **traduzido para 3 idiomas** — um esforço grande, feito em dezenas de frentes: landing, cadastro/login, onboarding, paywall, dashboard, check-in, histórico, análise, planejamento, metas, agenda, finanças, nutrição, sono, leitura, corrida, diário, porquês, compras, comunidade, perfil, configurações, admin e chat. O idioma é escolhido no onboarding e pode ser trocado no perfil.

### 4.2 Sistema de cobrança e assinatura (Stripe)
- **Teste grátis de 7 dias sem cartão**, iniciado automaticamente ao terminar o onboarding.
- **Checkout de pagamento** (planos mensal e anual), **portal de cobrança** (gerenciar/cancelar/atualizar cartão) e **sincronização automática de status** (pagamento concluído, falha de cobrança, cancelamento).
- **Paywall inteligente** que muda a mensagem conforme a situação: novo usuário, teste expirado, pagamento pendente ou cancelado.
- **Bloqueio de acesso** para quem não tem assinatura ativa (após o teste).
- **Preço adaptativo à moeda do cartão** (o cliente paga na moeda local; o app recebe em reais).
- **Paywall localizado por país:** quem está no Brasil vê os preços em reais; quem está fora vê em dólar (detecção automática).

### 4.3 Melhorias na Maya (a companheira)
- **Noção de tempo e agenda** nas conversas (ela entende o ritmo das mensagens).
- **Continuidade no planejamento** (ela conecta o plano da semana ao contexto geral).

### 4.4 Melhorias na Agenda
Várias melhorias de usabilidade e performance: indicador do horário atual, conclusão de compromissos que cruzam a meia-noite, carregamento instantâneo ao navegar entre dias, cabeçalho fixo com rolagem automática para o horário atual, e correção de espaçamentos.

### 4.5 Melhorias em Metas e Planejamento
Polimento do hub de metas (confirmações, edição/exclusão de resultados), dicas de ajuda, e formulário de resultados mais inteligente (alvo dinâmico por unidade).

### 4.6 Performance e experiência
- Retorno instantâneo à tela inicial (cache).
- Carregamento mais rápido dos dados da home.
- Correção de data local em finanças (evitava bug no iOS).

---

## 5. Modelo de Negócio Atual (o que já está implementado)

### Modelo
A Maya é um **app por assinatura**, com **teste grátis de 7 dias sem cartão de crédito**. Depois do teste, o acesso ao app é **bloqueado** até a pessoa assinar. Não há versão "gratuita para sempre" — o teste gratuito é a porta de entrada, e depois o usuário paga.

### Preços
- **No Brasil (exibido em reais):**
  - Mensal: **R$ 49,90/mês**
  - Anual: **R$ 399,90/ano** (≈ R$ 33,33/mês, com selo "economize")
- **Fora do Brasil (exibido em dólar, como referência):**
  - Mensal: **US$ 9,99/mês**
  - Anual: **US$ 79,99/ano** (≈ US$ 6,67/mês)

### Cobrança
- Assinatura **recorrente**, cancelável a qualquer momento.
- **Preço adaptativo:** cada cartão é cobrado na **moeda local do cliente** (peso chileno, quetzal, dólar, peso mexicano...), e o app **recebe em reais** (conta no Brasil). Isso elimina falhas de "moeda não suportada" para usuários da América Latina.
- O paywall detecta automaticamente se o usuário está no Brasil (mostra R$) ou fora (mostra US$).

### O que acontece em cada situação
- **Novo usuário:** termina o onboarding → teste de 7 dias começa sozinho → usa tudo.
- **Durante o teste:** um banner discreto mostra quantos dias restam.
- **Teste expira:** o app redireciona ao paywall com a mensagem "teste expirado"; até assinar, o acesso fica bloqueado.
- **Pagamento pendente** (falha de cobrança): o paywall pede para **atualizar o pagamento** (vai ao portal de cobrança).
- **Cancelado:** o paywall convida a **reativar**.

### Ciclo de vida do cliente
1. Cadastro → onboarding (14 etapas) → teste grátis de 7 dias (sem cartão) → uso pleno.
2. Fim do teste → paywall → assinatura (mensal ou anual).
3. Gestão da assinatura pelo portal (atualizar cartão, cancelar, reativar).

### Sobre o custo da IA
O principal custo variável do app é a **inteligência artificial** (geração de texto e análise de fotos), que é o coração do produto. O preço da assinatura foi calibrado para cobrir esse custo com margem saudável.

---

## 6. Roadmap / Em desenvolvimento

O que está planejado (não prometer como disponível hoje):

### 6.1 Comunidade
A comunidade (feed anônimo de apoio e inspiração) está **pronta no código, mas desativada**. O plano é **reativá-la quando houver usuários ativos suficientes** para o feed não parecer vazio.

### 6.2 Memória de longo prazo da Maya
Hoje a Maya já guarda "fatos" e memórias, mas o plano é **evoluir a memória de longo prazo** (resumos por período), para que ela se torne cada vez mais pessoal e coerente ao longo de meses/anos. É uma prioridade futura.

### 6.3 Aplicativo nativo (lojas)
Hoje a Maya é instalável como PWA (pelo navegador). O plano é **publicar nas lojas (App Store e Google Play)** depois dos primeiros usuários pagantes, empacotando o mesmo app de forma nativa.

### 6.4 Evolução contínua
- Ajustes de preço e margem conforme o aprendizado de mercado.
- Expansão do planejamento e da Roda da Vida (mantendo a separação entre "volume planejado" e "hábitos diários").

---

## Resumo rápido para a equipe de conteúdo

- **O que é:** um app de bem-estar e crescimento pessoal com uma companheira de IA chamada Maya.
- **Público:** falantes de português e espanhol, em qualquer país.
- **Posicionamento:** bem-estar e crescimento pessoal — **não** é saúde mental/terapia.
- **Modelo:** assinatura com 7 dias grátis (sem cartão); R$ 49,90/mês ou R$ 399,90/ano (Brasil); US$ 9,99 / US$ 79,99 (referência fora).
- **Diferencial:** une todos os dados da vida em um só lugar + uma IA que percebe padrões, acolhe e dá direção.
- **Recurso visual compartilhável:** a Roda da Vida (imagem para redes sociais).
- **O que NÃO prometer hoje:** a comunidade (desativada) e o app nas lojas (futuro).
