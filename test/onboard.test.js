// test/onboard.test.js · node --test · pins every weight, edge, guard, route and table of the page's own checks
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLIENT_TYPES, DOC_TYPES, RTR_DOCS, HIGH_RISK_JURIS, CMP_SCHEMES, WIZ_STEPS, T0_RULES,
  assessAmlRisk, clientDisplayName, getSteps, askT0, newClientRec, VERSION,
} from '../src/index.js';

const checked = { sanctionsChecked: true };
const risk = (c) => assessAmlRisk(c);

test('assessAmlRisk: each factor adds its weight and names itself', () => {
  assert.deepEqual(risk({ aml: { ...checked } }), { grade: 'low', score: 0, reasons: [] });
  assert.deepEqual(risk({ aml: {} }), { grade: 'low', score: 1, reasons: ['sanctions unchecked'] });
  assert.deepEqual(risk({ aml: { ...checked, pepStatus: true } }), { grade: 'medium', score: 3, reasons: ['PEP'] });
  assert.deepEqual(risk({ aml: { ...checked }, nationality: 'ir' }), { grade: 'medium', score: 3, reasons: ['high-risk nationality'] });
  assert.deepEqual(risk({ aml: { ...checked }, nationality: 'GB' }).score, 0);
  assert.deepEqual(risk({ aml: { ...checked }, rent: 5001 }), { grade: 'low', score: 1, reasons: ['rent over £5,000 a month'] });
  assert.equal(risk({ aml: { ...checked }, rent: 5000 }).score, 0); // the edge: over £5,000, not at it
  assert.equal(risk({ aml: { ...checked }, rent: '6000' }).score, 1);
  assert.deepEqual(risk({ clientType: 'buyer', aml: { ...checked, sourceOfFunds: 'overseas' } }), { grade: 'medium', score: 2, reasons: ['overseas source'] });
  assert.equal(risk({ clientType: 'seller', aml: { ...checked, sourceOfFunds: 'overseas' } }).score, 0);
  assert.equal(risk({ clientType: 'buyer', aml: { ...checked, sourceOfFunds: 'uk' } }).score, 0);
});

test('assessAmlRisk: high at exactly 5, medium at exactly 2, low below', () => {
  assert.equal(risk({ clientType: 'buyer', aml: { ...checked, pepStatus: true, sourceOfFunds: 'overseas' } }).grade, 'high'); // 3 + 2 = 5
  assert.equal(risk({ aml: { pepStatus: true }, rent: 9000 }).grade, 'high'); // PEP 3 + unchecked 1 + rent 1 = 5
  assert.equal(risk({ aml: { pepStatus: true }, rent: 9000 }).score, 5);
  assert.equal(risk({ aml: { pepStatus: true } }).grade, 'medium'); // 4
  assert.equal(risk({ aml: {}, rent: 9000 }).grade, 'medium'); // 2
  assert.equal(risk({ aml: {} }).grade, 'low'); // 1
  const all = risk({ clientType: 'buyer', nationality: 'KP', rent: 9999, aml: { pepStatus: true, sourceOfFunds: 'overseas' } });
  assert.deepEqual(all, { grade: 'high', score: 10, reasons: ['PEP', 'sanctions unchecked', 'high-risk nationality', 'rent over £5,000 a month', 'overseas source'] });
});

test('assessAmlRisk: never throws, and only real objects are read', () => {
  for (const j of [undefined, null, 0, 'x', [], true, NaN]) assert.deepEqual(risk(j), { grade: 'low', score: 1, reasons: ['sanctions unchecked'] });
  const fn = Object.assign(() => 0, { aml: { pepStatus: true, sanctionsChecked: true } });
  assert.equal(risk(fn).score, 1); // a function is not a client record
  const fnAml = { aml: Object.assign(() => 0, { pepStatus: true, sanctionsChecked: true }) };
  assert.equal(risk(fnAml).score, 1); // nor is a function an AML block
  assert.equal(risk({ nationality: 7, aml: { ...checked } }).score, 0);
});

test('assessAmlRisk scores the record newClientRec builds', () => {
  const c = newClientRec({ id: 'cl_1', ts: 1, firmId: 'f1' });
  assert.equal(c.id, 'cl_1'); assert.equal(c.ts, 1); assert.equal(c.updatedAt, 1); assert.equal(c.firmId, 'f1');
  assert.equal(c.clientType, 'tenant'); assert.equal(c.tenancyType, 'Assured periodic'); assert.equal(c.nationality, 'GB');
  assert.deepEqual(risk(c), { grade: 'low', score: 1, reasons: ['sanctions unchecked'] });
  assert.equal(newClientRec({ clientType: 'buyer' }).clientType, 'buyer');
  assert.match(newClientRec().id, /^cl_[a-z0-9]+$/);
  assert.equal(typeof newClientRec(null).ts, 'number');
  assert.equal(newClientRec().firmId, '');
});

