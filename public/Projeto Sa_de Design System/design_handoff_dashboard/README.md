# Handoff — Dashboard "Atmospheric" Redesign

## Overview

Redesign completo da **tela inicial** (`src/app/(auth)/dashboard/page.tsx`) do app Projeto Saúde. A tela atual passa sensação de "amador" porque os recursos estão simplesmente empilhados em `<Card>` shadcn padrão, sem hierarquia visual ou impacto. Esta nova versão troca todos os cards genéricos por uma composição **atmosférica**: gradiente vertical sutil percorrendo toda a tela, blocos visuais distintos (Maya como bloco de presença, sequência com marca-d'água, fio da semana como linha do tempo conectada), e tipografia grande carregando o peso visual.

Público-alvo: 22–40 anos. Esta direção foi escolhida porque **passa profissionalismo sem ficar gendered, frio ou hospitalar**.

## About the design files

Os arquivos em `references/` são **referências visuais em HTML/JSX** — protótipos que mostram o look-and-feel intencional, **não** código de produção pra copiar diretamente. A tarefa é **recriar este design dentro do codebase existente** (`projeto-saude/`), reaproveitando os tokens OKLCH em `src/app/globals.css`, ícones `lucide-react`, e o sistema i18n em `src/lib/i18n.ts`.

Abra `references/Dashboard Explorations.html` num browser pra ver o resultado final (Variante B — Atmosférico).

## Fidelity

**High-fidelity (hifi).** Cores, tipografia, espaçamento, gradientes e interações estão finais. Reproduza pixel-perfect.

---

## Architecture

A página atual mistura tudo em um único arquivo de ~280 linhas com vários componentes `Card`-based importados. O redesign **mantém os componentes lógicos** (StreakBadge, MoodChart, MayaNudge, PorqueCard, etc) mas reescreve a **composição visual** da página dashboard. Em vez de cada componente ser um `<Card>`, todos viram **seções flow** com tipografia + divisores.

**Estratégia recomendada:** reescrever `src/app/(auth)/dashboard/page.tsx` inteiro, descartando o uso atual de `<Card>` ali dentro. Os componentes existentes (`<MayaNudge>`, `<PorqueCard>`, `<DayThread>`, `<MoodChart>`, `<Testemunha>`, `<MonthlyPortrait>`, `<NutritionMiniCard>`) podem **continuar existindo nos seus arquivos atuais**, mas o dashboard os ignora — ele constrói uma nova composição inline.

Se preferir manter modular, criar:
- `src/components/dashboard/AtmosphericBackground.tsx` — wrapper com o gradiente
- `src/components/dashboard/MayaPresence.tsx` — bloco de presença da Maya
- `src/components/dashboard/FioSemana.tsx` — linha do tempo dos 7 dias
- `src/components/dashboard/Evolucao.tsx` — sparkline de 14 dias
- `src/components/dashboard/UltimosCheckins.tsx` — lista editorial dos últimos check-ins
- E reutilizar `<Progresso>` (já criado em handoff anterior)

---

## Layout — order of sections

```
┌─────────────────────────────────────────┐
│ [floating ⋯ kebab top-right]           │
│                                         │
│ BOA TARDE                               │
│ Ana                          (38px hero)│
│ DOM · 17 MAI              (mono small)  │
│                                         │
│ ┌─ MAYA PRESENCE BLOCK ────────────┐   │
│ │ [avatar 56px] MAYA · AGORA       │   │
│ │               [quote 16px]       │   │
│ │  [Conversar com Maya →] button   │   │
│ └──────────────────────────────────┘   │
│                                         │
│ MEU PORQUÊ                              │
│ [photo 92px] "Pela Sofia..."           │
│              • • •  (rotation dots)    │
│                                         │
│ SUA SEQUÊNCIA      Ouro · 16d até Diam │
│ 14 dias consecutivos   [14 watermark]  │
│ ████ ████ ████ ████ ░░░░ ░░░░          │
│                                         │
│ CUIDADOS DE HOJE                  55%  │
│ 6 / 11                                  │
│ 💧Água  😴Sono  🧘Pausa  ...           │
│                                         │
│ O FIO DA SEMANA                         │
│ ● seg  😴  5/10        3ref · 1820kcal │
│ │                                       │
│ ● ter  😵  4/10        2ref · 1240kcal │
│ │                                       │
│ ● ... (7 dias com fio conectando)      │
│                                         │
│ EVOLUÇÃO       Média 6.4/10 · subindo  │
│ [sparkline 14 dias com gradient fill]  │
│                                         │
│ ▮ SÓ PRA VOCÊ SABER                    │
│   Teve um dia difícil esta semana... → │
│ ───────────────────────────────────────│
│ ▮ SEU RETRATO DO MÊS                   │
│   Maya preparou um novo reflexo...   → │
│ ───────────────────────────────────────│
│ [83🟢] NUTRIÇÃO                        │
│        1 420 kcal · 3 refeições     →  │
│                                         │
│ ÚLTIMOS CHECK-INS         Ver todos →  │
│ 17 mai  DOM   Cansada mas em paz...   │
│ ──────────────────────────────────────  │
│ 16 mai  SÁB   Foi um dia bom...       │
│ ──────────────────────────────────────  │
│ ...                                     │
└─────────────────────────────────────────┘
```

---

## Background — atmospheric gradient

Wrapper do dashboard **inteiro** (substitui o `<div className="space-y-6">` atual):

```tsx
<div
  className="relative min-h-screen"
  style={{
    background: `
      radial-gradient(ellipse 80% 50% at 20% 0%, oklch(.95 .04 80 / .55) 0%, transparent 50%),
      radial-gradient(ellipse 100% 60% at 100% 100%, oklch(.85 .07 160 / .35) 0%, transparent 60%),
      linear-gradient(180deg, oklch(.98 .005 160) 0%, oklch(.94 .025 160) 100%)
    `,
  }}
>
  {/* … */}
</div>
```

Os dois `radial-gradient` criam um halo cream-âmbar no topo esquerdo e um halo verde-claro no rodapé direito. O `linear-gradient` vertical une tudo. Resultado: a tela **toda** tem cor, sem ficar cansativo.

---

## 1. Header (greeting) — remover "Diário" + broto

**O que muda:**
- Atualmente: `<h1>{t("ola")}</h1>` (`text-2xl font-bold`)
- Agora: greeting eyebrow ("BOA TARDE") **em uppercase muted** + nome do usuário em hero (36px bold) + data em mono pequeno

```tsx
<div className="px-6 pt-6 pb-2">
  <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
    {greetingTimeOfDay()} {/* "Bom dia" / "Boa tarde" / "Boa noite" */}
  </p>
  <h1 className="mt-1 text-[36px] font-bold tracking-tight leading-[1.05]">
    {firstName}
  </h1>
  <p className="mt-1 font-mono text-[11px] text-muted-foreground uppercase">
    {todayDisplay} {/* "DOM · 17 MAI" */}
  </p>
</div>
```

**Botão kebab flutuante** (no canto superior direito, posicionado absoluto):
```tsx
<button
  className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/55 backdrop-blur-md
             border-0 flex items-center justify-center shadow-sm cursor-pointer"
>
  <MoreVertical className="w-4 h-4" />
</button>
```

**Função helper para greeting:**
```tsx
function greetingTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
```

**Data display:** atualmente é `new Date().toLocaleDateString("pt-BR", { weekday, day, month })` produzindo "domingo, 17 de maio". Trocar pra:
```tsx
const d = new Date();
const wk = d.toLocaleDateString("pt-BR", { weekday: "short" }).toUpperCase().replace(".", "");
const dn = d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).toUpperCase().replace(".", "");
setTodayDisplay(`${wk} · ${dn}`); // "DOM · 17 MAI"
```

---

## 2. Maya Presence Block

Substitui o `<MayaNudge>` atual quando ele aparece no dashboard.

```tsx
<div className="mx-4 mt-3.5">
  <div className="relative rounded-[22px] overflow-hidden border p-5"
       style={{
         background: 'linear-gradient(135deg, oklch(.5 .12 160 / .08) 0%, oklch(.5 .12 160 / .02) 100%)',
         borderColor: 'oklch(.5 .12 160 / .15)',
       }}>
    {/* Anéis decorativos */}
    <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full border"
         style={{ borderColor: 'oklch(.5 .12 160 / .12)' }} />
    <div className="absolute -right-5 -top-5 w-30 h-30 rounded-full border"
         style={{ borderColor: 'oklch(.5 .12 160 / .08)' }} />

    <div className="relative flex gap-3.5 items-start">
      <span className="w-14 h-14 rounded-full overflow-hidden flex-none border-2 border-white shadow-lg">
        <Image src="/maya.png" alt="" width={56} height={56} className="object-cover" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10.5px] font-bold tracking-wider uppercase text-primary m-0">
          Maya · agora há pouco
        </p>
        <p className="mt-1.5 text-base leading-[1.4] font-medium tracking-tight">
          {mayaNudgeText}
        </p>
      </div>
    </div>

    <Button className="mt-3.5 w-full h-9.5 rounded-xl text-[13px] font-semibold gap-1.5"
            onClick={() => router.push('/insights')}>
      Conversar com Maya
      <ArrowRight className="w-3.5 h-3.5" />
    </Button>
  </div>
</div>
```

**Onde tá o `mayaNudgeText`:** o componente `MayaNudge.tsx` atual chama `/api/maya/nudge`. Manter essa lógica, mas extrair o texto e exibir no novo formato. Ou puxar pelo próprio dashboard via `useEffect`.

---

## 3. Meu Porquê

Substitui o `<PorqueCard>` atual. **Sem card** — só foto + frase em itálico + dots de rotação.

```tsx
<Section label="Meu Porquê">
  <div className="grid grid-cols-[92px_1fr] gap-3.5 items-center py-1">
    <div className="w-23 h-23 rounded-2xl overflow-hidden shadow-md
                    bg-gradient-to-br from-pink-200 to-pink-50
                    flex items-center justify-center">
      {photoUrl ? (
        <Image src={photoUrl} alt="" width={92} height={92} className="object-cover" />
      ) : (
        <UserIcon className="w-11 h-11 text-rose-400/60" />
      )}
    </div>
    <div>
      <p className="text-base italic font-medium leading-[1.4] tracking-tight m-0">
        &ldquo;{currentPorque.text}&rdquo;
      </p>
      <div className="flex gap-1.5 mt-2.5">
        {porques.map((_, i) => (
          <span key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: i === currentIdx ? 'var(--primary)' : 'oklch(.5 .12 160 / .25)' }}
          />
        ))}
      </div>
    </div>
  </div>
</Section>
```

**`Section` helper:**
```tsx
function Section({ label, extra, children, className = '' }: {
  label: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-6 pt-7 relative ${className}`}>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-[11px] font-bold tracking-[.12em] uppercase text-muted-foreground">
          {label}
        </span>
        {extra && <span className="text-[11px] text-muted-foreground">{extra}</span>}
      </div>
      {children}
    </div>
  );
}
```

---

## 4. Sequência (Streak) — com marca d'água

Substitui o `<StreakBadge>` atual.

```tsx
<Section label="Sua sequência" extra={`${tierName} · ${daysToNext} dias até ${nextTierName}`}>
  {/* Marca d'água: o número da sequência em gigante, atrás */}
  <div
    className="absolute top-[-8px] right-[-4px] text-[96px] font-extrabold leading-none
               tracking-[-0.04em] tabular-nums select-none pointer-events-none"
    style={{ color: 'oklch(.5 .12 160 / .06)' }}
  >
    {streak}
  </div>

  <div className="relative -mt-1">
    <div className="flex items-baseline gap-2">
      <span className="text-[42px] font-bold tracking-[-0.03em] text-primary leading-none tabular-nums">
        {streak}
      </span>
      <span className="text-sm font-medium">dias consecutivos</span>
    </div>

    {/* Mini tier ladder — 6 segmentos */}
    <div className="flex gap-1 mt-3.5">
      {TIERS.map((t, i) => {
        const reached = i <= curIdx;
        const isCurrent = i === curIdx;
        return (
          <div key={t.rom} className="flex-1 relative">
            <div
              className="h-[5px] rounded-full"
              style={{
                background: reached ? t.color : 'var(--muted)',
                border: isCurrent ? '1px solid oklch(.5 .12 160 / .5)' : 'none',
              }}
            />
            {isCurrent && (
              <div
                className="absolute -top-[2px] -left-[3px] w-2.5 h-2.5 rounded-full bg-primary
                           border-2 border-white shadow-md"
              />
            )}
          </div>
        );
      })}
    </div>
  </div>
