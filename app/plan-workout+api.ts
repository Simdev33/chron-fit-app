import { GoogleGenAI, Type } from '@google/genai';

import type {
  PlannedDay,
  PlannedExercise,
  WorkoutPlan,
  WorkoutPlanRequest,
  WorkoutPlanResponse,
} from '@/types/workoutPlan';

import { logApiFailure } from '@/utils/apiLogging';

const MODEL = 'gemini-3.5-flash-lite';
const MAX_PROMPT_LENGTH = 1_200;
const MIN_PROMPT_LENGTH = 3;
const MAX_CONTEXT_LENGTH = 2_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
/** A plan is one deliberate action, not something to hammer. */
const RATE_LIMIT_REQUESTS = 8;
const MAX_OUTPUT_TOKENS = 3_000;

const SYSTEM_INSTRUCTION = `
Heti edzésterveket állítasz össze egy IBD-vel (Crohn-betegség, colitis ulcerosa)
élő felhasználónak. Tapasztalt edző vagy, aki érti, mit jelent krónikus
bélbetegséggel mozogni.

Amit figyelembe veszel:
- A fáradékonyság az IBD egyik legterhesebb tünete. Ne tervezz olyan hetet,
  ami csak tökéletes napokon teljesíthető.
- Fellángolás idején a mozgás legyen könnyű: séta, nyújtás, légzés. Ilyenkor
  ne adj nagy terhelésű súlyzós napot.
- Sztóma vagy hasi műtét után kerüld az erős hasprést és a nagy súlyú
  emeléseket; helyettük stabilizáló, kontrollált gyakorlatokat adj.
- A rendszeres, mérsékelt mozgás jót tesz a csontsűrűségnek és a hangulatnak,
  különösen szteroid mellett.

A terv felépítése:
- Pontosan hét napot adj vissza, hétfőtől vasárnapig, weekday 0-tól 6-ig.
- Minden napnak legyen egy típusa: strength, cardio, active-rest vagy rest.
- A teljes pihenőnap (rest) is legyen benne, ha a kérés azt indokolja. Egy
  rest napnak ne adj gyakorlatokat.
- A gyakorlatoknál a sets és a reps legyen rövid szöveg, például "3" és
  "8-12". Ha valamit érzésre kell adagolni, írd oda úgy.
- A note mező rövid technikai fogódzó vagy könnyítés, legfeljebb egy mondat.
- Magyarul írj, közvetlenül a felhasználónak.

Amit soha nem teszel:
- Nem adsz orvosi tanácsot, nem módosítasz gyógyszerelést, nem diagnosztizálsz.
- Nem hivatkozol dokumentumokra, irányelvekre vagy forrásokra.
- Nem hárítod el a kérést azzal, hogy ehhez szakember kell. Készítsd el a
  tervet, és ahol óvatosság indokolt, azt a note mezőben mondd el.
`.trim();

type RateLimitEntry = { count: number; resetAt: number };
const rateLimits = new Map<string, RateLimitEntry>();

