/**
 * AI risk brief for a single Pune H3 zone. Pulls the zone + model forecast from
 * the FastAPI service, then asks Gemini for a short decision-maker briefing.
 * Falls back to a deterministic summary built from the same numbers.
 */
import { config } from './config.js';
import { generateText, type GeneratedText } from './ai.js';

interface ZoneDetail {
  cell_id: string;
  current: {
    date: string;
    score: number;
    risk_class: string;
    pm25: number;
    aqi_est: number;
    population: number;
    top_factors: string[];
  };
  components: { hazard: number; exposure: number; vulnerability: number };
  priority?: {
    rank?: number;
    action?: string;
    score_peak?: number;
    class_peak?: string;
    emit_5km?: number;
  };
}

interface ZoneForecast {
  forecast: Array<{ horizon_days: number; date: string; pm25: number; score: number; risk_class: string }>;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${config.riskApiUrl}${path}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`risk service ${res.status} for ${path}`);
  return (await res.json()) as T;
}

export function ruleBasedZoneBrief(zone: ZoneDetail, forecast: ZoneForecast | null): string {
  const c = zone.current;
  const drivers = c.top_factors?.length ? c.top_factors.slice(0, 3).join('; ') : 'no dominant driver returned';
  const outlook = forecast?.forecast?.length
    ? forecast.forecast.map((f) => `+${f.horizon_days}d PM2.5 ${f.pm25} (${f.risk_class})`).join(', ')
    : 'no model forecast available';
  const action = zone.priority?.action ?? 'Prioritise emission controls and public-health advisories.';

  return [
    `Zone ${zone.cell_id} is classified ${c.risk_class} risk with a composite score of ${c.score}/100 on ${c.date}. PM2.5 is ${c.pm25} µg/m³ (AQI estimate ${c.aqi_est}) and ${c.population.toLocaleString('en-IN')} people live in this H3 cell.`,
    `The score is driven by hazard ${zone.components.hazard.toFixed(2)}, exposure ${zone.components.exposure.toFixed(2)} and vulnerability ${zone.components.vulnerability.toFixed(2)}. Main factors: ${drivers}. Forecast: ${outlook}.`,
    `Recommended action: ${action}`,
  ].join('\n\n');
}

export interface ZoneBrief extends GeneratedText {
  cell_id: string;
  generated_at: string;
}

export async function zoneBrief(cellId: string): Promise<ZoneBrief> {
  const id = encodeURIComponent(cellId);
  const [detail, forecast] = await Promise.all([
    fetchJson<ZoneDetail>(`/zones/${id}`),
    fetchJson<ZoneForecast>(`/forecast/${id}`).catch(() => null),
  ]);

  const payload = {
    cell_id: detail.cell_id,
    date: detail.current.date,
    score: detail.current.score,
    risk_class: detail.current.risk_class,
    pm25_ug_m3: detail.current.pm25,
    aqi_estimate: detail.current.aqi_est,
    population: detail.current.population,
    components: detail.components,
    top_factors: detail.current.top_factors,
    priority_rank: detail.priority?.rank ?? null,
    priority_action: detail.priority?.action ?? null,
    peak_score: detail.priority?.score_peak ?? null,
    peak_class: detail.priority?.class_peak ?? null,
    forecast: forecast?.forecast?.map((f) => ({
      horizon_days: f.horizon_days,
      date: f.date,
      pm25: f.pm25,
      score: f.score,
      risk_class: f.risk_class,
    })) ?? [],
  };

  const prompt = [
    'You are an environmental risk analyst briefing a city health officer.',
    'Use ONLY the JSON below. Do not invent numbers or dates. If a value is null, say it is unavailable.',
    'Write 3 short paragraphs: (1) current situation for this H3 zone, (2) likely health or ecological impact, (3) two concrete recommended actions.',
    'Under 170 words total. Plain text, no markdown headings.',
    '',
    JSON.stringify(payload),
  ].join('\n');

  const generated = await generateText(prompt, ruleBasedZoneBrief(detail, forecast));
  return { cell_id: cellId, ...generated, generated_at: new Date().toISOString() };
}