</Section>
```

**Tier color palette (mais saturada que a versão anterior):**
```tsx
const TIERS = [
  { rom: 'I',   name: 'tier_iniciante', th: 0,  color: '#e4e4e7' },
  { rom: 'II',  name: 'tier_bronze',    th: 3,  color: '#fde68a' },
  { rom: 'III', name: 'tier_prata',     th: 7,  color: '#cbd5e1' }, // ← prata mais saturada que antes
  { rom: 'IV',  name: 'tier_ouro',      th: 14, color: '#fde047' },
  { rom: 'V',   name: 'tier_diamante',  th: 30, color: '#a5f3fc' },
  { rom: 'VI',  name: 'tier_lendario',  th: 60, color: '#fbbf24' },
];
```

---

## 5. Cuidados de Hoje

Substitui o uso atual de habits no dashboard.

```tsx
<Section label="Cuidados de hoje">
  <div className="flex items-baseline gap-1.5 mb-3.5">
    <span className="text-[36px] font-bold tracking-tight leading-none tabular-nums">
      {positiveCount}
    </span>
    <span className="text-[22px] text-muted-foreground font-normal">/ {totalHabits}</span>
    <span className="ml-auto text-xs font-medium text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
      {Math.round((positiveCount / totalHabits) * 100)}%
    </span>
  </div>
  <div className="flex flex-wrap gap-1.5">
    {completedHabits.map(([emoji, label]) => (
      <span key={label}
            className="px-2.5 py-[5px] rounded-full text-[11.5px] font-medium border bg-white/70
                       inline-flex items-center gap-1">
        {emoji} {label}
      </span>
    ))}
  </div>
