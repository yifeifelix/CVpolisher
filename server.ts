import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import next from 'next';

const PORT = parseInt(process.env.PORT ?? '3443', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
const isDev = process.env.NODE_ENV === 'development';

const CERT_PATH = path.join(process.cwd(), 'certs', 'server.cert');
const KEY_PATH = path.join(process.cwd(), 'certs', 'server.key');

const hasCerts = fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH);

// Pass port but NOT hostname. Next builds absolute request URLs from
// hostname+port (next-server.js attachRequestMeta); with hostname omitted
// it falls back to "localhost", with HOST passed it would bake the bind
// address (0.0.0.0) into OAuth callback URLs, and with port also omitted
// it defaults to localhost:3000. Verified: URLs come out as
// http://localhost:<PORT> regardless of the request's Host header, which
// matches the registered Google redirect URI through the SSH tunnel.
const app = next({ dev: isDev, port: PORT });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  let server: http.Server | https.Server;

  if (hasCerts) {
    const tlsOptions = {
      cert: fs.readFileSync(CERT_PATH),
      key: fs.readFileSync(KEY_PATH),
    };
    server = https.createServer(tlsOptions, (req, res) => {
      handle(req, res);
    });
  } else {
    server = http.createServer((req, res) => {
      handle(req, res);
    });
  }

  const protocol = hasCerts ? 'https' : 'http';

  server.listen(PORT, HOST, () => {
    const localIp = getLocalIp();
    console.log(`${protocol.toUpperCase()} server listening`);
    console.log(`  Local:   ${protocol}://localhost:${PORT}`);
    if (localIp) {
      console.log(`  Network: ${protocol}://${localIp}:${PORT}`);
    }
  });
}).catch((err: Error) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

function getLocalIp(): string | null {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const entry of iface) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }
  return null;
}
