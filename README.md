# FallEstateOnboard SDK

**Live page, with a try-it panel, the API and the proof:** https://sjgant80-hub.github.io/fallestateonboard-sdk/

A JavaScript library with the checks behind FallEstateOnboard, the client-onboarding tool for UK estate and letting agents: the AML risk score for a client, the onboarding steps each kind of client needs, the document and Right to Rent tables, and 10 rules-based answers on AML, Right to Rent, deposits, referencing, redress, client money, tenant fees, vulnerable customers, EPCs and sanctions.

It is the [FallEstateOnboard](https://sjgant80-hub.github.io/fallestateonboard/) page's own code, as modules. It supports your process; it is not legal advice, and the risk score is a heuristic your MLRO sets policy on, not a statutory test.

## Install

```bash
npm install github:sjgant80-hub/fallestateonboard-sdk
```

It is not on the npm registry; it installs from this repository. Pin a commit for production: `npm install github:sjgant80-hub/fallestateonboard-sdk#<commit>`.

## Use

```js
import { newClientRec, assessAmlRisk, getSteps, askT0 } from '@ai-native-solutions/fallestateonboard-sdk';

const client = newClientRec({ clientType: 'buyer' });
client.aml.pepStatus = true; client.aml.sourceOfFunds = 'overseas';
assessAmlRisk(client);   // { grade: 'high', score: 6, reasons: ['PEP', 'sanctions unchecked', 'overseas source'] }
getSteps(client);        // the six steps a buyer needs (tenants get ten)
askT0('when do letting agents need to do CDD?');
```

## API

| Export | What it does |
|---|---|
| `assessAmlRisk(client)` | { grade, score, reasons } for a client record. Never throws: anything that is not a record scores as an empty one. |
| `getSteps(client)` | The onboarding steps for that client type. |
| `askT0(question)` | The matching rules-based answer and its source, or null. |
| `newClientRec({ id, ts, firmId, clientType })` | A blank client record in the page's exact shape (deterministic when you pass id and ts). |
| `clientDisplayName(client)` | "Ms Emma Clarke", or "Unnamed". |
| `CLIENT_TYPES · DOC_TYPES · RTR_DOCS · HIGH_RISK_JURIS · CMP_SCHEMES · WIZ_STEPS · T0_RULES` | The page's tables: client types, document types with validity days, Right to Rent documents, the high-risk nationality list, deposit schemes, steps and answers. |

## How it is kept honest

- Every block in src/onboard.js, the tables and the four functions, is lifted from the FallEstateOnboard page byte for byte, with only the word export added. scripts/parity.mjs reads the published page and fails the build if any block is no longer there.
- The AML score adds 3 for a politically exposed person, 1 if sanctions are not yet checked, 3 for a nationality on the page's high-risk list, 1 for rent over £5,000 a month, and 2 for a buyer with overseas funds. 5 or more is high, 2 or more is medium.
- A buyer, seller or landlord goes through six steps; a tenant also needs the tenancy, Right to Rent, referencing and deposit steps (ten).
- A question is answered by the first rule whose pattern it matches; otherwise there is no answer, rather than a guess.
- The tests pin every weight, both grade edges, the £5,000 boundary, every route and every table, and the mutation gate confirms each comparison in the code is tested (19 of 19).

Run it yourself: `npm test`, `npm run parity`, `npm run example`. CI runs the same, plus the mutation gate, on every push.

## Not included

- Identity verification, sanctions screening, credit checks: these need a provider.
- The page's storage, wizard UI and AI chat: this is the logic, not the app.

## Licence and supplier

MIT, © Simon Gant. Supplied by [AI Native Solutions](https://www.ai-nativesolutions.com); support is agreed per deployment.
