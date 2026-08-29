export type ScenarioCitation = {
  documentId: string;
  pageNumber: number;
  passage: string;
};

export type ScenarioChoice = {
  id: string;
  text: string;
  score: 0 | 1 | 2;
  consequence: string;
  positivePoints: string[];
  risks: string[];
  recommendedConduct: string;
  explanation: string;
  nextSceneId?: string | null;
  source?: string;
  sources?: ScenarioCitation[];
};

export type ScenarioScene = {
  id: string;
  title: string;
  location: string;
  moment: string;
  learnerRole: string;
  people: string[];
  context: string;
  problem: string;
  constraints: string[];
  dialogue?: string;
  imageUrl?: string;
  mission: string;
  objective: string;
  competencies: string[];
  observationCriteria: string[];
  usefulInformation: string[];
  documents: string[];
  question: string;
  sources?: ScenarioCitation[];
  choices: ScenarioChoice[];
};

export type ScenarioContent = {
  version: 2;
  mode: 'single' | 'independent' | 'progressive' | 'successive' | 'case-study' | 'final-assessment';
  progressive: boolean;
  simplifiedFrench: boolean;
  feedbackTiming: 'immediate' | 'deferred';
  scoreMode: 'points' | 'skills' | 'hidden';
  showHints: boolean;
  addImages: boolean;
  outputs: string[];
  scenes: ScenarioScene[];
  debrief: {
    title: string;
    summary: string;
    bestPractices: string[];
    pointsToReview: string[];
    trainerQuestions: string[];
  };
};

const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const stringList = (value: unknown): string[] => Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : [];
const stringValue = (value: unknown, fallback = ''): string => typeof value === 'string' && value.trim() ? value.trim() : fallback;

export function validateScenarioContent(content: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const scenes = Array.isArray(content.scenes) ? content.scenes : [];
  const progressiveMode = content.mode === 'progressive' || content.mode === 'successive';
  if (scenes.length < (progressiveMode ? 3 : 1) || scenes.length > 6) return [progressiveMode ? 'Un parcours progressif doit contenir entre 3 et 6 scènes.' : 'La mise en situation doit contenir entre 1 et 6 scènes.'];
  const sceneIds = new Set<string>();
  for (const [sceneIndex,value] of scenes.entries()) {
    const scene = record(value);
    if (!scene) { errors.push(`La scène ${sceneIndex + 1} est invalide.`); continue; }
    const id = stringValue(scene.id);
    if (!id || sceneIds.has(id)) errors.push(`La scène ${sceneIndex + 1} doit posséder un identifiant unique.`); else sceneIds.add(id);
    for (const key of ['title','context','problem','mission','objective','question']) if (!stringValue(scene[key])) errors.push(`La scène ${sceneIndex + 1} doit renseigner « ${key} ».`);
    const choices = Array.isArray(scene.choices) ? scene.choices : [];
    if (choices.length < 3 || choices.length > 4) errors.push(`La scène ${sceneIndex + 1} doit proposer 3 ou 4 décisions.`);
    const choiceIds = new Set<string>(); let hasRecommended = false;
    for (const [choiceIndex,choiceValue] of choices.entries()) {
      const choice = record(choiceValue);
      if (!choice) { errors.push(`Le choix ${choiceIndex + 1} de la scène ${sceneIndex + 1} est invalide.`); continue; }
      const choiceId = stringValue(choice.id);
      if (!choiceId || choiceIds.has(choiceId)) errors.push(`Chaque choix de la scène ${sceneIndex + 1} doit avoir un identifiant unique.`); else choiceIds.add(choiceId);
      if (!stringValue(choice.text)) errors.push(`Le choix ${choiceIndex + 1} de la scène ${sceneIndex + 1} est vide.`);
      const score = Number(choice.score);
      if (![0,1,2].includes(score)) errors.push(`Le choix ${choiceIndex + 1} de la scène ${sceneIndex + 1} doit être noté 0, 1 ou 2.`);
      if (score === 2) hasRecommended = true;
      for (const key of ['consequence','recommendedConduct','explanation']) if (!stringValue(choice[key])) errors.push(`Le choix ${choiceIndex + 1} de la scène ${sceneIndex + 1} doit renseigner « ${key} ».`);
      validateCitations(choice.sources, `le choix ${choiceIndex + 1} de la scène ${sceneIndex + 1}`, errors);
    }
    validateCitations(scene.sources, `la scène ${sceneIndex + 1}`, errors);
    if (!hasRecommended) errors.push(`La scène ${sceneIndex + 1} doit contenir au moins une conduite recommandée notée 2.`);
  }
  const sceneIndexes = new Map(Array.from(sceneIds).map((id,index) => [id,index]));
  for (const [sceneIndex,value] of scenes.entries()) {
    const scene = record(value); if (!scene) continue;
    for (const choiceValue of Array.isArray(scene.choices) ? scene.choices : []) {
      const choice = record(choiceValue); const nextSceneId = choice?.nextSceneId;
      if (typeof nextSceneId === 'string' && nextSceneId && !sceneIds.has(nextSceneId)) errors.push(`La scène suivante « ${nextSceneId} » est introuvable.`);
      else if (typeof nextSceneId === 'string' && nextSceneId && Number(sceneIndexes.get(nextSceneId)) <= sceneIndex) errors.push(`La destination « ${nextSceneId} » doit conduire vers une scène ultérieure.`);
    }
  }
  const debrief = record(content.debrief);
  if (!debrief || !stringValue(debrief.summary) || stringList(debrief.bestPractices).length === 0) errors.push('Le bilan final doit contenir une synthèse et les bonnes pratiques à retenir.');
  return errors;
}

