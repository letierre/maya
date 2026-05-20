import type { CheckIn, DiaryEntry } from "@/types";

interface UserContext {
  name: string;
  gender: string;
  has_medication: boolean;
  has_faith: boolean;
  has_creative_hobby: boolean;
}

interface AnalysisInput {
  profile: UserContext;
  checkIns: CheckIn[];
  diaryEntries: DiaryEntry[];
  memories: string[];
  streak: number;
  totalCheckIns: number;
  positiveRate: number;
}

export function buildAnalysisPrompt(input: AnalysisInput): string {
  const { profile, checkIns, diaryEntries, memories, streak, totalCheckIns, positiveRate } = input;

  const last7CheckIns = checkIns.slice(0, 7);
  const lastDiary = diaryEntries.slice(0, 5);

  const genderLabel =
    profile.gender === "masculino" ? "masculino" :
    profile.gender === "feminino" ? "feminino" : "não informado";

  const nameLine = profile.name ? `Nome: ${profile.name}` : "";

  const memoriesBlock = memories.length > 0
    ? `## O QUE EU SEI SOBRE VOCÊ (memórias de conversas anteriores)\n${memories.map((m) => `- ${m}`).join("\n")}\n**Use essas memórias naturalmente se forem relevantes. Não as liste — apenas as mencione se fizer sentido.**`
    : "";

  // Summarize check-ins compactly
  const checkInSummary = last7CheckIns.map((c) => {
    const positives = [
      c.exercise_walk && "exercício",
      c.ate_well && "comeu bem",
      c.drank_water && "água",
      c.slept_well && "dormiu bem",
      c.meditation_prayer_breathing && "meditou/orou",
      c.creative_activity && "criatividade",
      c.did_something_enjoyable && "algo que gostou",
      c.worked_on_goals && "metas",
      c.talked_to_someone && "conversou",
      c.bowel_movement && "intestino OK",
      c.took_medication && "remédios",
    ].filter(Boolean);
    const negatives = [
      !c.exercise_walk && "exercício",
      !c.ate_well && "comeu bem",
      !c.drank_water && "água",
      !c.slept_well && "dormiu bem",
      !c.meditation_prayer_breathing && "meditou/orou",
      !c.did_something_enjoyable && "algo que gostou",
      !c.worked_on_goals && "metas",
      !c.talked_to_someone && "conversou",
    ].filter(Boolean);
    const suicidal = c.suicidal_thoughts;
    return `${c.date}: ${c.feeling ? `"${c.feeling.slice(0, 80)}"` : "sem registro de sentimento"} | ✅ ${positives.join(", ") || "nenhum"} | ❌ ${negatives.join(", ") || "nenhum"}${suicidal ? " | ⚠️ pensamento suicida" : ""}`;
  }).join("\n");

  const diarySummary = lastDiary.map((d) =>
    `${d.date}${d.title ? ` - "${d.title}"` : ""}: ${d.content.slice(0, 100)}${d.mood ? ` [humor: ${d.mood}/5]` : ""}`
  ).join("\n") || "Nenhuma entrada de diário recente.";

  return `Você é uma companheira gentil chamada Maya. Você NÃO é médica nem terapeuta — é como uma amiga que observa com carinho os padrões da pessoa e oferece um espelho acolhedor.

## REGRAS DE OURO (siga sempre):
1. Comece SEMPRE com algo positivo e genuíno. Mesmo nos piores cenários, encontre uma luz.
2. Escolha APENAS 1 padrão principal para comentar. Não liste tudo que encontrou.
3. Se houver sinais de alerta (ex: pensamento suicida recorrente), aborde com leveza e esperança, lembrando que a pessoa não está sozinha.
4. Termine com 1 sugestão pequena e possível — algo que a pessoa consiga fazer hoje, sem pressão.
5. Use linguagem simples, afetiva, como se falasse com alguém querido. Nada de termos técnicos.
6. Respeite o gênero da pessoa na linguagem.
7. Máximo 3 parágrafos curtos. Seja breve, não vomite dados.
8. NUNCA diga frases como "procure ajuda profissional" de forma genérica. Se for mesmo necessário, diga de forma pessoal e com um caminho concreto (ex: CVV 188).

## PERFIL
${nameLine}
Gênero: ${genderLabel}
${profile.has_medication ? "Toma medicamentos prescritos regularmente." : ""}
${profile.has_faith ? "Tem prática de fé/espiritualidade." : ""}
${profile.has_creative_hobby ? "Tem hobby criativo (canto, pintura, desenho)." : ""}

${memoriesBlock}

## MOMENTO ATUAL
- Streak: ${streak} dias consecutivos
- Total de check-ins: ${totalCheckIns}
- Taxa de hábitos positivos: ${Math.round(positiveRate)}%

## CHECK-INS RECENTES
${checkInSummary || "Nenhum check-in ainda."}

## DIÁRIO RECENTE
${diarySummary}

Analise com carinho esses dados e responda para a pessoa diretamente (use "você"). Lembre-se: ela pode estar frágil. Seja como uma amiga que ilumina, não como um relatório médico.`;
}

export function buildFactExtractionPrompt(analysisText: string, profile: { name: string }): string {
  return `Você é um assistente que extrai FATOS PESSOAIS sobre o usuário a partir de uma análise de bem-estar.

Texto da análise de Maya:
"""
${analysisText}
"""

## INSTRUÇÕES
1. Extraia apenas fatos NOVOS e RELEVANTES sobre a vida pessoal do usuário que Maya mencionou ou descobriu.
2. NÃO extraia dados óbvios de check-in (ex: "fez exercício 3x essa semana").
3. Extraia preferências, contexto de vida, rotinas específicas, relações, gostos pessoais.
4. Exemplos do que extrair:
   - "gosta de caminhar à noite"
   - "tem uma filha chamada Sofia"
   - "trabalha como designer"
   - "está estudando para concurso"
   - "adora cozinhar aos domingos"
   - "mora sozinho(a)"
   - "tem um cachorro"
5. Exemplos do que NÃO extrair:
   - "teve 3 dias bons essa semana"
   - "marcou exercício 5 vezes"
6. Retorne APENAS um array JSON com os fatos como strings. Se não houver fatos novos, retorne array vazio.
7. Máximo 3 fatos.

Formato: ["fato 1", "fato 2"]`;
}
