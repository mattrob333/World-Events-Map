const base = process.env.APP_BASE_URL;
const secret = process.env.CRON_SECRET;
if (!base || !secret) throw new Error('Set APP_BASE_URL and CRON_SECRET in the scheduler environment.');
const url = new URL('/api/cron/refresh', base);
if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Use HTTPS outside localhost.');
const response = await fetch(url, { headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(65_000), redirect: 'error' });
const result = await response.json();
console.log(JSON.stringify(result, null, 2));
if (!response.ok || result.social === 'error') process.exitCode = 1;
