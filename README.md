# Dominó Online

Monorepo (npm workspaces):

- `packages/engine` — motor de regras em TypeScript puro + bots. Usado pelo front e (em breve) pelo servidor Colyseus.
- `apps/web` — front em React + Vite (deploy na Cloudflare Pages).
- `apps/server` — (próximo passo) Colyseus no Railway, salas públicas/privadas.

## Rodar

```bash
npm install
npm test          # testes do motor
npm run dev:web   # http://localhost:5173
npm run build:web # gera apps/web/dist para a Cloudflare Pages
```

## Regras implementadas

- Modalidades: duplas 2x2, 1x1, 4 individual.
- 1ª rodada: começa quem tem a maior carroça (6-6 com 4 jogadores) e é obrigado a jogá-la. Nas seguintes, começa quem venceu a anterior.
- Sem compra (passa) ou com compra do monte (só no 1x1, que tem monte).
- Pontuação "por batida": simples 1, carroça 2, lá-e-lô 3, cruzada 4, trancado 1 (vence quem tem menos pontos na mão; empate não pontua).
- Pontuação "soma das peças": quem bate leva a soma das peças que sobraram com os adversários.
- Partida por número de rodadas; timer configurável. Se o tempo acabar, o bot joga por você.
- Bots: fácil (aleatório), médio (descarta carroças e peças pesadas), difícil (lê os passes, tenta trancar o adversário e não travar o parceiro).

## Deploy do front na Cloudflare Pages

Build command: `npm run build:web` · Output: `apps/web/dist`
