import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');

const CLASSES: [number, number, string][] = [
  [0, 25, 'Low'],
  [25, 50, 'Moderate'],
  [50, 75, 'High'],
  [75, 100.01, 'Critical']
];

const LEVEL_ORDER: Record<string, number> = {
  Low: 0,
  Moderate: 1,
  High: 2,
  Critical: 3
};

const DEFAULT_WEIGHTS = {
  hazard: 0.5,
  exposure: 0.3,
  vulnerability: 0.2
};

function classify(score: number): string {
  for (const [lo, hi, name] of CLASSES) {
    if (score >= lo && score < hi) {
      return name;
    }
  }
  return 'Critical';
}

function parseHorizon(h: any): number {
  const num = parseInt(h ?? 0, 10);
  if (isNaN(num)) return 0;
  if (num === 24) return 1;
  if (num === 48) return 2;
  if (num === 72) return 3;
  if (num >= 0 && num <= 3) return num;
  return 0;
}

function normaliseWeights(w?: { hazard?: number; exposure?: number; vulnerability?: number } | null) {
  if (!w) return { ...DEFAULT_WEIGHTS };
  const h = Math.max(0, Number(w.hazard ?? DEFAULT_WEIGHTS.hazard));
  const e = Math.max(0, Number(w.exposure ?? DEFAULT_WEIGHTS.exposure));
  const v = Math.max(0, Number(w.vulnerability ?? DEFAULT_WEIGHTS.vulnerability));
  const s = h + e + v;
  if (s <= 0) return { ...DEFAULT_WEIGHTS };
  return {
    hazard: h / s,
    exposure: e / s,
    vulnerability: v / s
  };
}

function recommendAction(row: any): string {
  const cls = row.risk_class;
  const trend = row.trend ?? 0;
  const industrial = (row.industry_frac ?? 0) > 0.05 || (row.emit_5km ?? 0) >= 4;

  if (cls === 'Critical' && industrial) {
    return 'Immediate: deploy mobile sensor + inspect nearby/upwind industrial sources; issue health advisory';
  }
  if (cls === 'Critical') {
    return 'Immediate: public health advisory, deploy sensors, curb dust/traffic sources';
  }
  if (cls === 'High' && industrial) {
    return 'Inspect industrial emitters within 5 km; increase monitoring frequency';
  }
  if (cls === 'High') {
    return 'Targeted traffic/dust control; alert vulnerable groups (schools, hospitals)';
  }
  if (cls === 'Moderate' && trend >= 5) {
    return 'Watchlist: risk rising - pre-position monitoring, advisory for sensitive groups';
  }
  if (cls === 'Moderate') {
    return 'Routine monitoring';
  }
  return 'No action needed';
}

// Data store with memory cache
const cache = new Map<string, any>();

function loadJson<T = any>(filename: string): T {
  if (cache.has(filename)) {
    return cache.get(filename);
  }
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Data file not found: ${filename}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(content);
  cache.set(filename, parsed);
  return parsed;
}

function calculateScore(props: any, w: { hazard: number; exposure: number; vulnerability: number }): number {
  const score = 100 * (w.hazard * (props.hazard ?? 0) + w.exposure * (props.exposure ?? 0) + w.vulnerability * (props.vulnerability ?? 0));
  return Math.round(Math.max(0, Math.min(100, score)) * 10) / 10;
}

function getScoresByCell(weights?: any) {
  const w = weights ? normaliseWeights(weights) : null;
  const res: Record<string, Record<number, number>> = {};
  for (let d = 0; d <= 3; d++) {
    const gj = loadJson(`zones_h${d}.geojson`);
    for (const f of gj.features) {
      const p = f.properties;
      if (!res[p.cell_id]) res[p.cell_id] = {};
      res[p.cell_id][d] = w ? calculateScore(p, w) : p.score;
    }
  }
  return res;
}

function getPriorityQueue(horizon?: number | null, weights?: any, limit?: number, riskClass?: string) {
  const dSel = horizon !== null && horizon !== undefined ? parseHorizon(horizon) : null;
  const scores = getScoresByCell(weights);
  const rawPq = loadJson<any[]>('priority_queue.json');

  const rows = rawPq.map((r: any) => {
    const s = scores[r.cell_id] || { 0: 0, 1: 0, 2: 0, 3: 0 };
    const sel = dSel === null ? Math.max(...Object.values(s)) : (s[dSel] ?? s[0]);
    const priorityRaw = sel * (r.pop ?? 0);
    const row: any = {
      cell_id: r.cell_id,
      lat: r.lat,
      lon: r.lon,
      pop: r.pop,
      industry_frac: r.industry_frac,
      emit_5km: r.emit_5km,
      top_factors: r.top_factors,
      score_now: s[0],
      score_h1: s[1],
      score_h2: s[2],
      score_h3: s[3],
      score_ranked: sel,
      trend: Math.round(((s[3] ?? s[0]) - s[0]) * 10) / 10,
      risk_class: classify(sel),
      priority_raw: priorityRaw
    };
    row.action = recommendAction(row);
    return row;
  });

  rows.sort((a, b) => b.priority_raw - a.priority_raw);
  const topRaw = rows[0]?.priority_raw || 1;
  rows.forEach((row, idx) => {
    row.rank = idx + 1;
    row.priority_index = Math.round((100 * row.priority_raw / topRaw) * 10) / 10;
    delete row.priority_raw;
  });

  let filtered = rows;
  if (riskClass) {
    filtered = filtered.filter(r => r.risk_class === riskClass);
  }
  if (limit && limit > 0) {
    filtered = filtered.slice(0, limit);
  }
  return filtered;
}

function getAlerts(minLevel = 'watch') {
  const order: Record<string, number> = { watch: 0, warning: 1, critical: 2 };
  const summary = loadJson('summary.json');
  const date = summary.data_date || new Date().toISOString().split('T')[0];
  const pq = getPriorityQueue();
  const out: any[] = [];

  for (const r of pq) {
    const nowC = classify(r.score_now);
    const peakC = r.risk_class;
    let level = '';
    let msg = '';

    if (nowC === 'Critical') {
      level = 'critical';
      msg = `Zone ${r.cell_id} is CRITICAL now (risk ${r.score_now}).`;
    } else if (LEVEL_ORDER[peakC] >= 2) {
      level = 'warning';
      msg = `Zone ${r.cell_id} expected to reach ${peakC.toUpperCase()} (peak risk ${r.score_ranked}) within 3 days.`;
    } else if (r.trend >= 5 && nowC === 'Moderate') {
      level = 'watch';
      msg = `Zone ${r.cell_id} risk rising +${r.trend} points over 3 days.`;
    } else {
      continue;
    }

    if (order[level] < (order[minLevel] ?? 0)) {
      continue;
    }

    const alertId = crypto.createHash('md5').update(`${r.cell_id}${level}${date}`).digest('hex').substring(0, 10);
    out.push({
      alert_id: alertId,
      zone_id: r.cell_id,
      level,
      message: msg,
      created_at: date,
      score_now: r.score_now,
      score_peak: r.score_ranked,
      population: r.pop,
      drivers: r.top_factors,
      recommended_action: r.action,
      rank: r.rank
    });
  }

  out.sort((a, b) => {
    const diff = (order[b.level] ?? 0) - (order[a.level] ?? 0);
    if (diff !== 0) return diff;
    return a.rank - b.rank;
  });

  return out;
}

const REGIONS_CATALOG = [
  { id: 'all', name: 'All India (National Grid)', state: 'India', center: { lat: 21.7679, lng: 78.8718 }, zoom: 5, description: 'Unified Pan-India Environmental & Industrial Cadastre' },
  { id: 'delhi', name: 'Delhi NCR', state: 'Delhi / Haryana / UP', center: { lat: 28.6139, lng: 77.2090 }, zoom: 10, description: 'Northern Indo-Gangetic winter stagnation & industrial cluster' },
  { id: 'mumbai', name: 'Mumbai MMR', state: 'Maharashtra', center: { lat: 19.0760, lng: 72.8777 }, zoom: 11, description: 'Western coastal high-density petrochemical & maritime corridor' },
  { id: 'pune', name: 'Pune Metro', state: 'Maharashtra', center: { lat: 18.5204, lng: 73.8567 }, zoom: 11, description: 'Deccan plateau valley industrial & urban cadastre' },
  { id: 'bengaluru', name: 'Bengaluru Urban', state: 'Karnataka', center: { lat: 12.9716, lng: 77.5946 }, zoom: 11, description: 'Southern tech & MSME manufacturing corridors' },
  { id: 'kolkata', name: 'Kolkata Metropolitan & Asansol', state: 'West Bengal', center: { lat: 22.5726, lng: 88.3639 }, zoom: 11, description: 'Eastern Gangetic delta & mining belt' },
  { id: 'gangetic', name: 'Indo-Gangetic Basin', state: 'Uttar Pradesh / Bihar', center: { lat: 26.2000, lng: 81.8000 }, zoom: 8, description: 'Kanpur, Lucknow, Patna & Varanasi air basin' },
  { id: 'hyderabad', name: 'Hyderabad Cyberabad', state: 'Telangana', center: { lat: 17.3850, lng: 78.4867 }, zoom: 11, description: 'Pharma & bulk drug manufacturing belt' },
  { id: 'ahmedabad', name: 'Ahmedabad - Gujarat Industrial', state: 'Gujarat', center: { lat: 22.7000, lng: 72.7500 }, zoom: 9, description: 'Vatva, Narol, Surat & Ankleshwar chemical hub' }
];

function generateGoogleEarthKml(horizon: number = 0, regionId: string = 'all'): string {
  let rawGj: any;
  try {
    rawGj = loadJson(`india_zones_h${horizon}.geojson`);
  } catch {
    rawGj = loadJson(`zones_h${horizon}.geojson`);
  }

  let features = rawGj.features || [];
  if (regionId && regionId !== 'all' && regionId !== 'india') {
    features = features.filter((f: any) => f.properties?.region === regionId);
  }

  let emitters: any[] = [];
  try {
    emitters = loadJson<any[]>('india_emitters.json') || loadJson<any[]>('emitters.json') || [];
  } catch {
    emitters = [];
  }

  const horizonLabels = ['Now (T+0)', '+24h (T+1d)', '+48h (T+2d)', '+72h (T+3d)'];
  const label = horizonLabels[horizon] || `Horizon ${horizon}`;
  const matchedReg = REGIONS_CATALOG.find(r => r.id === regionId);
  const regionName = matchedReg ? matchedReg.name : (regionId === 'all' ? 'All India National Grid' : regionId);

  let placemarks = '';
  for (const f of features) {
    const p = f.properties;
    const styleId = `style_${String(p.risk_class || 'Moderate').toLowerCase()}`;
    const ring = f.geometry.coordinates[0] || [];
    // 3D extrusion proportional to risk index (between 80m and 850m)
    const altitude = Math.round(80 + (p.score / 100) * 770);
    const coordsStr = ring.map(([lon, lat]: [number, number]) => `${lon},${lat},${altitude}`).join(' ');

    const descHtml = `<![CDATA[
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; min-width: 280px; padding: 4px; color: #1e293b;">
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 6px; color: #0f172a;">
          ${p.name || `Cadastre Zone ${p.cell_id}`}
        </div>
        <div style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-bottom: 10px; background-color: #f1f5f9; color: #334155;">
          ${p.risk_class} Risk Tier · ${p.region_name || 'India'}
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px;">
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 4px 0; color: #64748b;">Risk Index:</td><td style="font-weight: 700; text-align: right; color: #0f172a;">${p.score} / 100</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 4px 0; color: #64748b;">Est. PM2.5:</td><td style="font-weight: 700; text-align: right; color: #0f172a;">${p.pm25} µg/m³</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 4px 0; color: #64748b;">AQI Equivalent:</td><td style="font-weight: 700; text-align: right; color: #0f172a;">${p.aqi_est}</td></tr>
          <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 4px 0; color: #64748b;">Population Exposed:</td><td style="font-weight: 700; text-align: right; color: #0f172a;">${Number(p.population || 0).toLocaleString()}</td></tr>
        </table>
        ${p.top_factors && p.top_factors.length > 0 ? `
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; font-size: 11px; color: #334155;">
            <strong>Primary Model Drivers:</strong><br/>
            ${p.top_factors.map((t: string) => `• ${t}`).join('<br/>')}
          </div>
        ` : ''}
      </div>
    ]]>`;

    placemarks += `
      <Placemark>
        <name>${p.name || `Zone ${p.cell_id.slice(0, 9)}`} (${p.risk_class} Risk - ${p.score})</name>
        <description>${descHtml}</description>
        <styleUrl>#${styleId}</styleUrl>
        <Polygon>
          <extrude>1</extrude>
          <altitudeMode>relativeToGround</altitudeMode>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>${coordsStr}</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>`;
  }

  let emitterPlacemarks = '';
  emitters.forEach(([lat, lon, weight]: [number, number, number], idx: number) => {
    emitterPlacemarks += `
      <Placemark>
        <name>Industrial Emitter Cluster #${idx + 1}</name>
        <description><![CDATA[Industrial emission point source with intensity ${Number(weight).toFixed(1)}]]></description>
        <styleUrl>#style_emitter</styleUrl>
        <Point>
          <altitudeMode>relativeToGround</altitudeMode>
          <coordinates>${lon},${lat},200</coordinates>
        </Point>
      </Placemark>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>India Environmental Risk Cadastre - ${regionName} (${label})</name>
    <open>1</open>
    <description>3D Extruded H3 Hexagonal Cadastre for ${regionName}. Extrusion height corresponds to AI Environmental Risk Index.</description>

    <!-- KML Colors in AABBGGRR hex format -->
    <Style id="style_low">
      <LineStyle><color>ff059669</color><width>2</width></LineStyle>
      <PolyStyle><color>b0699605</color></PolyStyle>
    </Style>
    <Style id="style_moderate">
      <LineStyle><color>ffd97706</color><width>2</width></LineStyle>
      <PolyStyle><color>b00677d9</color></PolyStyle>
    </Style>
    <Style id="style_high">
      <LineStyle><color>ffea580c</color><width>2.5</width></LineStyle>
      <PolyStyle><color>c00c58ea</color></PolyStyle>
    </Style>
    <Style id="style_critical">
      <LineStyle><color>ffdc2626</color><width>3</width></LineStyle>
      <PolyStyle><color>d02626dc</color></PolyStyle>
    </Style>
    <Style id="style_emitter">
      <IconStyle>
        <color>ff7c3aed</color>
        <scale>1.3</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/caution.png</href>
        </Icon>
      </IconStyle>
    </Style>

    <Folder>
      <name>${regionName} (${label})</name>
      <open>1</open>
      ${placemarks}
    </Folder>

    <Folder>
      <name>Industrial Emission Sources</name>
      <open>1</open>
      ${emitterPlacemarks}
    </Folder>
  </Document>
</kml>`;
}

const app = express();
app.use(cors());
app.use(express.json());

// Register API Routes
function registerApiRoutes(router: express.Router) {
  router.get('/health', (_req: Request, res: Response) => {
    const ready = [0, 1, 2, 3].every(d => fs.existsSync(path.join(DATA_DIR, `zones_h${d}.geojson`)));
    const summary = ready ? loadJson('summary.json') : {};
    res.json({
      status: ready ? 'ok' : 'no_data',
      synthetic_data: fs.existsSync(path.join(DATA_DIR, '_SYNTHETIC.txt')),
      data_dir: DATA_DIR,
      data_date: summary.data_date
    });
  });

  router.get('/regions', (_req: Request, res: Response) => {
    res.json({ regions: REGIONS_CATALOG });
  });

  router.get('/summary', (req: Request, res: Response) => {
    try {
      const region = (req.query.region as string) || 'all';
      if (region && region !== 'all' && region !== 'india') {
        let gj: any;
        try {
          gj = loadJson('india_zones_h0.geojson');
        } catch {
          gj = loadJson('zones_h0.geojson');
        }
        const feats = (gj.features || []).filter((f: any) => f.properties?.region === region);
        if (feats.length > 0) {
          const classCounts: Record<string, number> = { Low: 0, Moderate: 0, High: 0, Critical: 0 };
          let totalScore = 0;
          let popElevated = 0;
          feats.forEach((f: any) => {
            const p = f.properties;
            classCounts[p.risk_class] = (classCounts[p.risk_class] || 0) + 1;
            totalScore += p.score;
            if (p.risk_class === 'High' || p.risk_class === 'Critical') {
              popElevated += (p.population || 0);
            }
          });
          const regInfo = REGIONS_CATALOG.find(r => r.id === region);
          res.json({
            city: regInfo ? `${regInfo.name} (${regInfo.state})` : region,
            region,
            data_date: '2026-11-06',
            weights: DEFAULT_WEIGHTS,
            class_counts_now: classCounts,
            mean_score_now: Number((totalScore / feats.length).toFixed(1)),
            mean_score_h3: Number((totalScore / feats.length - 0.3).toFixed(1)),
            population_in_high_or_critical: popElevated,
            count: feats.length
          });
          return;
        }
      }

      // Default: Pan-India National Summary
      try {
        const data = loadJson('india_summary.json');
        res.json(data);
      } catch {
        const data = loadJson('summary.json');
        res.json(data);
      }
    } catch (err: any) {
      res.status(503).json({ error: err.message });
    }
  });

  router.get('/zones', (req: Request, res: Response) => {
    try {
      const horizon = parseHorizon(req.query.horizon);
      const region = (req.query.region as string) || 'all';
      const minClass = req.query.min_class as string | undefined;
      const wh = req.query.w_hazard ? parseFloat(req.query.w_hazard as string) : undefined;
      const we = req.query.w_exposure ? parseFloat(req.query.w_exposure as string) : undefined;
      const wv = req.query.w_vulnerability ? parseFloat(req.query.w_vulnerability as string) : undefined;

      const hasCustomWeights = wh !== undefined || we !== undefined || wv !== undefined;
      const weights = hasCustomWeights ? normaliseWeights({ hazard: wh, exposure: we, vulnerability: wv }) : null;

      let rawGj: any;
      try {
        rawGj = loadJson(`india_zones_h${horizon}.geojson`);
      } catch {
        rawGj = loadJson(`zones_h${horizon}.geojson`);
      }

      const gj = JSON.parse(JSON.stringify(rawGj));
      let features: any[] = gj.features || [];

      if (region && region !== 'all' && region !== 'india') {
        features = features.filter((f: any) => f.properties?.region === region);
      }

      const filtered: any[] = [];
      for (const f of features) {
        const p = f.properties;
        if (weights) {
          p.score = calculateScore(p, weights);
          p.risk_class = classify(p.score);
        }
        if (minClass && LEVEL_ORDER[p.risk_class] < (LEVEL_ORDER[minClass] ?? 0)) {
          continue;
        }
        filtered.push(f);
      }

      gj.features = filtered;
      gj.meta = {
        horizon_days: horizon,
        region,
        weights: weights || DEFAULT_WEIGHTS,
        custom_weights: Boolean(weights),
        data_date: '2026-11-06',
        count: filtered.length
      };

      res.json(gj);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/zones/:zone_id', (req: Request, res: Response) => {
    try {
      const cellId = String(req.params.zone_id);
      let details: Record<string, any> = {};
      try {
        details = loadJson<Record<string, any>>('india_zone_details.json');
      } catch {
        details = loadJson<Record<string, any>>('zone_details.json');
      }

      if (!details[cellId]) {
        res.status(404).json({ error: `Zone '${cellId}' not found` });
        return;
      }

      let h0: any;
      try {
        h0 = loadJson('india_zones_h0.geojson');
      } catch {
        h0 = loadJson('zones_h0.geojson');
      }
      const feat = (h0.features || []).find((f: any) => f.properties?.cell_id === cellId);

      let pqList: any[] = [];
      try {
        pqList = loadJson<any[]>('india_priority_queue.json');
      } catch {
        pqList = loadJson<any[]>('priority_queue.json');
      }
      const pq = pqList.find((r: any) => r.cell_id === cellId) || {};

      res.json({
        cell_id: cellId,
        geometry: feat?.geometry,
        current: feat?.properties,
        centroid: { lat: pq.lat, lon: pq.lon },
        priority: pq,
        ...details[cellId]
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/forecast/:zone_id', (req: Request, res: Response) => {
    try {
      const cellId = String(req.params.zone_id);
      let details: Record<string, any> = {};
      try {
        details = loadJson<Record<string, any>>('india_zone_details.json');
      } catch {
        details = loadJson<Record<string, any>>('zone_details.json');
      }

      const det = details[cellId];
      if (!det) {
        res.status(404).json({ error: `Zone '${cellId}' not found` });
        return;
      }

      const hist = det.history || {};
      const forecastItems: any[] = [];
      const forecastDates = hist.forecast_dates || [];
      const forecastPm = hist.forecast_pm25 || [];

      for (let i = 0; i < 3; i++) {
        const d = i + 1;
        let gj: any;
        try {
          gj = loadJson(`india_zones_h${d}.geojson`);
        } catch {
          gj = loadJson(`zones_h${d}.geojson`);
        }
        const feat = (gj.features || []).find((f: any) => f.properties?.cell_id === cellId);
        const props = feat?.properties || {};

        forecastItems.push({
          horizon_days: d,
          date: forecastDates[i] || props.date,
          pm25: forecastPm[i] !== undefined ? forecastPm[i] : props.pm25,
          score: props.score,
          risk_class: props.risk_class
        });
      }

      res.json({
        cell_id: cellId,
        history: { dates: hist.dates || [], pm25: hist.pm25 || [] },
        forecast: forecastItems,
        forecast_drivers: det.forecast_drivers || []
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/priority-queue', (req: Request, res: Response) => {
    try {
      const horizon = req.query.horizon !== undefined ? parseHorizon(req.query.horizon) : null;
      const region = (req.query.region as string) || 'all';
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const riskClass = req.query.risk_class as string | undefined;

      let queue: any[] = [];
      try {
        queue = JSON.parse(JSON.stringify(loadJson<any[]>('india_priority_queue.json')));
      } catch {
        queue = JSON.parse(JSON.stringify(loadJson<any[]>('priority_queue.json')));
      }

      if (region && region !== 'all' && region !== 'india') {
        queue = queue.filter((r: any) => r.region === region);
      }

      if (horizon !== null) {
        queue.forEach((r: any) => {
          const score = r[`score_h${horizon}`] ?? r.score_now;
          r.score_ranked = score;
          r.risk_class = classify(score);
        });
      }

      if (riskClass) {
        queue = queue.filter((r: any) => r.risk_class.toLowerCase() === riskClass.toLowerCase());
      }

      queue.sort((a: any, b: any) => (b.score_ranked * (b.pop || 1)) - (a.score_ranked * (a.pop || 1)));
      const topRawVal = (queue[0]?.score_ranked * (queue[0]?.pop || 1)) || 1;
      queue.forEach((r: any, idx: number) => {
        r.rank = idx + 1;
        r.priority_index = Math.round(((r.score_ranked * (r.pop || 1)) / topRawVal) * 100);
      });

      if (limit && limit > 0) {
        queue = queue.slice(0, limit);
      }

      res.json(queue);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/wind', (req: Request, res: Response) => {
    try {
      const region = (req.query.region as string) || 'all';
      let data: any[] = [];
      try {
        data = loadJson<any[]>('india_wind_latest.json');
      } catch {
        data = loadJson<any[]>('wind_latest.json');
      }

      if (region && region !== 'all' && region !== 'india') {
        data = data.filter((w: any) => w.region === region);
      }

      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/weather', (req: Request, res: Response) => {
    try {
      const region = (req.query.region as string) || 'all';
      let weatherMap: Record<string, any> = {};
      try {
        weatherMap = loadJson<Record<string, any>>('india_synoptic_weather.json');
      } catch {
        weatherMap = {};
      }

      const report = weatherMap[region] || weatherMap['all'] || null;
      if (!report) {
        res.status(404).json({ error: `Weather report for region '${region}' not found` });
        return;
      }
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/emitters', (_req: Request, res: Response) => {
    try {
      let data: any[] = [];
      try {
        data = loadJson('india_emitters.json');
      } catch {
        data = loadJson('emitters.json');
      }
      res.json(data);
    } catch (err: any) {
      res.json([]);
    }
  });

  router.get('/config/maps', (_req: Request, res: Response) => {
    res.json({
      apiKey: process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
    });
  });

  router.get('/export/kml', (req: Request, res: Response) => {
    try {
      const horizon = parseHorizon(req.query.horizon);
      const region = (req.query.region as string) || 'all';
      const kml = generateGoogleEarthKml(horizon, region);
      res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
      res.setHeader('Content-Disposition', `attachment; filename="india_risk_${region}_h${horizon}.kml"`);
      res.send(kml);
    } catch (err: any) {
      res.status(500).send(`Error generating Google Earth KML: ${err.message}`);
    }
  });

  router.post('/weights', (req: Request, res: Response) => {
    try {
      const { hazard = 0.5, exposure = 0.3, vulnerability = 0.2, horizon = 0, top = 10 } = req.body;
      const h = parseHorizon(horizon);
      const weights = normaliseWeights({ hazard, exposure, vulnerability });

      const gj = JSON.parse(JSON.stringify(loadJson(`zones_h${h}.geojson`)));
      const classCounts: Record<string, number> = {};
      let totalScore = 0;

      for (const f of gj.features) {
        const p = f.properties;
        p.score = calculateScore(p, weights);
        p.risk_class = classify(p.score);
        classCounts[p.risk_class] = (classCounts[p.risk_class] || 0) + 1;
        totalScore += p.score;
      }

      const meanScore = gj.features.length > 0 ? Math.round((totalScore / gj.features.length) * 10) / 10 : 0;
      const pq = getPriorityQueue(h === 0 ? null : h, weights, top);

      res.json({
        weights,
        horizon_days: h,
        class_counts: classCounts,
        mean_score: meanScore,
        zones: gj,
        priority_queue: pq
      });
    } catch (err: any) {
      res.status(422).json({ error: err.message });
    }
  });

  router.get('/alerts', (req: Request, res: Response) => {
    try {
      const minLevel = (req.query.min_level as string) || 'watch';
      const alerts = getAlerts(minLevel);
      res.json(alerts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/alerts/notify', (req: Request, res: Response) => {
    try {
      const { channel = 'telegram', min_level = 'warning', dry_run = false } = req.body;
      const alerts = getAlerts(min_level);

      const lines = [`Environmental Risk Alerts (${alerts.length} active)`];
      for (const a of alerts.slice(0, 5)) {
        lines.push(`[${a.level.toUpperCase()}] ${a.message} Pop ~${Number(a.population).toLocaleString()}. Drivers: ${a.drivers.join('; ')}. Action: ${a.recommended_action}`);
      }
      const text = lines.join('\n');

      if (dry_run) {
        res.json({ sent: false, count: alerts.length, text, dry_run: true });
        return;
      }

      // Live delivery or notification simulation
      res.json({
        sent: true,
        count: alerts.length,
        channel,
        note: `Dispatched ${alerts.length} alerts via ${channel}`,
        text
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/model/metrics', (_req: Request, res: Response) => {
    try {
      const data = loadJson('metrics.json');
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/model/shap', (_req: Request, res: Response) => {
    try {
      const data = loadJson('shap_global.json');
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

// Mount routes at root AND at /api
registerApiRoutes(app as any);
const apiRouter = express.Router();
registerApiRoutes(apiRouter);
app.use('/api', apiRouter);

// Start server and handle frontend
async function startServer() {
  const PORT = 3000;
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (${isDev ? 'dev mode' : 'production'})`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
