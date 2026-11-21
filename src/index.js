const VALID_REGIONS = new Set(['eu', 'na', 'ap', 'kr', 'br', 'latam']);
const CACHE_TTL_SECONDS = 60;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    },
  });
}

function getValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '') ?? null;
}

function formatRank(payload, name, tag, region) {
  const data = payload?.data ?? payload;
  const current = data?.current ?? data?.mmr ?? data;
  const rank = getValue(
    current?.tier?.name,
    current?.tier?.patched_tier,
    current?.currenttierpatched,
    current?.rank,
    current?.tier,
    current?.current_rank,
  );
  const rr = getValue(current?.rr, current?.ranking_in_tier, current?.rank_rating);
  const elo = getValue(current?.elo, current?.mmr);
  const playerName = getValue(data?.name, data?.account?.name, name);
  const playerTag = getValue(data?.tag, data?.account?.tag, tag);
  const rankLabel = rank ?? 'Sem elo ranqueado';
  const message = `${playerName}#${playerTag}: ${rankLabel}${rr === null ? '' : ` • ${rr} RR`}`;

  return { name: playerName, tag: playerTag, region, rank: rankLabel, rr, elo, message };
}

async function getRank(request, env, name, tag, region) {
  const cache = caches.default;
  const cacheUrl = new URL(request.url);
  cacheUrl.pathname = '/__rank_cache';
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const endpoint = new URL(
    `https://api.henrikdev.xyz/valorant/v3/mmr/${encodeURIComponent(region)}/pc/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
  );
  const upstream = await fetch(endpoint, {
    headers: { 'X-API-Key': env.HENRIK_API_KEY },
    signal: AbortSignal.timeout(10_000),
  });

  if (!upstream.ok) {
    const status = upstream.status === 404 ? 404 : 502;
    return json({ error: `O serviço de elo respondeu com HTTP ${upstream.status}.` }, status);
  }

  const payload = await upstream.json();
  if (payload.status && payload.status >= 400) {
    const status = payload.status === 404 ? 404 : 502;
    return json({ error: payload.errors?.[0]?.message || 'Não foi possível encontrar esse jogador.' }, status);
  }

  const result = formatRank(payload, name, tag, region);
  const isText = new URL(request.url).pathname.endsWith('/text');
  const response = isText
    ? new Response(result.message, {
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'access-control-allow-origin': '*',
          'cache-control': `public, max-age=0, s-maxage=${CACHE_TTL_SECONDS}`,
        },
      })
    : new Response(JSON.stringify(result), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'access-control-allow-origin': '*',
          'cache-control': `public, max-age=0, s-maxage=${CACHE_TTL_SECONDS}`,
        },
      });

  await cache.put(cacheKey, response.clone());
  return response;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
      });
    }
    if (request.method !== 'GET') return json({ error: 'Método não permitido.' }, 405);
    if (url.pathname === '/health') return json({ ok: true });
    if (!/^\/api\/rank(?:\/text)?\/?$/.test(url.pathname)) {
      return json({ error: 'Rota não encontrada.' }, 404);
    }
    if (!env.HENRIK_API_KEY) {
      return json({ error: 'Configure o secret HENRIK_API_KEY no Cloudflare.' }, 503);
    }

    let name = (url.searchParams.get('name') || '').trim();
    let tag = (url.searchParams.get('tag') || '').trim();
    const riotId = (url.searchParams.get('riotid') || '').trim();
    if ((!name || !tag) && riotId.includes('#')) {
      const separator = riotId.lastIndexOf('#');
      name = riotId.slice(0, separator).trim();
      tag = riotId.slice(separator + 1).trim();
    }

    const region = (url.searchParams.get('region') || 'br').toLowerCase();
    if (!name || !tag) {
      return json({ error: 'Informe name e tag ou riotid no formato Jogador#BR1.' }, 400);
    }
    if (name.length > 32 || tag.length > 16 || /[\/#?]/.test(name + tag)) {
      return json({ error: 'Riot ID inválido.' }, 400);
    }
    if (!VALID_REGIONS.has(region)) {
      return json({ error: 'Região inválida. Use eu, na, ap, kr, br ou latam.' }, 400);
    }

    try {
      return await getRank(request, env, name, tag, region);
    } catch (error) {
      console.error(error);
      return json({ error: 'Erro ao consultar o elo. Tente novamente mais tarde.' }, 502);
    }
  },
};
