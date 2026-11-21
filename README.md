# API de elo do VALORANT para Twitch

API em Node.js que consulta o elo de uma conta pelo Riot ID (`nick#tag`), usando o serviço HenrikDev. O endpoint de texto foi pensado para serviços de comando/custom API da Twitch.

## Requisitos

- Node.js 18 ou superior
- Uma chave de API do HenrikDev

## Executar

```bash
npm start
```

Configure a chave no ambiente do servidor (não coloque a chave no código nem na URL pública):

```bash
HENRIK_API_KEY=sua_chave PORT=3000 npm start
```

No Windows PowerShell:

```powershell
$env:HENRIK_API_KEY="sua_chave"
$env:PORT="3000"
npm start
```

## Usar

Passe o nick e a tag como parâmetros separados. A região padrão é `br`.

- Texto simples, ideal para custom API/comando: `GET /api/rank/text?name=Jogador&tag=BR1`
- JSON: `GET /api/rank?name=Jogador&tag=BR1`
- Outras regiões: acrescente `&region=na` (regiões aceitas: `br`, `na`, `latam`, `eu`, `ap`, `kr`).
- Verificação de saúde: `GET /health`

Exemplo de resposta de texto:

```text
Jogador#BR1: Diamante 2 • 57 RR
```

Exemplo JSON:

```json
{
  "name": "Jogador",
  "tag": "BR1",
  "region": "br",
  "rank": "Diamante 2",
  "rr": 57,
  "elo": 1820,
  "message": "Jogador#BR1: Diamante 2 • 57 RR"
}
```

Use a URL pública `/api/rank/text?...` no campo de custom API do seu bot. A sintaxe exata da variável para inserir nick/tag depende do bot da Twitch; informe o Riot ID como dois parâmetros (`name` e `tag`). Exemplo de URL para testar:

```text
https://SEU-DOMINIO/api/rank/text?name=Jogador&tag=BR1&region=br
```

O endpoint JSON também pode ser usado por bots que permitem selecionar um campo da resposta, como `message` ou `rank`.

## Observações

- A chave HenrikDev fica apenas no servidor e é enviada ao provedor pelo cabeçalho `X-API-Key`.
- As respostas são armazenadas em cache por 60 segundos para reduzir chamadas ao provedor.
- Hospede a API em um serviço com HTTPS e configure limites de requisição no provedor de hospedagem, pois o endpoint é público.
