// @ai-native-solutions/fallestateonboard-sdk · the public surface · MIT · plain ESM · zero dependencies
// The FallEstateOnboard page's own data and checks (https://sjgant80-hub.github.io/fallestateonboard/) as modules:
// client types, document types, the Right to Rent documents, the AML risk heuristic, the onboarding steps and the
// rules-based Q&A. No DOM, no network, no storage. Information for estate and letting agents, not legal advice.

export { CLIENT_TYPES, DOC_TYPES, RTR_DOCS, HIGH_RISK_JURIS, CMP_SCHEMES, WIZ_STEPS, T0_RULES, assessAmlRisk, clientDisplayName, getSteps, askT0 } from './onboard.js';
export { newClientRec } from './records.js';

export const VERSION = '1.1.0';
