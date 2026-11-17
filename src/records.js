// @ai-native-solutions/fallestateonboard-sdk · records.js · MIT
// A blank client record in the exact shape the FallEstateOnboard page stores and assessAmlRisk reads.
// The page's own version reads its app state for the firm and the clock; this one takes them as options,
// so it is deterministic when you pass `id` and `ts`.

/**
 * @param {{ id?: string, ts?: number, firmId?: string, clientType?: 'buyer'|'seller'|'landlord'|'tenant' }} [opts]
 */
export function newClientRec(opts = {}) {
  const o = Object(opts);
  const ts = o.ts ?? Date.now();
  return {
    id: o.id ?? ('cl_' + Math.random().toString(36).slice(2, 11)), firmId: o.firmId ?? '', ts, updatedAt: ts, archivedAt: null,
    clientType: o.clientType ?? 'tenant', title: 'Mr', firstName: '', lastName: '', dob: '', nationality: 'GB', phone: '', email: '',
    address: '', postcode: '',
    employer: '', annualIncome: 0,
    propertyAddress: '', propertyPostcode: '', rent: 0, tenancyStart: '', tenancyEnd: '', tenancyType: 'Assured periodic',
    aml: { idVerified: false, addressVerified: false, sourceOfFunds: '', sanctionsChecked: false, pepStatus: false, riskGrade: 'low', riskReasons: [], cddComplete: false, notes: '' },
    rtr: { checked: false, documentType: '', shareCode: '', expiryDate: '', followUpDate: '', rightConfirmed: false, restrictedUntil: '', notes: '' },
    referencing: { creditCheck: false, employerRef: false, landlordRef: false, affordabilityCheck: false, guarantorRequired: false, guarantorName: '', guarantorRelationship: '', guarantorIncome: 0, notes: '' },
    vulnerable: { identified: false, category: '', details: '', adjustments: '' },
    deposit: { amount: 0, scheme: '', schemeRef: '', protectedDate: '', returnDue: '' },
    documents: [],
    status: 'new', agentId: '', isDemo: false,
  };
}
