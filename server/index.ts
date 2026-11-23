import { readServerConfig, ServerConfig } from './config';
import { startOnlineServer } from './onlineServer';
import { writeLogLine } from './telemetry';

let config: ServerConfig;
try {
  config = readServerConfig(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

startOnlineServer({ ...config, log: writeLogLine })
  .then((server) => {
    // A deploy or restart sends SIGTERM: tell every room why before exiting.
    const stop = (signal: NodeJS.Signals) => {
      server.shutdown(signal).finally(() => process.exit(0));
    };
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  });
