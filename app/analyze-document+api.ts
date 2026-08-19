import { GoogleGenAI, Type } from '@google/genai';

import { logApiFailure } from '@/utils/apiLogging';

const MODEL = 'gemini-3.5-flash-lite';
const MAX_OUTPUT_TOKENS = 4_000;
const GEMINI_TIMEOUT_MS = 90_000;
const MAX_FILE_BASE64_LENGTH = 8_000_000;
const MIN_FILE_BASE64_LENGTH = 500;
const MAX_MEDICATIONS = 25;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 8;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'] as const;

/** Kept in step with the pickers offered in the profile sheet. */
const SEGMENTS = [
  'Terminális ileum',
  'Vakbél',
  'Felszálló vastagbél',
  'Haránt vastagbél',
  'Leszálló vastagbél',
  'Szigmabél',
  'Végbél',
] as const;
const STOMA_TYPES = ['Ileosztóma', 'Kolosztóma', 'Urosztóma'] as const;

type AllowedMime = (typeof ALLOWED_MIME)[number];

export type DocumentAnalyzeRequest = {
  fileBase64: string;
  mimeType: AllowedMime;
};

export type DocumentFindings = {
  /** Null where the document does not say; the app never guesses these. */
  diagnosis: 'crohn' | 'uc' | 'ibdu' | null;
  resectedSegments: string[];
  hasStoma: boolean | null;
  stomaType: string | null;
  hadSurgery: boolean | null;
  surgeryNotes: string;
  medications: { name: string; note: string }[];
  jointSymptoms: boolean | null;
  skinSymptoms: boolean | null;
  /** One or two sentences for Flora's context, in Hungarian. */
  summary: string;
};

export type DocumentAnalyzeResponse = DocumentFindings | { error: string };

const SYSTEM_INSTRUCTION = `
Orvosi dokumentumokból (zárójelentés, ambuláns lap, kórházi összefoglaló) nyersz ki
adatokat egy egészségnaplózó alkalmazás profiljához.

- Csak azt töltsd ki, ami a dokumentumban SZEREPEL. Amit nem találsz, hagyd null értéken
  vagy üresen. Soha ne következtess és ne találj ki adatot.
- diagnosis: 'crohn' Crohn-betegségnél, 'uc' colitis ulcerosánál, 'ibdu' be nem sorolt
  IBD-nél. Ha nem derül ki egyértelműen, legyen null.
- resectedSegments: csak ezekből válassz, és csak ha a dokumentum említi őket:
  ${SEGMENTS.join(', ')}.
- stomaType: csak ${STOMA_TYPES.join(', ')} egyike lehet, vagy null.
- surgeryNotes: a műtétek rövid felsorolása dátummal, ahogy a dokumentumban szerepel.
- medications: a dokumentumban említett gyógyszerek neve; a note mezőbe a dózis vagy az
  alkalmazás módja kerülhet, ha szerepel. Ne egészítsd ki saját tudásból.
- jointSymptoms és skinSymptoms: csak akkor igaz, ha a dokumentum ízületi, illetve
  bőrtünetet említ a betegnél.
- summary: egy-két tömör magyar mondat arról, mi a beteg helyzete a dokumentum alapján.
  Ne adj tanácsot, ne értékelj, csak összefoglalj.
`.trim();

type RateLimitEntry = { count: number; resetAt: number };
const rateLimits = new Map<string, RateLimitEntry>();

function json(body: DocumentAnalyzeResponse, status = 200) {
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

function boolOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function fromList<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  return allowed.includes(value as T) ? (value as T) : null;
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return json(
      { error: 'Túl sok dokumentum egymás után. Várj egy percet.' },
      429,
    );
  }

  let body: DocumentAnalyzeRequest;
  try {
    body = (await request.json()) as DocumentAnalyzeRequest;
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
    return json({ error: 'A dokumentumolvasás még nincs beállítva.' }, 503);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1',
      httpOptions: { timeout: GEMINI_TIMEOUT_MS },
    });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: file } },
            { text: 'Nyerd ki a dokumentumból a beteg adatait.' },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            diagnosis: { type: Type.STRING, nullable: true },
            resectedSegments: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            hasStoma: { type: Type.BOOLEAN, nullable: true },
            stomaType: { type: Type.STRING, nullable: true },
            hadSurgery: { type: Type.BOOLEAN, nullable: true },
            surgeryNotes: { type: Type.STRING },
            medications: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  note: { type: Type.STRING },
                },
                required: ['name', 'note'],
              },
            },
            jointSymptoms: { type: Type.BOOLEAN, nullable: true },
            skinSymptoms: { type: Type.BOOLEAN, nullable: true },
            summary: { type: Type.STRING },
          },
          required: [
            'diagnosis',
            'resectedSegments',
            'hasStoma',
            'stomaType',
            'hadSurgery',
            'surgeryNotes',
            'medications',
            'jointSymptoms',
            'skinSymptoms',
            'summary',
          ],
        },
      },
    });

    const raw = response.text?.trim();
    if (!raw) {
      return json({ error: 'Nem sikerült feldolgozni a dokumentumot.' }, 502);
    }

    let parsed: Partial<DocumentFindings>;
    try {
      parsed = JSON.parse(raw) as Partial<DocumentFindings>;
    } catch {
      return json(
        {
          error:
            'Ez a dokumentum túl hosszú volt egyben. Próbáld a lényeges oldalakkal.',
        },
        422,
      );
    }

    const findings: DocumentFindings = {
      diagnosis: fromList(parsed.diagnosis, ['crohn', 'uc', 'ibdu'] as const),
      // Anything off the list would not match a control in the profile sheet.
      resectedSegments: Array.isArray(parsed.resectedSegments)
        ? parsed.resectedSegments.filter((s): s is string =>
            SEGMENTS.includes(s as (typeof SEGMENTS)[number]),
          )
        : [],
      hasStoma: boolOrNull(parsed.hasStoma),
      stomaType: fromList(parsed.stomaType, STOMA_TYPES),
      hadSurgery: boolOrNull(parsed.hadSurgery),
      surgeryNotes: String(parsed.surgeryNotes ?? '').trim().slice(0, 400),
      medications: Array.isArray(parsed.medications)
        ? parsed.medications
            .filter((m) => m?.name?.trim())
            .slice(0, MAX_MEDICATIONS)
            .map((m) => ({
              name: String(m.name).trim().slice(0, 60),
              note: String(m.note ?? '').trim().slice(0, 60),
            }))
        : [],
      jointSymptoms: boolOrNull(parsed.jointSymptoms),
      skinSymptoms: boolOrNull(parsed.skinSymptoms),
      summary: String(parsed.summary ?? '').trim().slice(0, 600),
    };

    const foundSomething =
      findings.diagnosis !== null ||
      findings.resectedSegments.length > 0 ||
      findings.hasStoma !== null ||
      findings.hadSurgery !== null ||
      findings.medications.length > 0 ||
      findings.summary.length > 0;

    if (!foundSomething) {
      return json(
        {
          error:
            'Ebből a dokumentumból nem tudtam adatot kinyerni. Próbálj egy zárójelentést vagy ambuláns lapot.',
        },
        422,
      );
    }

    return json(findings);
  } catch (error) {
    logApiFailure('analyze-document', error);
    return json(
      { error: 'A dokumentumolvasás most nem érhető el. Próbáld újra később.' },
      502,
    );
  }
}