</Section>
```

`HABIT_DISPLAY` já existe no arquivo atual.

---

## 6. O Fio da semana

**Componente novo.** Substitui o uso de `<DayThread>` no dashboard (mantém o componente atual pra outras telas se ainda usado).

Visualmente: linha vertical fina conectando 7 dias da semana, cada dia mostra emoji de sono + energia + refeições/calorias inline. Hoje destacado com aura no nó.

Ver `references/AtmosphericDashboard.jsx` — função `FioSemana` (linhas ~240–290) para implementação completa de referência.

Dados precisam:
- `dia` da semana abreviado (seg/ter/qua/...)
- `energy` (1-10)
- `sleep` (boolean)
- `meals` (count)
- `kcal` (number)
- `today` (boolean)

Buscar de check-ins existentes filtrados pelos últimos 7 dias.

---

## 7. Evolução (sparkline)

Substitui o `<MoodChart>` atual. Sparkline minimalista de 14 dias.

Ver `references/AtmosphericDashboard.jsx` — função `MoodSpark` (linhas ~295–330). Implementação:

```tsx
function Evolucao({ data }: { data: number[] }) {
  const W = 320, H = 100, P = 4;
  const max = 10, min = 0;
  const xStep = (W - P * 2) / (data.length - 1);
  const points = data.map((v, i) => {
    const x = P + i * xStep;
    const y = P + (H - P * 2) * (1 - (v - min) / (max - min));
    return [x, y];
  });
  const line = points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ');
  const fill = `${line} L ${points[points.length-1][0]} ${H} L ${points[0][0]} ${H} Z`;
  const last = points[points.length-1];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" preserveAspectRatio="none">
        <defs>
          <linearGradient id="msFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(.5 .12 160)" stopOpacity=".22" />
            <stop offset="100%" stopColor="oklch(.5 .12 160)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={P} x2={W - P} y1={H/2} y2={H/2}
              stroke="oklch(.5 .12 160 / .08)" strokeDasharray="2 4" />
        <path d={fill} fill="url(#msFill)" />
        <path d={line} fill="none" stroke="oklch(.5 .12 160)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="4" fill="#fff"
                stroke="oklch(.5 .12 160)" strokeWidth="2" />
      </svg>
      <div className="flex justify-between mt-1 text-[10px] text-muted-foreground font-mono">
        <span>{dateLabels[0]}</span>
        <span>{dateLabels[1]}</span>
        <span>{dateLabels[2]}</span>
      </div>
    </div>
  );
}
```

---

## 8. Reflexivas — Testemunha & Retrato & Nutrição

Substitui os componentes `<Testemunha>`, `<MonthlyPortrait>`, `<NutritionMiniCard>` quando aparecem no dashboard. Tratamento **soft row** com barra vertical de accent.

```tsx
function SoftRow({ accent, accentText, tag, body, onClick }: SoftRowProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 py-3.5 border-b text-left
                 hover:bg-white/30 transition-colors"
      style={{ borderColor: 'oklch(.5 .12 160 / .12)' }}
    >
      <span className="w-1 h-8 rounded-full flex-none mt-0.5"
            style={{ background: accent }} />
      <div className="flex-1 min-w-0">
        <p className="text-[10.5px] font-bold tracking-[.08em] uppercase m-0"
           style={{ color: accentText }}>
          {tag}
        </p>
        <p className="mt-1 text-sm leading-[1.5]">{body}</p>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-none mt-1" />
    </button>
  );
}
```

Uso:
```tsx
<div className="px-6 pt-8">
  <SoftRow
    accent="#f43f5e" accentText="#be123c"
    tag="Só pra você saber"
    body={<>Teve um dia difícil esta semana. Você registrou. <span className="text-muted-foreground">Isso importa.</span></>}
    onClick={() => router.push('/diario/evolucao')}
  />
  <SoftRow
    accent="#f59e0b" accentText="#b45309"
    tag="Seu retrato do mês"
    body="Maya preparou um novo reflexo dos seus últimos 30 dias."
    onClick={() => router.push('/diario')}
  />

  {/* Nutrição: tratamento especial — ring + número */}
  <button className="w-full flex items-center gap-3.5 py-4 text-left"
          onClick={() => router.push('/nutricao')}>
    <NutritionRing score={83} />
    <div className="flex-1 min-w-0">
      <p className="text-[10.5px] font-bold tracking-[.08em] uppercase text-muted-foreground m-0">
        Nutrição
      </p>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className="text-xl font-bold tracking-tight leading-none tabular-nums">1 420</span>
        <span className="text-xs text-muted-foreground">kcal · 3 refeições</span>
      </div>
    </div>
    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
  </button>
