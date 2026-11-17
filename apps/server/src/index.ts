import { Server, WebSocketTransport } from 'colyseus';
import { DominoRoom } from './DominoRoom';

const port = Number(process.env.PORT) || 2567;

const server = new Server({
  transport: new WebSocketTransport({ pingInterval: 10_000 }),
  greet: false,
});

// Sala pública: junta jogadores da mesma modalidade; bots completam depois de 15s.
server.define('publica', DominoRoom, { kind: 'public' }).filterBy(['mode']);
// Sala privada: entra só quem tem o código.
server.define('privada', DominoRoom, { kind: 'private' });

server.listen(port).then(() => console.log(`Servidor do dominó rodando na porta ${port}`));
