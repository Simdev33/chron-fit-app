import { GoogleGenAI } from '@google/genai';

import type {
  FloraChatRequest,
  FloraChatResponse,
} from '@/types/floraChat';

import { logApiFailure } from '@/utils/apiLogging';

const MODEL = 'gemini-3.5-flash-lite';
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_TOTAL_LENGTH = 12_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 15;
// The knowledge base changes rarely, so a warm serverless instance reuses it
// instead of putting a database round-trip in front of every message.
const KNOWLEDGE_TTL_MS = 10 * 60_000;
// Kept well under the client's own budget so a slow lookup cannot be what
// makes Flora time out; she falls back to her base instructions instead.
const KNOWLEDGE_TIMEOUT_MS = 4_000;
// 500 cut ordinary answers off mid-word; a typical reply runs 300-400 tokens,
// so this leaves headroom for the longer ones without inviting essays.
const MAX_OUTPUT_TOKENS = 1_100;
const FINISH_REASON_MAX_TOKENS = 'MAX_TOKENS';
const MEDICATION_QUERY =
  /\b(gyógyszer|gyógyszerek|tabletta|kapszula|adag|dózis|injekció|mesalazin|szteroid|biológiai terápia)\b/i;

const SYSTEM_INSTRUCTION = `
Te Flóra vagy, a CrohnSync empatikus egészség-asszisztense Crohn-betegséggel élő felhasználók számára.

Kötelező biztonsági szabályok:
- Mindig magyarul válaszolj.
- Légy empatikus, tömör, támogató és könnyen érthető.
- Soha ne állíts fel diagnózist, és ne sugallj biztos betegséget vagy állapotot.
- Soha ne írj elő kezelést, gyógyszert vagy adagolást.
- Soha ne utasítsd a felhasználót gyógyszer elkezdésére, elhagyására, cseréjére vagy adagjának módosítására.
- Gyógyszerrel kapcsolatos kérdésnél mondd el, hogy ebben gasztroenterológus vagy kezelőorvos tud biztonságosan dönteni.
- Általános életmódbeli és önmegfigyelési információt adhatsz, de jelezd, hogy az nem helyettesíti az orvosi tanácsot.
- Súlyos vagy gyorsan romló tünetek, erős vérzés, ájulás, kiszáradás, nehézlégzés, magas láz vagy elviselhetetlen fájdalom esetén javasolj sürgős orvosi segítséget; közvetlen veszélyben a 112 hívását.
- Ne állítsd, hogy hozzáférsz olyan naplóhoz, laboreredményhez vagy személyes adathoz, amelyet az aktuális beszélgetés nem tartalmaz.
- Ne kérj szükségtelenül érzékeny személyes adatokat.

Kommunikációs stílus:
- Legyél közvetlen, barátságos, emberi és segítőkész.
- Kerüld a merev, hivatalos, túl száraz vagy mechanikus megfogalmazásokat.
- Úgy beszélgess, mint egy profi, de laza kolléga.

A válasz hossza igazodjon a kérdéshez:
- Egyszerű kérdésre rövid válasz jár: néhány bekezdés bőven elég, ne told ki fölöslegesen.
- Ha viszont a felhasználó tervet, listát, étrendet, edzéstervet vagy részletes leírást kér,
  akkor tényleg add is meg. Ilyenkor legyen konkrét és használható: napokra vagy lépésekre
  bontva, valódi tartalommal.
- Ha megadja az adatait (életkor, testsúly, magasság, célja), vedd figyelembe őket, és
  arra szabd a javaslatot.
- Ne hárítsd el a kérést azzal, hogy ehhez szakember kell. A javaslat végén jelezheted, hogy
  érdemes szakemberrel is egyeztetni, de előtte adj érdemi, kidolgozott választ.
- Étrendi és mozgásbeli tervet nyugodtan összeállíthatsz. Gyógyszerre és adagolásra ez nem
  vonatkozik: ott továbbra is az orvosé a döntés.

A beszélgetés menete:
- A csevegés MÁR elindult egy üdvözléssel, amit a felhasználó lát a képernyőn. Amit te írsz,
  az mindig egy folyamatban lévő beszélgetés következő üzenete.
- Ezért soha ne köszönj és ne mutatkozz be újra. Ne kezdd a választ azzal, hogy "Szia",
  "Helló", "Üdv", "Üdvözöllek" vagy bármilyen köszönés.
- Vágj bele egyből a lényegbe, ahogy egy folyamatos beszélgetésben tennéd.
`.trim();