</div>
```

`<NutritionRing>` é um SVG circular com `strokeDasharray`. Ver referência (linhas ~390–410 do JSX).

---

## 9. Últimos check-ins

**Componente novo.** Substitui ou complementa qualquer listagem de histórico que aparece no dashboard.

```tsx
<Section label="Últimos check-ins" extra={<a href="/historico" className="text-primary">Ver todos →</a>}>
  <div>
    {recentCheckins.slice(0, 5).map((it, i) => (
      <div key={it.id} className="grid grid-cols-[52px_1fr] py-3 items-baseline"
           style={{ borderTop: i === 0 ? 'none' : '1px solid oklch(.5 .12 160 / .1)' }}>
        <div>
          <div className="text-[13px] font-semibold leading-none tabular-nums">
            {formatDayMonth(it.date)} {/* "17 mai" */}
          </div>
          <div className="text-[9.5px] font-semibold tracking-wider uppercase text-muted-foreground mt-0.5">
            {formatWeekday(it.date)} {/* "DOM" */}
          </div>
        </div>
        <p className="m-0 text-[13px] leading-[1.45]"
           style={{
             color: it.note ? undefined : 'var(--muted-foreground)',
             fontStyle: it.note ? 'normal' : 'italic',
           }}>
          {it.note || '—'}
        </p>
      </div>
    ))}
  </div>
