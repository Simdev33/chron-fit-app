import type { HealthLog } from '@/context/HealthLogContext';
import { toIsoDate } from '@/context/HealthLogContext';
import type { Profile } from '@/context/ProfileContext';
import type { DailyProgress } from '@/utils/dailyTasks';
import { computeNutritionTargets } from '@/utils/nutritionTargets';

/**
 * The tip is composed here rather than asked of the model. It appears every
 * time the home screen opens, so a round trip would cost tokens and a spinner
 * on every visit for two sentences -- and the things worth saying are already
 * in the log. Flóra herself stays available for anything that needs her.
 */

type Candidate = {
  /** Higher wins. Ties are broken by the day, so the card is not static. */
  priority: number;
  text: string;
};

function firstName(profile: Profile) {
  const name = profile.name.trim().split(/\s+/)[0];
  return name ? `, ${name}` : '';
}

export function buildFloraTip(
  profile: Profile,
  log: HealthLog,
  progress: DailyProgress,
  now: Date,
): string {
  const who = firstName(profile);
  const todayIso = toIsoDate(now);
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  );
  const yesterdayIso = toIsoDate(yesterday);
  const yesterdayEntry = (log.symptoms[yesterdayIso] ?? []).find(
    (entry) => entry.journalKind === 'yesterday',
  );

  const candidates: Candidate[] = [];

  // What yesterday's journal said outranks everything else: it is the most
  // recent thing the user actually told us.
  if (yesterdayEntry?.fever) {
    candidates.push({
      priority: 100,
      text: `Tegnap lázad volt${who}. Ha ma is megmarad, vagy hasi fájdalommal jár, érdemes felhívnod a gondozó orvosodat — addig pihenj és igyál eleget.`,
    });
  }
  if ((yesterdayEntry?.nightWakings ?? 0) >= 3) {
    candidates.push({
      priority: 80,
      text: `Tegnap éjjel ${yesterdayEntry?.nightWakings}-szor ébredtél fel. A mai napra vegyél vissza a tempóból — a kialvatlanság a tüneteket is felerősíti.`,
    });
  }
  if (yesterdayEntry?.jointPain) {
    candidates.push({
      priority: 70,
      text: `Tegnap ízületi fájdalmad volt${who}. Ma inkább mozogj könnyedén — séta vagy nyújtás jobb választás, mint egy nehéz edzés.`,
    });
  }
  if ((yesterdayEntry?.pain ?? 0) >= 6) {
    candidates.push({
      priority: 75,
      text: `Tegnap erős hasi fájdalmat jelöltél. Ma maradj a bevált, kímélő ételeknél, és figyeld, változik-e valami.`,
    });
  }

  if (profile.phase === 'flare') {
    candidates.push({
      priority: 60,
      text: `Fellángolás módban vagyunk${who}. Igyál eleget a nap folyamán, és inkább több kis adagot egyél, mint keveset és nagyot.`,
    });
    candidates.push({
      priority: 58,
      text: `Fellángolás alatt a rost sokaknál nehezebben megy${who}. Ma maradhatunk a hámozott, főtt változatoknál — a naplóban látni fogjuk, mi vált be.`,
    });
  }

  // Things still open today.
  if (progress.next?.kind === 'medication') {
    candidates.push({
      priority: 50,
      text: `Még vár rád egy adag: ${progress.next.label}${who}. Ha most nem alkalmas, állíts be rá emlékeztetőt.`,
    });
  }
  if (progress.next?.kind === 'journal') {
    candidates.push({
      priority: 45,
      text: `A tegnapi napló még nincs kitöltve${who}. Két perc, és utána sokkal többet tudok mondani arról, mi mozgatja a tüneteidet.`,
    });
  }
  if (progress.next?.kind === 'workout') {
    candidates.push({
      priority: 40,
      text: `A mai edzésed még előtted van: ${progress.next.label}. Étkezés után nagyjából egy órával a legkellemesebb nekifogni.`,
    });
  }

  // How the day is going nutritionally.
  const targets = computeNutritionTargets(profile);
  const meals = log.meals[todayIso] ?? [];
  const kcal = meals.reduce((sum, meal) => sum + (meal.calories ?? 0), 0);
  const protein = meals.reduce((sum, meal) => sum + (meal.proteinG ?? 0), 0);

  if (targets && meals.length === 0 && now.getHours() >= 12) {
    candidates.push({
      priority: 42,
      text: `Ma még nem rögzítettél étkezést${who}. Ha most beírod, amit ettél, a napi keretedből is látod, hol tartasz.`,
    });
  }
  if (targets && protein > 0 && protein < targets.proteinG * 0.5 && now.getHours() >= 15) {
    candidates.push({
      priority: 35,
      text: `A fehérje ma még bőven a napi kereted alatt van${who}. Egy tojás, joghurt vagy egy adag hal sokat lendít rajta.`,
    });
  }
  if (targets && kcal > 0 && kcal < targets.calories * 0.4 && now.getHours() >= 18) {
    candidates.push({
      priority: 38,
      text: `Ma eddig jóval kevesebbet ettél a szokásosnál${who}. IBD mellett a bevitel könnyen lecsúszik — egy laktató vacsora most jól jönne.`,
    });
  }

  // Nothing to nag about.
  if (progress.total > 0 && progress.next === null) {
    candidates.push({
      priority: 30,
      text: `Mára mindent kipipáltál${who}. Ez az a fajta rendszeresség, ami a leglátványosabban javít a hosszú távú képen.`,
    });
  }
  if (yesterdayEntry && !yesterdayEntry.fever && !yesterdayEntry.jointPain) {
    candidates.push({
      priority: 20,
      text: `Szuper, hogy vezeted a naplót${who}. Minél több nap gyűlik össze, annál pontosabban látjuk, mi tesz jót és mi nem.`,
    });
  }

  candidates.push({
    priority: 10,
    text: `Ha bármi kérdésed van a mai napról${who}, csak koppints rám — átnézem, amit eddig rögzítettél.`,
  });
  candidates.push({
    priority: 9,
    text: `A rendszeres, mérsékelt mozgás IBD mellett a hangulatra és a csontokra is jót tesz${who}. Nem kell nagy dolog, egy séta is számít.`,
  });

  const best = Math.max(...candidates.map((item) => item.priority));
  const top = candidates.filter((item) => item.priority === best);
  // Same day, same tip: it should not shuffle on every render.
  const seed = Number(todayIso.replace(/-/g, ''));
  return top[seed % top.length].text;
}
