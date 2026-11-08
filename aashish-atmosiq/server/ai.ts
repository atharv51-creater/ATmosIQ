import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { config } from './config.js';
import { getFires } from './data/fires.js';
import { getAirQuality } from './data/airQuality.js';
import { DEFORESTATION_HOTSPOTS } from './data/deforestation.js';
import { haversineKm } from './data/geo.js';

export interface AreaContext {
  name: string;
  lat: number;
  lon: number;
  radiusKm: number;
  fires: { count: number; totalFrp: number; maxFrp: number; live: boolean };
  /** 'unavailable' = the air-quality source failed; 'none-nearby' = source worked but no monitored city within 500 km. */
  airQualityStatus: 'ok' | 'unavailable' | 'none-nearby';
  airQuality: { station: string; distanceKm: number; usAqi: number | null; pm25: number | null; category: string } | null;
  deforestation: { name: string; distanceKm: number; driver: string; severity: string }[];
}

export async function buildContext(name: string, lat: number, lon: number, radiusKm = 150): Promise<AreaContext> {
  const [fires, aq] = await Promise.all([getFires(1), getAirQuality().catch(() => null)]);
  const aqAvailable = aq !== null;

  const near = fires.points.filter((p) => haversineKm(lat, lon, p.lat, p.lon) <= radiusKm);
  const totalFrp = near.reduce((s, p) => s + p.frp, 0);

  let station: AreaContext['airQuality'] = null;
  let best = Infinity;
  for (const s of aq?.points ?? []) {
    const d = haversineKm(lat, lon, s.lat, s.lon);
    if (d < best && d <= 500) {
      best = d;
      station = { station: s.name, distanceKm: Math.round(d), usAqi: s.usAqi, pm25: s.pm25, category: s.category };
    }
  }

  const defo = DEFORESTATION_HOTSPOTS
    .map((h) => ({ h, d: haversineKm(lat, lon, h.lat, h.lon) }))
    .filter((x) => x.d <= 800)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map(({ h, d }) => ({ name: h.name, distanceKm: Math.round(d), driver: h.driver, severity: h.severity }));

  return {
    name, lat, lon, radiusKm,
    fires: {
      count: near.length,
      totalFrp: Math.round(totalFrp),
      maxFrp: Math.round(Math.max(0, ...near.map((p) => p.frp))),
      live: fires.live,
    },
    airQualityStatus: !aqAvailable ? 'unavailable' : station ? 'ok' : 'none-nearby',
    airQuality: station,
    deforestation: defo,
  };
}

/** Deterministic fallback so the feature still works without a Gemini key. */
export function ruleBasedSummary(c: AreaContext): string {
  const parts: string[] = [];
  parts.push(
    c.fires.count === 0
      ? `No high-confidence fire detections within ${c.radiusKm} km in the last 24 hours.`
      : `${c.fires.count} fire detections within ${c.radiusKm} km in the last 24 hours (combined radiative power ${c.fires.totalFrp} MW, strongest ${c.fires.maxFrp} MW).`
  );
  parts.push(
    c.airQuality
      ? `Nearest air-quality reading (${c.airQuality.station}, ${c.airQuality.distanceKm} km away): US AQI ${c.airQuality.usAqi ?? 'n/a'} — ${c.airQuality.category}.`
      : c.airQualityStatus === 'unavailable'
        ? 'Air-quality data is temporarily unavailable, so no air reading is included.'
        : 'No monitored city with an air-quality reading within 500 km.'
  );
  parts.push(
    c.deforestation.length
      ? `Nearby forest-loss pressure: ${c.deforestation.map((d) => `${d.name} (${d.distanceKm} km, ${d.driver})`).join('; ')}.`
      : 'No catalogued deforestation hotspot within 800 km.'
  );
  return parts.join(' ');
}

export interface GeneratedText {
  text: string;
  source: 'gemini' | 'rule-based';
}

// ---- Structured Gemini environmental brief ----

export interface GeminiBriefResult {
  brief: GeminiBrief;
  source: 'gemini' | 'rule-based';
  model: string;
}

const BriefSchema = z.object({
  summary: z.string().min(1),
  risk_level: z.string().min(1),
  risk_reasoning: z.string().min(1),
  top_risk_drivers: z.array(z.string()),
  environmental_observations: z.array(z.string()),
  recommended_actions: z.array(z.string()),
  data_limitations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  model: z.string().optional(),
  generated_at: z.string().optional(),
});
export type GeminiBrief = z.infer<typeof BriefSchema> & {
  model: string;
  generated_at: string;
};