</Section>
```

`recentCheckins` = os últimos 5 `checkIns` ordenados por data desc, com a `note` (campo de texto livre do check-in).

---

## Tokens & spacing

- **Background gradient:** ver seção "Background" acima
- **Section padding:** `px-6 pt-7` (a primeira seção depois do greeting tem `pt-7`)
- **Eyebrow label:** `text-[11px] font-bold tracking-[.12em] uppercase text-muted-foreground`
- **Extra label (right):** `text-[11px] text-muted-foreground`
- **Number hero:** `text-[36px] font-bold tracking-tight leading-none tabular-nums`
- **Number total/divisor:** `text-[22px] text-muted-foreground font-normal`
- **Body:** `text-sm leading-[1.5]`
- **Quote (Meu Porquê):** `text-base italic font-medium leading-[1.4] tracking-tight`
- **Divisor padrão:** `border-color: oklch(.5 .12 160 / .12)` (verde da marca a 12% — não usar `var(--border)` cinza)
- **White surfaces:** `bg-white/70` para chips, `bg-white/55 backdrop-blur-md` para botão kebab

---

## Components to deprecate (do dashboard apenas)

Esses componentes continuam existindo no codebase pra outras telas, mas **não são mais importados no dashboard**:

- `<Card>`, `<CardContent>`, `<CardHeader>`, `<CardTitle>` (shadcn) — substituídos por `<Section>` + `<SoftRow>`
- `<StreakBadge>` — substituído pela seção "Sua sequência" inline
- `<GardenView>` / `<StatsView>` — já removidos do dashboard no handoff anterior, agora confirmado fora
- `<MoodChart>` — substituído por `<Evolucao>` (sparkline novo)
- `<DayThread>` — substituído por `<FioSemana>` (novo, com fio vertical)

Mantidos como fonte de lógica/dados (mas o JSX é reescrito inline):
- `<MayaNudge>` → fonte do `mayaNudgeText`
- `<PorqueCard>` → fonte do array de porquês + foto
- `<Testemunha>` → fonte do reflexo semanal
- `<MonthlyPortrait>` → fonte do retrato mensal
- `<NutritionMiniCard>` → fonte do score / calorias / refeições
- `<Progresso>` → já reescrito no handoff anterior

---

## Implementation order

1. **Wrapper + background gradient** — começar substituindo `<div className="space-y-6">` pelo novo div com gradient inline
2. **Header (greeting)** — Eyebrow + nome + data + kebab flutuante. Remover o ícone broto e "Diário"
3. **Section helper + Maya Presence Block** — entrega visual imediata
4. **Meu Porquê + Sequência + Cuidados** — as três seções mais densas; usar `<Section>`
5. **Fio da semana** — componente novo
6. **Evolução** — sparkline SVG
7. **Reflexivas (SoftRow + NutritionRing)** — três rows
8. **Últimos check-ins** — lista editorial final

Testar incrementalmente, fazendo merge por etapa.

---

## Testes manuais

- [ ] Greeting muda com a hora (Bom dia 0-12h, Boa tarde 12-18h, Boa noite 18-24h)
- [ ] Streak 0 → barra toda cinza, tier "Iniciante", sem mostrar "X dias até..."
- [ ] Streak 60+ → todos 6 segmentos coloridos, sem texto de próximo tier
- [ ] Fio da semana: dia atual sempre tem aura no nó; dias futuros (se sábado/dom no início da semana) ficam vazios ou ocultos
- [ ] Sparkline com <2 pontos: esconder o card ou mostrar mensagem
- [ ] Últimos check-ins: lidar com check-in sem `note` (mostra "—" em itálico)
- [ ] Dark mode: o gradient atmosférico **não foi desenhado pra dark mode** — flag pro fundador antes de implementar
- [ ] Mobile-only: o design é portrait 390×844 (iPhone). Não otimizado pra tablet ainda

---

## Caveats

- **Dark mode não foi desenhado.** Os gradientes e cores branco-translúcidas (`bg-white/70`, `bg-white/55`) assumem fundo claro. Combinar com o fundador antes de implementar dark.
- **Fontes:** o JSX de referência usa `var(--font-sans)` e `var(--font-mono)` — confirma que esses já estão definidos em `globals.css` do projeto. Se não, mapear pras fontes Tailwind padrão.
- **Imagem do Maya:** o arquivo está em `references/Maya.png`. No codebase, ele deve viver em `public/maya.png` (Next.js).
- **`Progresso` component:** o handoff anterior criou `src/components/Progresso.tsx` com 6 chips/Algarismos romanos. Este redesign **NÃO USA ele no dashboard** — usa a barra fina inline em "Sua sequência". O `<Progresso>` continua disponível pra outras telas (ex.: tela de perfil ou de conquistas dedicada).
- **API:** todos os dados continuam vindo dos endpoints existentes (`/api/check-ins`, `/api/preferences`, etc). Nenhuma nova rota é necessária.

---

## Files in `references/`

| Arquivo | O que é |
|---|---|
| `Dashboard Explorations.html` | Canvas comparativo com 2 variantes. Abrir no browser e clicar na **artboard B (Atmosférico)** pra ver o resultado final |
| `AtmosphericDashboard.jsx` | Implementação React completa (JSX puro, não TS, não shadcn) — use como referência de estrutura e medidas. **Não copiar direto** — recriar no codebase usando shadcn/Tailwind |
| `Maya.png` | Avatar da Maya — copiar pra `public/maya.png` |
