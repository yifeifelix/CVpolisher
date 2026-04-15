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

if (!fs.existsSync(CERT_PATH) || !fs.existsSync(KEY_PATH)) {
  console.error('TLS certificates not found.');
  console.error(`Expected cert: ${CERT_PATH}`);
  console.error(`Expected key:  ${KEY_PATH}`);
  console.error('Run the following command to generate them:');
  console.error('  bash scripts/generate-cert.sh');
  process.exit(1);
}

const tlsOptions = {
  cert: fs.readFileSync(CERT_PATH),
  key: fs.readFileSync(KEY_PATH),
};

const app = next({ dev: isDev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  https.createServer(tlsOptions, (req, res) => {
    handle(req, res);
  }).listen(PORT, HOST, () => {
    const localIp = getLocalIp();
    console.log(`HTTPS server listening`);
    console.log(`  Local:   https://localhost:${PORT}`);
    if (localIp) {
      console.log(`  Network: https://${localIp}:${PORT}`);
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
