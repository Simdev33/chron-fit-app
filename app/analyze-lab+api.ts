import { GoogleGenAI, Type } from '@google/genai';

const MODEL = 'gemini-3.5-flash-lite';
/** A lab report is text-heavy, so it needs more room than a meal photo. */
const MAX_OUTPUT_TOKENS = 2_000;
const MAX_FILE_BASE64_LENGTH = 8_000_000;
const MIN_FILE_BASE64_LENGTH = 500;
const MAX_VALUES = 40;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 8;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'] as const;

type AllowedMime = (typeof ALLOWED_MIME)[number];

export type LabAnalyzeRequest = {
  fileBase64: string;
  mimeType: AllowedMime;
};

type ExtractedValue = {
  name: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
  refRange?: string;
};

export type LabAnalyzeResponse =
  | { date: string | null; values: ExtractedValue[] }
  | { error: string };

const SYSTEM_INSTRUCTION = `
Laborleleteket olvasol ki egy egészségnaplózó alkalmazás számára.

- Másold ki MINDEN vizsgálat nevét, mért értékét és mértékegységét, pontosan úgy, ahogy a
  leleten szerepel. Ne fordítsd le és ne nevezd át őket.
- A refRange mezőbe SZÓ SZERINT másold a leleten látható referenciatartományt.
- A refLow és refHigh a tartomány alsó és felső számértéke. Ha a leleten csak egyik irány
  szerepel (például "< 5,0"), akkor csak azt töltsd ki.
- A date mezőbe a mintavétel dátuma kerüljön ÉÉÉÉ-HH-NN formában. Ha nem szerepel a leleten,
  hagyd üresen.
- A tizedesvesszőt tizedespontként add vissza.
- Ne értelmezd az eredményeket, ne írj véleményt, ne adj tanácsot. Csak kiolvasol.
- Ha a kép vagy a fájl nem laborlelet, üres values listát adj vissza.
`.trim();

type RateLimitEntry = { count: number; resetAt: number };
const rateLimits = new Map<string, RateLimitEntry>();

function json(body: LabAnalyzeResponse, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function isRateLimited(request: Request) {
  const now = Date.now();
  const clientId =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const current = rateLimits.get(clientId);

  if (!current || now > current.resetAt) {
    rateLimits.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_REQUESTS;
}

function finiteOrUndefined(value: unknown): number | undefined {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return json({ error: 'Túl sok lelet egymás után. Várj egy percet.' }, 429);
  }

  let body: LabAnalyzeRequest;
  try {
    body = (await request.json()) as LabAnalyzeRequest;
  } catch {
    return json({ error: 'Hibás kérés.' }, 400);
  }

  const file = body?.fileBase64;
  const mimeType = body?.mimeType;

  if (!ALLOWED_MIME.includes(mimeType)) {
    return json({ error: 'Csak kép vagy PDF tölthető fel.' }, 415);
  }
  if (typeof file !== 'string' || file.length < MIN_FILE_BASE64_LENGTH) {
    return json({ error: 'Nem érkezett fájl.' }, 400);
  }
  if (file.length > MAX_FILE_BASE64_LENGTH) {
    return json({ error: 'A fájl túl nagy. Próbáld egy kisebbel.' }, 413);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: 'A leletbeolvasás még nincs beállítva.' }, 503);
  }

  try {
    const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1' });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: file } },
            { text: 'Olvasd ki a lelet minden vizsgálati eredményét.' },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        // Reading numbers off a page is not a creative task.
        temperature: 0,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            values: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  value: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  refLow: { type: Type.NUMBER },
                  refHigh: { type: Type.NUMBER },
                  refRange: { type: Type.STRING },
                },
                // Without every field required the model quietly drops the
                // upper bound, which is the direction that matters most here.
                required: [
                  'name',
                  'value',
                  'unit',
                  'refLow',
                  'refHigh',
                  'refRange',
                ],
              },
            },
          },
          required: ['date', 'values'],
        },
      },
    });

    const raw = response.text?.trim();
    if (!raw) {
      return json({ error: 'Nem sikerült kiolvasni a leletet.' }, 502);
    }

    const parsed = JSON.parse(raw) as {
      date?: string;
      values?: ExtractedValue[];
    };
    const values = (parsed.values ?? [])
      .filter((row) => row?.name?.trim() && Number.isFinite(Number(row.value)))
      .slice(0, MAX_VALUES)
      .map((row) => ({
        name: String(row.name).trim().slice(0, 60),
        value: Number(row.value),
        unit: String(row.unit ?? '').trim().slice(0, 20),
        refLow: finiteOrUndefined(row.refLow),
        refHigh: finiteOrUndefined(row.refHigh),
        refRange: row.refRange
          ? String(row.refRange).trim().slice(0, 40)
          : undefined,
      }));

    if (values.length === 0) {
      return json(
        {
          error:
            'Ezen nem találtam laboreredményt. Ellenőrizd, hogy a lelet jól látszik-e a képen.',
        },
        422,
      );
    }

    const date =
      typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
        ? parsed.date
        : null;

    return json({ date, values });
  } catch {
    return json(
      { error: 'A leletbeolvasás most nem érhető el. Próbáld újra később.' },
      502,
    );
  }
}
