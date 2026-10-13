const origin = process.argv[2];
if (!origin)
  throw new Error(
    'Usage: node scripts/check-asset-cache.mjs https://your-frontend'
  );
const html = await (await fetch(origin)).text();
const assets = [
  ...new Set(
    [...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)].map(
      (match) => match[1]
    )
  ),
];
if (!assets.length)
  throw new Error('No Next.js versioned assets found in the page.');
for (const asset of assets.slice(0, 10)) {
  const url = new URL(asset.replaceAll('&amp;', '&'), origin);
  const response = await fetch(url, { method: 'HEAD' });
  const policy = response.headers.get('cache-control') ?? '';
  if (
    !response.ok ||
    !policy.includes('immutable') ||
    !policy.includes('max-age=31536000')
  )
    throw new Error('Unexpected cache policy: ' + url.pathname + ' ' + policy);
  console.log(url.pathname + ': ' + policy);
}
