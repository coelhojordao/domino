# Colocando o Dominó no ar (grátis)

```
Jogador ──► Cloudflare Pages (site, grátis, sem dormir)
              │  WebSocket (wss://)
              ▼
          Render — Web Service grátis (servidor Colyseus)
```

- **Front (site):** Cloudflare Pages. Grátis e não dorme.
- **Servidor do jogo:** Render, no plano Free.
  - Aceita WebSocket.
  - Dorme depois de 15 minutos sem ninguém jogando. O primeiro jogador depois disso espera cerca de 1 minuto para ele acordar, e o site mostra um aviso.
  - Para começar e validar a ideia, isso basta. Se o jogo pegar, troque para o plano pago (Starter, a partir de US$ 7/mês) e ele não dorme mais.
- **Por que não o Railway agora:** hoje ele só tem um teste com US$ 5 de crédito e depois cobra. Quando for pagar, ele também serve: os comandos são os mesmos.

---

## 0. Rodar tudo no seu PC (antes de publicar)

```bash
npm install
npm run dev:server   # servidor em ws://localhost:2567
npm run dev:web      # site em http://localhost:5173
```

Abra o site em duas abas (ou uma aba anônima) para testar sala privada e pública.

## 1. Subir o código para o GitHub

1. Crie um repositório (pode ser privado) em github.com → **New repository** → `domino`.
2. Na pasta do projeto:

```bash
git init
git add .
git commit -m "Dominó online"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/domino.git
git push -u origin main
```

O `.gitignore` já deixa de fora `node_modules`, `dist` e `.env`.

## 2. Servidor no Render

1. Entre em render.com com a conta do GitHub.
2. Clique em **New → Web Service** e escolha o repositório `domino`.
3. Preencha:

| Campo | Valor |
|---|---|
| Language | Node |
| Branch | main |
| Root Directory | *(deixe vazio)* |
| Build Command | `npm install` |
| Start Command | `npm run start:server` |
| Instance Type | **Free** |

4. Clique em **Deploy**. No fim aparece uma URL como `https://domino-xxxx.onrender.com`.
5. Para testar, abra essa URL no navegador. Se responder (mesmo com erro 404), o servidor está no ar.

> O Render define a porta pela variável `PORT`, e o servidor já lê essa variável.

## 3. Site na Cloudflare Pages

1. Em dash.cloudflare.com, vá em **Workers & Pages → Create → Pages → Connect to Git** e escolha o `domino`.
2. Preencha:

| Campo | Valor |
|---|---|
| Framework preset | None |
| Build command | `npm run build:web` |
| Build output directory | `apps/web/dist` |

3. Em **Environment variables**, adicione:
   - `VITE_SERVER_URL` = `wss://domino-xxxx.onrender.com` (a URL do Render trocando `https` por **`wss`**)
   - `NODE_VERSION` = `20`
4. Clique em **Save and Deploy**. O site fica em `https://domino-xxx.pages.dev`.

> Se mudar a URL do servidor, altere a variável e faça **Retry deployment**, porque o endereço é gravado no site na hora do build.

## 4. Testar

- Abra o site e clique em **Criar sala**. Mande o link para alguém (ou abra numa aba anônima) e jogue.
- Clique em **Procurar mesa**. Em 15 segundos os bots completam a mesa.

## Atualizações

Tudo que você enviar com `git push` para a `main` é publicado sozinho nos dois serviços.

## Quando crescer

- Trocar o Render para o plano Starter (não dorme) ou levar o servidor para o Railway Hobby.
- Domínio próprio (ex.: `dominoonline.com.br`) apontando para a Cloudflare.
- Com muitas salas ao mesmo tempo, o Colyseus pode rodar em vários servidores com Redis. Isso só será necessário com centenas de jogadores simultâneos.