/** Guards against a bloated or pasted-in context arriving from the client. */
const MAX_USER_CONTEXT_LENGTH = 1_200;

const USER_CONTEXT_PREAMBLE = `
Az alábbi néhány mondat arról szól, akivel épp beszélgetsz. A saját profiljából származik.

- Vedd figyelembe, amikor releváns: erre szabd a tanácsot, és ne mondj ellent neki.
- Ne sorold vissza neki, amit tudsz róla, és ne ezzel kezdd a választ.
- Ne egészítsd ki, és ne következtess belőle olyasmire, ami nem szerepel benne.
- Ha ellentmond annak, amit a beszélgetésben mond, a beszélgetés az erősebb.
`.trim();

const KNOWLEDGE_PREAMBLE = `
Az alábbi ismeretek a TE SAJÁT, belső szaktudásod. Nem külső anyagból olvasod fel őket,
hanem tudod őket, ahogy egy sokat látott szakember tudja a maga területét.

- Úgy beszélj, mint egy nagyon felkészült, tapasztalt szakember: magabiztosan és a magadéként.
- SOHA ne használd ezeket a szavakat: "ESPEN", "ECCO", "IOIBD", "irányelv", "irányelvek",
  "iránymutatás", "protokoll", "szakmai ajánlás", "szakmai konszenzus", "konszenzus",
  "szabvány", "a dokumentum szerint", "a tudásbázis szerint", "a forrás", "a szakirodalom".
- Ne hivatkozz semmilyen szervezetre, kiadványra, tanulmányra vagy dokumentumra.
- Ne kezdd így: "az ajánlás szerint", "a szakirodalom szerint". Egyszerűen mondd ki a lényeget.
- Ha megkérdezik, mire alapozod amit mondasz: egyszerűen és röviden mondd, hogy a szakmai
  tudásodra. Ne sorolj fel forrástípusokat, ne magyarázkodj, és ne is tagadd, hogy dokumentumot
  használsz — arról egyáltalán ne essen szó. Terelj vissza a kérdésére.
- Ha egy kérdésre nincs meg a tudásod, mondd meg őszintén, és ne találj ki adatot.
- Amit mondasz, az általános szakmai tudás, nem a felhasználó személyre szabott kezelési terve;
  ezt továbbra is jelezd, és irányítsd orvoshoz vagy dietetikushoz, ahol indokolt.
- A fenti biztonsági szabályok mindennél erősebbek: gyógyszerről és adagolásról továbbra sem
  nyilatkozol, akkor sem, ha a tudásod említ ilyet.
`.trim();

type KnowledgeRow = {
  source: string;
  source_ref: string | null;
  topic: string;
  grade: string | null;
  content: string;
};

let knowledgeCache: { text: string; loadedAt: number } | null = null;
let knowledgeInFlight: Promise<string> | null = null;

/**
 * Source and grade stay in the database for provenance, but never reach the
 * model. Flora speaks from her own expertise, and the surest way to keep a
 * source name out of an answer is to never put it in the prompt.
 */
function formatKnowledge(rows: KnowledgeRow[]) {
  const byTopic = new Map<string, string[]>();
  for (const row of rows) {
    const list = byTopic.get(row.topic) ?? [];
    list.push(`- ${row.content}`);
    byTopic.set(row.topic, list);
  }
  return [...byTopic.entries()]
    .map(([topic, lines]) => `## ${topic}\n${lines.join('\n')}`)
    .join('\n\n');
}

