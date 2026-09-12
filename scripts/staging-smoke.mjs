// Read-only acceptance of the deployed control plane. Never prints response bodies or secrets.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export async function stagingSmoke(baseUrl, canonicalUrl = baseUrl) {
  const base = new URL(baseUrl), canonical = new URL(canonicalUrl);
  const local = ['localhost', '127.0.0.1'].includes(base.hostname);
  assert.ok(base.protocol === 'https:' || (local && base.protocol === 'http:'), 'HTTPS required');
  for (const url of [base, canonical]) {
    assert.ok(!url.username && !url.password && !url.search && !url.hash && url.pathname === '/', 'Use an origin without credentials, path or query');
  }
  const request = async path => {
    let url = new URL(path, base), response;
    for (let redirects = 0; redirects <= 3; redirects++) {
      response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(90000) });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      assert.ok(location, `${path}: redirect has a destination`);
      const target = new URL(location, url);
      // TanStack normalises default search parameters. Never follow off-site redirects
      // or accept a signup page that merely redirects to a different application route.
      assert.ok(target.origin === base.origin && target.pathname === url.pathname, `${path}: unexpected redirect`);
      url = target;
    }
    assert.equal(response.status, 200, `${path}: expected HTTP 200, received ${response.status}`);
    assert.equal(response.headers.get('cache-control'), 'private, no-store', `${path}: private cache policy`);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', `${path}: staging noindex`);
    assert.equal(response.headers.get('x-frame-options'), 'DENY', `${path}: frame protection`);
    assert.ok(response.headers.get('strict-transport-security'), `${path}: HTTPS policy`);
    return response;
  };
  for (const path of ['/', '/signup', '/login', '/download']) {
    const response = await request(path);
    assert.match(response.headers.get('content-type') || '', /text\/html/, `${path}: HTML response`);
    const html = await response.text();
    assert.ok(html.includes('Lane'), `${path}: Lane application rendered`);
    if (path === '/') assert.ok(html.includes(`rel="canonical" href="${canonical.origin}/"`), 'Canonical origin matches deployment');
  }
  const robots = await (await request('/robots.txt')).text();
  assert.match(robots, /Disallow:\s*\/\s*(?:\r?\n|$)/, 'Staging blocks indexing');
  const config = await (await request('/api/auth/configuration')).json();
  assert.ok(Array.isArray(config.providers), 'Auth configuration is available');
  const session = await (await request('/api/auth/get-session')).json();
  assert.equal(session, null, 'Anonymous request has no user session');
  return { passed: true, origin: base.origin, publicPages: true, stagingNoindex: true,
    privateCache: true, anonymousSession: true, canonical: true,
    availableOAuthProviders: config.providers.filter(p => p.available).length,
    accountCreationTested: false, desktopPairingTested: false, at: new Date().toISOString() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    assert.ok(process.argv[2], 'Usage: node scripts/staging-smoke.mjs https://HOST [https://CANONICAL]');
    console.log(JSON.stringify(await stagingSmoke(process.argv[2], process.argv[3]), null, 2));
  } catch (error) {
    // Do not print request URLs or underlying network errors which may contain private data.
    console.error(error instanceof assert.AssertionError ? error.message : 'Staging request failed; check deployment health and HTTPS.');
    process.exitCode = 1;
  }
}
