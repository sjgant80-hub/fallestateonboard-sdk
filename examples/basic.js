// examples/basic.js · onboard a buyer and a tenant · run: node examples/basic.js
import { newClientRec, assessAmlRisk, getSteps, askT0, clientDisplayName, VERSION } from '../src/index.js';

console.log('fallestateonboard-sdk v' + VERSION);
const buyer = newClientRec({ id: 'cl_demo1', ts: 0, clientType: 'buyer' });
Object.assign(buyer, { title: 'Ms', firstName: 'Emma', lastName: 'Clarke' });
Object.assign(buyer.aml, { pepStatus: true, sanctionsChecked: true, sourceOfFunds: 'overseas' });
const risk = assessAmlRisk(buyer);
console.log(clientDisplayName(buyer) + ': AML risk ' + risk.grade + ' (' + risk.score + ') · ' + risk.reasons.join(', '));
console.log('buyer steps: ' + getSteps(buyer).map((s) => s.name).join(' → '));
console.log('tenant steps: ' + getSteps({ clientType: 'tenant' }).map((s) => s.name).join(' → '));
const a = askT0('when do letting agents need to do CDD?');
console.log('Q&A: ' + a.answer.slice(0, 140) + '…');
if (risk.grade !== 'high' || getSteps(buyer).length !== 6 || !a) { console.error('the example did not produce what it should'); process.exit(1); }
