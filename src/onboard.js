// @ai-native-solutions/fallestateonboard-sdk · onboard.js · MIT · zero dependencies
// The data and pure functions of the FallEstateOnboard page (https://sjgant80-hub.github.io/fallestateonboard/),
// lifted from the page VERBATIM: every block below, minus the word `export`, appears in the page byte for byte, and
// scripts/parity.mjs fails the build if one ever stops doing so. No DOM, no network, no storage.
//
// assessAmlRisk is the page's own heuristic: it is not a statutory test. HIGH_RISK_JURIS is the page's list, which
// cites no source; check it against the current UK high-risk third countries list before you rely on it.

export const CLIENT_TYPES=['buyer','seller','landlord','tenant'];

export const DOC_TYPES=[
  {id:'passport',label:'Passport',expiry:10*365},
  {id:'driving-licence',label:'Driving Licence',expiry:10*365},
  {id:'biometric-card',label:'Biometric Residence Card',expiry:10*365},
  {id:'share-code',label:'Home Office Share Code',expiry:90},
  {id:'utility-bill',label:'Utility Bill (3 months)',expiry:90},
  {id:'bank-statement',label:'Bank Statement',expiry:90},
  {id:'council-tax',label:'Council Tax Bill',expiry:365},
  {id:'employer-letter',label:'Employer Reference',expiry:90},
  {id:'landlord-ref',label:'Previous Landlord Reference',expiry:90},
  {id:'payslips',label:'Payslips (3 months)',expiry:90},
  {id:'guarantor-id',label:'Guarantor ID',expiry:365},
  {id:'other',label:'Other',expiry:365}];

export const RTR_DOCS=['passport','biometric-card','share-code'];

export const HIGH_RISK_JURIS=['AF','BY','BI','CF','CD','CU','GN','GW','HT','IR','IQ','KP','LA','LB','LY','ML','MM','MZ','NI','PK','RU','SO','SS','SD','SY','TZ','VE','YE','ZW'];

export const CMP_SCHEMES=['DPS','MyDeposits','TDS'];

export const WIZ_STEPS=[{id:'type',name:'Type'},{id:'details',name:'Details'},{id:'contact',name:'Contact'},
  {id:'tenancy',name:'Tenancy'},{id:'aml',name:'AML'},{id:'rtr',name:'RTR'},
  {id:'referencing',name:'Referencing'},{id:'vulnerable',name:'Vulnerable'},{id:'deposit',name:'Deposit'},{id:'documents',name:'Docs'}];

