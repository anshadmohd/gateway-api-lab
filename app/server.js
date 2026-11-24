import { createServer } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const server = createServer();

server.listen(port, () => {
  const version = process.env.APP_VERSION ?? 'v1';
  console.log(`shop ${version} listening on :${port}`);
});

// Kubernetes sends SIGTERM before it stops a pod; finish in-flight requests first.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    server.closeIdleConnections();
  });
}
