import { File, Paths } from 'expo-file-system';
import {
  EncodingType,
  StorageAccessFramework,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import {
  MOOD_LABELS,
  mealTypeLabels,
  portionLabels,
  toIsoDate,
  type AppointmentEntry,
  type MealEntry,
  type MedicationEntry,
  type SymptomEntry,
} from '@/context/HealthLogContext';
import {
  diagnosisLabels,
  phaseLabels,
  type Profile,
} from '@/context/ProfileContext';

const DAYS = 90;

type LogShape = {
  moods: Record<string, number>;
  symptoms: Record<string, SymptomEntry[]>;
  meals: Record<string, MealEntry[]>;
  medications: MedicationEntry[];
  appointments: AppointmentEntry[];
  noMeds: boolean;
};

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function hu(dateIso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(`${dateIso}T12:00:00`).toLocaleDateString('hu-HU', opts);
}

/** Az elmúlt 90 nap ISO dátumai, a maitól visszafelé. */
function lastDays(): string[] {
  const out: string[] = [];
  for (let i = 0; i < DAYS; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(toIsoDate(d));
  }
  return out;
}

/** Napi átlagos fájdalom-polyline az SVG grafikonhoz. */
function buildPainChart(days: string[], log: LogShape): string {
  const w = 660;
  const h = 180;
  const padL = 28;
  const padB = 24;
  const chartW = w - padL - 8;
  const chartH = h - padB - 8;

  // időrendben (legrégebbi elöl)
  const ordered = [...days].reverse();
  const points: { x: number; y: number; blood: boolean }[] = [];
  ordered.forEach((iso, i) => {
    const entries = log.symptoms[iso] ?? [];
    if (entries.length === 0) return;
    const avg =
      entries.reduce((s, e) => s + e.pain, 0) / Math.max(entries.length, 1);
    const x = padL + (i / (ordered.length - 1)) * chartW;
    const y = 8 + chartH - (avg / 10) * chartH;
    points.push({ x, y, blood: entries.some((e) => e.blood) });
  });

  const grid = [0, 5, 10]
    .map((v) => {
      const y = 8 + chartH - (v / 10) * chartH;
      return `<line x1="${padL}" y1="${y}" x2="${w - 8}" y2="${y}" stroke="#E9D5FF" stroke-width="1" stroke-dasharray="3,4"/>
        <text x="${padL - 6}" y="${y + 3}" font-size="9" fill="#A78BFA" text-anchor="end">${v}</text>`;
    })
    .join('');

  // Havi címkék
  const monthLabels: string[] = [];
  let lastMonth = '';
  ordered.forEach((iso, i) => {
    const m = iso.slice(0, 7);
    if (m !== lastMonth) {
      lastMonth = m;
      const x = padL + (i / (ordered.length - 1)) * chartW;
      monthLabels.push(
        `<text x="${x}" y="${h - 6}" font-size="9" fill="#A78BFA">${hu(iso, { month: 'short' })}</text>`,
      );
    }
  });

  const polyline =
    points.length > 1
      ? `<polyline points="${points.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')}" fill="none" stroke="#7C3AED" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`
      : '';
  const dots = points
    .map(
      (pt) =>
        `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="3.2" fill="${pt.blood ? '#EF4444' : '#7C3AED'}"/>`,
    )
    .join('');

  const empty =
    points.length === 0
      ? `<text x="${w / 2}" y="${h / 2}" font-size="12" fill="#A78BFA" text-anchor="middle">Nincs rögzített tünet ebben az időszakban</text>`
      : '';

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${grid}${monthLabels.join('')}${polyline}${dots}${empty}</svg>`;
}

function buildSummary(days: string[], log: LogShape) {
  const allEntries: { date: string; entry: SymptomEntry }[] = [];
  days.forEach((iso) =>
    (log.symptoms[iso] ?? []).forEach((entry) =>
      allEntries.push({ date: iso, entry }),
    ),
  );
  const loggedDays = new Set(allEntries.map((e) => e.date));
  const bloodDays = new Set(
    allEntries.filter((e) => e.entry.blood).map((e) => e.date),
  );
  const avgPain =
    allEntries.length > 0
      ? allEntries.reduce((s, e) => s + e.entry.pain, 0) / allEntries.length
      : 0;
  const maxPain = allEntries.reduce(
    (max, e) => (e.entry.pain > max.pain ? { pain: e.entry.pain, date: e.date } : max),
    { pain: 0, date: '' },
  );
  const bristolCounts = new Map<number, number>();
  allEntries.forEach((e) => {
    if (e.entry.bristol) {
      bristolCounts.set(
        e.entry.bristol,
        (bristolCounts.get(e.entry.bristol) ?? 0) + 1,
      );
    }
  });
  let topBristol: number | null = null;
  let topBristolCount = 0;
  bristolCounts.forEach((count, type) => {
    if (count > topBristolCount) {
      topBristol = type;
      topBristolCount = count;
    }
  });

  // trend: első vs. második 45 nap átlagfájdalma
  const mid = new Date();
  mid.setDate(mid.getDate() - DAYS / 2);
  const midIso = toIsoDate(mid);
  const older = allEntries.filter((e) => e.date < midIso);
  const newer = allEntries.filter((e) => e.date >= midIso);
  const avgOf = (list: typeof allEntries) =>
    list.length > 0
      ? list.reduce((s, e) => s + e.entry.pain, 0) / list.length
      : null;
  const oldAvg = avgOf(older);
  const newAvg = avgOf(newer);
  let trend = 'A trend megítéléséhez még kevés az adat.';
  if (oldAvg !== null && newAvg !== null) {
    const diff = newAvg - oldAvg;
    trend =
      Math.abs(diff) < 0.5
        ? `A fájdalomszint stabil (átlag ${newAvg.toFixed(1)}/10).`
        : diff < 0
          ? `A fájdalomszint javuló tendenciát mutat (${oldAvg.toFixed(1)} → ${newAvg.toFixed(1)}/10).`
          : `A fájdalomszint emelkedő tendenciát mutat (${oldAvg.toFixed(1)} → ${newAvg.toFixed(1)}/10).`;
  }

  return {
    entryCount: allEntries.length,
    loggedDayCount: loggedDays.size,
    bloodDayCount: bloodDays.size,
    avgPain,
    maxPain,
    topBristol,
    trend,
  };
}

function buildMealSummary(days: string[], log: LogShape) {
  let mealCount = 0;
  let kcalSum = 0;
  const mealDays = new Set<string>();
  days.forEach((iso) => {
    const meals = log.meals[iso] ?? [];
    if (meals.length > 0) mealDays.add(iso);
    meals.forEach((m) => {
      mealCount += 1;
      kcalSum += m.calories ?? 0;
    });
  });
  return {
    mealCount,
    mealDayCount: mealDays.size,
    avgDailyKcal: mealDays.size > 0 ? Math.round(kcalSum / mealDays.size) : 0,
  };
}

export type ExportMode = 'share' | 'save';
export type ExportResult = 'done' | 'cancelled';

export async function exportHealthReport(
  profile: Profile,
  log: LogShape,
  mode: ExportMode = 'share',
): Promise<ExportResult> {
  const days = lastDays();
  const s = buildSummary(days, log);
  const ms = buildMealSummary(days, log);
  const today = toIsoDate(new Date());
  const from = days[days.length - 1];

  const findings: string[] = [s.trend];
  if (s.bloodDayCount > 0) {
    findings.push(
      `Vér jelenléte ${s.bloodDayCount} napon került rögzítésre — a grafikonon piros pontok jelölik.`,
    );
  } else {
    findings.push('Az időszakban nem került rögzítésre vérzés.');
  }
  if (s.topBristol) {
    findings.push(`Leggyakoribb széklettípus: Bristol ${s.topBristol}. típus.`);
  }
  if (s.maxPain.pain > 0) {
    findings.push(
      `Legerősebb fájdalom: ${s.maxPain.pain}/10 (${hu(s.maxPain.date, { month: 'long', day: 'numeric' })}).`,
    );
  }
  if (ms.mealDayCount > 0) {
    findings.push(
      `Étkezésnapló ${ms.mealDayCount} napon vezetve (${ms.mealCount} étkezés), átlagosan ~${ms.avgDailyKcal} kcal/nap.`,
    );
  }
  if (profile.triggerFoods.length > 0) {
    findings.push(
      `Ismert trigger ételek: ${profile.triggerFoods.join(', ')}.`,
    );
  }

  // Napi bontású sorok (csak azok a napok, ahol van adat), legújabb elöl
  const dayRows = days
    .filter(
      (iso) =>
        (log.symptoms[iso] ?? []).length > 0 ||
        (log.meals[iso] ?? []).length > 0 ||
        log.moods[iso],
    )
    .map((iso) => {
      const mood = log.moods[iso];
      const entries = log.symptoms[iso] ?? [];
      const meals = log.meals[iso] ?? [];
      const entryHtml =
        entries.length === 0
          ? '<span class="muted">–</span>'
          : entries
              .map(
                (e) => `
                  <div class="entry">
                    <span class="time">${esc(e.time)}</span>
                    <span>Fájdalom: <b>${e.pain}/10</b></span>
                    ${e.bristol ? `<span>Bristol ${e.bristol}.</span>` : ''}
                    ${e.blood ? '<span class="blood">VÉR</span>' : ''}
                    ${e.note ? `<span class="muted">„${esc(e.note)}"</span>` : ''}
                  </div>`,
              )
              .join('');
      const dayKcal = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
      const mealHtml =
        meals.length === 0
          ? '<span class="muted">–</span>'
          : meals
              .map(
                (m) => `
                  <div class="entry">
                    <span class="time">${esc(m.time)}</span>
                    <span><b>${esc(m.name)}</b></span>
                    <span class="muted">${mealTypeLabels[m.mealType]} · ${portionLabels[m.portion]}</span>
                    <span>${m.calories ?? '–'} kcal</span>
                  </div>`,
              )
              .join('') +
            `<div class="entry muted">Összesen: <b>${dayKcal} kcal</b></div>`;
      return `
        <tr>
          <td class="date">${hu(iso, { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' })}</td>
          <td class="mood">${mood ? MOOD_LABELS[mood - 1] : '–'}</td>
          <td>${entryHtml}</td>
          <td>${mealHtml}</td>
        </tr>`;
    })
    .join('');

  // Gyógyszerlista
  const medRows = log.medications
    .map(
      (m) => `
        <tr>
          <td class="date">${esc(m.name)}</td>
          <td>${esc(m.dose)}</td>
          <td>${esc(
            m.type === 'biologic'
              ? `${m.intervalMonths ?? 1} havonta`
              : m.times.join(', '),
          )}</td>
          <td>${esc(m.since || '–')}</td>
        </tr>`,
    )
    .join('');

  // Közelgő időpontok (mai naptól)
  const upcoming = [...log.appointments]
    .filter((a) => a.date >= today)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const aptRows = upcoming
    .map(
      (a) => `
        <tr>
          <td class="date">${hu(a.date, { year: 'numeric', month: 'short', day: 'numeric' })} ${a.allDay ? 'egész nap' : esc(a.time)}</td>
          <td>${esc(a.doctor)}</td>
          <td>${esc(a.exam)}</td>
        </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1A0D35; padding: 32px; font-size: 12px; }
  .header { background: linear-gradient(120deg, #7C3AED, #6D28D9); border-radius: 16px; padding: 24px 28px; color: #fff; margin-bottom: 20px; }
  .header h1 { font-size: 22px; font-weight: 800; margin-bottom: 2px; }
  .header .sub { color: rgba(255,255,255,0.75); font-size: 12px; }
  .patient { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 14px; }
  .patient div { font-size: 11px; }
  .patient .label { color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1px; font-size: 9px; }
  .patient .value { font-weight: 700; font-size: 13px; }
  .cards { display: flex; gap: 12px; margin-bottom: 20px; }
  .card { flex: 1; border: 1px solid #E9D5FF; border-radius: 12px; padding: 12px 14px; background: #FAF5FF; }
  .card .num { font-size: 20px; font-weight: 800; color: #6D28D9; }
  .card .lbl { font-size: 10px; color: #7E22CE; margin-top: 2px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; color: #7C3AED; margin: 20px 0 10px; }
  .chart-box { border: 1px solid #E9D5FF; border-radius: 12px; padding: 12px; background: #fff; }
  .legend { font-size: 10px; color: #7E22CE; margin-top: 6px; }
  .legend .dot { display: inline-block; width: 8px; height: 8px; border-radius: 99px; margin-right: 4px; vertical-align: middle; }
  .findings { border: 1px solid #E9D5FF; border-left: 4px solid #7C3AED; border-radius: 8px; padding: 12px 16px; background: #FAF5FF; }
  .findings li { margin-left: 16px; margin-bottom: 4px; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #7E22CE; padding: 8px 10px; border-bottom: 2px solid #E9D5FF; }
  td { padding: 8px 10px; border-bottom: 1px solid #F3E8FF; vertical-align: top; }
  td.date { white-space: nowrap; font-weight: 700; color: #4C1D95; }
  td.mood { white-space: nowrap; }
  .entry { margin-bottom: 4px; }
  .entry span { margin-right: 10px; }
  .time { font-weight: 700; color: #7C3AED; }
  .blood { background: #FEE2E2; color: #DC2626; font-weight: 800; font-size: 9px; padding: 1px 6px; border-radius: 99px; }
  .muted { color: #A78BFA; }
  .footer { margin-top: 24px; font-size: 9px; color: #A78BFA; text-align: center; line-height: 1.6; }
</style>
</head>
<body>
  <div class="header">
    <h1>CrohnFit — Tüneti riport</h1>
    <div class="sub">Időszak: ${hu(from, { year: 'numeric', month: 'long', day: 'numeric' })} – ${hu(today, { year: 'numeric', month: 'long', day: 'numeric' })} (90 nap) · Készült: ${hu(today, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
    <div class="patient">
      <div><div class="label">Páciens</div><div class="value">${esc(profile.name || '–')}</div></div>
      <div><div class="label">Email</div><div class="value">${esc(profile.email || '–')}</div></div>
      <div><div class="label">Diagnózis</div><div class="value">${diagnosisLabels[profile.diagnosis]}</div></div>
      <div><div class="label">Aktuális státusz</div><div class="value">${phaseLabels[profile.phase]}</div></div>
    </div>
  </div>

  <div class="cards">
    <div class="card"><div class="num">${s.loggedDayCount}</div><div class="lbl">nap tünetnaplóval</div></div>
    <div class="card"><div class="num">${s.entryCount}</div><div class="lbl">tünetbejegyzés</div></div>
    <div class="card"><div class="num">${s.entryCount > 0 ? s.avgPain.toFixed(1) : '–'}</div><div class="lbl">átlagos fájdalom (0–10)</div></div>
    <div class="card"><div class="num">${s.bloodDayCount}</div><div class="lbl">nap vérzéssel</div></div>
    <div class="card"><div class="num">${ms.mealCount}</div><div class="lbl">rögzített étkezés</div></div>
  </div>

  <h2>Fájdalomszint alakulása (napi átlag)</h2>
  <div class="chart-box">
    ${buildPainChart(days, log)}
    <div class="legend">
      <span class="dot" style="background:#7C3AED"></span>tünetbejegyzés &nbsp;&nbsp;
      <span class="dot" style="background:#EF4444"></span>vér jelenlétével
    </div>
  </div>

  <h2>Lelet-kivonat</h2>
  <div class="findings">
    <ul>${findings.map((f) => `<li>${f}</li>`).join('')}</ul>
  </div>

  <h2>Napi napló</h2>
  <table>
    <thead><tr><th style="width:120px">Dátum</th><th style="width:70px">Hangulat</th><th>Tünetek</th><th>Étkezések</th></tr></thead>
    <tbody>${dayRows || '<tr><td colspan="4" class="muted">Nincs rögzített adat az időszakban.</td></tr>'}</tbody>
  </table>

  <h2>Aktuális gyógyszerek és kiegészítők</h2>
  <table>
    <thead><tr><th>Név</th><th style="width:100px">Adag</th><th style="width:110px">Időpontok</th><th style="width:110px">Mióta szedi</th></tr></thead>
    <tbody>${
      medRows ||
      `<tr><td colspan="4" class="muted">${
        log.noMeds
          ? 'A páciens jelzése szerint nem szed rendszeresen gyógyszert.'
          : 'Nincs rögzített gyógyszer.'
      }</td></tr>`
    }</tbody>
  </table>

  <h2>Közelgő orvosi időpontok</h2>
  <table>
    <thead><tr><th style="width:160px">Mikor</th><th>Orvos / intézmény</th><th>Vizsgálat</th></tr></thead>
    <tbody>${aptRows || '<tr><td colspan="3" class="muted">Nincs közelgő időpont.</td></tr>'}</tbody>
  </table>

  <div class="footer">
    Ezt a riportot a CrohnFit alkalmazás készítette a felhasználó saját naplóbejegyzései alapján.<br/>
    Nem minősül orvosi leletnek — a diagnózis és a kezelés kérdésében mindig a kezelőorvos dönt.
  </div>
</body>
</html>`;

  if (Platform.OS === 'web') {
    // Rejtett iframe-be töltjük a riportot és azt nyomtatjuk — így nem kell
    // felugró ablak (amit a böngészők gyakran blokkolnak). A nyomtatási
    // párbeszédből PDF-be menthető.
    const doc = (globalThis as any).document;
    const frame = doc.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    doc.body.appendChild(frame);

    const frameDoc = frame.contentDocument ?? frame.contentWindow?.document;
    if (!frameDoc) {
      doc.body.removeChild(frame);
      throw new Error('Nem sikerült előkészíteni a nyomtatást.');
    }
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();
    frameDoc.title = `CrohnFit riport ${today}`;

    // Rövid várakozás, hogy a tartalom biztosan lerenderelődjön.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const frameWin = frame.contentWindow;
    const cleanup = () => {
      if (frame.parentNode) doc.body.removeChild(frame);
    };
    if (frameWin) {
      frameWin.onafterprint = cleanup;
      frameWin.focus();
      frameWin.print();
    }
    // Biztonsági takarítás, ha az onafterprint nem fut le.
    setTimeout(cleanup, 60000);
    return 'done';
  }

  // A printToFileAsync a rendszer közös gyorsítótárába ment, amit Expo Go-ban
  // sem a megosztó, sem a fájlkezelő modul nem olvashat ("Not allowed to read
  // file under given URL"). Ezért base64-ként kérjük el a PDF tartalmát, és
  // közvetlenül az app saját (engedélyezett) könyvtárába írjuk ki.
  const { uri, base64 } = await Print.printToFileAsync({ html, base64: true });
  const fileName = `CrohnFit-riport-${today}`;

  // Helyi mentés Androidon: a rendszer mappaválasztójával a felhasználó
  // kiválasztja a célmappát (pl. Letöltések), és oda írjuk a PDF-et.
  // iOS-en a megosztási panel "Mentés a Fájlok appba" opciója tölti be
  // ugyanezt a szerepet, ezért ott a megosztási ág fut.
  if (mode === 'save' && Platform.OS === 'android') {
    if (!base64) {
      throw new Error('Nem sikerült előállítani a PDF tartalmát.');
    }
    const permissions =
      await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      return 'cancelled';
    }
    const destUri = await StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      fileName,
      'application/pdf',
    );
    await writeAsStringAsync(destUri, base64, {
      encoding: EncodingType.Base64,
    });
    return 'done';
  }

  let shareUri = uri;
  try {
    if (base64) {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const dest = new File(Paths.cache, `${fileName}.pdf`);
      if (dest.exists) dest.delete();
      dest.write(bytes);
      shareUri = dest.uri;
    }
  } catch (err) {
    console.warn('PDF másolás az app könyvtárába nem sikerült:', err);
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(shareUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Tüneti riport megosztása',
      UTI: 'com.adobe.pdf',
    });
  } else {
    // Ha a megosztás nem elérhető, a rendszer nyomtatási ablakát nyitjuk meg.
    await Print.printAsync({ uri: shareUri });
  }
  return 'done';
}
