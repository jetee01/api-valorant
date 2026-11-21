const http = require('node:http');

const PORT = Number(process.env.PORT) || 3000;
const HENRIK_API_KEY = process.env.HENRIK_API_KEY;
const CACHE_TTL_MS = 60_000;
const cache = new Map();
const validRegions = new Set(['eu', 'na', 'ap', 'kr', 'br', 'latam']);

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function getValue(data, keys) {
  for (const key of keys) {
    if (data?.[key] !== undefined && data[key] !== null && data[key] !== '') {
      return data[key];
    }
  }
  return null;
}

function formatRank(data, name, tag, region) {
  const rank = getValue(data, ['currenttierpatched', 'rank', 'tier', 'current_rank']);
  const rr = getValue(data, ['ranking_in_tier', 'rr', 'rank_rating']);
  const elo = getValue(data, ['elo', 'mmr']);
  const playerName = data?.name || name;
  const playerTag = data?.tag || tag;
  const rankLabel = rank || 'Sem elo ranqueado';
  const rrLabel = rr === null ? '' : ` • ${rr} RR`;
  const message = `${playerName}#${playerTag}: ${rankLabel}${rrLabel}`;

  return {
    name: playerName,
    tag: playerTag,
    region,
    rank: rankLabel,
    rr,
    elo,
    message,
  };
}

async function getRank(name, tag, region) {
  const cacheKey = `${region}:${name.toLowerCase()}:${tag.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = new URL(
    `https://api.henrikdev.xyz/valorant/v3/mmr/${encodeURIComponent(region)}/pc/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
  );
  const response = await fetch(url, {
    headers: { 'X-API-Key': HENRIK_API_KEY },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const error = new Error(`O serviço de elo respondeu com HTTP ${response.status}.`);
    error.status = response.status === 404 ? 404 : 502;
    throw error;
  }

  const payload = await response.json();
  if (payload.status && payload.status >= 400) {
    const error = new Error(payload.errors?.[0]?.message || 'Não foi possível encontrar esse jogador.');
    error.status = payload.status === 404 ? 404 : 502;
    throw error;
  }

  const result = formatRank(payload.data || payload, name, tag, region);
  cache.set(cacheKey, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    return res.end();
  }

  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Método não permitido.' });
  if (url.pathname === '/health') return sendJson(res, 200, { ok: true });

  const match = url.pathname.match(/^\/api\/rank(?:\/text)?\/?$/);
  if (!match) return sendJson(res, 404, { error: 'Rota não encontrada.' });
  if (!HENRIK_API_KEY) {
    return sendJson(res, 503, { error: 'Configure a variável HENRIK_API_KEY no servidor.' });
  }

  const name = (url.searchParams.get('name') || '').trim();
  const tag = (url.searchParams.get('tag') || '').trim();
  const region = (url.searchParams.get('region') || 'br').toLowerCase();
  if (!name || !tag) {
    return sendJson(res, 400, { error: 'Informe os parâmetros name e tag. Exemplo: ?name=Jogador&tag=BR1' });
  }
  if (name.length > 32 || tag.length > 16 || /[\/#?]/.test(name + tag)) {
    return sendJson(res, 400, { error: 'Riot ID inválido.' });
  }
  if (!validRegions.has(region)) {
    return sendJson(res, 400, { error: 'Região inválida. Use eu, na, ap, kr, br ou latam.' });
  }

  try {
    const result = await getRank(name, tag, region);
    if (url.pathname.endsWith('/text')) {
      res.writeHead(200, {
        'content-type': 'text/plain; charset=utf-8',
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
      });
      return res.end(result.message);
    }
    return sendJson(res, 200, result);
  } catch (error) {
    console.error(error.message);
    return sendJson(res, error.status || 502, { error: error.message || 'Erro ao consultar o elo.' });
  }
});

server.listen(PORT, () => {
  console.log(`API de elo do VALORANT disponível na porta ${PORT}.`);
});