async function fetchKnowledge(): Promise<string> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return '';

  const endpoint =
    `${url}/rest/v1/flora_knowledge` +
    '?select=source,source_ref,topic,grade,content&order=topic.asc';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KNOWLEDGE_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    if (!response.ok) return '';
    const rows = (await response.json()) as KnowledgeRow[];
    return Array.isArray(rows) ? formatKnowledge(rows) : '';
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Never lets a knowledge-base problem break the chat: on failure Flora answers
 * from her base instructions instead, which are already safe on their own.
 */
async function getKnowledge(): Promise<string> {
  const fresh =
    knowledgeCache && Date.now() - knowledgeCache.loadedAt < KNOWLEDGE_TTL_MS;
  if (fresh) return knowledgeCache!.text;

  if (!knowledgeInFlight) {
    knowledgeInFlight = fetchKnowledge()
      .then((text) => {
        if (text) knowledgeCache = { text, loadedAt: Date.now() };
        return text || knowledgeCache?.text || '';
      })
      .catch(() => knowledgeCache?.text || '')
      .finally(() => {
        knowledgeInFlight = null;
      });
  }
  return knowledgeInFlight;
}

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimits = new Map<string, RateLimitEntry>();

/**
 * The chat UI already opens with Flora's own greeting, so a generated reply is
 * always a continuation. The prompt says so too, but models drift on negative
 * instructions, and a greeting on every single answer is exactly the tic users
 * notice — so strip it rather than hope.
 */
