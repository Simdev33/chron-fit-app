import {
  diagnosisLabels,
  phaseLabels,
  type Profile,
  type SupplementEntry,
} from '@/context/ProfileContext';

/** Matches the server-side cap, so nothing is silently cut in transit. */
const MAX_LENGTH = 1_200;
const FIBER_LABELS = [
  'nagyon alacsony',
  'alacsony',
  'közepes',
  'magas',
  'nagyon magas',
];
/** Mirrors defaultProfile; these mean "nem nyúlt hozzá", not a choice. */
const DEFAULT_DIET = 'standard';
const DEFAULT_FIBER = 3;
const DIET_LABELS: Record<string, string> = {
  'low-residue': 'salakszegény',
  standard: 'normál',
  'high-fiber': 'rostdús',
};

function listNames(entries: SupplementEntry[]) {
  return entries.map((entry) => entry.name).join(', ');
}

/**
 * A compact description of the user, built only from what they actually filled
 * in. Empty fields are skipped rather than sent as "nincs megadva", which would
 * spend tokens to say nothing and invite the model to comment on the gaps.
 */
export function buildUserContext(profile: Profile): string {
  const parts: string[] = [];

  if (profile.documentSummary) parts.push(profile.documentSummary);

  const basics = [
    diagnosisLabels[profile.diagnosis],
    profile.phase !== 'unknown' ? phaseLabels[profile.phase] : '',
    profile.age && `${profile.age} éves`,
    profile.weightKg && `${profile.weightKg} kg`,
    profile.heightCm && `${profile.heightCm} cm`,
  ].filter(Boolean);
  if (basics.length) parts.push(`${basics.join(', ')}.`);

  // Medication lists: "nem szed" is as useful to Flora as a list of names.
  if (profile.noPrescribedMeds) {
    parts.push('Felírt gyógyszert nem szed.');
  } else if (profile.prescribedMeds.length) {
    parts.push(`Felírt gyógyszerei: ${listNames(profile.prescribedMeds)}.`);
  }

  if (profile.noBiologics) {
    parts.push('Biológiai terápiát nem kap.');
  } else if (profile.biologics.length) {
    parts.push(`Biológiai terápia: ${listNames(profile.biologics)}.`);
  }

  if (!profile.noVitamins && profile.vitamins.length) {
    parts.push(`Vitaminok, kiegészítők: ${listNames(profile.vitamins)}.`);
  }
  if (!profile.noFitnessSupplements && profile.fitnessSupplements.length) {
    parts.push(
      `Fitnesz-kiegészítők: ${listNames(profile.fitnessSupplements)}.`,
    );
  }

  if (profile.noTriggerFoods) {
    parts.push('Nincs ismert trigger étele.');
  } else if (profile.triggerFoods.length) {
    parts.push(`Trigger ételek: ${profile.triggerFoods.join(', ')}.`);
  }

  if (profile.hasStoma) {
    parts.push(
      `Sztómája van${profile.stomaType ? ` (${profile.stomaType})` : ''}.`,
    );
  }
  if (profile.resectedSegments.length) {
    parts.push(
      `Érintett bélszakaszok: ${profile.resectedSegments.join(', ')}.`,
    );
  }
  if (profile.hadSurgery && profile.surgeryNotes) {
    parts.push(`Műtétek: ${profile.surgeryNotes}`);
  }
  if (profile.jointSymptoms) parts.push('Ízületi panaszai vannak.');
  if (profile.skinSymptoms) parts.push('Bőrtünetei vannak.');

  // Only sent when the user moved off the default. Passing the untouched value
  // along would tell Flora the user chose a normal diet when they never said so.
  const diet =
    profile.dietApproach === DEFAULT_DIET
      ? ''
      : DIET_LABELS[profile.dietApproach];
  const fiber =
    profile.fiberTolerance === DEFAULT_FIBER
      ? ''
      : FIBER_LABELS[profile.fiberTolerance - 1];
  if (diet || fiber) {
    parts.push(
      `Étrend: ${[diet, fiber && `${fiber} rosttolerancia`]
        .filter(Boolean)
        .join(', ')}.`,
    );
  }

  if (profile.noExercise) {
    parts.push('Jelenleg nem sportol.');
  } else if (profile.workoutFrequency > 0) {
    const focus = profile.workoutFocus.length
      ? `, ${profile.workoutFocus.join(', ')}`
      : '';
    parts.push(`Heti ${profile.workoutFrequency} alkalommal mozog${focus}.`);
  }

  const text = parts.join(' ');
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1)}…` : text;
}
