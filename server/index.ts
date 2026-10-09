import { startOnlineServer } from './onlineServer';

const port = Number(process.env.PORT ?? 8787);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

startOnlineServer({ port, host: '0.0.0.0', allowedOrigins })
  .then((server) => {
    // eslint-disable-next-line no-console
    console.log(`Online server listening on ${server.port}`);
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  });
