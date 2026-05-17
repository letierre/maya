export type Lang = "pt" | "es" | "en";

const translations: Record<Lang, Record<string, string>> = {
  pt: {
    // Navegação
    inicio: "Início",
    checkin: "Check-in",
    diario: "Diário",
    historico: "Histórico",
    ajustes: "Ajustes",
    configuracoes: "Configurações",

    // Header
    diario_app: "🌱 Diário",

    // Onboarding
    vamos_conhecer: "Vamos nos conhecer",
    onboarding_subtitle:
      "Algumas perguntas para personalizar seu diário. Suas respostas ajudam a mostrar só o que faz sentido pra você.",
    pergunta_genero: "Qual seu gênero?",
    genero_subtitle_onboarding:
      "Vamos personalizar sua experiência. Depois você pode mudar nas configurações.",
    genero_subtitle_config: "Personaliza o estilo visual do seu dashboard.",
    comecar: "Começar",
    salvando: "Salvando...",
    diario_personalizado: "Diário personalizado! 🌱",

    // Onboarding questions
    q_medicacao: "Você toma medicamentos prescritos regularmente?",
    q_medicacao_desc:
      "Se sim, vamos te lembrar de registrar se tomou os remédios certinho.",
    q_fe: "Você tem alguma prática de fé, espiritualidade ou religião?",
    q_fe_desc:
      "Se sim, a pergunta de meditação incluirá 'oração'. Se não, será apenas meditação e respiração.",
    q_criatividade: "Você costuma cantar, pintar ou desenhar?",
    q_criatividade_desc:
      "Se sim, incluiremos essas opções. Se não, a pergunta será mais geral sobre criatividade e lazer.",
    q_suicida: "Quer incluir a pergunta sobre pensamento suicida?",
    q_suicida_desc:
      "É uma pergunta importante para acompanhar sua segurança. Recomendamos incluir.",

    // Config
    config_title: "Configurações",
    config_subtitle:
      "Suas respostas ajudam a personalizar as perguntas do check-in.",
    preferencias_atualizadas: "Preferências atualizadas! 🌱",

    // Dashboard
    ola: "Olá! 🌱",
    carregando: "Carregando...",
    checkin_hoje_feito: "Check-in de hoje ✅",
    habitos: "hábitos",
    sem_checkin: "Você ainda não fez o check-in de hoje",
    leva_menos_3min: "Leva menos de 3 minutos",
    fazer_checkin: "Fazer check-in",
    editar_checkin: "Editar check-in de hoje",
    como_se_sente: "Como se sente:",
    gratidao: "Gratidão:",
    evolucao: "Evolução",
    ultimos_checkins: "Últimos check-ins",
    nenhum_checkin: "Nenhum check-in ainda. Comece hoje!",

    // Check-in
    checkin_diario: "Check-in diário",
    responda_sinceridade: "Responda com sinceridade — sem julgamentos",
    editando_checkin: "Editando check-in",
    nenhuma_pergunta: "Nenhuma pergunta selecionada.",
    configure_diario: "Configure seu diário",
    respostas_abertas: "Respostas abertas",
    sentimento_label: "Como você está hoje?",
    gratidao_label: "Pelo que você é grato(a) hoje?",
    sentimento_placeholder: "Descreva em uma palavra ou frase...",
    gratidao_placeholder: "Pelo que você é grato(a) hoje?",
    gratidao_momento: "Um momento de gratidão",
    seus_habitos: "Seus hábitos",
    adicionar_foto: "Adicionar foto",
    salvo_automaticamente: "Salvo automaticamente",
    ver_refeicoes: "Ver todas as refeições →",
    cuidados_hoje: "cuidados hoje",
    salvar_checkin: "Salvar check-in",
    atualizar_checkin: "Atualizar check-in",
    checkin_registrado: "Check-in registrado!",
    checkin_atualizado: "Check-in atualizado com sucesso! 🌱",
    desbloqueado: "desbloqueado!",

    // Check-in questions
    q_meditacao_fe: "Separou um momento para si?",
    q_meditacao: "Separou um momento para si?",
    q_criatividade_hobby: "Fez algo criativo ou relaxante?",
    q_criatividade_geral: "Fez algo criativo ou relaxante?",
    q_julgada: "Sentiu-se julgado(a) hoje?",
    q_remedios: "Tomou seus medicamentos?",
    q_conversou: "Conversou com alguém hoje?",
    q_comeu_bem: "Comeu bem hoje",
    q_coco: "Foi ao banheiro normalmente?",
    q_exercicio: "Saiu para caminhar ou se exercitou?",
    q_agua: "Bebeu pelo menos 1L de água?",
    q_dormiu: "Dormiu e descansou bem?",
    q_suicida_label: "Teve pensamentos difíceis hoje?",
    q_gostou: "Fez algo que te deu prazer?",
    q_metas: "Avançou nas suas metas?",

    // Check-in hints
    q_exercicio_hint: "Pequenas vitórias contam muito",
    q_agua_hint: "Hidratação é a base de tudo",
    q_dormiu_hint: "O sono recarrega tudo",
    q_remedios_hint: "Criar esse hábito protege sua saúde",
    q_meditacao_hint: "Meditar, orar ou respirar com atenção",
    q_conversou_hint: "Conexão humana faz bem",
    q_gostou_hint: "Lazer também é saúde",
    q_metas_hint: "Cada passo conta",
    q_criatividade_hint: "Criatividade nutre a alma",
    q_coco_hint: "Um bom funcionamento é sinal de saúde",

    // Streak
    dias_consecutivos: "dias consecutivos",
    comece_hoje: "Comece hoje! 🌱",
    comecando: "Está começando! 🌿",
    constancia: "Constância! 🌳",
    uma_semana: "Uma semana! ⭐",
    incrivel: "Incrível! 💎",
    um_mes: "1 mês! 🏆",
    lendario: "Lendário! 👑",
    faltam_dias: "Faltam",
    para_proximo_marco: "para o próximo marco",

    // Garden
    seu_jardim: "Seu jardim",
    cultiva_jardim: "Cada dia de check-in cultiva seu jardim",
    plante_semente: "Plante sua primeira semente hoje",
    semente_brotando: "Sua semente está brotando...",
    planta_crescendo: "Sua planta está crescendo!",
    flores_aparecendo: "Flores aparecendo!",
    jardim_florido: "Jardim florido!",
    jardim_lendario: "Jardim lendário!",
    dia_consecutivo: "dia consecutivo",
    dias_consecutivos_garden: "dias consecutivos",
    checkin_total: "check-in total",
    checkins_total: "check-ins total",
    desbloquear_conquistas: "Complete check-ins para desbloquear conquistas",

    // Stats
    estatisticas: "⚡ Estatísticas",
    cada_checkin_forte: "Cada check-in te deixa mais forte",
    nivel: "Nível",
    xp_para_nivel: "Faltam {{xp}} XP para o nível {{level}}",
    tier_iniciante: "Iniciante",
    tier_bronze: "Bronze",
    tier_prata: "Prata",
    tier_ouro: "Ouro",
    tier_diamante: "Diamante",
    tier_lendario: "Lendário",
    conquistas: "Conquistas",
    desbloquear_stats: "Complete check-ins para desbloquear",

    // Diário
    diario_title: "Diário",
    diario_subtitle: "Escreva livremente sobre seu dia",
    nova_entrada: "+ Nova",
    nenhuma_entrada: "Nenhuma entrada ainda",
    comece_diario: "Comece seu diário escrevendo sobre hoje",
    escrever_primeira: "Escrever primeira entrada",
    toque_no_mais: "Toque no + para começar",
    sem_conteudo: "Sem conteúdo",
    nova_entrada_title: "Nova entrada",
    como_esta_hoje: "Como você está hoje?",
    titulo_opcional: "Título (opcional)",
    titulo_placeholder: "Dê um título para sua entrada...",
    o_que_escrever: "O que você quer escrever?",
    escrever_placeholder:
      "Escreva livremente sobre seu dia, pensamentos, sentimentos...",
    cancelar: "Cancelar",
    salvar_entrada: "Salvar entrada",
    entrada_salva: "Entrada salva! 📔",
    entrada_atualizada: "Entrada atualizada! 📔",
    entrada_deletada: "Entrada deletada.",
    editar: "Editar",
    deletar: "Deletar",
    voltar: "← Voltar",
    entrada_nao_encontrada: "Entrada não encontrada.",
    voltar_diario: "Voltar ao diário",
    titulo: "Título",
    conteudo: "Conteúdo",
    salvar: "Salvar",
    editando: "Editando",
    confirmar_deletar: "Tem certeza que quer deletar esta entrada?",
    erro_salvar_entrada: "Erro ao salvar.",
    erro_deletar: "Erro ao deletar.",
    escreva_algo: "Escreva algo no diário.",
    erro_salvar: "Erro ao salvar. Tente novamente.",
    erro_buscar: "Erro ao buscar entradas do diário",
    erro_processar: "Erro ao processar conquistas",

    // Mood
    muito_mal: "Muito mal",
    mal: "Mal",
    normal: "Normal",
    bem: "Bem",
    muito_bem: "Muito bem",
    humor_dia: "Humor do dia",

    // Sim/Não
    sim: "Sim",
    nao: "Não",

    // Maya
    maya_subtitle: "Uma companheira para conversar e refletir",
    maya_placeholder: "Escreva sua mensagem...",
    maya_welcome:
      "Oi! Eu sou a Maya, sua companheira virtual 🌸\n\nEstou aqui para te ouvir, conversar e oferecer um olhar acolhedor sobre seu momento. Não sou terapeuta nem médica — sou como uma amiga que te ajuda a refletir.\n\nComo você está hoje?",
    maya_typing: "Maya está escrevendo...",
    maya_error:
      "Tive dificuldade de me conectar agora. Tente novamente em alguns instantes. 💛",

    // CVV
    cvv_warning:
      "Se você está tendo pensamentos suicidas, por favor ligue para o CVV: 188. Você não está sozinho(a). 💚",

    // Nutrição — navegação
    nutricao: "Nutrição",
    registrar_refeicao: "Registrar refeição",

    // Tipos de refeição
    cafe_da_manha: "Café da manhã",
    almoco: "Almoço",
    lanche: "Lanche",
    jantar: "Jantar",
    lanche_noturno: "Lanche noturno",

    // Classificações
    equilibrada: "Equilibrada",
    leve_proteina: "Leve em proteína",
    alta_acucar: "Alta em açúcar",
    alta_gordura: "Alta em gordura",
    vegetais_baixo: "Vegetais / Baixa caloria",
    nao_identificada: "Não identificada",

    // Registro de refeição
    foto_refeicao: "Foto da refeição",
    descrever_refeicao: "Quer descrever o que tem aí?",
    adicionar_sem_foto: "Adicionar refeição sem foto",
    editar_tipo: "Editar tipo",
    selecionar_data_hora: "Data e hora",
    analisando: "Analisando sua refeição...",
    refeicao_salva: "Refeição salva! 🍽️",
    refeicao_atualizada: "Refeição atualizada!",
    refeicao_deletada: "Refeição removida",
    erro_analisar: "Não consegui analisar a foto. Quer descrever manualmente?",
    erro_salvar_refeicao: "Erro ao salvar refeição",
    confirmar_deletar_refeicao: "Remover esta refeição?",

    // Itens
    itens_identificados: "Itens identificados",
    adicionar_item: "Adicionar item",
    remover_item: "Remover",

    // Macros
    macros_estimados: "Macros estimados",
    carboidratos: "Carboidratos",
    proteinas: "Proteínas",
    gorduras: "Gorduras",
    calorias: "Calorias",

    // Resumo diário
    resumo_do_dia: "Resumo do dia",
    resumo_da_semana: "Resumo da semana",
    resumo_do_mes: "Resumo do mês",
    total_calorias: "Total de calorias",
    qualidade_bom: "Bom 🌱",
    qualidade_atencao: "Atenção ⚠️",
    qualidade_sem_dados: "Sem dados",
    refeicoes_hoje: "Refeições de hoje",
    nenhuma_refeicao: "Nenhuma refeição registrada hoje",
    registre_primeira: "Registre sua primeira refeição!",

    // Semanal / Mensal
    visao_semanal: "Visão semanal",
    visao_mensal: "Visão mensal",
    calorias_por_dia: "Calorias por dia",
    padroes_detectados: "Padrões detectados",
    dias: "dias",
    sem_dados_suficientes: "Registre mais refeições para ver padrões.",

    // Estados de análise
    pendente_analise: "Pendente de análise",
    analisado: "Analisado",
    falha_analise: "Falha na análise",

    // Offline / Falha
    sem_internet: "Sem internet. A foto foi salva e será analisada quando a conexão voltar.",
    api_falhou: "Não consegui analisar agora. Você pode registrar manualmente.",
    foto_nao_identificada: "Não consegui identificar bem, quer me contar o que tem aí?",
    escrever_manual: "Descrever manualmente",
    salvar_sem_analise: "Salvar sem análise",

    // Integração check-in
    comeu_bem_auto: "Baseado nas suas {{n}} refeições de hoje",
    registrar_agora: "Registrar agora",

    // Features — O Fio (DayThread)
    fio_titulo: "O fio da semana",
    fio_descricao: "Como os dias se conectam. Setas mostram a direção do fluxo.",
    sem_registro: "sem registro",
    sem_refeicoes_curto: "sem refeições",
    ref_abrev: "ref",
    sono_vespera: "sono da véspera",
    retomou_dia: "retomou depois de um dia sem registros",

    // Features — O Menor Passo (GentleDayCard)
    bom_dia_titulo: "Bom dia",
    corpo_pede_gentileza: "Hoje o corpo pede gentileza",
    dia_de_leveza: "Hoje é dia de leveza",
    ainda_nao_fez_msg: "Ainda não fez o check-in. Se quiser, quando puder. Sem pressa.",
    energia_bem_baixa_msg: "Sua energia está bem baixa hoje. Isso acontece. Seu corpo não está contra você — ele está pedindo cuidado. Hoje, o menor passo já é vitória.",
    energia_meio_baixa_msg: "Energia meio baixa. Dias assim pedem menos exigência e mais gentileza. O que parecer possível, já basta.",
    ideias_nao_obrigacao: "Nenhum desses é obrigação. São ideias. O que você fizer hoje já é suficiente.",

    // Features — A Testemunha (Testemunha)
    so_pra_voce_saber: "Só pra você saber",
    testemunha_hard_days_plural: "Em {{n}} dias desta semana, você não estava bem. E mesmo assim veio aqui. Isso não é hábito. É coragem de se olhar.",
    testemunha_hard_days_single: "Teve um dia difícil esta semana. Você registrou. Não fugiu. Não se escondeu. Isso importa.",
    testemunha_honest: "Você tem sido honesto(a) nos registros. Nem todo dia é cheio de conquistas — e você não finge que é. Essa honestidade é rara.",
    testemunha_presence: "{{n}} check-ins em 7 dias. Não é sobre o número. É sobre estar presente com você mesmo(a).",

    // Features — O Sistema (SystemForces)
    contexto_revela: "O que o contexto revela",
    contexto_descricao: "Nem tudo que acontece com você é sobre você. Às vezes é sobre o sistema ao redor.",
    contexto_disclaimer: "Estas observações não são diagnósticos. São convites para olhar para fora — para o que o mundo faz com você.",
    sistema_energia_titulo: "Sua energia muda com os dias",
    sistema_energia_body: "Sua energia média em dias úteis ({{wd}}/10) é menor que nos fins de semana ({{we}}/10). Isso pode ter a ver com o ritmo das obrigações — e não significa que você está fazendo algo errado. Significa que seu corpo responde ao contexto.",
    sistema_sono_titulo: "Dormir é mais difícil durante a semana",
    sistema_sono_body: "Você dorme bem em {{wd}}% dos dias úteis, contra {{we}}% nos fins de semana. Não é só você — é difícil dormir bem quando a cabeça está cheia de compromissos. Isso não é um fracasso pessoal.",
    sistema_bateria_titulo: "Muitos dias com a bateria baixa",
    sistema_bateria_body: "Em {{n}} dos últimos 28 dias, sua energia esteve em 4 ou menos. Isso não é preguiça. É sinal de que algo no seu entorno está drenando mais do que deveria. Vale olhar com carinho para o que está consumindo você.",
    sistema_comer_titulo: "Dias em que comer ficou em segundo plano",
    sistema_comer_body: "Em {{n}} dias do último mês, você fez check-in mas não registrou refeições. Às vezes o dia engole a gente e comer bem fica difícil. Isso fala mais sobre o ritmo do seu contexto do que sobre qualquer falha sua.",

    // Features — O Retrato (MonthlyPortrait)
    retrato_titulo: "Seu retrato do mês",
    preparando_retrato: "Preparando seu retrato...",
    retrato_disclaimer: "Observações a partir dos seus últimos 30 dias de registro. Com poucos dados, serão observações simples. Com mais dados, padrões podem aparecer. Não é um diagnóstico.",

    // Features — O Espelho (WeeklyMirror)
    espelho_titulo: "Seu espelho da semana",
    preparando_espelho: "Preparando seu espelho da semana...",
    espelho_disclaimer: "Gerado a partir dos seus dados. Não é um diagnóstico — é um reflexo.",

    // Features — Progresso (tier ladder)
    progresso_titulo: "Progresso",
    progresso_subtitle: "{{n}} check-ins · cada dia consecutivo te sobe um degrau",
    atual: "Atual",

    // Dashboard — Atmospheric redesign
    bom_dia: "Bom dia",
    boa_tarde: "Boa tarde",
    boa_noite: "Boa noite",
    maya_agora: "Maya · agora há pouco",
    conversar_com_maya: "Conversar com Maya",
    meu_porque_label: "Meu Porquê",
    sua_sequencia: "Sua sequência",
    cuidados_de_hoje: "Cuidados de hoje",
    ver_todos: "Ver todos",
    retrato_maya_preparou: "Maya preparou um novo reflexo dos seus últimos 30 dias.",
    media_energia: "Média {{n}}/10",
    subindo: "subindo",
    estavel: "estável",
    caindo: "caindo",
    dias_ate_tier: "{{n}} dias até {{tier}}",

    // Features — Madrugada (Maya time awareness — sistema, não precisa de i18n visível)
  },

  es: {
    inicio: "Inicio",
    checkin: "Check-in",
    diario: "Diario",
    historico: "Histórico",
    ajustes: "Ajustes",
    configuracoes: "Configuraciones",
    diario_app: "🌱 Diario",

    vamos_conhecer: "Vamos a conocernos",
    onboarding_subtitle:
      "Algunas preguntas para personalizar tu diario. Tus respuestas ayudan a mostrar solo lo que tiene sentido para ti.",
    pergunta_genero: "¿Cuál es tu género?",
    genero_subtitle_onboarding:
      "Personalizaremos tu experiencia. Luego puedes cambiarlo en configuración.",
    genero_subtitle_config: "Personaliza el estilo visual de tu dashboard.",
    comecar: "Comenzar",
    salvando: "Guardando...",
    diario_personalizado: "¡Diario personalizado! 🌱",

    q_medicacao: "¿Tomas medicamentos recetados regularmente?",
    q_medicacao_desc:
      "Si sí, te recordaremos registrar si tomaste los remedios correctamente.",
    q_fe: "¿Tienes alguna práctica de fe, espiritualidad o religión?",
    q_fe_desc:
      "Si sí, la pregunta de meditación incluirá 'oración'. Si no, será solo meditación y respiración.",
    q_criatividade: "¿Sueles cantar, pintar o dibujar?",
    q_criatividade_desc:
      "Si sí, incluiremos esas opciones. Si no, la pregunta será más general sobre creatividad y ocio.",
    q_suicida: "¿Quieres incluir la pregunta sobre pensamiento suicida?",
    q_suicida_desc:
      "Es una pregunta importante para acompañar tu seguridad. Recomendamos incluir.",

    config_title: "Configuraciones",
    config_subtitle: "Tus respuestas ayudan a personalizar las preguntas del check-in.",
    preferencias_atualizadas: "¡Preferencias actualizadas! 🌱",

    ola: "¡Hola! 🌱",
    carregando: "Cargando...",
    checkin_hoje_feito: "Check-in de hoy ✅",
    habitos: "hábitos",
    sem_checkin: "Aún no has hecho el check-in de hoy",
    leva_menos_3min: "Toma menos de 3 minutos",
    fazer_checkin: "Hacer check-in",
    editar_checkin: "Editar check-in de hoy",
    como_se_sente: "Cómo te sientes:",
    gratidao: "Gratitud:",
    evolucao: "Evolución",
    ultimos_checkins: "Últimos check-ins",
    nenhum_checkin: "Ningún check-in aún. ¡Comienza hoy!",

    checkin_diario: "Check-in diario",
    responda_sinceridade: "Responde con sinceridad — sin juicios",
    editando_checkin: "Editando check-in",
    nenhuma_pergunta: "Ninguna pregunta seleccionada.",
    configure_diario: "Configura tu diario",
    respostas_abertas: "Respuestas abiertas",
    sentimento_label: "¿Cómo estás hoy?",
    gratidao_label: "¿Por qué estás agradecido(a) hoy?",
    sentimento_placeholder: "Descríbelo en una palabra o frase...",
    gratidao_placeholder: "¿Por qué estás agradecido(a) hoy?",
    gratidao_momento: "Un momento de gratitud",
    seus_habitos: "Tus hábitos",
    adicionar_foto: "Añadir foto",
    salvo_automaticamente: "Guardado automáticamente",
    ver_refeicoes: "Ver todas las comidas →",
    cuidados_hoje: "cuidados hoy",
    salvar_checkin: "Guardar check-in",
    atualizar_checkin: "Actualizar check-in",
    checkin_registrado: "¡Check-in registrado!",
    checkin_atualizado: "¡Check-in actualizado con éxito! 🌱",
    desbloqueado: "desbloqueado!",

    q_meditacao_fe: "¿Separaste un momento para ti?",
    q_meditacao: "¿Separaste un momento para ti?",
    q_criatividade_hobby: "¿Hiciste algo creativo o relajante?",
    q_criatividade_geral: "¿Hiciste algo creativo o relajante?",
    q_julgada: "¿Te sentiste juzgado(a) hoy?",
    q_remedios: "¿Tomaste tus medicamentos?",
    q_conversou: "¿Conversaste con alguien hoy?",
    q_comeu_bem: "Comiste bien hoy",
    q_coco: "¿Fuiste al baño normalmente?",
    q_exercicio: "¿Saliste a caminar o hiciste ejercicio?",
    q_agua: "¿Bebiste al menos 1L de agua?",
    q_dormiu: "¿Dormiste y descansaste bien?",
    q_suicida_label: "¿Tuviste pensamientos difíciles hoy?",
    q_gostou: "¿Hiciste algo que te dio placer?",
    q_metas: "¿Avanzaste en tus metas?",

    q_exercicio_hint: "Las pequeñas victorias cuentan mucho",
    q_agua_hint: "La hidratación es la base de todo",
    q_dormiu_hint: "El sueño lo recarga todo",
    q_remedios_hint: "Crear ese hábito protege tu salud",
    q_meditacao_hint: "Meditar, orar o respirar con atención",
    q_conversou_hint: "La conexión humana hace bien",
    q_gostou_hint: "El ocio también es salud",
    q_metas_hint: "Cada paso cuenta",
    q_criatividade_hint: "La creatividad nutre el alma",
    q_coco_hint: "Un buen funcionamiento es señal de salud",

    dias_consecutivos: "días consecutivos",
    comece_hoje: "¡Comienza hoy! 🌱",
    comecando: "¡Estás comenzando! 🌿",
    constancia: "¡Constancia! 🌳",
    uma_semana: "¡Una semana! ⭐",
    incrivel: "¡Increíble! 💎",
    um_mes: "¡1 mes! 🏆",
    lendario: "¡Legendario! 👑",
    faltam_dias: "Faltan",
    para_proximo_marco: "para el próximo hito",

    seu_jardim: "Tu jardín",
    cultiva_jardim: "Cada día de check-in cultiva tu jardín",
    plante_semente: "Planta tu primera semilla hoy",
    semente_brotando: "¡Tu semilla está brotando...",
    planta_crescendo: "¡Tu planta está creciendo!",
    flores_aparecendo: "¡Apareciendo flores!",
    jardim_florido: "¡Jardín florido!",
    jardim_lendario: "¡Jardín legendario!",
    dia_consecutivo: "día consecutivo",
    dias_consecutivos_garden: "días consecutivos",
    checkin_total: "check-in total",
    checkins_total: "check-ins total",
    desbloquear_conquistas: "Completa check-ins para desbloquear logros",

    estatisticas: "⚡ Estadísticas",
    cada_checkin_forte: "Cada check-in te hace más fuerte",
    nivel: "Nivel",
    xp_para_nivel: "Faltan {{xp}} XP para el nivel {{level}}",
    tier_iniciante: "Iniciante",
    tier_bronze: "Bronce",
    tier_prata: "Plata",
    tier_ouro: "Oro",
    tier_diamante: "Diamante",
    tier_lendario: "Legendario",
    conquistas: "Logros",
    desbloquear_stats: "Completa check-ins para desbloquear",

    diario_title: "Diario",
    diario_subtitle: "Escribe libremente sobre tu día",
    nova_entrada: "+ Nueva",
    nenhuma_entrada: "Ninguna entrada aún",
    comece_diario: "Comienza tu diario escribiendo sobre hoy",
    escrever_primeira: "Escribir primera entrada",
    toque_no_mais: "Toca el + para empezar",
    sem_conteudo: "Sin contenido",
    nova_entrada_title: "Nueva entrada",
    como_esta_hoje: "¿Cómo estás hoy?",
    titulo_opcional: "Título (opcional)",
    titulo_placeholder: "Ponle un título a tu entrada...",
    o_que_escrever: "¿Qué quieres escribir?",
    escrever_placeholder:
      "Escribe libremente sobre tu día, pensamientos, sentimientos...",
    cancelar: "Cancelar",
    salvar_entrada: "Guardar entrada",
    entrada_salva: "¡Entrada guardada! 📔",
    entrada_atualizada: "¡Entrada actualizada! 📔",
    entrada_deletada: "Entrada eliminada.",
    editar: "Editar",
    deletar: "Eliminar",
    voltar: "← Volver",
    entrada_nao_encontrada: "Entrada no encontrada.",
    voltar_diario: "Volver al diario",
    titulo: "Título",
    conteudo: "Contenido",
    salvar: "Guardar",
    editando: "Editando",
    confirmar_deletar: "¿Estás seguro de que quieres eliminar esta entrada?",
    erro_salvar_entrada: "Error al guardar.",
    erro_deletar: "Error al eliminar.",
    escreva_algo: "Escribe algo en el diario.",
    erro_salvar: "Error al guardar. Intenta de nuevo.",
    erro_buscar: "Error al buscar entradas del diario",
    erro_processar: "Error al procesar logros",

    muito_mal: "Muy mal",
    mal: "Mal",
    normal: "Normal",
    bem: "Bien",
    muito_bem: "Muy bien",
    humor_dia: "Estado de ánimo",

    sim: "Sí",
    nao: "No",

    // Maya
    maya_subtitle: "Una compañera para conversar y reflexionar",
    maya_placeholder: "Escribe tu mensaje...",
    maya_welcome:
      "¡Hola! Soy Maya, tu compañera virtual 🌸\n\nEstoy aquí para escucharte, conversar y ofrecerte una mirada acogedora sobre tu momento. No soy terapeuta ni médica — soy como una amiga que te ayuda a reflexionar.\n\n¿Cómo estás hoy?",
    maya_typing: "Maya está escribiendo...",
    maya_error:
      "Tuve dificultad para conectarme ahora. Intenta de nuevo en unos instantes. 💛",

    // CVV
    cvv_warning:
      "Si estás teniendo pensamientos suicidas, por favor llama a la línea de prevención: 188. No estás solo(a). 💚",

    // Nutrición — navegación
    nutricao: "Nutrición",
    registrar_refeicao: "Registrar comida",

    // Tipos de comida
    cafe_da_manha: "Desayuno",
    almoco: "Almuerzo",
    lanche: "Merienda",
    jantar: "Cena",
    lanche_noturno: "Snack nocturno",

    // Clasificaciones
    equilibrada: "Equilibrada",
    leve_proteina: "Baja en proteína",
    alta_acucar: "Alta en azúcar",
    alta_gordura: "Alta en grasa",
    vegetais_baixo: "Vegetales / Bajas calorías",
    nao_identificada: "No identificada",

    // Registro de comida
    foto_refeicao: "Foto de la comida",
    descrever_refeicao: "¿Quieres describir lo que hay?",
    adicionar_sem_foto: "Añadir comida sin foto",
    editar_tipo: "Editar tipo",
    selecionar_data_hora: "Fecha y hora",
    analisando: "Analizando tu comida...",
    refeicao_salva: "¡Comida guardada! 🍽️",
    refeicao_atualizada: "¡Comida actualizada!",
    refeicao_deletada: "Comida eliminada",
    erro_analisar: "No pude analizar la foto. ¿Quieres describirla manualmente?",
    erro_salvar_refeicao: "Error al guardar la comida",
    confirmar_deletar_refeicao: "¿Eliminar esta comida?",

    // Items
    itens_identificados: "Items identificados",
    adicionar_item: "Añadir item",
    remover_item: "Eliminar",

    // Macros
    macros_estimados: "Macros estimados",
    carboidratos: "Carbohidratos",
    proteinas: "Proteínas",
    gorduras: "Grasas",
    calorias: "Calorías",

    // Resumen diario
    resumo_do_dia: "Resumen del día",
    resumo_da_semana: "Resumen de la semana",
    resumo_do_mes: "Resumen del mes",
    total_calorias: "Total de calorías",
    qualidade_bom: "Bien 🌱",
    qualidade_atencao: "Atención ⚠️",
    qualidade_sem_dados: "Sin datos",
    refeicoes_hoje: "Comidas de hoy",
    nenhuma_refeicao: "Ninguna comida registrada hoy",
    registre_primeira: "¡Registra tu primera comida!",

    // Semanal / Mensual
    visao_semanal: "Visión semanal",
    visao_mensal: "Visión mensual",
    calorias_por_dia: "Calorías por día",
    padroes_detectados: "Patrones detectados",
    dias: "días",
    sem_dados_suficientes: "Registra más comidas para ver patrones.",

    // Estados de análisis
    pendente_analise: "Pendiente de análisis",
    analisado: "Analizado",
    falha_analise: "Fallo en análisis",

    // Sin conexión / Fallo
    sem_internet: "Sin internet. La foto se guardó y se analizará cuando vuelva la conexión.",
    api_falhou: "No pude analizar ahora. Puedes registrar manualmente.",
    foto_nao_identificada: "No pude identificar bien, ¿me cuentas qué hay?",
    escrever_manual: "Describir manualmente",
    salvar_sem_analise: "Guardar sin análisis",

    // Integración check-in
    comeu_bem_auto: "Basado en tus {{n}} comidas de hoy",
    registrar_agora: "Registrar ahora",

    // Features — O Fio (DayThread)
    fio_titulo: "El hilo de la semana",
    fio_descricao: "Cómo los días se conectan. Las flechas muestran la dirección del flujo.",
    sem_registro: "sin registro",
    sem_refeicoes_curto: "sin comidas",
    ref_abrev: "comida",
    sono_vespera: "sueño de la víspera",
    retomou_dia: "retomaste después de un día sin registros",

    // Features — O Menor Passo (GentleDayCard)
    bom_dia_titulo: "Buenos días",
    corpo_pede_gentileza: "Hoy el cuerpo pide gentileza",
    dia_de_leveza: "Hoy es día de ligereza",
    ainda_nao_fez_msg: "Aún no has hecho el check-in. Si quieres, cuando puedas. Sin prisa.",
    energia_bem_baixa_msg: "Tu energía está muy baja hoy. Eso pasa. Tu cuerpo no está en tu contra — está pidiendo cuidado. Hoy, el paso más pequeño ya es una victoria.",
    energia_meio_baixa_msg: "Energía medio baja. Días así piden menos exigencia y más gentileza. Lo que parezca posible, ya basta.",
    ideias_nao_obrigacao: "Nada de esto es obligación. Son ideas. Lo que hagas hoy ya es suficiente.",

    // Features — A Testemunha (Testemunha)
    so_pra_voce_saber: "Solo para que sepas",
    testemunha_hard_days_plural: "En {{n}} días de esta semana, no estabas bien. Y aún así viniste aquí. Eso no es hábito. Es coraje para mirarse.",
    testemunha_hard_days_single: "Tuviste un día difícil esta semana. Lo registraste. No huiste. No te escondiste. Eso importa.",
    testemunha_honest: "Has sido honesto(a) en los registros. No todo día está lleno de logros — y no finges que sí. Esa honestidad es rara.",
    testemunha_presence: "{{n}} check-ins en 7 días. No se trata del número. Se trata de estar presente contigo mismo(a).",

    // Features — O Sistema (SystemForces)
    contexto_revela: "Lo que el contexto revela",
    contexto_descricao: "No todo lo que te pasa es por tu culpa. A veces se trata del sistema a tu alrededor.",
    contexto_disclaimer: "Estas observaciones no son diagnósticos. Son invitaciones para mirar hacia afuera — hacia lo que el mundo hace contigo.",
    sistema_energia_titulo: "Tu energía cambia con los días",
    sistema_energia_body: "Tu energía promedio en días hábiles ({{wd}}/10) es menor que en los fines de semana ({{we}}/10). Esto puede estar relacionado con el ritmo de las obligaciones — y no significa que estés haciendo algo mal. Significa que tu cuerpo responde al contexto.",
    sistema_sono_titulo: "Dormir es más difícil entre semana",
    sistema_sono_body: "Duermes bien en {{wd}}% de los días hábiles, contra {{we}}% en los fines de semana. No es solo cosa tuya — es difícil dormir bien cuando la cabeza está llena de compromisos. No es un fracaso personal.",
    sistema_bateria_titulo: "Muchos días con la batería baja",
    sistema_bateria_body: "En {{n}} de los últimos 28 días, tu energía estuvo en 4 o menos. No es pereza. Es señal de que algo en tu entorno está consumiéndote más de lo que debería. Vale mirar con cariño eso que te está agotando.",
    sistema_comer_titulo: "Días en que comer quedó en segundo plano",
    sistema_comer_body: "En {{n}} días del último mes, hiciste check-in pero no registraste comidas. A veces el día nos traga y comer bien se vuelve difícil. Esto habla más del ritmo de tu contexto que de cualquier falla tuya.",

    // Features — O Retrato (MonthlyPortrait)
    retrato_titulo: "Tu retrato del mes",
    preparando_retrato: "Preparando tu retrato...",
    retrato_disclaimer: "Observaciones a partir de tus últimos 30 días de registro. Con pocos datos, serán observaciones simples. Con más datos, pueden aparecer patrones. No es un diagnóstico.",

    // Features — Progresso (tier ladder)
    progresso_titulo: "Progreso",
    progresso_subtitle: "{{n}} check-ins · cada día consecutivo te sube un escalón",
    atual: "Actual",

    // Dashboard — Atmospheric redesign
    bom_dia: "Buenos días",
    boa_tarde: "Buenas tardes",
    boa_noite: "Buenas noches",
    maya_agora: "Maya · hace un momento",
    conversar_com_maya: "Hablar con Maya",
    meu_porque_label: "Mi Porqué",
    sua_sequencia: "Tu secuencia",
    cuidados_de_hoje: "Cuidados de hoy",
    ver_todos: "Ver todos",
    retrato_maya_preparou: "Maya preparó un nuevo reflejo de tus últimos 30 días.",
    media_energia: "Media {{n}}/10",
    subindo: "subiendo",
    estavel: "estable",
    caindo: "bajando",
    dias_ate_tier: "{{n}} días hasta {{tier}}",

    // Features — O Espelho (WeeklyMirror)
    espelho_titulo: "Tu espejo de la semana",
    preparando_espelho: "Preparando tu espejo de la semana...",
    espelho_disclaimer: "Generado a partir de tus datos. No es un diagnóstico — es un reflejo.",
  },

  en: {
    inicio: "Home",
    checkin: "Check-in",
    diario: "Journal",
    historico: "History",
    ajustes: "Settings",
    configuracoes: "Settings",
    diario_app: "🌱 Journal",

    vamos_conhecer: "Let's get to know you",
    onboarding_subtitle:
      "A few questions to personalize your journal. Your answers help show only what makes sense for you.",
    pergunta_genero: "What's your gender?",
    genero_subtitle_onboarding:
      "We'll personalize your experience. You can change it later in settings.",
    genero_subtitle_config: "Personalizes the visual style of your dashboard.",
    comecar: "Get started",
    salvando: "Saving...",
    diario_personalizado: "Journal personalized! 🌱",

    q_medicacao: "Do you take prescribed medications regularly?",
    q_medicacao_desc:
      "If yes, we'll remind you to log whether you took your meds.",
    q_fe: "Do you have a faith, spirituality or religion practice?",
    q_fe_desc:
      "If yes, the meditation question will include 'prayer'. If not, it'll be just meditation and breathing.",
    q_criatividade: "Do you usually sing, paint or draw?",
    q_criatividade_desc:
      "If yes, we'll include those options. If not, the question will be more general about creativity and leisure.",
    q_suicida: "Include the suicidal thoughts question?",
    q_suicida_desc:
      "It's an important question to track your safety. We recommend including it.",

    config_title: "Settings",
    config_subtitle: "Your answers help personalize your check-in questions.",
    preferencias_atualizadas: "Preferences updated! 🌱",

    ola: "Hello! 🌱",
    carregando: "Loading...",
    checkin_hoje_feito: "Today's check-in ✅",
    habitos: "habits",
    sem_checkin: "You haven't done today's check-in yet",
    leva_menos_3min: "Takes less than 3 minutes",
    fazer_checkin: "Do check-in",
    editar_checkin: "Edit today's check-in",
    como_se_sente: "How you feel:",
    gratidao: "Gratitude:",
    evolucao: "Progress",
    ultimos_checkins: "Latest check-ins",
    nenhum_checkin: "No check-ins yet. Start today!",

    checkin_diario: "Daily check-in",
    responda_sinceridade: "Answer honestly — no judgment",
    editando_checkin: "Editing check-in",
    nenhuma_pergunta: "No questions selected.",
    configure_diario: "Configure your journal",
    respostas_abertas: "Open answers",
    sentimento_label: "How are you today?",
    gratidao_label: "What are you grateful for today?",
    sentimento_placeholder: "Describe it in a word or phrase...",
    gratidao_placeholder: "What are you grateful for today?",
    gratidao_momento: "A moment of gratitude",
    seus_habitos: "Your habits",
    adicionar_foto: "Add photo",
    salvo_automaticamente: "Saved automatically",
    ver_refeicoes: "See all meals →",
    cuidados_hoje: "cares today",
    salvar_checkin: "Save check-in",
    atualizar_checkin: "Update check-in",
    checkin_registrado: "Check-in saved!",
    checkin_atualizado: "Check-in updated! 🌱",
    desbloqueado: "unlocked!",

    q_meditacao_fe: "Took a moment for yourself?",
    q_meditacao: "Took a moment for yourself?",
    q_criatividade_hobby: "Did something creative or relaxing?",
    q_criatividade_geral: "Did something creative or relaxing?",
    q_julgada: "Felt judged today?",
    q_remedios: "Took your medications?",
    q_conversou: "Talked to someone today?",
    q_comeu_bem: "Ate well today",
    q_coco: "Had a normal bowel movement?",
    q_exercicio: "Went for a walk or exercised?",
    q_agua: "Drank at least 1L of water?",
    q_dormiu: "Slept and rested well?",
    q_suicida_label: "Had difficult thoughts today?",
    q_gostou: "Did something that gave you pleasure?",
    q_metas: "Made progress on your goals?",

    q_exercicio_hint: "Small victories count a lot",
    q_agua_hint: "Hydration is the foundation of everything",
    q_dormiu_hint: "Sleep recharges everything",
    q_remedios_hint: "Building this habit protects your health",
    q_meditacao_hint: "Meditate, pray or breathe mindfully",
    q_conversou_hint: "Human connection is good for you",
    q_gostou_hint: "Leisure is also health",
    q_metas_hint: "Every step counts",
    q_criatividade_hint: "Creativity nourishes the soul",
    q_coco_hint: "Good bowel function is a sign of health",

    dias_consecutivos: "consecutive days",
    comece_hoje: "Start today! 🌱",
    comecando: "Getting started! 🌿",
    constancia: "Consistency! 🌳",
    uma_semana: "One week! ⭐",
    incrivel: "Amazing! 💎",
    um_mes: "1 month! 🏆",
    lendario: "Legendary! 👑",
    faltam_dias: "",
    para_proximo_marco: "days until next milestone",

    seu_jardim: "Your garden",
    cultiva_jardim: "Each check-in day grows your garden",
    plante_semente: "Plant your first seed today",
    semente_brotando: "Your seed is sprouting...",
    planta_crescendo: "Your plant is growing!",
    flores_aparecendo: "Flowers appearing!",
    jardim_florido: "Garden in bloom!",
    jardim_lendario: "Legendary garden!",
    dia_consecutivo: "consecutive day",
    dias_consecutivos_garden: "consecutive days",
    checkin_total: "total check-in",
    checkins_total: "total check-ins",
    desbloquear_conquistas: "Complete check-ins to unlock achievements",

    estatisticas: "⚡ Stats",
    cada_checkin_forte: "Each check-in makes you stronger",
    nivel: "Level",
    xp_para_nivel: "{{xp}} XP to level {{level}}",
    tier_iniciante: "Beginner",
    tier_bronze: "Bronze",
    tier_prata: "Silver",
    tier_ouro: "Gold",
    tier_diamante: "Diamond",
    tier_lendario: "Legendary",
    conquistas: "Achievements",
    desbloquear_stats: "Complete check-ins to unlock",

    diario_title: "Journal",
    diario_subtitle: "Write freely about your day",
    nova_entrada: "+ New",
    nenhuma_entrada: "No entries yet",
    comece_diario: "Start your journal by writing about today",
    escrever_primeira: "Write first entry",
    toque_no_mais: "Tap + to start",
    sem_conteudo: "No content",
    nova_entrada_title: "New entry",
    como_esta_hoje: "How are you today?",
    titulo_opcional: "Title (optional)",
    titulo_placeholder: "Give your entry a title...",
    o_que_escrever: "What do you want to write?",
    escrever_placeholder:
      "Write freely about your day, thoughts, feelings...",
    cancelar: "Cancel",
    salvar_entrada: "Save entry",
    entrada_salva: "Entry saved! 📔",
    entrada_atualizada: "Entry updated! 📔",
    entrada_deletada: "Entry deleted.",
    editar: "Edit",
    deletar: "Delete",
    voltar: "← Back",
    entrada_nao_encontrada: "Entry not found.",
    voltar_diario: "Back to journal",
    titulo: "Title",
    conteudo: "Content",
    salvar: "Save",
    editando: "Editing",
    confirmar_deletar: "Are you sure you want to delete this entry?",
    erro_salvar_entrada: "Error saving.",
    erro_deletar: "Error deleting.",
    escreva_algo: "Write something in your journal.",
    erro_salvar: "Error saving. Please try again.",
    erro_buscar: "Error fetching journal entries",
    erro_processar: "Error processing achievements",

    muito_mal: "Very bad",
    mal: "Bad",
    normal: "Okay",
    bem: "Good",
    muito_bem: "Great",
    humor_dia: "Today's mood",

    sim: "Yes",
    nao: "No",

    // Maya
    maya_subtitle: "A companion to talk and reflect",
    maya_placeholder: "Write your message...",
    maya_welcome:
      "Hi! I'm Maya, your virtual companion 🌸\n\nI'm here to listen, chat, and offer a warm perspective on your moment. I'm not a therapist or doctor — I'm like a friend who helps you reflect.\n\nHow are you today?",
    maya_typing: "Maya is typing...",
    maya_error:
      "I had trouble connecting right now. Please try again in a moment. 💛",

    // CVV
    cvv_warning:
      "If you're having suicidal thoughts, please call the suicide prevention hotline. You're not alone. 💚",

    // Nutrition — navigation
    nutricao: "Nutrition",
    registrar_refeicao: "Log a meal",

    // Meal types
    cafe_da_manha: "Breakfast",
    almoco: "Lunch",
    lanche: "Snack",
    jantar: "Dinner",
    lanche_noturno: "Late snack",

    // Classifications
    equilibrada: "Balanced",
    leve_proteina: "Low protein",
    alta_acucar: "High sugar",
    alta_gordura: "High fat",
    vegetais_baixo: "Veggies / Low cal",
    nao_identificada: "Unidentified",

    // Meal logging
    foto_refeicao: "Meal photo",
    descrever_refeicao: "Want to describe what's in it?",
    adicionar_sem_foto: "Add meal without photo",
    editar_tipo: "Edit type",
    selecionar_data_hora: "Date and time",
    analisando: "Analyzing your meal...",
    refeicao_salva: "Meal saved! 🍽️",
    refeicao_atualizada: "Meal updated!",
    refeicao_deletada: "Meal removed",
    erro_analisar: "I couldn't analyze the photo. Want to describe it manually?",
    erro_salvar_refeicao: "Error saving meal",
    confirmar_deletar_refeicao: "Remove this meal?",

    // Items
    itens_identificados: "Identified items",
    adicionar_item: "Add item",
    remover_item: "Remove",

    // Macros
    macros_estimados: "Estimated macros",
    carboidratos: "Carbs",
    proteinas: "Protein",
    gorduras: "Fat",
    calorias: "Calories",

    // Daily summary
    resumo_do_dia: "Daily summary",
    resumo_da_semana: "Week summary",
    resumo_do_mes: "Month summary",
    total_calorias: "Total calories",
    qualidade_bom: "Good 🌱",
    qualidade_atencao: "Attention ⚠️",
    qualidade_sem_dados: "No data",
    refeicoes_hoje: "Today's meals",
    nenhuma_refeicao: "No meals logged today",
    registre_primeira: "Log your first meal!",

    // Weekly / Monthly
    visao_semanal: "Weekly view",
    visao_mensal: "Monthly view",
    calorias_por_dia: "Calories per day",
    padroes_detectados: "Detected patterns",
    dias: "days",
    sem_dados_suficientes: "Log more meals to see patterns.",

    // Analysis status
    pendente_analise: "Pending analysis",
    analisado: "Analyzed",
    falha_analise: "Analysis failed",

    // Offline / Failure
    sem_internet: "No internet. Photo saved and will be analyzed when connection returns.",
    api_falhou: "Couldn't analyze right now. You can log manually.",
    foto_nao_identificada: "I couldn't identify it well, can you tell me what's there?",
    escrever_manual: "Describe manually",
    salvar_sem_analise: "Save without analysis",

    // Check-in integration
    comeu_bem_auto: "Based on your {{n}} meals today",
    registrar_agora: "Log now",

    // Features — O Fio (DayThread)
    fio_titulo: "The week's thread",
    fio_descricao: "How the days connect. Arrows show the flow direction.",
    sem_registro: "no entry",
    sem_refeicoes_curto: "no meals",
    ref_abrev: "meal",
    sono_vespera: "previous night's sleep",
    retomou_dia: "returned after a day with no entries",

    // Features — O Menor Passo (GentleDayCard)
    bom_dia_titulo: "Good morning",
    corpo_pede_gentileza: "Today your body asks for gentleness",
    dia_de_leveza: "Today calls for lightness",
    ainda_nao_fez_msg: "Haven't done your check-in yet. When you can. No rush.",
    energia_bem_baixa_msg: "Your energy is really low today. It happens. Your body isn't against you — it's asking for care. Today, the smallest step is already a win.",
    energia_meio_baixa_msg: "Energy is a bit low. Days like this ask for less pressure and more gentleness. Whatever feels possible is enough.",
    ideias_nao_obrigacao: "None of this is an obligation. Just ideas. Whatever you do today is already enough.",

    // Features — A Testemunha (Testemunha)
    so_pra_voce_saber: "Just so you know",
    testemunha_hard_days_plural: "On {{n}} days this week, you weren't okay. And you still showed up. That's not a habit. That's courage to look at yourself.",
    testemunha_hard_days_single: "You had a hard day this week. You logged it. You didn't run. You didn't hide. That matters.",
    testemunha_honest: "You've been honest in your logs. Not every day is full of wins — and you don't pretend it is. That honesty is rare.",
    testemunha_presence: "{{n}} check-ins in 7 days. It's not about the number. It's about being present with yourself.",

    // Features — O Sistema (SystemForces)
    contexto_revela: "What the context reveals",
    contexto_descricao: "Not everything that happens to you is about you. Sometimes it's about the system around you.",
    contexto_disclaimer: "These observations are not diagnoses. They are invitations to look outward — at what the world does to you.",
    sistema_energia_titulo: "Your energy shifts with the days",
    sistema_energia_body: "Your average energy on weekdays ({{wd}}/10) is lower than on weekends ({{we}}/10). This may have to do with obligations — and doesn't mean you're doing anything wrong. It means your body responds to context.",
    sistema_sono_titulo: "Sleep is harder during the workweek",
    sistema_sono_body: "You sleep well on {{wd}}% of weekdays, versus {{we}}% on weekends. It's not just you — it's hard to sleep well with a full mind. This isn't a personal failure.",
    sistema_bateria_titulo: "Many days on low battery",
    sistema_bateria_body: "On {{n}} of the last 28 days, your energy was at 4 or lower. This isn't laziness. It's a sign that something around you is draining more than it should. Worth looking kindly at what's weighing on you.",
    sistema_comer_titulo: "Days when eating took a back seat",
    sistema_comer_body: "On {{n}} days this month, you checked in but didn't log any meals. Sometimes the day swallows us whole and eating well becomes hard. This says more about your context than about any failure of yours.",

    // Features — O Retrato (MonthlyPortrait)
    retrato_titulo: "Your portrait this month",
    preparando_retrato: "Preparing your portrait...",
    retrato_disclaimer: "Observations from your last 30 days of logging. With little data, observations will be simple. With more data, patterns may appear. Not a diagnosis.",

    // Features — Progresso (tier ladder)
    progresso_titulo: "Progress",
    progresso_subtitle: "{{n}} check-ins · each consecutive day lifts you up one step",
    atual: "Current",

    // Dashboard — Atmospheric redesign
    bom_dia: "Good morning",
    boa_tarde: "Good afternoon",
    boa_noite: "Good evening",
    maya_agora: "Maya · just now",
    conversar_com_maya: "Talk to Maya",
    meu_porque_label: "My Why",
    sua_sequencia: "Your streak",
    cuidados_de_hoje: "Today's self-care",
    ver_todos: "See all",
    retrato_maya_preparou: "Maya prepared a new reflection of your last 30 days.",
    media_energia: "Average {{n}}/10",
    subindo: "rising",
    estavel: "steady",
    caindo: "falling",
    dias_ate_tier: "{{n}} days until {{tier}}",

    // Features — O Espelho (WeeklyMirror)
    espelho_titulo: "Your week's mirror",
    preparando_espelho: "Preparing your weekly mirror...",
    espelho_disclaimer: "Generated from your data. Not a diagnosis — a reflection.",
  },
};

export function t(lang: Lang, key: string, vars?: Record<string, string>): string {
  let text = translations[lang]?.[key] || translations["pt"][key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{{${k}}}`, v);
    }
  }
  return text;
}

export const LANG_OPTIONS = [
  { id: "pt" as const, label: "Português", flag: "🇧🇷" },
  { id: "es" as const, label: "Español", flag: "🇪🇸" },
  { id: "en" as const, label: "English", flag: "🇺🇸" },
];