export function normalizeScenarioContent(content: Record<string, unknown>): ScenarioContent {
  if (Array.isArray(content.scenes)) {
    const scenes = content.scenes.map((value,index) => normalizeScene(value,index)).filter((scene): scene is ScenarioScene => Boolean(scene));
    const debrief = record(content.debrief);
    return {
      version: 2,
      mode: content.mode === 'single' || content.mode === 'independent' || content.mode === 'successive' || content.mode === 'case-study' || content.mode === 'final-assessment' ? content.mode : 'progressive',
      progressive: content.progressive !== false,
      simplifiedFrench: content.simplifiedFrench !== false,
      feedbackTiming: content.feedbackTiming === 'deferred' ? 'deferred' : 'immediate',
      scoreMode: content.scoreMode === 'skills' || content.scoreMode === 'hidden' ? content.scoreMode : 'points',
      showHints: content.showHints !== false,
      addImages: content.addImages === true,
      outputs: stringList(content.outputs),
      scenes,
      debrief: {
        title: stringValue(debrief?.title,'Bilan de la mise en situation'),
        summary: stringValue(debrief?.summary,'Comparez vos décisions aux conduites professionnelles recommandées.'),
        bestPractices: stringList(debrief?.bestPractices),
        pointsToReview: stringList(debrief?.pointsToReview),
        trainerQuestions: stringList(debrief?.trainerQuestions),
      },
    };
  }
  const legacySteps = Array.isArray(content.steps) ? content.steps : [];
  const scenes = legacySteps.map((value,index) => {
    const step = record(value); if (!step) return null;
    const choices = (Array.isArray(step.choices) ? step.choices : []).map((choiceValue,choiceIndex) => {
      const choice = record(choiceValue);
      return {
        id: `choice-${index + 1}-${choiceIndex + 1}`,
        text: stringValue(choice?.label,`Décision ${choiceIndex + 1}`),
        score: choiceIndex === 0 ? 2 : 1 as 0 | 1 | 2,
        consequence: stringValue(choice?.consequence,'Cette décision doit être analysée avec le groupe.'),
        positivePoints: [], risks: [],
        recommendedConduct: choiceIndex === 0 ? 'Conserver cette décision et expliquer le protocole appliqué.' : 'Comparer cette décision avec le protocole de l’établissement.',
        explanation: stringValue(choice?.consequence,'Reliez la décision aux règles professionnelles applicables.'),
        nextSceneId: index + 1 < legacySteps.length ? `scene-${index + 2}` : null,
      };
    });
    return normalizeScene({ id:`scene-${index + 1}`,title:`Situation ${index + 1}`,context:stringValue(step.situation),problem:stringValue(step.situation),question:'Quelle réaction professionnelle choisissez-vous ?',choices },index);
  }).filter((scene): scene is ScenarioScene => Boolean(scene));
  return { version:2,mode:'progressive',progressive:true,simplifiedFrench:true,feedbackTiming:'immediate',scoreMode:'points',showHints:true,addImages:false,outputs:['digital','a4','learner','trainer'],scenes,debrief:{ title:'Bilan de la mise en situation',summary:'Reprenez les décisions prises et justifiez la conduite professionnelle la plus adaptée.',bestPractices:['Observer la situation avant d’agir.','Respecter la personne, les consignes et le protocole.','Transmettre les informations utiles.'],pointsToReview:['Argumenter chaque décision.'],trainerQuestions:['Quelle décision modifieriez-vous après le débrief ?'] } };
}