// Schema-constrained JSON schema passed to the Gemini SDK (responseMimeType application/json).
const BRIEF_JSON_SCHEMA = {
  type: Type.OBJECT,
  required: [
    'summary',
    'risk_level',
    'risk_reasoning',
    'top_risk_drivers',
    'environmental_observations',
    'recommended_actions',
    'data_limitations',
    'confidence',
    'model',
  ],
  properties: {
    summary: {
      type: Type.STRING,
      description: 'Two to three sentence situation summary grounded only in the supplied data.',
    },
    risk_level: {
      type: Type.STRING,
      description: 'Qualitative risk level grounded only in the supplied data.',
    },
    risk_reasoning: {
      type: Type.STRING,
      description:
        'Why the location has its current condition, which factors contribute most, concerning measurements, and hazards requiring attention.',
    },
    top_risk_drivers: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Short list of main risk drivers.' },
    environmental_observations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Notable observations with values and distances.',
    },
    recommended_actions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Concrete recommended monitoring / mitigation actions.',
    },
    data_limitations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Missing or uncertain data (e.g. PM10, risk buffers, component scores, historical trend).',
    },
    confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
    model: { type: Type.STRING },
    generated_at: { type: Type.STRING },
  },
};

function buildStructuredPrompt(ctx: AreaContext): string {
  const aq = ctx.airQuality;
  const aqLine = aq
    ? `Nearest air-quality station: ${aq.station} (${aq.distanceKm} km away), US AQI ${aq.usAqi ?? 'n/a'} (${aq.pm25 ?? 'n/a'} µg/m³ PM2.5, ${aq.category}).`
    : ctx.airQualityStatus === 'unavailable'
      ? 'Air-quality source failed; no reading available.'
      : 'No monitored city with an air-quality reading within 500 km.';
  const fireLine =
    ctx.fires.count === 0
      ? `No high-confidence fire detections within ${ctx.radiusKm} km in the last 24 hours.`
      : `${ctx.fires.count} fire detections within ${ctx.radiusKm} km in the last 24 hours (combined radiative power ${ctx.fires.totalFrp} MW, strongest ${ctx.fires.maxFrp} MW).`;
  const defoLine =
    ctx.deforestation.length > 0
      ? `Catalogued forest-loss hotspots nearby: ${ctx.deforestation
          .map((d) => `${d.name} (${d.distanceKm} km, ${d.driver}, severity ${d.severity})`)
          .join('; ')}.`
      : 'No catalogued deforestation hotspot within 800 km.';
  return [
    'You are an environmental risk analyst briefing a decision maker.',
    'Use ONLY the JSON data below. Do not invent numbers, dates, PM10 values, risk-buffer distances, or component scores. If a field is missing or null, say the data is unavailable for this location.',
    'Produce a JSON object with: summary, risk_level, risk_reasoning, top_risk_drivers, environmental_observations, recommended_actions, data_limitations, confidence.',
    '- summary: 2-3 sentence situation summary.',
    '- risk_level: qualitative risk level (Low / Moderate / High / Critical / Undetermined) grounded only in the supplied data.',
    '- risk_reasoning: why the location has its current condition, which factors contribute most, concerning measurements, and hazards requiring attention.',
    '- top_risk_drivers: short array of the main drivers.',
    '- environmental_observations: array of notable observations with values and distances.',
    '- recommended_actions: array of concrete, appropriate monitoring / mitigation actions.',
    '- data_limitations: array of what is missing or uncertain.',
    '- confidence: number 0 to 1.',
    'State whether risk is increasing or decreasing ONLY if historical data supports it; this snapshot has no historical trend, so do not claim a trend.',
    `Location: ${ctx.name} (${ctx.lat.toFixed(4)}, ${ctx.lon.toFixed(4)}), radius ${ctx.radiusKm} km.`,
    `Fire data is ${ctx.fires.live ? 'live' : 'sample data, not live; say so if relevant'}.`,
    aqLine,
    fireLine,
    defoLine,
    'Respond with valid JSON only.',
  ].join('\n');
}

