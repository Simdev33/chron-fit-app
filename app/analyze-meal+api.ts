import { GoogleGenAI, Type } from '@google/genai';

import type {
  MealPhotoAnalysis,
  MealPhotoRequest,
  MealPhotoResponse,
} from '@/types/mealPhoto';

import { logApiFailure } from '@/utils/apiLogging';

const MODEL = 'gemini-3.5-flash-lite';
/** Roughly 3 MB of JPEG once base64 decoding is accounted for. */
const MAX_IMAGE_BASE64_LENGTH = 4_000_000;
const MIN_IMAGE_BASE64_LENGTH = 500;
const RATE_LIMIT_WINDOW_MS = 60_000;
/** Lower than the chat: a photo costs far more per call than a message. */
const RATE_LIMIT_REQUESTS = 10;

const SYSTEM_INSTRUCTION = `
Ételfotókat elemzel egy egészségnaplózó alkalmazásban.

- Nevezd meg magyarul, röviden, mi látható a tányéron. Például: "Sült lazac rizzsel".
- Becsüld meg a képen látható adag kalóriatartalmát. Egész szám legyen.
- Becsüld meg az adag méretét is: small, medium vagy large.
- Ha a képen nem étel vagy ital van, vagy nem tudod megnevezni, akkor a recognized mező
  legyen false, a name pedig üres string.
- Ne írj magyarázatot, ne tegyél hozzá tanácsot, csak a kért mezőket töltsd ki.
- A becslés hozzávetőleges: soha ne állítsd, hogy pontos mérés.
`.trim();

type RateLimitEntry = { count: number; resetAt: number };
const rateLimits = new Map<string, RateLimitEntry>();

function json(body: MealPhotoResponse, status = 200) {
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
    rateLimits.set(clientId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_REQUESTS;
}

function clampPortion(value: unknown): MealPhotoAnalysis['portion'] {
  return value === 'small' || value === 'large' ? value : 'medium';
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return json({ error: 'Túl sok fotó egymás után. Várj egy percet.' }, 429);
  }

  let body: MealPhotoRequest;
  try {
    body = (await request.json()) as MealPhotoRequest;
  } catch {
    return json({ error: 'Hibás kérés.' }, 400);
  }

  const image = body?.imageBase64;
  if (typeof image !== 'string' || image.length < MIN_IMAGE_BASE64_LENGTH) {
    return json({ error: 'Nem érkezett kép.' }, 400);
  }
  if (image.length > MAX_IMAGE_BASE64_LENGTH) {
    return json({ error: 'A kép túl nagy. Próbáld újra egy kisebbel.' }, 413);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: 'A képfelismerés még nincs beállítva.' }, 503);
  }

  try {
    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1' });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: image } },
            { text: 'Mi ez az étel, és nagyjából hány kalória?' },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2,
        maxOutputTokens: 200,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recognized: { type: Type.BOOLEAN },
            name: { type: Type.STRING },
            calories: { type: Type.INTEGER },
            portion: {
              type: Type.STRING,
              enum: ['small', 'medium', 'large'],
            },
          },
          required: ['recognized', 'name', 'calories', 'portion'],
        },
      },
    });

    const raw = response.text?.trim();
    if (!raw) {
      return json({ error: 'Nem sikerült felismerni a képet.' }, 502);
    }

    const parsed = JSON.parse(raw) as Partial<MealPhotoAnalysis>;
    if (!parsed.recognized || !parsed.name?.trim()) {
      return json(
        {
          error:
            'Ezen nem sikerült ételt felismernem. Írd be kézzel, vagy próbálj egy tisztább fotót.',
        },
        422,
      );
    }

    const calories = Math.round(Number(parsed.calories));
    return json({
      recognized: true,
      name: parsed.name.trim().slice(0, 80),
      // A wild number helps nobody; fall back rather than store nonsense.
      calories:
        Number.isFinite(calories) && calories > 0 && calories < 5000
          ? calories
          : 0,
      portion: clampPortion(parsed.portion),
    });
  } catch (error) {
    logApiFailure('analyze-meal', error);
    return json(
      { error: 'A képfelismerés most nem érhető el. Próbáld újra később.' },
      502,
    );
  }
}