function normalizeScene(value: unknown,index: number): ScenarioScene | null {
  const scene = record(value); if (!scene) return null;
  const choices = (Array.isArray(scene.choices) ? scene.choices : []).map((choiceValue,choiceIndex) => {
    const choice = record(choiceValue); const score = Number(choice?.score);
    return { id:stringValue(choice?.id,`choice-${index + 1}-${choiceIndex + 1}`),text:stringValue(choice?.text ?? choice?.label,`Décision ${choiceIndex + 1}`),score:([0,1,2].includes(score) ? score : 0) as 0 | 1 | 2,consequence:stringValue(choice?.consequence,'Conséquence à analyser.'),positivePoints:stringList(choice?.positivePoints),risks:stringList(choice?.risks),recommendedConduct:stringValue(choice?.recommendedConduct,'Se référer au protocole et transmettre l’information utile.'),explanation:stringValue(choice?.explanation ?? choice?.consequence,'Expliquez le lien entre la décision et la pratique professionnelle.'),nextSceneId:typeof choice?.nextSceneId === 'string' || choice?.nextSceneId === null ? choice.nextSceneId as string | null : undefined,source:stringValue(choice?.source) || undefined,sources:normalizeCitations(choice?.sources) };
  });
  return { id:stringValue(scene.id,`scene-${index + 1}`),title:stringValue(scene.title,`Situation ${index + 1}`),location:stringValue(scene.location,'Lieu de travail'),moment:stringValue(scene.moment,'Pendant l’intervention'),learnerRole:stringValue(scene.learnerRole,'Professionnel en situation'),people:stringList(scene.people),context:stringValue(scene.context,'Analysez la situation professionnelle présentée.'),problem:stringValue(scene.problem, stringValue(scene.context)),constraints:stringList(scene.constraints),dialogue:stringValue(scene.dialogue) || undefined,imageUrl:stringValue(scene.imageUrl) || undefined,mission:stringValue(scene.mission,'Choisir une réaction puis justifier sa décision.'),objective:stringValue(scene.objective,'Adapter son intervention à la situation.'),competencies:stringList(scene.competencies),observationCriteria:stringList(scene.observationCriteria),usefulInformation:stringList(scene.usefulInformation),documents:stringList(scene.documents),question:stringValue(scene.question,'Quelle réaction professionnelle choisissez-vous ?'),sources:normalizeCitations(scene.sources),choices };
}

function normalizeCitations(value: unknown): ScenarioCitation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const citation = record(item); const documentId = stringValue(citation?.documentId); const pageNumber = Number(citation?.pageNumber);
    return documentId && Number.isInteger(pageNumber) && pageNumber > 0 ? [{ documentId, pageNumber, passage:stringValue(citation?.passage) }] : [];
  });
}

function validateCitations(value: unknown, label: string, errors: string[]) {
  if (value === undefined) return;
  if (!Array.isArray(value)) { errors.push(`Les sources de ${label} sont invalides.`); return; }
  for (const citationValue of value) {
    const citation = record(citationValue);
    if (!citation || !stringValue(citation.documentId) || !Number.isInteger(Number(citation.pageNumber)) || Number(citation.pageNumber) < 1) errors.push(`Une citation de ${label} ne précise pas un document et une page valides.`);
  }
}