test('clientDisplayName: title, first and last name, or Unnamed', () => {
  assert.equal(clientDisplayName({ title: 'Ms', firstName: 'Emma', lastName: 'Clarke' }), 'Ms Emma Clarke');
  assert.equal(clientDisplayName({ firstName: 'Emma' }), 'Emma');
  assert.equal(clientDisplayName({ lastName: 'Clarke' }), 'Clarke');
  assert.equal(clientDisplayName({ title: 'Dr' }), 'Dr');
  assert.equal(clientDisplayName({}), 'Unnamed');
  assert.equal(clientDisplayName(null), 'Unnamed');
  assert.equal(clientDisplayName(Object.assign(() => 0, { firstName: 'Fn' })), 'Unnamed');
});

test('getSteps: tenants get all ten steps, everyone else skips the four tenancy steps', () => {
  const ids = (c) => getSteps(c).map((s) => s.id);
  assert.deepEqual(ids({ clientType: 'tenant' }), WIZ_STEPS.map((s) => s.id));
  assert.equal(WIZ_STEPS.length, 10);
  for (const t of ['buyer', 'seller', 'landlord']) assert.deepEqual(ids({ clientType: t }), ['type', 'details', 'contact', 'aml', 'vulnerable', 'documents']);
  assert.deepEqual(ids(null), ['type', 'details', 'contact', 'aml', 'vulnerable', 'documents']);
  assert.notEqual(getSteps({ clientType: 'tenant' }), WIZ_STEPS); // a copy, never the table itself
});

const ROUTES = [
  ['what CDD do I need', 'Under MLR 2017, estate and letting agents must conduct CDD: estate agents on both the buyer and the seller of every sale, whatever the price; letting agents where the monthly rent is €10,000 or more.'],
  ['right to rent checks', 'Immigration Act 2014 requires landlords'],
  ['deposit protection', 'Housing Act 2004 (as amended) requires tenancy deposits in England'],
  ['guarantor referencing', 'Tenant referencing typically includes'],
  ['redress scheme', 'All property agents in England must belong'],
  ['client money', 'Letting agents holding client money'],
  ['tenant fees act', 'Tenant Fees Act 2019 (England) prohibits'],
  ['vulnerable customer', 'While not FCA-regulated'],
  ['epc rating', 'Minimum Energy Efficiency Standards'],
  ['sanctions screening', 'Under MLR 2017, agents must screen clients'],
];
test('askT0: every question routes to its own rule, and no rule answers what it does not cover', () => {
  for (const [q, start] of ROUTES) {
    const r = askT0(q);
    assert.ok(r && r.answer.startsWith(start), q);
    assert.equal(r.source, 'T0 · estate/letting agent rules');
  }
  assert.equal(askT0('weather tomorrow'), null);
  assert.equal(askT0(undefined), null);
  assert.equal(askT0(null), null);
  assert.equal(askT0({ toString: () => 'deposit' }), null); // only a string is a question
  assert.equal(askT0(Object.create(null)), null);
  assert.equal(askT0(''), null);
  assert.equal(T0_RULES.length, ROUTES.length);
  assert.doesNotMatch(T0_RULES.map((r) => r.a).join(' '), /€10,000\/year|TBA/);
});

test('the tables are the page\'s tables', () => {
  assert.deepEqual(CLIENT_TYPES, ['buyer', 'seller', 'landlord', 'tenant']);
  assert.deepEqual(CMP_SCHEMES, ['DPS', 'MyDeposits', 'TDS']);
  assert.deepEqual(Object.fromEntries(DOC_TYPES.map((d) => [d.id, d.expiry])), {
    passport: 3650, 'driving-licence': 3650, 'biometric-card': 3650, 'share-code': 90, 'utility-bill': 90, 'bank-statement': 90,
    'council-tax': 365, 'employer-letter': 90, 'landlord-ref': 90, payslips: 90, 'guarantor-id': 365, other: 365,
  });
  assert.ok(RTR_DOCS.every((d) => DOC_TYPES.some((t) => t.id === d)));
  assert.equal(HIGH_RISK_JURIS.length, 29);
  assert.ok(HIGH_RISK_JURIS.every((c) => /^[A-Z]{2}$/.test(c)));
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});
