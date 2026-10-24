# Maya Adaptativa — Perfil de Comportamento (persona)

> Documento de desenho. Nada aqui foi implementado ainda — serve para fechar a
> visão, revisar junto e só então começar a codar.

## 1. Conceito e visão

A Maya conhece o usuário em **duas camadas**:

- **Fatos** (memória atual): eventos, contextos, "o que aconteceu". *(já existe)*
- **Comportamento** (nova camada): padrões de "como a pessoa é e funciona".

A memória já sabe *que* você tem uma meta de corrida ou *que* contou estar
ansioso. Falta a Maya saber *como você funciona*: "costuma vir toda noite",
"começa metas com força mas larga quando o sono piora", "quando está triste,
some".

**Objetivo:** tornar a comunicação **proativa** da Maya (abertura do chat, home,
push, recordatórios) personalizada pelo comportamento — para que ela pareça uma
amiga de verdade: nota a ausência, entende *por que* uma meta travou, e fala
sobre o que a pessoa de fato se importa.

**Princípio central:** afinidade é uma **LENTE, não um FILTRO**. O sinal de
saúde continua disparando — mas é entregue *através* daquilo que o usuário gosta.
Ex.: usuário que ama o diário e dorme mal → em vez de trocar o diário pelo sono,
a Maya diz *"você dormiu mal, quer despejar isso no diário antes de dormir?"*.

## 2. Princípios / guardrails (inabaláveis)

- **Comportamento > aspiração.** O que a pessoa *faz* pesa mais do que o que ela
  *diz* no onboarding ("quero correr" vs. "na prática, só escreve no diário").
- **Zero vigilância, zero culpa.** Ficar fora é normal. Nunca "detectei que você
  sumiu"; no máximo "fazia uns dias que você não vinha".
- **Nunca usar o perfil como chantagem ou rótulo.** O perfil escolhe e veste o
  que a Maya fala; nunca é usado *contra* a pessoa.
- **Só notar ausência de quem já tem ritmo.** Usuário novo não tem "padrão" ainda
  (baseline: ~7 dias distintos de atividade).
- **Cooldown.** Um toque por ausência, depois silêncio respeitoso.
- **Tom de amiga.** Quente, feminino, sem aridez (ver §10 — polir depois).

## 3. Estado atual (não reconstruir)

- **Memória:** fatos + compilação L3 + recall por gatilho (fases 0–5 concluídas).
- **Sinais:** `computeSignals` (care + nudge + plan) — já detecta diário parado,
  check-in não feito, meta estagnada, etc.
- **Superfícies (vozes):** chat (`/api/maya`), home (`buildHomeMessagePrompt`),
  push proativo (`buildProactivePrompt` + cron), nudge (`/api/maya/nudge`),
  planejamento.
- **Dados com timestamp:** `app_events` (aberturas), `chat_messages`,
  `check_ins`, `diary_entries`, `goals`, `user_memories`.

Nada disso olha hoje para o **ritmo da pessoa COM a Maya** — é a lacuna.

## 4. Perfil de comportamento (persona)

Composto por campos **determinísticos** (SQL + agregação, sem LLM na v1),
guardado em `user_preferences.context.maya_persona` (mesmo padrão do
`maya_nudge`), recalculado pelo cron proativo.

| Campo | Fonte | Descrição |
|---|---|---|
| `cadence` | `chat_messages` | intervalo mediano entre dias de conversa → "diário / dias alternados / semanal" |
| `usual_window` | `chat_messages` + `app_events` | manhã / tarde / noite (se houver sinal claro) |
| `last_active_days` | `chat_messages` | dias desde a última conversa |
| `engagement` | check-in, diário, reza/meditação, exercício, metas, refeição, sono | quais features usa **e volta a usar**, com constância |
| `topics` | memória + chat | temas de afinidade: relacionamento, fé, trabalho, saúde… |
| `blockers` | cruzamento memória × metas × sinais | padrões que travam metas ("sono ruim → meta parada", "ansiedade → isolamento") |

**Peso:** comportamento (engajamento real) > aspiração (onboarding/porquês).

## 5. Superfícies (vozes) e regras

| Superfície | Papel da persona | Registro |
|---|---|---|
| **Chat — abertura** | notar gap + puxar fato recente relevante | 1ª mensagem, 1–2 frases |
| **Chat — conversa** | **intocada** (dirigida pelo usuário, adapta sozinha) | livre |
| **Home** (saudação + nudge) | tema e tom nascidos da afinidade | 1–3 frases |
| **Push proativo** ("Maya puxa conversa") | tema = o que o usuário se importa; ausência → toque gentil | 1 frase |
| **Recordatórios** (check-in, refeição, sono, agenda) | **filtra quais mandar** (não o texto) | funcional |

### Abertura do chat (o gatilho do usuário)
- Quando `last_active_days > 2`, a abertura **nota o gap** e puxa um fato recente
  relevante: *"fazia uns dias que você não vinha… como foi essa semana? aquela
  conversa que você estava tenso, aconteceu?"* — com cuidado, sem interrogatório.
- Os dados já existem (timestamps "há 3 dias" no histórico). O trabalho é tornar
  isso **intencional** (regra no prompt), não deixar ao acaso.

### Recordatórios (anti-spam)
A persona decide **quais** notificações mandar: quem nunca registra refeição não
recebe lembrete de refeição; quem ama o diário recebe lembrete de diário.
Resultado: **mandar menos, mandar melhor**.

## 6. O ciclo virtuoso

```
comportamento → persona mais fina → comunicação mais natural
     ↑                                       ↓
mais dado ← mais engajamento ←  pergunta/abertura menos genérica
```

## 7. Fases

- **A (MVP):** perfil determinístico + aplicar em abertura do chat + home + push
  proativo + **filtro de recordatórios**.
- **B:** janela por horário ("você costuma vir de manhã, hoje apareceu à noite,
  aconteceu algo?"), desvio de check-in/humor.
- **C:** ausência cruzada com humor (saiu porque estava mal → tom diferente).

## 8. Custos de LLM

- Perfil determinístico → **zero LLM**.
- Usar o perfil → +poucas centenas de tokens de *entrada* em chamadas que **já
  acontecem** (marginal no Haiku).
- *(Opcional)* resumo narrativo da persona → 1 job periódico pequeno (como o L3).
- Recordatórios filtrados → **menos** chamadas de nudge/push.
- **Net: desprezível, possivelmente negativo.**

## 9. Riscos

- **Bolha de afinidade** → mitigado pela regra "lente, não filtro" (a saúde entra
  pela afinidade, não some).
- **Sensação de vigilância** → mitigado pelo tom (cuidado, não monitoramento) e
  pelo baseline/cooldown.
- **Aspiração ≠ comportamento** → mitigado pelo peso do comportamento.
- **Prompt longo demais** → o perfil é curto e estruturado, não narrativo.

## 10. Polimentos futuros

- **Voz feminina/quente:** a Maya hoje soa um pouco seca/neutra (comunicação mais
  masculina). Lapidar o tom para soar como uma mulher próxima — item separado,
  depois desta feature.

## 11. Decisões fechadas

1. **Fase A inclui o filtro de recordatórios** — junto com home + push + abertura.
2. **Chamar de volta pode ser push** — o push proativo também serve para notar a
   ausência (toque gentil, com cooldown).
3. **Limite de ausência relativo** — ausência = `2 ×` o intervalo habitual da
   pessoa (não um número fixo de dias).