export const SCENARIO_EXAMPLE_CONTENT: ScenarioContent = {
  version: 2,
  mode: 'progressive',
  progressive: true,
  simplifiedFrench: true,
  feedbackTiming: 'immediate',
  scoreMode: 'points',
  showHints: true,
  addImages: false,
  outputs: ['digital','a4','learner','trainer'],
  scenes: [
    {
      id:'scene-1',title:'Préparer une intervention en chambre',location:'EHPAD · couloir du secteur B',moment:'Début de la tournée du matin',learnerRole:'Agent de bio-nettoyage',people:['Le résident','L’aide-soignante référente'],
      context:'Vous préparez le chariot avant d’entrer dans la chambre de Monsieur Robert. Le planning prévoit un entretien complet et le couloir est déjà fréquenté.',problem:'Vous devez intervenir sans gêner les résidents ni créer de risque dans la circulation.',constraints:['Respecter le protocole de bio-nettoyage','Maintenir le passage dégagé','Préserver la confidentialité'],
      mission:'Sécuriser et préparer l’intervention avant tout contact avec le résident.',objective:'Organiser son intervention et annoncer sa présence de façon professionnelle.',competencies:['Organisation du poste','Prévention des risques','Communication professionnelle'],observationCriteria:['Chariot complet et rangé','Zone de circulation préservée','Présence annoncée'],usefulInformation:['Le résident peut refuser ou demander un report.'],documents:['Planning de secteur','Protocole de bio-nettoyage'],question:'Quelle préparation choisissez-vous avant de frapper à la porte ?',
      choices:[
        {id:'s1-a',text:'Laisser le chariot en travers du couloir pour garder tout le matériel à portée.',score:0,consequence:'Le passage est gêné et un résident peut trébucher ou heurter le chariot.',positivePoints:['Le matériel reste proche.'],risks:['Chute ou collision','Gêne de l’évacuation'],recommendedConduct:'Stationner le chariot le long du mur sans obstruer le passage et vérifier le matériel.',explanation:'La préparation doit concilier efficacité et sécurité collective. Un couloir doit rester circulable.',nextSceneId:'scene-2'},
        {id:'s1-b',text:'Vérifier le chariot, le placer sans gêner le passage, puis frapper et annoncer sa présence.',score:2,consequence:'L’intervention commence dans de bonnes conditions de sécurité et de respect.',positivePoints:['Matériel vérifié','Circulation sécurisée','Intimité respectée'],risks:[],recommendedConduct:'Conserver cette préparation méthodique et attendre la réponse avant d’entrer.',explanation:'Cette décision respecte à la fois l’organisation du travail, la prévention et les droits du résident.',nextSceneId:'scene-2'},
        {id:'s1-c',text:'Entrer rapidement pour gagner du temps puisque la chambre figure au planning.',score:0,consequence:'L’intimité du résident n’est pas respectée et la relation de confiance est fragilisée.',positivePoints:['Le planning semble respecté.'],risks:['Atteinte à l’intimité','Conflit avec le résident'],recommendedConduct:'Toujours frapper, s’identifier et attendre l’autorisation d’entrer.',explanation:'Le planning n’autorise jamais à entrer sans respecter la personne et son espace privé.',nextSceneId:'scene-2'},
      ],dialogue:'Vous frappez : « Bonjour Monsieur Robert, c’est l’agent de bio-nettoyage. Puis-je entrer ? »'
    },
    {
      id:'scene-2',title:'Un résident refuse l’entretien de sa chambre',location:'Chambre de Monsieur Robert',moment:'Pendant la tournée du matin',learnerRole:'Agent de bio-nettoyage',people:['Monsieur Robert','Le responsable de secteur'],context:'Après avoir frappé et annoncé votre présence, Monsieur Robert répond : « Non, pas maintenant, laissez-moi tranquille. » Le chariot est prêt dans le couloir et votre planning est chargé.',problem:'Vous devez respecter le refus tout en assurant la continuité du service.',constraints:['Respect de la personne','Organisation du report','Transmission à l’encadrant'],dialogue:'Monsieur Robert : « Non, pas maintenant, laissez-moi tranquille. »',mission:'Choisir une réaction, puis justifier oralement votre décision au groupe.',objective:'Adapter son intervention tout en respectant le résident et le protocole de l’établissement.',competencies:['Relation avec le résident','Communication professionnelle','Organisation du travail'],observationCriteria:['Respect de la personne','Proposition d’une solution','Transmission adaptée'],usefulInformation:['Un refus doit être respecté et signalé selon la procédure.'],documents:['Planning d’entretien','Fiche de transmission'],question:'Quelle réaction professionnelle choisissez-vous ?',choices:[
        {id:'s2-a',text:'Entrer malgré son refus pour respecter le planning.',score:0,consequence:'Le résident se sent agressé et la relation de confiance est rompue.',positivePoints:['La tâche prévue est tentée.'],risks:['Non-respect du consentement','Conflit','Signalement possible'],recommendedConduct:'Sortir, respecter le refus, proposer un autre horaire et prévenir l’encadrant.',explanation:'L’organisation ne prime pas sur le respect de la personne. Le refus impose une adaptation et une transmission.',nextSceneId:'scene-3'},
        {id:'s2-b',text:'Respecter son refus, proposer un autre horaire et prévenir l’encadrant.',score:2,consequence:'Le résident est respecté et l’entretien peut être reprogrammé de manière tracée.',positivePoints:['Consentement respecté','Solution proposée','Continuité organisée'],risks:['Le report doit être effectivement suivi.'],recommendedConduct:'Confirmer le nouvel horaire, noter le report et transmettre l’information utile.',explanation:'Cette réponse associe respect, communication et organisation. Elle protège la personne sans abandonner la mission.',nextSceneId:'scene-3'},
        {id:'s2-c',text:'Repartir sans rien dire et supprimer la chambre du planning.',score:1,consequence:'Le refus est respecté, mais l’équipe ne sait pas que l’entretien reste à reprogrammer.',positivePoints:['Le résident n’est pas contraint.'],risks:['Absence de transmission','Entretien oublié'],recommendedConduct:'Respecter le refus puis informer l’encadrant et organiser un report.',explanation:'Ne pas entrer est correct, mais une conduite professionnelle comprend aussi la transmission et la continuité du service.',nextSceneId:'scene-3'},
      ]
    },
    {
      id:'scene-3',title:'Organiser le report sans désorganiser le secteur',location:'Office de l’unité',moment:'Quelques minutes après le refus',learnerRole:'Agent de bio-nettoyage',people:['Le responsable de secteur','L’équipe soignante'],context:'Monsieur Robert accepte finalement un passage après le déjeuner. Deux autres chambres sont encore prévues avant la pause.',problem:'Le report doit être tracé et intégré au planning sans oublier les priorités du secteur.',constraints:['Charge de travail','Coordination avec l’équipe','Traçabilité'],mission:'Choisir une organisation réaliste et transmettre l’information utile.',objective:'Coordonner un report en maintenant la qualité du service.',competencies:['Planification','Transmission ciblée','Travail en équipe'],observationCriteria:['Horaire confirmé','Information transmise','Priorités conservées'],usefulInformation:['Une transmission doit être factuelle, concise et utile.'],documents:['Planning actualisable','Outil de transmission'],question:'Comment organisez-vous la suite ?',choices:[
        {id:'s3-a',text:'Noter le report, informer le responsable et vérifier que le nouvel horaire est compatible avec les soins.',score:2,consequence:'Le report est compris par tous et peut être réalisé au bon moment.',positivePoints:['Traçabilité','Coordination','Planning réaliste'],risks:[],recommendedConduct:'Poursuivre la tournée puis revenir à l’horaire validé.',explanation:'Une transmission courte et factuelle sécurise la continuité de la prestation.',nextSceneId:'scene-4'},
        {id:'s3-b',text:'Garder l’information en mémoire et revenir si vous avez le temps.',score:1,consequence:'Le report reste possible, mais il peut être oublié ou entrer en conflit avec un soin.',positivePoints:['Volonté de revenir.'],risks:['Oubli','Mauvaise coordination'],recommendedConduct:'Tracer le report et vérifier l’horaire avec l’équipe.',explanation:'La mémoire seule n’est pas un outil de coordination fiable dans un environnement collectif.',nextSceneId:'scene-4'},
        {id:'s3-c',text:'Demander à un collègue de faire la chambre sans lui expliquer le refus ni l’horaire proposé.',score:0,consequence:'Le collègue peut revenir trop tôt et provoquer un nouveau refus.',positivePoints:['Recherche d’une solution rapide.'],risks:['Information incomplète','Nouvelle tension'],recommendedConduct:'Partager le contexte utile et confirmer la répartition avec le responsable.',explanation:'Déléguer sans transmettre les informations nécessaires met le collègue et le résident en difficulté.',nextSceneId:'scene-4'},
      ]
    },
    {
      id:'scene-4',title:'Revenir et clôturer l’intervention',location:'Chambre de Monsieur Robert',moment:'Après le déjeuner',learnerRole:'Agent de bio-nettoyage',people:['Monsieur Robert'],context:'Vous revenez à l’horaire convenu. Monsieur Robert vous autorise à entrer, mais il semble fatigué et souhaite que l’intervention soit courte.',problem:'Vous devez réaliser une prestation adaptée, contrôler le résultat et clôturer avec respect.',constraints:['Temps limité','Qualité attendue','Confort du résident'],mission:'Adapter la prestation sans supprimer les étapes essentielles.',objective:'Réaliser et clôturer une intervention négociée avec le résident.',competencies:['Adaptation','Qualité du bio-nettoyage','Relation de service'],observationCriteria:['Accord confirmé','Priorités réalisées','Résultat contrôlé'],usefulInformation:['Une adaptation ne doit pas supprimer les règles d’hygiène et de sécurité.'],documents:['Protocole de bio-nettoyage'],question:'Quelle conduite adoptez-vous ?',choices:[
        {id:'s4-a',text:'Confirmer son accord, expliquer brièvement les priorités, réaliser le protocole adapté puis contrôler le résultat.',score:2,consequence:'La prestation est réalisée avec l’accord du résident et les exigences essentielles sont maintenues.',positivePoints:['Communication claire','Adaptation maîtrisée','Contrôle final'],risks:[],recommendedConduct:'Remercier le résident, remettre la chambre en ordre et tracer l’intervention.',explanation:'La meilleure décision concilie la personne, la qualité du service et le protocole professionnel.',nextSceneId:null},
        {id:'s4-b',text:'Faire uniquement ce qui se voit pour sortir le plus vite possible.',score:1,consequence:'Le résident est peu dérangé, mais des points d’hygiène importants peuvent être oubliés.',positivePoints:['Durée limitée.'],risks:['Qualité insuffisante','Traçabilité trompeuse'],recommendedConduct:'Prioriser avec méthode sans supprimer les étapes essentielles.',explanation:'Adapter la durée est possible, mais le protocole et le contrôle ne peuvent pas être remplacés par une simple apparence de propreté.',nextSceneId:null},
        {id:'s4-c',text:'Réaliser silencieusement l’entretien complet sans tenir compte de sa fatigue.',score:0,consequence:'La prestation peut être techniquement complète, mais elle ne respecte pas la situation ni la relation avec le résident.',positivePoints:['Volonté de suivre le protocole.'],risks:['Inconfort','Nouvelle rupture de confiance'],recommendedConduct:'Expliquer, prioriser avec son accord et reprogrammer un complément si nécessaire.',explanation:'La qualité professionnelle inclut l’adaptation et la communication, pas seulement l’exécution technique.',nextSceneId:null},
      ]
    },
  ],
  debrief:{ title:'Bilan · Respecter, adapter et transmettre',summary:'Vous avez accompagné une intervention depuis sa préparation jusqu’à sa clôture, en conciliant respect du résident, sécurité, organisation et qualité.',bestPractices:['Frapper, s’identifier et attendre l’accord.','Respecter un refus et proposer une solution réaliste.','Tracer et transmettre les informations utiles.','Adapter la prestation sans supprimer les exigences essentielles.'],pointsToReview:['Distinguer un respect passif du refus d’une réponse professionnelle complète.','Formuler une transmission factuelle et concise.'],trainerQuestions:['Quelle phrase utiliseriez-vous pour proposer un report ?','Quelles informations sont indispensables dans la transmission ?','Comment prioriser une prestation courte sans perdre en qualité ?'] }
};
