// AtmosphericDashboard.jsx — Variant B (final): gradient flow + layered presence
// FULL dashboard including Meu Porquê, O Fio da semana, Evolução, Últimos check-ins.

function AtmosphericDashboard() {
  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      fontFamily: 'var(--font-sans)', color: 'var(--foreground)',
      background: `
        radial-gradient(ellipse 80% 50% at 20% 0%, oklch(.95 .04 80 / .55) 0%, transparent 50%),
        radial-gradient(ellipse 100% 60% at 100% 100%, oklch(.85 .07 160 / .35) 0%, transparent 60%),
        linear-gradient(180deg, oklch(.98 .005 160) 0%, oklch(.94 .025 160) 100%)
      `,
      position: 'relative',
    }}>
      {/* Floating kebab — no full header bar anymore */}
      <button style={{
        position: 'absolute', top: 14, right: 16, zIndex: 10,
        width: 36, height: 36, borderRadius: 9999, border: 0, cursor: 'pointer',
        background: 'oklch(1 0 0 / .55)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--foreground)',
        boxShadow: '0 1px 3px oklch(.25 .02 160 / .06)',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.7" strokeLinecap="round">
          <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
        </svg>
      </button>

      {/* GREETING — now top of the page */}
      <div style={{ padding: '22px 24px 8px' }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)', letterSpacing: '.05em', textTransform: 'uppercase', fontWeight: 600 }}>
          Boa tarde
        </p>
        <h1 style={{
          margin: '4px 0 6px',
          fontSize: 36, fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.05,
          color: 'var(--foreground)',
        }}>
          Ana
        </h1>
        <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted-foreground)' }}>
          DOM · 17 MAI
        </p>
      </div>

      {/* ── MAYA PRESENCE BLOCK ──────────────────────────────────── */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{
          position: 'relative', borderRadius: 22, overflow: 'hidden',
          background: 'linear-gradient(135deg, oklch(.5 .12 160 / .08) 0%, oklch(.5 .12 160 / .02) 100%)',
          border: '1px solid oklch(.5 .12 160 / .15)',
          padding: '20px 18px 18px',
        }}>
          {/* Decorative rings */}
          <div style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: 9999, border: '1px solid oklch(.5 .12 160 / .12)' }} />
          <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: 9999, border: '1px solid oklch(.5 .12 160 / .08)' }} />
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative' }}>
            <span style={{
              width: 56, height: 56, borderRadius: 9999, overflow: 'hidden', flex: 'none',
              boxShadow: '0 4px 16px -4px oklch(.25 .02 160 / .3)',
              border: '2px solid #fff',
            }}>
              <img src="assets/Maya.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--primary)' }}>
                Maya · agora há pouco
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 16, lineHeight: 1.4, color: 'var(--foreground)', fontWeight: 500, letterSpacing: '-0.01em' }}>
                Vi que ontem dormiu mal. Quer me contar como você está agora? Sem pressa.
              </p>
            </div>
          </div>
          <button style={{
            marginTop: 14, width: '100%', height: 38, borderRadius: 12,
            background: 'var(--primary)', color: '#fff', border: 0, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600, letterSpacing: '-0.005em',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            Conversar com Maya
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── MEU PORQUÊ ────────────────────────────────────────────── */}
      <Section label="Meu Porquê" pad={28}>
        <div style={{
          display: 'grid', gridTemplateColumns: '92px 1fr', gap: 14, alignItems: 'center',
          padding: '4px 0',
        }}>
          {/* Photo — soft rounded square */}
          <div style={{
            width: 92, height: 92, borderRadius: 16, overflow: 'hidden',
            background: 'linear-gradient(135deg,#fbcfe8,#fdf2f8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px -6px oklch(.25 .02 160 / .15)',
          }}>
            {/* placeholder portrait silhouette */}
            <svg width="46" height="46" viewBox="0 0 24 24" fill="#fb7185" opacity=".6">
              <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
              <path d="M3 21a9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div>
            <p style={{
              margin: 0, fontSize: 16, lineHeight: 1.4, color: 'var(--foreground)',
              fontStyle: 'italic', fontWeight: 500, letterSpacing: '-0.005em',
            }}>
              "Pela Sofia. Pra ela me ver inteira quando crescer."
            </p>
            {/* rotation dots */}
            <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
              <span style={{ width: 6, height: 6, borderRadius: 9999, background: 'var(--primary)' }} />
              <span style={{ width: 6, height: 6, borderRadius: 9999, background: 'oklch(.5 .12 160 / .25)' }} />
              <span style={{ width: 6, height: 6, borderRadius: 9999, background: 'oklch(.5 .12 160 / .25)' }} />
            </div>
          </div>
        </div>
      </Section>

      {/* ── SUA SEQUÊNCIA ───────────────────────────────────────── */}
      <Section label="Sua sequência" pad={28} extra="Ouro · 16 dias até Diamante">
        {/* Watermark */}
        <div style={{
          position: 'absolute', top: -8, right: -4, fontSize: 96, fontWeight: 800,
          color: 'oklch(.5 .12 160 / .06)', lineHeight: 1, letterSpacing: '-0.04em',
          fontVariantNumeric: 'tabular-nums', userSelect: 'none', pointerEvents: 'none',
        }}>14</div>
        <div style={{ position: 'relative', marginTop: -4 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              14
            </span>
            <span style={{ fontSize: 14, color: 'var(--foreground)', fontWeight: 500 }}>dias consecutivos</span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
            {[
              { bg: '#f4f4f5' }, { bg: '#fde68a' }, { bg: '#e4e4e7' },
              { bg: '#fde047', active: true }, { bg: '#a5f3fc' }, { bg: '#fbbf24' },
            ].map((t, i) => (
              <div key={i} style={{ flex: 1, position: 'relative' }}>
                <div style={{
                  height: 5, borderRadius: 9999,
                  background: i < 4 ? t.bg : 'var(--muted)',
                  border: t.active ? '1px solid oklch(.5 .12 160 / .5)' : 'none',
                }} />
                {t.active && (
                  <div style={{
                    position: 'absolute', top: -2, left: -3, width: 11, height: 11,
                    borderRadius: 9999, background: 'var(--primary)', border: '2px solid #fff',
                    boxShadow: '0 2px 6px -1px oklch(.5 .12 160 / .4)',
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── CUIDADOS DE HOJE ────────────────────────────────────── */}
      <Section label="Cuidados de hoje" pad={28}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
          <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--foreground)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>6</span>
          <span style={{ fontSize: 22, color: 'var(--muted-foreground)', fontWeight: 400 }}>/ 11</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 500, color: '#047857', background: '#d1fae5', padding: '4px 10px', borderRadius: 9999 }}>
            55%
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {[['💧','Água'],['😴','Sono'],['🧘','Pausa'],['🗣️','Conversa'],['💊','Remédios'],['🍽️','Comeu bem']].map(([e,l]) => (
            <span key={l} style={{
              padding: '5px 11px', borderRadius: 9999, fontSize: 11.5, fontWeight: 500,
              background: 'oklch(1 0 0 / .7)', color: 'var(--foreground)',
              border: '1px solid var(--border)',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>{e} {l}</span>
          ))}
        </div>
      </Section>

      {/* ── O FIO DA SEMANA ─────────────────────────────────────── */}
      <Section label="O Fio da semana" pad={28}>
        <FioSemana />
      </Section>

      {/* ── EVOLUÇÃO ────────────────────────────────────────────── */}
      <Section label="Evolução" extra="Média 6.4/10 · subindo" pad={28}>
        <MoodSpark />
      </Section>

      {/* ── REFLEXIVAS (Testemunha, Retrato, Nutrição) ──────────── */}
      <div style={{ padding: '32px 24px 0' }}>
        <SoftRow
          accent="#f43f5e"
          tag="Só pra você saber"
          tagColor="#be123c"
          body={<>Teve um dia difícil esta semana. Você registrou. <span style={{ color: 'var(--muted-foreground)' }}>Isso importa.</span></>}
        />
        <SoftRow
          accent="#f59e0b"
          tag="Seu retrato do mês"
          tagColor="#b45309"
          body="Maya preparou um novo reflexo dos seus últimos 30 dias."
        />
        {/* Nutrition */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0 14px' }}>
          <div style={{ width: 42, height: 42, position: 'relative', flex: 'none' }}>
            <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="18" cy="18" r="15" fill="none" stroke="oklch(.25 .02 160 / .12)" strokeWidth="2.5" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="#10b981" strokeWidth="2.5" strokeDasharray="78 94.2" strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#047857' }}>83</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
              Nutrição
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>1 420</span>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>kcal · 3 refeições</span>
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.6" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>

      {/* ── ÚLTIMOS CHECK-INS ───────────────────────────────────── */}
      <Section label="Últimos check-ins" pad={28} extra="Ver todos →">
        <UltimosCheckins />
      </Section>

      <div style={{ height: 90 }} />
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────

function Section({ label, extra, pad = 28, children }) {
  return (
    <div style={{ padding: `${pad}px 24px 0`, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>
          {label}
        </span>
        {extra && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{extra}</span>}
      </div>
      {children}
    </div>
  );
}

function SoftRow({ accent, tag, tagColor, body }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '14px 0', borderBottom: '1px solid oklch(.5 .12 160 / .12)',
    }}>
      <span style={{ width: 4, height: 32, borderRadius: 9999, background: accent, flex: 'none', marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: tagColor }}>
          {tag}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.5, color: 'var(--foreground)' }}>
          {body}
        </p>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.6" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
    </div>
  );
}

// O Fio da semana — 7 days as horizontal compact rows tied by a thin thread
function FioSemana() {
  const days = [
    { d: 'seg', energy: 5, sleep: true,  meals: 3, kcal: 1820 },
    { d: 'ter', energy: 4, sleep: false, meals: 2, kcal: 1240 },
    { d: 'qua', energy: 6, sleep: true,  meals: 3, kcal: 1980 },
    { d: 'qui', energy: 7, sleep: true,  meals: 3, kcal: 2110 },
    { d: 'sex', energy: 5, sleep: false, meals: 2, kcal: 1380 },
    { d: 'sáb', energy: 8, sleep: true,  meals: 3, kcal: 2240 },
    { d: 'dom', energy: 7, sleep: true,  meals: 3, kcal: 1420, today: true },
  ];
  const color = (e) => e >= 7 ? '#059669' : e >= 5 ? '#b45309' : '#dc2626';
  return (
    <div style={{ position: 'relative' }}>
      {/* spine */}
      <div style={{
        position: 'absolute', left: 22, top: 14, bottom: 14, width: 1.5,
        background: 'oklch(.5 .12 160 / .15)',
      }} />
      {days.map((day) => (
        <div key={day.d} style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '8px 0 8px 0', position: 'relative',
          opacity: day.today ? 1 : 0.85,
        }}>
          {/* node */}
          <div style={{
            width: 12, height: 12, borderRadius: 9999, flex: 'none',
            background: day.today ? 'var(--primary)' : '#fff',
            border: `2px solid ${day.today ? 'var(--primary)' : 'oklch(.5 .12 160 / .35)'}`,
            marginLeft: 16, zIndex: 1, position: 'relative',
            boxShadow: day.today ? '0 0 0 4px oklch(.5 .12 160 / .12)' : 'none',
          }} />
          <span style={{
            fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.05em',
            fontWeight: day.today ? 700 : 500, color: day.today ? 'var(--foreground)' : 'var(--muted-foreground)',
            width: 30,
          }}>{day.d}</span>
          <span style={{ fontSize: 14 }}>{day.sleep ? '😴' : '😵'}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: color(day.energy), fontVariantNumeric: 'tabular-nums', width: 32 }}>
            {day.energy}/10
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted-foreground)', fontVariantNumeric: 'tabular-nums' }}>
            {day.meals} ref · {day.kcal} kcal
          </span>
        </div>
      ))}
    </div>
  );
}

// Mood spark — compact line chart
function MoodSpark() {
  // 14 days of energy
  const data = [4, 5, 4, 6, 5, 6, 7, 5, 6, 6, 5, 7, 6, 7];
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
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="msFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(.5 .12 160)" stopOpacity=".22" />
            <stop offset="100%" stopColor="oklch(.5 .12 160)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* baseline midline */}
        <line x1={P} x2={W - P} y1={H/2} y2={H/2} stroke="oklch(.5 .12 160 / .08)" strokeDasharray="2 4" />
        <path d={fill} fill="url(#msFill)" />
        <path d={line} fill="none" stroke="oklch(.5 .12 160)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* last point dot */}
        {points.length > 0 && (
          <circle cx={points[points.length-1][0]} cy={points[points.length-1][1]} r="4"
                  fill="#fff" stroke="oklch(.5 .12 160)" strokeWidth="2" />
        )}
      </svg>
      {/* axis labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)' }}>
        <span>4 mai</span><span>10 mai</span><span>17 mai</span>
      </div>
    </div>
  );
}

function UltimosCheckins() {
  const items = [
    { d: '17 mai', wk: 'dom', txt: 'Cansada mas em paz. Hoje foi um dia normal.' },
    { d: '16 mai', wk: 'sáb', txt: 'Foi um dia bom. Saí pra caminhar e deu certo.' },
    { d: '15 mai', wk: 'sex', txt: 'Difícil. Reunião puxada, fiquei sem fome.' },
    { d: '14 mai', wk: 'qui', txt: 'Acordei melhor. Comecei a ler de novo.' },
    { d: '13 mai', wk: 'qua', txt: '—' },
  ];
  return (
    <div>
      {items.map((it, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '52px 1fr',
          padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid oklch(.5 .12 160 / .1)',
          alignItems: 'baseline',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {it.d.split(' ')[0]}
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginTop: 2 }}>
              {it.wk}
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: it.txt === '—' ? 'var(--muted-foreground)' : 'var(--foreground)', fontStyle: it.txt === '—' ? 'italic' : 'normal' }}>
            {it.txt}
          </p>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { AtmosphericDashboard });
