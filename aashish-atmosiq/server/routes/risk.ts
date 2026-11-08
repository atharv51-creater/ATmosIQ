/**
 * Thin authenticated proxy from the ATmosIQ Express API to the Python FastAPI
 * risk service (Pune H3 grid + XGBoost forecasts). Keeping it server-side means
 * the browser has one origin, cookies stay same-site, and the FastAPI service is
 * never exposed directly.
 */
import { Router, type Request, type Response } from 'express';
import { config } from '../config.js';
import { requireAuth } from './auth.js';
import { zoneBrief } from '../riskBrief.js';

export const riskRouter = Router();

async function forward(req: Request, res: Response, path: string, method: 'GET' | 'POST' = 'GET') {
  const qs = new URLSearchParams(req.query as Record<string, string>).toString();
  const target = `${config.riskApiUrl}${path}${qs ? `?${qs}` : ''}`;
  try {
    const upstream = await fetch(target, {
      method,
      headers: {
        accept: 'application/json',
        ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
      },
      body: method === 'POST' ? JSON.stringify(req.body ?? {}) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const text = await upstream.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { error: `Risk service returned non-JSON (${upstream.status})` };
    }
    res.status(upstream.status).json(json);
  } catch (err) {
    console.error('[risk]', path, err instanceof Error ? err.message : err);
    res.status(502).json({
      error: 'Risk / ML service is unavailable. Start it with: uvicorn app.main:app --port 8000',
      upstream: config.riskApiUrl,
    });
  }
}

riskRouter.get('/status', requireAuth, (req, res) => forward(req, res, '/health'));
riskRouter.get('/model-status', requireAuth, (req, res) => forward(req, res, '/model/status'));
riskRouter.get('/summary', requireAuth, (req, res) => forward(req, res, '/summary'));
riskRouter.get('/zones', requireAuth, (req, res) => forward(req, res, '/zones'));
riskRouter.get('/priority', requireAuth, (req, res) => forward(req, res, '/priority-queue'));
riskRouter.get('/wind', requireAuth, (req, res) => forward(req, res, '/wind'));
riskRouter.get('/alerts', requireAuth, (req, res) => forward(req, res, '/alerts'));
riskRouter.get('/metrics', requireAuth, (req, res) => forward(req, res, '/model/metrics'));
riskRouter.get('/shap', requireAuth, (req, res) => forward(req, res, '/model/shap'));
riskRouter.get('/model-forecast', requireAuth, (req, res) => forward(req, res, '/model/forecast'));
riskRouter.get('/regions', requireAuth, (req, res) => forward(req, res, '/regions'));

riskRouter.get('/zones/:id', requireAuth, (req, res) =>
  forward(req, res, `/zones/${encodeURIComponent(req.params.id)}`));
riskRouter.get('/forecast/:id', requireAuth, (req, res) =>
  forward(req, res, `/forecast/${encodeURIComponent(req.params.id)}`));
riskRouter.get('/explain/:id', requireAuth, (req, res) =>
  forward(req, res, `/model/explain/${encodeURIComponent(req.params.id)}`));
riskRouter.get('/predict/:id', requireAuth, (req, res) =>
  forward(req, res, `/model/predict/${encodeURIComponent(req.params.id)}`));

riskRouter.post('/zone-brief', requireAuth, async (req, res) => {
  const cellId = typeof req.body?.cell_id === 'string' ? req.body.cell_id.trim() : '';
  if (!/^[0-9a-f]{15}$/i.test(cellId)) {
    res.status(400).json({ error: 'cell_id must be a 15-character H3 cell index' });
    return;
  }
  try {
    res.json(await zoneBrief(cellId));
  } catch (err) {
    console.error('[risk] zone-brief', err instanceof Error ? err.message : err);
    res.status(502).json({ error: 'Could not build an AI risk brief from the risk service.' });
  }
});

riskRouter.post('/weights', requireAuth, (req, res) => forward(req, res, '/weights', 'POST'));
riskRouter.post('/notify', requireAuth, (req, res) => forward(req, res, '/alerts/notify', 'POST'));

export default riskRouter;