export const T0_RULES=[
  {q:/aml|money launder|cdd/i,a:'Under MLR 2017, estate and letting agents must conduct CDD: estate agents on both the buyer and the seller of every sale, whatever the price; letting agents where the monthly rent is €10,000 or more. Verify identity (passport/driving licence), verify address (utility bill/bank statement), assess source of funds for buyers, screen sanctions, and check PEP status. Enhanced due diligence for high-risk clients. Report suspicious activity to NCA via SAR.'},
  {q:/right.?to.?rent|rtr|immigration/i,a:'Immigration Act 2014 requires landlords and their agents to check prospective tenants have the right to rent in the UK before granting a tenancy. Acceptable evidence: a UK or Irish passport, or a Home Office share code for an eVisa or EU Settlement Scheme status (biometric residence permits were replaced by eVisas). Checks must be done before tenancy starts. For time-limited right, set follow-up check before expiry. Civil penalty (from 13 Feb 2024): up to £10,000 per occupier for a first breach and £20,000 for a repeat (£5,000 / £10,000 per lodger).'},
  {q:/deposit|protect|dps|tds/i,a:'Housing Act 2004 (as amended) requires tenancy deposits in England to be protected in an authorised scheme (DPS, MyDeposits, or TDS) within 30 days of receipt. The prescribed information must be served on the tenant within 30 days. Failure to protect: tenant can claim 1-3x the deposit amount, and the court will not make a possession order unless the deposit is protected with the prescribed information given, or returned. Every private tenancy in England is an assured periodic tenancy from 1 May 2026 (Renters\' Rights Act 2025). Wales has its own regime (Renting Homes (Wales) Act 2016).'},
  {q:/referenc|credit|afford|guarantor/i,a:'Tenant referencing typically includes: credit check (adverse credit, CCJs, insolvency), employer reference (confirming employment and salary), previous landlord reference (conduct, rent payment history), and affordability assessment (rent should typically be ≤35-40% of gross income). If affordability is marginal, a guarantor may be required — guarantor income should typically be 3x+ the annual rent.'},
  {q:/redress|complaint|prs|tpos/i,a:'All property agents in England must belong to a government-approved redress scheme: PRS (The Property Redress Scheme) or TPOS (The Property Ombudsman). Civil penalty up to £5,000 for non-membership. Agents must display membership details prominently. Complaints procedure must be in writing and provided to clients.'},
  {q:/cmp|client money|protection/i,a:'Letting agents holding client money (rent, deposits, maintenance funds) must belong to a Client Money Protection (CMP) scheme. Required under the Tenant Fees Act 2019 and Client Money Protection Schemes for Property Agents Regulations 2019. Display CMP certificate prominently. Failure: unlimited fine.'},
  {q:/fee|tenant fees act/i,a:'Tenant Fees Act 2019 (England) prohibits most fees to tenants. Permitted payments only: rent, tenancy deposit (capped at 5 weeks for rent <£50k/yr), holding deposit (capped at 1 week), early termination (capped at rent owed), and changes to tenancy requested by tenant (capped at £50). Breach: a penalty of up to £5,000; a repeat within five years, up to £30,000 or prosecution.'},
  {q:/vulnerab/i,a:'While not FCA-regulated, estate and letting agents should identify vulnerable customers (elderly, disability, language barriers, financial difficulty) and make reasonable adjustments. Document vulnerability, adjustments made, and communication preferences. Consider whether additional support or time is needed for decision-making.'},
  {q:/energy|epc|mees/i,a:'Minimum Energy Efficiency Standards (MEES): rental properties must have EPC rating of E or above. Landlords cannot let a property with F or G rating unless a valid exemption is registered. EPC must be provided to prospective tenants before viewing. Valid for 10 years.'},
  {q:/sanction|pep/i,a:'Under MLR 2017, agents must screen clients against the HM Treasury sanctions list. PEP (Politically Exposed Person) status requires enhanced due diligence. Sanctions match = report to NCA immediately and do not proceed. PEP = proceed with enhanced scrutiny of source of funds and ongoing monitoring.'}];

export function assessAmlRisk(c) {
  const r = (c && typeof c === 'object') ? c : {};
  const aml = (r.aml && typeof r.aml === 'object') ? r.aml : {};
  let score = 0; const reasons = [];
  if (aml.pepStatus) { score += 3; reasons.push('PEP'); }
  if (!aml.sanctionsChecked) { score += 1; reasons.push('sanctions unchecked'); }
  const nat = String(r.nationality || '').toUpperCase();
  if (HIGH_RISK_JURIS.includes(nat)) { score += 3; reasons.push('high-risk nationality'); }
  if (+r.rent > 5000) { score += 1; reasons.push('rent over £5,000 a month'); }
  if (r.clientType === 'buyer' && aml.sourceOfFunds === 'overseas') { score += 2; reasons.push('overseas source'); }
  return { grade: score >= 5 ? 'high' : score >= 2 ? 'medium' : 'low', score, reasons };
}

export function clientDisplayName(c) {
  const r = (c && typeof c === 'object') ? c : {};
  return ((r.title ? r.title + ' ' : '') + (r.firstName || '') + ' ' + (r.lastName || '')).trim() || 'Unnamed';
}

export function getSteps(c) {
  let steps = [...WIZ_STEPS];
  if (!c || c.clientType !== 'tenant') steps = steps.filter((s) => !['tenancy', 'rtr', 'referencing', 'deposit'].includes(s.id));
  return steps;
}

export function askT0(q) {
  const s = typeof q === 'string' ? q : '';
  for (const r of T0_RULES) { if (r.q.test(s)) return { answer: r.a, source: 'T0 · estate/letting agent rules' }; }
  return null;
}
