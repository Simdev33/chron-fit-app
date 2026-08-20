import type { Profile } from '@/context/ProfileContext';

export type NutritionTargets = {
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  fiberG: number;
};

/**
 * Mifflin-St Jeor, which needs a sex the profile does not ask for. The two
 * variants differ by a fixed constant (+5 and -161), so the midpoint is used:
 * that is at most ~83 kcal out either way, well inside the ±10% these
 * equations carry anyway. Asking for one would tighten it.
 */
const SEX_NEUTRAL_OFFSET = -78;

/**
 * Light activity. A sedentary factor would understate most people, and
 * anything higher would have to be guessed -- the app does not track steps.
 */
const ACTIVITY_FACTOR = 1.375;

/**
 * Grams per kilogram. Higher than the 0.8 g/kg general reference, because
 * protein needs run higher with IBD, and low intake is a far more common
 * problem here than excess.
 */
const PROTEIN_PER_KG = 1.2;

/** Share of energy from fat; the rest of it goes to carbohydrate. */
const FAT_ENERGY_SHARE = 0.3;

const KCAL_PER_G_FAT = 9;
const KCAL_PER_G_CARB = 4;

/** Grams of fibre per 1000 kcal at an average tolerance. */
const FIBRE_PER_1000_KCAL = 14;
/** Indexed by fiberTolerance 1-5, where 3 is the untouched default. */
const FIBRE_TOLERANCE_SCALE = [0.5, 0.75, 1, 1.15, 1.3];
const FIBRE_CEILING_G = 35;

function positiveNumber(value: string) {
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Null while the profile is missing what the estimate needs -- better an
 * honest prompt than a number built on defaults the user never entered.
 */
export function computeNutritionTargets(
  profile: Pick<Profile, 'age' | 'weightKg' | 'heightCm' | 'fiberTolerance'>,
): NutritionTargets | null {
  const age = positiveNumber(profile.age);
  const weight = positiveNumber(profile.weightKg);
  const height = positiveNumber(profile.heightCm);
  if (!age || !weight || !height) return null;

  const bmr =
    10 * weight + 6.25 * height - 5 * age + SEX_NEUTRAL_OFFSET;
  // Maintenance, with no deficit applied. Unintended weight loss is one of
  // the things IBD already does; the app should not push in that direction.
  const calories = Math.round((bmr * ACTIVITY_FACTOR) / 10) * 10;

  const proteinG = Math.round(weight * PROTEIN_PER_KG);
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

  return { calories, carbsG, proteinG, fatG, fiberG };
}
