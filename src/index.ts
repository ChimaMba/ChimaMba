import { config, policy } from './config.js';
import { hasTokens } from './gmail.js';
import { buildServer } from './server.js';
import { startWorker, tick } from './worker.js';

const app = buildServer(tick);

const server = app.listen(config.port, () => {
  console.log('');
  console.log(`  Inbox agent for ${config.ownerName} <${config.ownerEmail}>`);
  console.log(`  Dashboard:  http://localhost:${config.port}`);
  console.log(`  Autonomy:   ${policy.autonomy}`);
  console.log(`  Model:      ${policy.model}`);
  console.log(
    `  Outreach:   ${policy.outreach.enabled ? 'enabled' : 'disabled'}` +
      (policy.outreach.enabled && !config.postalAddress
        ? '  ⚠ POSTAL_ADDRESS unset — outreach will refuse to send'
        : ''),
  );
  if (!config.dashboardPassword) {
    console.log('  ⚠ DASHBOARD_PASSWORD is empty — do not expose this port publicly.');
  }
  console.log('');

  if (!hasTokens()) {
    console.log('  Gmail is not connected yet. Run:  npm run auth');
    console.log('');
    return;
  }

  startWorker();
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n  Port ${config.port} is already in use — the agent may already be running.\n` +
        `  Stop the other copy, or set a different PORT in .env.\n`,
    );
  } else {
    console.error('\n  Could not start the server:', err.message, '\n');
  }
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log('\nShutting down.');
    server.close(() => process.exit(0));
    // Don't hang forever on a slow in-flight request.
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