function json(body: WorkoutPlanResponse, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function getClientId(request: Request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isRateLimited(request: Request) {
  const now = Date.now();
  const clientId = getClientId(request);
  const current = rateLimits.get(clientId);

  if (!current || now > current.resetAt) {
    rateLimits.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_REQUESTS;
}

function clampKind(value: unknown): PlannedDay['kind'] {
  return value === 'strength' ||
    value === 'cardio' ||
    value === 'active-rest' ||
    value === 'rest'
    ? value
    : 'active-rest';
}

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * Ids come from here rather than from the model, because the reps and weights
 * the user types are stored against them. A model-invented id could collide or
 * change between plans and silently reattach old numbers to a new exercise.
 */
function normalisePlan(raw: unknown): WorkoutPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as { summary?: unknown; days?: unknown };
  if (!Array.isArray(source.days) || source.days.length === 0) return null;

  const stamp = Date.now().toString(36);
  const days: PlannedDay[] = source.days
    .slice(0, 7)
    .map((entry, dayIndex) => {
      const day = (entry ?? {}) as Record<string, unknown>;
      const kind = clampKind(day.kind);
      const weekday = Number(day.weekday);

      const exercises: PlannedExercise[] =
        kind === 'rest' || !Array.isArray(day.exercises)
          ? []
          : day.exercises
              .slice(0, 12)
              .map((item, exerciseIndex): PlannedExercise | null => {
                const exercise = (item ?? {}) as Record<string, unknown>;
                const name = text(exercise.name, 80);
                if (!name) return null;
                return {
                  id: `${stamp}-${dayIndex}-${exerciseIndex}`,
                  name,
                  sets: text(exercise.sets, 20) || '3',
                  reps: text(exercise.reps, 20) || '8-12',
                  note: text(exercise.note, 160) || undefined,
                };
              })
              .filter((item): item is PlannedExercise => item !== null);

      const duration = Math.round(Number(day.durationMin));
      return {
        id: `${stamp}-${dayIndex}`,
        weekday:
          Number.isInteger(weekday) && weekday >= 0 && weekday <= 6
            ? weekday
            : dayIndex,
        kind,
        title: text(day.title, 60) || 'Edzésnap',
        focus: text(day.focus, 80) || undefined,
        durationMin:
          Number.isFinite(duration) && duration > 0 && duration <= 300
            ? duration
            : undefined,
        exercises,
      };
    })
    .sort((a, b) => a.weekday - b.weekday);

  return {
    summary: text(source.summary, 300) || 'Heti terv',
    days,
  };
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return json({ error: 'Túl sok kérés egymás után. Várj egy percet.' }, 429);
  }

  let body: WorkoutPlanRequest;
  try {
    body = (await request.json()) as WorkoutPlanRequest;
  } catch {
    return json({ error: 'Hibás kérés.' }, 400);
  }

  const prompt = body?.prompt;
  if (typeof prompt !== 'string' || prompt.trim().length < MIN_PROMPT_LENGTH) {
    return json({ error: 'Írd le, milyen edzéshetet szeretnél.' }, 400);
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return json({ error: 'Ez túl hosszú. Foglald össze rövidebben.' }, 413);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: 'A tervezés még nincs beállítva.' }, 503);
  }

  const context =
    typeof body.context === 'string'
      ? body.context.slice(0, MAX_CONTEXT_LENGTH)
      : '';

  try {
    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1' });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: context
                ? `A felhasználóról tudod:\n${context}\n\nA kérése:\n${prompt.trim()}`
                : prompt.trim(),
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.6,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            days: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  weekday: { type: Type.INTEGER },
                  kind: {
                    type: Type.STRING,
                    enum: ['strength', 'cardio', 'active-rest', 'rest'],
                  },
                  title: { type: Type.STRING },
                  focus: { type: Type.STRING },
                  durationMin: { type: Type.INTEGER },
                  exercises: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        sets: { type: Type.STRING },
                        reps: { type: Type.STRING },
                        note: { type: Type.STRING },
                      },
                      // Without every field required the model drops the
                      // optional ones, exactly as it did for lab ranges.
                      required: ['name', 'sets', 'reps', 'note'],
                    },
                  },
                },
                required: [
                  'weekday',
                  'kind',
                  'title',
                  'focus',
                  'durationMin',
                  'exercises',
                ],
              },
            },
          },
          required: ['summary', 'days'],
        },
      },
    });

    const raw = response.text?.trim();
    if (!raw) {
      return json({ error: 'Nem sikerült tervet készíteni. Próbáld újra.' }, 502);
    }

    const plan = normalisePlan(JSON.parse(raw));
    if (!plan) {
      return json(
        { error: 'A terv üresen jött vissza. Fogalmazd át a kérést.' },
        422,
      );
    }
    return json(plan);
  } catch (error) {
    logApiFailure('plan-workout', error);
    return json(
      { error: 'A tervezés most nem érhető el. Próbáld újra később.' },
      502,
    );
  }
}
