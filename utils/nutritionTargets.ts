import type {
  ActivityLevel,
  Profile,
  Sex,
} from '@/context/ProfileContext';

export type NutritionTargets = {
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  fiberG: number;
  /** Which formula produced it, so the UI can say how it was reached. */
  basis: 'composition' | 'standard';
};

export const ACTIVITY_OPTIONS: {
  id: Exclude<ActivityLevel, ''>;
  label: string;
  hint: string;
  factor: number;
}[] = [
  {
    id: 'sedentary',
    label: 'Ülő életmód',
    hint: 'Túlnyomórészt ülés, alig mozgás',
    factor: 1.2,
  },
  {
    id: 'light',
    label: 'Enyhén aktív',
    hint: 'Heti 1–3 könnyebb mozgás',
    factor: 1.375,
  },
  {
    id: 'moderate',
    label: 'Közepesen aktív',
    hint: 'Heti 3–5 edzés',
    factor: 1.55,
  },
  {
    id: 'high',
    label: 'Nagyon aktív',
    hint: 'Heti 6–7 edzés vagy fizikai munka',
    factor: 1.725,
  },
];

export const SEX_OPTIONS: { id: Exclude<Sex, ''>; label: string }[] = [
  { id: 'male', label: 'Férfi' },
  { id: 'female', label: 'Nő' },
];

/** Mifflin-St Jeor's sex constants. */
const SEX_OFFSET: Record<Exclude<Sex, ''>, number> = {
  male: 5,
  female: -161,
};

/** Katch-McArdle, which works from lean mass and needs no sex or age. */
const KATCH_BASE = 370;
const KATCH_PER_KG_LEAN = 21.6;

/**
 * Grams per kilogram of body weight. Higher than the 0.8 g/kg general
 * reference, because protein needs run higher with IBD and low intake is a
 * far more common problem here than excess.
 */
const PROTEIN_PER_KG = 1.2;
/**
 * Per kilogram of lean mass, used when body composition is known. For an
 * average composition the two agree; they only diverge where using total
 * weight would be misleading.
 */
const PROTEIN_PER_KG_LEAN = 1.5;

const FAT_ENERGY_SHARE = 0.3;
const KCAL_PER_G_FAT = 9;
const KCAL_PER_G_CARB = 4;

const FIBRE_PER_1000_KCAL = 14;
/** Indexed by fiberTolerance 1-5, where 3 is the untouched default. */
const FIBRE_TOLERANCE_SCALE = [0.5, 0.75, 1, 1.15, 1.3];
const FIBRE_CEILING_G = 35;

function positiveNumber(value: string) {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function activityFactor(level: ActivityLevel) {
  return ACTIVITY_OPTIONS.find((option) => option.id === level)?.factor ?? null;
}

type TargetProfile = Pick<
  Profile,
  | 'age'
  | 'weightKg'
  | 'heightCm'
  | 'sex'
  | 'activityLevel'
  | 'smmKg'
  | 'bodyFatKg'
  | 'fiberTolerance'
>;

/** What the estimate still needs, in the order the profile asks for it. */
export function missingForTargets(profile: TargetProfile) {
  const missing: string[] = [];
  if (!positiveNumber(profile.age)) missing.push('életkor');
  if (!positiveNumber(profile.weightKg)) missing.push('testsúly');
  if (!positiveNumber(profile.heightCm)) missing.push('magasság');
  if (!profile.sex) missing.push('nem');
  if (!activityFactor(profile.activityLevel)) missing.push('életmód');
  return missing;
}

/**
 * Null while the profile is missing what the estimate needs -- better an
 * honest prompt than a number built on defaults the user never entered.
 */
export function computeNutritionTargets(
  profile: TargetProfile,
): NutritionTargets | null {
  const age = positiveNumber(profile.age);
  const weight = positiveNumber(profile.weightKg);
  const height = positiveNumber(profile.heightCm);
  const factor = activityFactor(profile.activityLevel);
  if (!age || !weight || !height || !profile.sex || !factor) return null;

  // Lean mass is what actually burns energy, so when the user knows their fat
  // mass the estimate stops depending on sex and age at all. Falling back to
  // skeletal muscle mass alone would understate it -- organs and bone are lean
  // too -- so only fat mass is used to derive it.
  const bodyFat = positiveNumber(profile.bodyFatKg);
  const leanMass =
    bodyFat !== null && bodyFat < weight ? weight - bodyFat : null;

  const bmr =
    leanMass !== null
      ? KATCH_BASE + KATCH_PER_KG_LEAN * leanMass
      : 10 * weight + 6.25 * height - 5 * age + SEX_OFFSET[profile.sex];

  // Maintenance, with no deficit applied. Unintended weight loss is one of
  // the things IBD already does; the app should not push in that direction.
  const calories = Math.round((bmr * factor) / 10) * 10;

  const proteinG = Math.round(
    leanMass !== null
      ? leanMass * PROTEIN_PER_KG_LEAN
      : weight * PROTEIN_PER_KG,
  );
  const fatG = Math.round((calories * FAT_ENERGY_SHARE) / KCAL_PER_G_FAT);
  const carbsG = Math.max(
    0,
    Math.round(
      (calories - proteinG * KCAL_PER_G_CARB - fatG * KCAL_PER_G_FAT) /
        KCAL_PER_G_CARB,
    ),
  );

  const scale =
    FIBRE_TOLERANCE_SCALE[
      Math.min(4, Math.max(0, (profile.fiberTolerance || 3) - 1))
    ];
  const fiberG = Math.min(
    FIBRE_CEILING_G,
    Math.round((calories / 1000) * FIBRE_PER_1000_KCAL * scale),
  );

  return {
    calories,
    carbsG,
    proteinG,
    fatG,
    fiberG,
    basis: leanMass !== null ? 'composition' : 'standard',
  };
}