const GREETING_PREFIX =
  // Longest variants first, and a lookahead instead of \b: JS word boundaries
  // are ASCII-only, so "helló" would never match after a trailing accent.
  /^[\s*_#]*(sziasztok|szia|hell[oó]|üdvözöllek|üdv|szervusz|jó reggelt|jó napot|jó estét)(?![a-záéíóöőúüű])[^\n.!?]{0,40}[.!?,…]*\s*/i;

/**
 * Walks back to the end of the last finished sentence. Returns the original if
 * that would throw away most of the answer — a stub is worse than a cut word.
 */
function trimToLastCompleteSentence(text: string) {
  const terminator = /[.!?…]["'”’)\]]?(?=\s|$)/g;
  let end = -1;
  let match: RegExpExecArray | null;
  while ((match = terminator.exec(text)) !== null) {
    end = match.index + match[0].length;
  }
  if (end <= 0) return text;

  const trimmed = text.slice(0, end).trimEnd();
  return trimmed.length >= text.length * 0.5 ? trimmed : text;
}

function stripGreeting(reply: string) {
  const stripped = reply.replace(GREETING_PREFIX, '').trimStart();
  // Only accept it if a real answer is left; never hand back a gutted reply.
  return stripped.length >= 20 ? stripped : reply;
}

/**
 * Flora presents this knowledge as her own, so attribution clauses must not
 * survive. The prompt forbids them and the source labels never reach the model,
 * but this catches anything the model produces from its own training.
 */
const ATTRIBUTION_CLAUSES: RegExp[] = [
  // "az ESPEN irányelve szerint", "az ECCO ajánlása alapján", "az IOIBD szerint"
  /\b(az?\s+)?(espen|ecco|ioibd)\b[^,.;:!?]{0,45}?\b(szerint|alapján)\b\s*,?\s*/gi,
  // "a szakmai irányelvek szerint", "a protokoll alapján", "a dokumentum szerint"
  /\b(az?\s+)?(klinikai\s+|szakmai\s+|nemzetközi\s+)?(irányelvek?|iránymutatások?|protokollok?|konszenzus|szakmai\s+ajánlások?|ajánlások?|dokumentum|tudásbázis|szakirodalom|forrás)\w*\s+\b(szerint|alapján)\b\s*,?\s*/gi,
];

function stripAttribution(reply: string) {
  let out = reply;
  for (const pattern of ATTRIBUTION_CLAUSES) out = out.replace(pattern, '');
  if (out === reply) return reply;

  out = out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/(^|\n)\s*,\s*/g, '$1')
    .trimStart();
  // Removing a leading clause can leave the sentence starting lowercase.
  out = out.replace(/(^|\n)([a-záéíóöőúüű])/g, (_m, lead: string, ch: string) =>
    lead + ch.toUpperCase(),
  );
  return out.trim().length >= 20 ? out : reply;
}

function json(body: FloraChatResponse, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
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

  if (!current || current.resetAt <= now) {
    rateLimits.set(clientId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  if (current.count >= RATE_LIMIT_REQUESTS) return true;
  current.count += 1;
  return false;
}

function isValidRequest(value: unknown): value is FloraChatRequest {
  if (!value || typeof value !== 'object') return false;

  const messages = (value as FloraChatRequest).messages;
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > MAX_MESSAGES ||
    messages[messages.length - 1]?.role !== 'user'
  ) {
    return false;
  }

  let totalLength = 0;
  for (const message of messages) {
    if (
      !message ||
      (message.role !== 'user' && message.role !== 'assistant') ||
      typeof message.text !== 'string' ||
      message.text.trim().length === 0 ||
      message.text.length > MAX_MESSAGE_LENGTH
    ) {
      return false;
    }
    totalLength += message.text.length;
  }

  return totalLength <= MAX_TOTAL_LENGTH;
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return json(
      { error: 'Túl sok kérés érkezett. Kérlek, próbáld újra egy perc múlva.' },
      429,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Érvénytelen kérés.' }, 400);
  }

  if (!isValidRequest(body)) {
    return json({ error: 'Érvénytelen vagy túl hosszú üzenet.' }, 400);
  }

  const latestMessage = body.messages[body.messages.length - 1].text;
  if (MEDICATION_QUERY.test(latestMessage)) {
    return json({
      reply:
        'Értem, hogy ez fontos kérdés. Gyógyszer elkezdéséről, elhagyásáról, cseréjéről vagy adagolásáról nem tudok biztonságosan dönteni. Kérlek, egyeztess a gasztroenterológusoddal vagy a kezelőorvosoddal; sürgős rosszullét esetén kérj azonnali orvosi segítséget.',
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(
      { error: 'Flóra AI-kapcsolata még nincs konfigurálva.' },
      503,
    );
  }

  try {
    const knowledge = await getKnowledge();
    const userContext =
      typeof body.userContext === 'string'
        ? body.userContext.trim().slice(0, MAX_USER_CONTEXT_LENGTH)
        : '';

    const systemInstruction = [
      SYSTEM_INSTRUCTION,
      knowledge ? `${KNOWLEDGE_PREAMBLE}\n\n${knowledge}` : '',
      userContext ? `${USER_CONTEXT_PREAMBLE}\n\n${userContext}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const ai = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1',
    });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: body.messages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.text.trim() }],
      })),
      config: {
        systemInstruction,
        temperature: 0.35,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    });
    const raw = response.text?.trim();

    if (!raw) {
      return json(
        { error: 'Flóra most nem tudott választ készíteni.' },
        502,
      );
    }

    // A raised cap makes truncation rare, not impossible. When it does happen
    // the model stops mid-word, so cut back to the last finished sentence
    // rather than showing the user a severed one.
    const hitCap =
      response.candidates?.[0]?.finishReason === FINISH_REASON_MAX_TOKENS;
    const reply = hitCap ? trimToLastCompleteSentence(raw) : raw;

    return json({ reply: stripAttribution(stripGreeting(reply)) });
  } catch (error) {
    logApiFailure('flora-chat', error);
    return json(
      {
        error:
          'Flóra jelenleg nem érhető el. Kérlek, próbáld újra egy kis idő múlva.',
      },
      502,
    );
  }
}
