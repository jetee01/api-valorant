# API de elo do VALORANT para Twitch — Cloudflare Workers

Worker que consulta o elo pelo Riot ID (`nick#tag`) usando o serviço HenrikDev. A rota de texto é indicada para custom API/comandos da Twitch.

## Publicar no Cloudflare

1. Instale o Node.js (18 ou superior) e faça clone deste repositório.
2. Na pasta do projeto, instale as dependências:

   ```bash
   npm install
   ```

3. Configure a chave da HenrikDev como secret (o comando pedirá o valor sem gravá-lo no código):

   ```bash
   npx wrangler login
   npx wrangler secret put HENRIK_API_KEY
   ```

4. Publique o Worker:

   ```bash
   npm run deploy
   ```

O Wrangler mostrará o endereço publicado, normalmente `https://api-valorant-rank.<sua-conta>.workers.dev`.

Para testar localmente, configure o secret de desenvolvimento e rode `npm run dev`:

```bash
npx wrangler secret put HENRIK_API_KEY --local
npm run dev
```

## Usar

A região padrão é `br`. Você pode informar o Riot ID de duas formas:

- Separado: `GET /api/rank/text?name=Jogador&tag=BR1`
- Junto: `GET /api/rank/text?riotid=Jogador%23BR1`

Outros exemplos:

- Texto simples: `/api/rank/text?name=Jogador&tag=BR1&region=br`
- JSON: `/api/rank?name=Jogador&tag=BR1`
- Saúde: `/health`

Regiões aceitas: `br`, `na`, `latam`, `eu`, `ap` e `kr`.

A resposta de texto tem o formato `Jogador#BR1: Diamante 2 • 57 RR`. Use a URL pública `/api/rank/text?...` no campo de custom API do seu bot. A sintaxe para interpolar o nick ou o Riot ID depende do bot; se ele fornecer o Riot ID como uma variável única, use o parâmetro `riotid` e codifique `#` como `%23`. Se fornecer nick e tag separadamente, use `name` e `tag`.

## Segurança e funcionamento

- A chave HenrikDev fica guardada como secret no Cloudflare e nunca deve ser colocada na URL do comando.
- O cache do Cloudflare mantém respostas por 60 segundos para reduzir chamadas ao serviço externo.
- O endpoint é público. Para evitar abuso, configure regras de rate limiting no Cloudflare.
