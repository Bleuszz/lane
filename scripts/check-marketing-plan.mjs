// Documentation-only launch model and validation. No network, providers or ad calls.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const names = ['LAUNCH_MARKETING_PLAN', 'MARKETING_BUDGET', 'GROWTH_EXPERIMENTS',
  'AD_CREATIVE_BANK', 'SEO_GROWTH_PLAN', 'COMMUNITY_ACQUISITION', 'GROWTH_METRICS'];
const docs = Object.fromEntries(names.map(name => [name, readFileSync(resolve(root, 'docs', `${name}.md`), 'utf8')]));
let links = 0;
for (const [name, content] of Object.entries(docs)) {
  assert(content.includes('12 September 2026'), `${name}: research date missing`);
  for (const [, target] of content.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^https?:\/\//.test(target) || target.startsWith('#')) continue;
    assert(existsSync(resolve(root, 'docs', target.split('#')[0])), `${name}: missing local link ${target}`);
    links++;
  }
  assert(!content.includes('C:\\Users\\'), `${name}: private local path in public plan`);
}
const ads = docs.AD_CREATIVE_BANK;
const headlines = [...ads.matchAll(/^- H: (.+)$/gm)].map(m => m[1]);
const descriptions = [...ads.matchAll(/^- D: (.+)$/gm)].map(m => m[1]);
assert.equal(headlines.length, 12);
assert.equal(descriptions.length, 4);
for (const h of headlines) assert([...h].length <= 30, `Headline too long: ${h}`);
for (const d of descriptions) assert([...d].length <= 90, `Description too long: ${d}`);
for (let day = 0; day <= 30; day++) {
  assert(new RegExp(`^\\| ${day} \\|`, 'm').test(docs.LAUNCH_MARKETING_PLAN), `Missing day ${day}`);
}
for (const [prefix, count, content] of [['V', 10, ads], ['T', 10, ads],
  ['SEO', 5, docs.SEO_GROWTH_PLAN], ['CT', 5, docs.SEO_GROWTH_PLAN]]) {
  for (let n = 1; n <= count; n++) assert(content.includes(`${prefix}${String(n).padStart(2, '0')}:`));
}
const base = 30;
const flights = [{cash: 5, media: 4}, {cash: 10, media: 8}, {cash: 15, media: 12}];
assert.equal(flights.reduce((s, f) => s + f.cash, 0), base);
const media = flights.reduce((s, f) => s + f.media, 0);
assert.equal(media, 24);
for (const f of flights) assert(f.media * 1.02 * 1.20 <= f.cash);
assert(Math.abs(media * 1.02 * 1.20 - 29.376) < 1e-9);
const round = n => Number(n.toFixed(4));
const scenarios = [
  {case: 'low', cpc: 2, ctr: .02, signup: .02, active: .30, paid: .10},
  {case: 'mid', cpc: 1, ctr: .04, signup: .05, active: .50, paid: .20},
  {case: 'high', cpc: .5, ctr: .06, signup: .10, active: .70, paid: .30},
].map(s => {
  const clicks = media / s.cpc, signups = clicks * s.signup;
  const activated = signups * s.active, paid = activated * s.paid;
  return {case: s.case, impressions: round(clicks / s.ctr), clicks,
    signups: round(signups), activated: round(activated), futurePaid: round(paid),
    costPerSignup: round(base / signups), costPerActivated: round(base / activated), paidCAC: round(base / paid)};
});
assert.deepEqual(scenarios.map(s => s.signups), [.24, 1.2, 4.8]);
assert.deepEqual(scenarios.map(s => s.activated), [.072, .6, 3.36]);
assert.deepEqual(scenarios.map(s => s.futurePaid), [.0072, .12, 1.008]);
const plans = [{plan: 'Starter', price: 9, ai: 0}, {plan: 'Seller', price: 19, ai: 2}, {plan: 'Pro', price: 29, ai: 6}]
  .map(p => {
    const contribution = p.price - (p.price * .022 + .20) - 1 - 3 - p.ai;
    const target = Math.min(contribution * 3, contribution * 6 * .5);
    return {plan: p.plan, contribution: round(contribution),
      beforeOnboardingCeilings: [1, 3, 6, 12].map(m => round(contribution * m)),
      targetBeforeOnboarding: round(target), targetAfterOnboarding: round(target - 3.75),
      vatInclusiveStress: round(contribution - p.price / 6)};
  });
assert.deepEqual(plans.map(p => p.contribution), [4.602, 12.382, 18.162]);
const calendar = docs.LAUNCH_MARKETING_PLAN.split('\n').filter(l => /^\| \d+ \|/.test(l));
assert.equal(calendar.reduce((sum, row) => sum + Number(row.split('|')[3].trim().replace('£', '')), 0), 30);
const icpRows = docs.LAUNCH_MARKETING_PLAN.split('\n').filter(l => /^\| .* \|(?: \d+ \|){10}$/.test(l));
assert.equal(icpRows.length, 10, 'Expected ten ICP score rows');
for (const row of icpRows) {
  const scores = row.split('|').slice(2, -1).map(Number);
  assert.equal(scores.slice(0, 9).reduce((a, b) => a + b, 0), scores[9], `ICP sum: ${row}`);
}
console.log(JSON.stringify({status: 'PASS', documents: names.length, localLinks: links,
  headlines: headlines.length, descriptions: descriptions.length, contentIdeas: 30, calendarDays: 31,
  cashBudget: base, mediaBudget: media, maximumIllustrativeInvoice: 29.376,
  scenarios, plans, zeroSignupProbabilityAt12ClicksAnd5Percent: round(.95 ** 12),
  note: 'Arithmetic and local-document validation only; assumptions are not market forecasts. No ads or external actions.'}, null, 2));