function ruleBasedGeminiBrief(ctx: AreaContext, reason: string): Omit<GeminiBrief, 'model' | 'generated_at'> {
  const text = ruleBasedSummary(ctx);
  const aq = ctx.airQuality;
  const riskLevel = aq?.usAqi != null
    ? aq.usAqi >= 150
      ? 'High'
      : aq.usAqi >= 100
        ? 'Moderate'
        : aq.usAqi >= 50
          ? 'Low'
          : 'Low'
    : ctx.fires.count > 0
      ? 'Elevated (fire)'
      : 'Undetermined';
  const drivers: string[] = [];
  if (aq) drivers.push(`Air quality ${aq.category} (AQI ${aq.usAqi}) at ${aq.station}, ${aq.distanceKm} km away`);
  if (ctx.fires.count > 0) drivers.push(`${ctx.fires.count} fire detections within ${ctx.radiusKm} km`);
  if (ctx.deforestation.length > 0) drivers.push(`Forest-loss pressure near ${ctx.deforestation.map((d) => d.name).join(', ')}`);
  if (!drivers.length) drivers.push('No dominant environmental driver detected in available data.');
  const observations: string[] = [];
  if (aq) observations.push(`US AQI ${aq.usAqi ?? 'n/a'} (${aq.category}), PM2.5 ${aq.pm25 ?? 'n/a'} µg/m³, ${aq.station} (${aq.distanceKm} km)`);
  if (ctx.fires.count > 0) observations.push(`${ctx.fires.count} fire detections, combined FRP ${ctx.fires.totalFrp} MW`);
  if (ctx.deforestation.length > 0) observations.push(`Deforestation hotspots: ${ctx.deforestation.map((d) => `${d.name} (${d.distanceKm} km)`).join('; ')}`);
  if (!observations.length) observations.push('No monitored environmental readings within range.');
  const actions: string[] = [];
  if (aq && (aq.usAqi ?? 0) >= 100) actions.push('Issue a public-health advisory for sensitive groups.');
  if (ctx.fires.count > 0) actions.push('Monitor fire dispersion trajectories and advise downwind communities.');
  if (ctx.deforestation.length > 0) actions.push('Verify canopy-loss boundaries against the next satellite pass.');
  if (!actions.length) actions.push('Maintain routine environmental surveillance.');
  return {
    summary: text,
    risk_level: riskLevel,
    risk_reasoning: text,
    top_risk_drivers: drivers,
    environmental_observations: observations,
    recommended_actions: actions,
    data_limitations: [
      reason,
      'No PM10, risk-buffer, or hazard/exposure/vulnerability component scores available for this location.',
      'No historical trend data; cannot determine whether risk is increasing or decreasing.',
    ],
    confidence: 0.4,
  };
}

export async function buildGeminiBrief(ctx: AreaContext): Promise<GeminiBriefResult> {
  const model = config.geminiModel;
  if (!config.geminiKey) {
    const fallback = ruleBasedGeminiBrief(ctx, 'Gemini API key not configured.');
    return { brief: { ...fallback, model, generated_at: new Date().toISOString() }, source: 'rule-based', model };
  }
  try {
    const ai = new GoogleGenAI({ apiKey: config.geminiKey, apiVersion: config.geminiApiVersion });
    const resp = await ai.models.generateContent({
      model,
      contents: buildStructuredPrompt(ctx),
      config: {
        temperature: 0.2,
        maxOutputTokens: 700,
        responseMimeType: 'application/json',
        responseSchema: BRIEF_JSON_SCHEMA,
        abortSignal: AbortSignal.timeout(20_000),
      },
    });
    const raw = resp.text?.trim();
    if (!raw) throw new Error('empty response');
    const parsed = BriefSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) throw new Error(`schema validation failed: ${JSON.stringify(parsed.error.flatten())}`);
    const brief: GeminiBrief = { ...parsed.data, model, generated_at: new Date().toISOString() };
    return { brief, source: 'gemini', model };
  } catch (err) {
    console.error('[ai] Gemini structured brief failed, using fallback:', err instanceof Error ? err.message : err);
    const fallback = ruleBasedGeminiBrief(ctx, 'Gemini request failed; deterministic fallback used.');
    return { brief: { ...fallback, model, generated_at: new Date().toISOString() }, source: 'rule-based', model };
  }
}

/** Shared Gemini call with a deterministic fallback so callers never fail. */
export async function generateText(prompt: string, fallback: string): Promise<GeneratedText> {
  if (!config.geminiKey) return { text: fallback, source: 'rule-based' };

  try {
    const ai = new GoogleGenAI({ apiKey: config.geminiKey, apiVersion: config.geminiApiVersion });
    const resp = await ai.models.generateContent({
      model: config.geminiModel,
      contents: prompt,
      config: {
        temperature: 0.4,
        maxOutputTokens: 320,
      },
    });
    const text = resp.text?.trim();
    if (!text) throw new Error('empty response');
    return { text, source: 'gemini' };
  } catch (err) {
    console.error('[ai] Gemini failed, using fallback:', err instanceof Error ? err.message : err);
    return { text: fallback, source: 'rule-based' };
  }
}

export async function summarise(c: AreaContext): Promise<GeneratedText> {
  const prompt = [
    'You are an environmental analyst writing a brief for a non-expert decision maker.',
    'Use ONLY the JSON data below. Do not invent numbers. If a field is missing or null, say the data is unavailable. If airQualityStatus is "unavailable" the air-quality source failed; if "none-nearby" there is no monitored city within 500 km.',
    'Write 3 short paragraphs: (1) current situation, (2) likely health or ecological impact, (3) two concrete recommended actions.',
    'Under 170 words total. Plain text, no markdown headings.',
    c.fires.live ? '' : 'Note: fire data is sample data, not live; say so.',
    '',
    JSON.stringify(c),
  ].join('\n');

  return generateText(prompt, ruleBasedSummary(c));
}
