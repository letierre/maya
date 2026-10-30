import { t as tFn, type Lang } from "@/lib/i18n";

// ── Narração em blocos da Maya ────────────────────────────────────────────
// Em vez de um roteiro contínuo, a sessão é uma playlist de blocos curtos
// (~15–30s), cada um com seu instante de início. Blocos sensoriais são
// compartilhados (cache global); só o que cita a meta é personalizado.

export type NarrationKind = "meditation" | "visualization";

export interface NarrationBlockSpec {
  key: string; // id estável (parte do caminho de cache)
  text: string; // texto resolvido p/ TTS
  atSec: number; // instante de início dentro da sessão (s)
  personalized: boolean; // true = por-meta (visualização), false = compartilhado
}

export interface VisualizationGoal {
  title: string;
  why_it_matters: string;
  reward?: string | null;
}

// ── Cadência (ajustável) ────────────────────────────────────────────────
const GAP = 65; // silêncio entre blocos do meio (s)
const FIRST_BODY_AT = 35; // primeiro bloco do meio (s)
const CLOSING_GAP = 40; // fechamento começa N segundos antes do fim
const MAX_BLOCK_SEC = 30; // teto de duração de um bloco (p/ encaixar antes do fim)

// Pool sensorial da meditação (compartilhado entre as 4 práticas).
const MEDITATION_SENSORY = [
  "mdb_sense_listen",
  "mdb_sense_body",
  "mdb_sense_temperature",
  "mdb_sense_air",
  "mdb_sense_breath",
  "mdb_sense_letgo",
  "mdb_sense_ground",
  "mdb_sense_presence",
  "mdb_sense_gratitude",
  "mdb_sense_softness",
];

// Pool sensorial da visualização (compartilhado entre metas — não cita o texto da meta).
const VISUALIZATION_SENSORY = [
  "vib_sense_see",
  "vib_sense_hear",
  "vib_sense_smell",
  "vib_sense_feel",
  "vib_sense_body",
  "vib_sense_pride",
  "vib_sense_lightness",
  "vib_sense_stay",
];

const MEDITATION_INTRO: Record<string, string> = {
  breath: "mdb_intro_breath",
  body: "mdb_intro_body",
  kindness: "mdb_intro_bondade",
  gratitude: "mdb_intro_gratidao",
};

/** Nº de blocos do meio que cabem entre startSec e closingAt, com GAP entre eles. */
function blocksFitting(startSec: number, closingAt: number): number {
  const span = closingAt - startSec;
  if (span <= 0) return 1;
  return Math.max(1, Math.floor((span - MAX_BLOCK_SEC) / GAP) + 1);
}

export function buildNarration(opts: {
  kind: NarrationKind;
  practiceKey?: string;
  goal?: VisualizationGoal;
  durationSec: number;
  lang: Lang;
}): NarrationBlockSpec[] {
  const { kind, practiceKey, goal, durationSec, lang } = opts;
  const blocks: NarrationBlockSpec[] = [];
  const closingAt = Math.max(durationSec - CLOSING_GAP, FIRST_BODY_AT + MAX_BLOCK_SEC);

  if (kind === "meditation") {
    const introKey = MEDITATION_INTRO[practiceKey ?? "breath"] ?? MEDITATION_INTRO.breath;
    blocks.push({ key: introKey, text: tFn(lang, introKey), atSec: 0, personalized: false });

    const n = blocksFitting(FIRST_BODY_AT, closingAt);
    for (let i = 0; i < n; i++) {
      const key = MEDITATION_SENSORY[i % MEDITATION_SENSORY.length];
      blocks.push({ key, text: tFn(lang, key), atSec: FIRST_BODY_AT + i * GAP, personalized: false });
    }

    blocks.push({ key: "mdb_closing", text: tFn(lang, "mdb_closing"), atSec: closingAt, personalized: false });
  } else {
    // Visualização: blocos personalizados perto do início, depois os sensoriais.
    const title = (goal?.title || "").trim();
    const why = (goal?.why_it_matters || "").trim();
    const reward = (goal?.reward || "").trim();
    const shortWhy = why.length > 220 ? `${why.slice(0, 220)}...` : why;

    blocks.push({ key: "vib_intro", text: tFn(lang, "vib_intro", { title }), atSec: 0, personalized: true });
    if (shortWhy) {
      blocks.push({ key: "vib_porque", text: tFn(lang, "vib_porque", { why: shortWhy }), atSec: 35, personalized: true });
    }
    if (reward) {
      blocks.push({ key: "vib_recompensa", text: tFn(lang, "vib_recompensa", { reward }), atSec: 70, personalized: true });
    }

    const bodyStart = reward ? 105 : shortWhy ? 70 : 35;
    const n = blocksFitting(bodyStart, closingAt);
    for (let i = 0; i < n; i++) {
      const key = VISUALIZATION_SENSORY[i % VISUALIZATION_SENSORY.length];
      blocks.push({ key, text: tFn(lang, key), atSec: bodyStart + i * GAP, personalized: false });
    }

    blocks.push({ key: "vib_outro", text: tFn(lang, "vib_outro"), atSec: closingAt, personalized: false });
  }

  return blocks;
}
