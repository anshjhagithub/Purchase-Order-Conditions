import { uid } from './ids';
import { CATEGORY_PRESETS } from './categoryPresets';
import { BASE_STEP } from '../engine/calc';
import type {
  AppliedCondition,
  ConditionBundle,
  ConditionMaster,
  Entity,
  IndexMasterEntry,
  ItemMasterEntry,
  PurchaseOrder,
  TaxMasterEntry,
  UoM,
  Vendor,
} from '../types';

// ── Reference / master data ────────────────────────────────────────────

export const ENTITIES: Entity[] = [
  { id: 'ent-1', name: 'Greencell Mobility Pvt Ltd', state: 'Maharashtra', gstin: '27AAGCG1234M1Z6' },
  { id: 'ent-2', name: 'Greencell Mobility — Bengaluru Ops', state: 'Karnataka', gstin: '29AAGCG1234M2Z4' },
];

export const VENDORS: Vendor[] = [
  { id: 'ven-cello', name: 'Cello World Limited', state: 'Maharashtra', gstin: '27AACCC1234F1Z5', vendorGroup: 'Material Suppliers' },
  { id: 'ven-evacay', name: 'Evacay Eelitee', state: 'Maharashtra', gstin: '27AABCE5678G1Z2', vendorGroup: 'Material Suppliers' },
  { id: 'ven-apex', name: 'Apex Battery Components Pte Ltd', state: 'Gujarat', gstin: '24AAJCA9988H1Z6', vendorGroup: 'Material Suppliers' },
  { id: 'ven-maersk', name: 'Maersk Line Shipping Pvt Ltd', state: 'Gujarat', gstin: '24AABCM2211J1Z9', vendorGroup: 'Logistics & Freight' },
  { id: 'ven-insure', name: 'Continental Marine Insurers Ltd', state: 'Maharashtra', gstin: '27AAECI4433K1Z1', vendorGroup: 'Insurance' },
  { id: 'ven-cha', name: 'Bharat Customs Clearance & Cargo', state: 'Maharashtra', gstin: '27AAFCB7766L1Z4', vendorGroup: 'Logistics & Freight' },
  { id: 'ven-gta', name: 'Universal Road Carriers (GTA)', state: 'Karnataka', gstin: '29AAGCU3322M1Z7', vendorGroup: 'Logistics & Freight' },
  { id: 'ven-lastmile', name: 'Swift Last-Mile Logistics', state: 'Maharashtra', gstin: '27AAHCS5544N1Z3', vendorGroup: 'Logistics & Freight' },
  { id: 'ven-authority', name: 'Office of the Commissioner of Customs', state: 'Gujarat', gstin: 'N/A — Government Authority', vendorGroup: 'Statutory Authority' },
  { id: 'ven-inspect', name: 'SGS Third-Party Inspections', state: 'Maharashtra', gstin: '27AAICS8899P1Z8', vendorGroup: 'Inspection & Certification' },
  // Raw-material suppliers for the bulk PO list (Dashboard pagination showcase).
  { id: 'ven-tatasteel', name: 'Tata Steel Ltd', state: 'Jharkhand', gstin: '20AAACT2727Q1ZW', vendorGroup: 'Metals & Alloys' },
  { id: 'ven-hindalco', name: 'Hindalco Industries Ltd', state: 'Uttar Pradesh', gstin: '09AAACH1201P1Z7', vendorGroup: 'Metals & Alloys' },
  { id: 'ven-amararaja', name: 'Amara Raja Advanced Cell Technologies', state: 'Andhra Pradesh', gstin: '37AAACA4433B1Z5', vendorGroup: 'Battery Materials' },
  { id: 'ven-exide', name: 'Exide Industries Ltd', state: 'West Bengal', gstin: '19AAACE5566C1Z2', vendorGroup: 'Battery Materials' },
  { id: 'ven-sundram', name: 'Sundram Fasteners Ltd', state: 'Tamil Nadu', gstin: '33AAACS7788D1Z8', vendorGroup: 'Components' },
  { id: 'ven-uflex', name: 'UFlex Ltd', state: 'Haryana', gstin: '06AAACU9900E1Z3', vendorGroup: 'Packaging Material' },
  { id: 'ven-polycab', name: 'Polycab India Ltd', state: 'Gujarat', gstin: '24AAACP2233F1Z9', vendorGroup: 'Electricals' },
  { id: 'ven-sona', name: 'Sona BLW Precision Forgings Ltd', state: 'Haryana', gstin: '06AAACS4455G1Z1', vendorGroup: 'Components' },
  { id: 'ven-graphene', name: 'Graphene Anode Materials Pvt Ltd', state: 'Karnataka', gstin: '29AABCG6677H1Z6', vendorGroup: 'Battery Materials' },
  { id: 'ven-jsw', name: 'JSW Steel Ltd', state: 'Karnataka', gstin: '29AAACJ8899I1Z4', vendorGroup: 'Metals & Alloys' },
];

export const TAX_MASTER: TaxMasterEntry[] = [
  { id: 'tm-1', codeType: 'HSN', code: '8507', description: 'Lithium-ion battery packs', gstRate: 18, effectiveFrom: '2024-01-01' },
  { id: 'tm-2', codeType: 'HSN', code: '8544', description: 'Insulated wiring harness', gstRate: 18, effectiveFrom: '2024-01-01' },
  { id: 'tm-3', codeType: 'HSN', code: '8503', description: 'Electric motor parts (BLDC)', gstRate: 18, effectiveFrom: '2024-01-01' },
  { id: 'tm-4', codeType: 'SAC', code: '996521', description: 'Sea freight transport of goods', gstRate: 5, effectiveFrom: '2024-01-01' },
  { id: 'tm-5', codeType: 'SAC', code: '997133', description: 'Marine / transit insurance services', gstRate: 18, effectiveFrom: '2024-01-01' },
  { id: 'tm-6', codeType: 'SAC', code: '996713', description: 'Customs clearing & forwarding services', gstRate: 18, effectiveFrom: '2024-01-01' },
  { id: 'tm-7', codeType: 'SAC', code: '996791', description: 'Goods transport agency (road, RCM)', gstRate: 5, effectiveFrom: '2024-01-01' },
  { id: 'tm-8', codeType: 'SAC', code: '998540', description: 'Third-party inspection & certification', gstRate: 18, effectiveFrom: '2024-01-01' },
  { id: 'tm-9', codeType: 'SAC', code: '996812', description: 'Packing & handling services', gstRate: 18, effectiveFrom: '2024-01-01' },
  { id: 'tm-10', codeType: 'SAC', code: '997212', description: 'Last-mile delivery services', gstRate: 18, effectiveFrom: '2024-01-01' },
];

export const UOMS: UoM[] = [
  { id: 'uom-nos', name: 'Nos', dimension: 'COUNT' },
  { id: 'uom-kg', name: 'KG', dimension: 'WEIGHT' },
  { id: 'uom-mt', name: 'MT', dimension: 'WEIGHT' },
  { id: 'uom-cbm', name: 'CBM', dimension: 'VOLUME' },
  { id: 'uom-day', name: 'Day', dimension: 'TIME' },
];

export const ITEM_MASTER: ItemMasterEntry[] = [
  { id: 'item-batt', name: 'Lithium Battery Pack 5kWh', hsn: '8507', uomId: 'uom-nos', unitWeightKg: 42, unitVolumeCbm: 1 },
  { id: 'item-harness', name: 'Insulated Wiring Harness Set', hsn: '8544', uomId: 'uom-nos', unitWeightKg: 3.2, unitVolumeCbm: 0.02 },
  { id: 'item-motor', name: 'BLDC Hub Motor Assembly', hsn: '8503', uomId: 'uom-nos', unitWeightKg: 8.5, unitVolumeCbm: 0.05 },
];

export const INDEX_MASTER: IndexMasterEntry[] = [
  { id: 'idx-fuel', name: 'Fuel Price Index (Diesel, HSD)', currentValue: 94.5, unit: 'INR/litre' },
];

// ── Condition master seed ──────────────────────────────────────────────

function makeCondition(c: {
  code: string;
  name: string;
  category: ConditionMaster['category'];
  overrides: Partial<ConditionMaster>;
}): ConditionMaster {
  const preset = CATEGORY_PRESETS[c.category];
  const base: ConditionMaster = {
    id: uid('cm'),
    code: c.code,
    name: c.name,
    category: c.category,
    subCategory: undefined,
    description: '',
    printOnPdf: true,

    calcBasis: preset.calcBasis!,
    uomId: undefined,
    defaultRate: undefined,
    sign: preset.sign!,
    currency: 'INR',
    statistical: false,
    rounding: 'NORMAL',

    codeType: preset.codeType!,
    taxCode: undefined,
    gstRate: undefined,
    gstTreatment: 'DEDUCTIBLE',
    itcEligibilityPct: 100,
    taxCalculatedOn: 'CONDITION_AMOUNT',
    tdsApplicable: false,
    tdsSection: undefined,

    defaultVendorId: undefined,
    vendorRule: preset.vendorRule!,
    vendorGroupFilter: [],
    defaultInvoiceOwner: undefined,
    defaultConfirmationOwner: undefined,

    calculateOn: preset.calculateOn ?? 'LINE_BASE',
    calculateOnCodes: [],
    capitalise: preset.capitalise!,
    allowedLevel: preset.allowedLevel!,
    distributionBasis: preset.allowedLevel === 'LINE' ? undefined : 'VALUE',
    requiresServiceConfirmation: preset.requiresServiceConfirmation!,
    autoConfirmOnMainGrn: preset.requiresServiceConfirmation ?? false,
    confirmationOnPartialGrn: 'PROPORTIONAL',
    lineItemGrnRequired: preset.lineItemGrnRequired!,
    rateEditableOnPo: preset.rateEditableOnPo!,
    vendorEditableOnPo: true,
    minValue: undefined,
    maxValue: undefined,
    approvalThreshold: undefined,
    applicabilityEntities: [],
    applicabilityCategories: [],
    applicabilityVendors: [],
    mandatoryFor: [],
    mutuallyExclusiveWith: [],
    requiresAttachment: false,
    reversible: false,
    releaseTrigger: undefined,
    slabTable: [],
    indexReferenceId: undefined,
    indexRevisionFrequency: undefined,
    indexRevisionLag: undefined,
    validFrom: '2024-01-01',
    validTo: undefined,
    status: 'Active',
    version: 1,
    usedOnAnyPo: false,
  };
  return { ...base, ...c.overrides };
}

export const CONDITION_MASTER: ConditionMaster[] = [
  makeCondition({
    code: 'VOL-DISC',
    name: 'Volume / Quantity Discount',
    category: 'DISC',
    overrides: {
      subCategory: 'Volume Discount',
      description: 'Slab-driven discount off line quantity, negotiated standing vendor terms.',
      calcBasis: 'PCT_OF_LINE_BASE',
      defaultRate: 5,
      taxCode: undefined,
      gstTreatment: 'DEDUCTIBLE',
      usedOnAnyPo: true,
    },
  }),
  makeCondition({
    code: 'TRADE-DISC',
    name: 'Trade Discount',
    category: 'DISC',
    overrides: {
      subCategory: 'Trade Discount',
      description: 'Standing vendor terms applied to the line value.',
      calcBasis: 'PCT_OF_LINE_BASE',
      defaultRate: 3,
    },
  }),
  makeCondition({
    code: 'CASH-DISC',
    name: 'Cash / Early Payment Discount',
    category: 'DISC',
    overrides: {
      subCategory: 'Cash / Early Payment Discount',
      description: 'Statistical only — realised at payment, not at PO.',
      calcBasis: 'PCT_OF_LINE_BASE',
      defaultRate: 2,
      statistical: true,
      printOnPdf: false,
    },
  }),
  makeCondition({
    code: 'FUEL-SURC',
    name: 'Fuel Surcharge',
    category: 'SURC',
    overrides: {
      subCategory: 'Fuel Surcharge',
      description: 'Index-linked slab band; revises monthly against the diesel price index.',
      calcBasis: 'SLAB',
      calculateOn: 'SELECTED',
      calculateOnCodes: [BASE_STEP, 'VOL-DISC'],
      taxCode: '996812',
      codeType: 'SAC',
      gstTreatment: 'DEDUCTIBLE',
      indexReferenceId: 'idx-fuel',
      indexRevisionFrequency: 'Monthly',
      indexRevisionLag: 1,
      slabTable: [
        { id: uid('slab'), from: 0, to: 50000, rate: 1 },
        { id: uid('slab'), from: 50000, to: 100000, rate: 3 },
        { id: uid('slab'), from: 100000, to: 999999999, rate: 4 },
      ],
      usedOnAnyPo: true,
    },
  }),
  makeCondition({
    code: 'HANDLING-CHG',
    name: 'Handling Charges',
    category: 'SURC',
    overrides: {
      subCategory: 'Handling Charges',
      calcBasis: 'FIXED_PER_LINE',
      defaultRate: 250,
      taxCode: '996812',
      codeType: 'SAC',
    },
  }),
  makeCondition({
    code: 'SMALL-ORD-SURC',
    name: 'Small Order Surcharge',
    category: 'SURC',
    overrides: {
      subCategory: 'Small Order Surcharge',
      description: 'Conditional — applies only below a value threshold.',
      calcBasis: 'FIXED_PER_PO',
      defaultRate: 500,
      maxValue: 25000,
    },
  }),
  makeCondition({
    code: 'OCEAN-FRT',
    name: 'Ocean Freight',
    category: 'LOGI',
    overrides: {
      subCategory: 'Ocean Freight',
      description: 'Shipment-level charge, rate per CBM. Confirmed via Service Confirmation, not a GRN.',
      calcBasis: 'RATE_X_VOLUME',
      uomId: 'uom-cbm',
      defaultRate: 500,
      taxCode: '996521',
      codeType: 'SAC',
      gstTreatment: 'RCM',
      defaultVendorId: 'ven-maersk',
      vendorGroupFilter: ['Logistics & Freight'],
      autoConfirmOnMainGrn: true,
      confirmationOnPartialGrn: 'FULL_ON_FIRST_GRN',
      lineItemGrnRequired: false,
      usedOnAnyPo: true,
    },
  }),
  makeCondition({
    code: 'ROAD-FRT-GTA',
    name: 'Road / Inland Freight (GTA)',
    category: 'LOGI',
    overrides: {
      subCategory: 'Road / Inland Freight',
      description: 'Goods Transport Agency freight — reverse charge applies; GST shown but not payable to vendor.',
      calcBasis: 'RATE_X_WEIGHT',
      uomId: 'uom-kg',
      defaultRate: 4.5,
      taxCode: '996791',
      codeType: 'SAC',
      gstTreatment: 'RCM',
      defaultVendorId: 'ven-gta',
      vendorGroupFilter: ['Logistics & Freight'],
      confirmationOnPartialGrn: 'PROPORTIONAL',
    },
  }),
  makeCondition({
    code: 'LAST-MILE',
    name: 'Last-Mile Delivery',
    category: 'LOGI',
    overrides: {
      subCategory: 'Last-Mile Delivery',
      calcBasis: 'FIXED_PER_LINE',
      defaultRate: 800,
      taxCode: '997212',
      codeType: 'SAC',
      defaultVendorId: 'ven-lastmile',
      allowedLevel: 'LINE',
      distributionBasis: undefined,
    },
  }),
  makeCondition({
    code: 'MARINE-INS',
    name: 'Marine / Transit Insurance',
    category: 'LOGI',
    overrides: {
      subCategory: 'Marine / Transit Insurance',
      description: 'Calculates on CIF (base + freight), not base alone. Premium is truncated, not rounded.',
      calcBasis: 'PCT_OF_SELECTED_BASE',
      calculateOn: 'SELECTED',
      calculateOnCodes: [BASE_STEP, 'VOL-DISC', 'FUEL-SURC', 'OCEAN-FRT'],
      defaultRate: 1,
      taxCode: '997133',
      codeType: 'SAC',
      gstTreatment: 'DEDUCTIBLE',
      defaultVendorId: 'ven-insure',
      vendorGroupFilter: ['Insurance'],
      rounding: 'DOWN',
      usedOnAnyPo: true,
    },
  }),
  makeCondition({
    code: 'CHA-FEE',
    name: 'Customs Clearance / CHA Fee',
    category: 'LOGI',
    overrides: {
      subCategory: 'Customs Clearance / CHA Fee',
      calcBasis: 'FIXED_PER_PO',
      defaultRate: 3500,
      taxCode: '996713',
      codeType: 'SAC',
      defaultVendorId: 'ven-cha',
      vendorGroupFilter: ['Logistics & Freight'],
      usedOnAnyPo: true,
    },
  }),
  makeCondition({
    code: 'BCD',
    name: 'Basic Customs Duty',
    category: 'STAT',
    overrides: {
      subCategory: 'Basic Customs Duty',
      description: 'Non-creditable — a real landed cost. Rate is derived, not entered on the PO.',
      calcBasis: 'PCT_OF_SELECTED_BASE',
      calculateOn: 'SELECTED',
      calculateOnCodes: [BASE_STEP, 'VOL-DISC', 'FUEL-SURC', 'OCEAN-FRT', 'MARINE-INS'],
      defaultRate: 10,
      taxCode: undefined,
      gstTreatment: 'NON_DEDUCTIBLE',
      defaultVendorId: 'ven-authority',
      capitalise: true,
      usedOnAnyPo: true,
    },
  }),
  makeCondition({
    code: 'SWS',
    name: 'Social Welfare Surcharge',
    category: 'STAT',
    overrides: {
      subCategory: 'Social Welfare Surcharge',
      description: 'A tax on a tax — computed on BCD only, nothing else.',
      calcBasis: 'PCT_OF_SELECTED_BASE',
      calculateOn: 'SELECTED',
      calculateOnCodes: ['BCD'],
      defaultRate: 10,
      gstTreatment: 'NON_DEDUCTIBLE',
      defaultVendorId: 'ven-authority',
      capitalise: true,
      usedOnAnyPo: true,
    },
  }),
  makeCondition({
    code: 'IMPORT-IGST',
    name: 'Import IGST',
    category: 'STAT',
    overrides: {
      subCategory: undefined, // architectural exception — GST is modelled as a condition attribute, not a §3.4 levy type
      description: 'Creditable — flagged Non-capitalising even though it shares the same cascade as BCD.',
      calcBasis: 'PCT_OF_SELECTED_BASE',
      calculateOn: 'SELECTED',
      calculateOnCodes: [BASE_STEP, 'VOL-DISC', 'FUEL-SURC', 'OCEAN-FRT', 'MARINE-INS', 'BCD', 'SWS'],
      defaultRate: 18,
      gstTreatment: 'DEDUCTIBLE',
      defaultVendorId: 'ven-authority',
      capitalise: false,
      usedOnAnyPo: true,
    },
  }),
  makeCondition({
    code: 'EXCISE',
    name: 'Excise Duty',
    category: 'STAT',
    overrides: {
      subCategory: 'Excise Duty',
      description: 'Specific duty — rate per physical unit, not a percentage.',
      calcBasis: 'RATE_X_QTY',
      uomId: 'uom-nos',
      defaultRate: 12,
      gstTreatment: 'NON_DEDUCTIBLE',
      defaultVendorId: 'ven-authority',
    },
  }),
  makeCondition({
    code: 'RETENTION',
    name: 'Retention Money',
    category: 'DEDN',
    overrides: {
      subCategory: 'Retention',
      description: 'Withheld from the vendor; released on commissioning or warranty expiry.',
      calcBasis: 'PCT_OF_LINE_BASE',
      defaultRate: 5,
      reversible: true,
      releaseTrigger: 'COMMISSIONING',
      usedOnAnyPo: true,
    },
  }),
  makeCondition({
    code: 'LD-PENALTY',
    name: 'Liquidated Damages / Late Penalty',
    category: 'DEDN',
    overrides: {
      subCategory: 'Liquidated Damages / Late Penalty',
      description: '% per week of delay, capped via Max Value.',
      calcBasis: 'PCT_OF_LINE_BASE',
      defaultRate: 0.5,
      maxValue: 10,
    },
  }),
  makeCondition({
    code: 'TDS',
    name: 'TDS',
    category: 'DEDN',
    overrides: {
      subCategory: 'TDS / TCS',
      description: 'Statutory withholding, applied at invoice — Section 194Q.',
      calcBasis: 'PCT_OF_LINE_BASE',
      defaultRate: 0.1,
      tdsApplicable: true,
      tdsSection: '194Q',
    },
  }),
  makeCondition({
    code: 'INSTALL-COMM',
    name: 'Installation & Commissioning',
    category: 'OTHR',
    overrides: {
      subCategory: 'Installation & Commissioning',
      calcBasis: 'FIXED_PER_PO',
      defaultRate: 6000,
      taxCode: '998540',
      codeType: 'SAC',
      requiresServiceConfirmation: true,
    },
  }),
  makeCondition({
    code: 'INSPECT-FEE',
    name: 'Third-Party Inspection',
    category: 'OTHR',
    overrides: {
      subCategory: 'Third-Party Inspection',
      calcBasis: 'FIXED_PER_PO',
      defaultRate: 2500,
      taxCode: '998540',
      codeType: 'SAC',
      defaultVendorId: 'ven-inspect',
      requiresAttachment: true,
    },
  }),
];

export const CONDITION_BUNDLES: ConditionBundle[] = [
  {
    id: 'bundle-import-sea',
    name: 'Import Shipment — Sea',
    description: 'Adds freight, insurance, BCD, SWS, IGST and CHA clearing in one click, pre-sequenced.',
    conditionCodes: ['OCEAN-FRT', 'MARINE-INS', 'BCD', 'SWS', 'IMPORT-IGST', 'CHA-FEE'],
  },
  {
    id: 'bundle-domestic-std',
    name: 'Domestic Purchase — Standard Terms',
    description: 'Trade discount, handling charges and retention — the usual domestic vendor terms.',
    conditionCodes: ['TRADE-DISC', 'HANDLING-CHG', 'RETENTION'],
  },
];

// ── Purchase orders ──────────────────────────────────────────────────────

function fromMaster(
  code: string,
  poVendor: { id: string; name: string },
  overrides: Partial<AppliedCondition> & { level: AppliedCondition['level'] }
): AppliedCondition {
  const m = CONDITION_MASTER.find((c) => c.code === code)!;
  // Vendor Rule (PRD §4.2): SAME_AS_PO conditions always follow the PO vendor;
  // otherwise fall back to the master's Default Vendor (freight/duty/insurance parties).
  const vendor = m.vendorRule === 'SAME_AS_PO' ? undefined : VENDORS.find((v) => v.id === m.defaultVendorId);
  const tax = TAX_MASTER.find((t) => t.code === m.taxCode);
  const base: AppliedCondition = {
    id: uid('ac'),
    conditionCode: m.code,
    conditionName: m.name,
    category: m.category,
    level: overrides.level,
    lineId: undefined,
    applyToLineIds: undefined,
    calcBasis: m.calcBasis,
    calculateOn: m.calculateOn,
    calculateOnCodes: m.calculateOnCodes,
    calculateOnWeights: m.calculateOnWeights,
    sign: m.sign,
    rate: m.defaultRate ?? 0,
    qty: 1,
    uomId: m.uomId,
    vendorId: vendor?.id ?? poVendor.id,
    vendorName: vendor?.name ?? poVendor.name,
    poForConditionId: undefined,
    distributionBasis: m.distributionBasis,
    codeType: m.codeType,
    taxCode: m.taxCode,
    gstRate: tax?.gstRate ?? 0,
    gstTreatment: m.gstTreatment,
    capitalise: m.capitalise,
    statistical: m.statistical,
    rounding: m.rounding,
    requiresServiceConfirmation: m.requiresServiceConfirmation,
    autoConfirmOnMainGrn: m.autoConfirmOnMainGrn,
    confirmationMode: m.confirmationOnPartialGrn,
    lineItemGrnRequired: m.lineItemGrnRequired,
    status: 'Draft',
    confirmedPct: 0,
    notes: undefined,
    currency: m.currency,
  };
  // slabTable travels along for the engine (not part of the strict AppliedCondition type)
  (base as any).slabTable = m.slabTable;
  return { ...base, ...overrides };
}

// PO-1 — simple domestic PO (P0 showcase): category presets, sign, live calc,
// jurisdiction-derived GST, vendor rules, line-level conditions.
const po1Line1Id = uid('line');
export const PO_DOMESTIC: PurchaseOrder = {
  id: uid('po'),
  poNumber: 'PO-GRNCL-00205',
  vendorId: 'ven-cello',
  vendorName: 'Cello World Limited',
  entityId: 'ent-1',
  deliveryState: 'Maharashtra',
  deliveryAddress: 'Greencell Mobility Plant 2, MIDC Chakan, Pune, Maharashtra 410501',
  currency: 'INR',
  incoterm: 'DAP',
  stage: 'Draft',
  stageIndex: 1,
  stagePercent: 14,
  owner: 'Admin',
  createdAt: '2026-08-04T18:29:00+05:30',
  createdBy: 'Admin',
  office: 'Pune Plant',
  submittedBy: 'Admin',
  spendSuperCategory: 'Raw Materials',
  spendCategory: 'Battery Cell Materials',
  lines: [
    {
      id: po1Line1Id,
      lineNo: 1,
      itemName: 'Lithium Battery Pack 5kWh',
      itemRef: 'PRODUCT-GRNCL-0000107',
      hsn: '8507',
      qty: 50,
      uom: 'Nos',
      unitPrice: 12000,
      unitWeightKg: 42,
      unitVolumeCbm: 1,
      deliveryAddress: 'Mumbai',
      deliveryDate: '2026-08-20',
      deliveredQty: 0,
      invoiceQty: 0,
      conditions: [
        fromMaster('TRADE-DISC', { id: 'ven-cello', name: 'Cello World Limited' }, { level: 'LINE', lineId: po1Line1Id }),
        fromMaster('HANDLING-CHG', { id: 'ven-cello', name: 'Cello World Limited' }, { level: 'LINE', lineId: po1Line1Id }),
        fromMaster('RETENTION', { id: 'ven-cello', name: 'Cello World Limited' }, { level: 'LINE', lineId: po1Line1Id }),
      ],
    },
  ],
  headerConditions: [],
};

// PO-2 — import shipment cascade (P1/P2 showcase): reproduces the §6 worked
// example exactly — Sequence, Calculate-On, Sign, Capitalise, GST Treatment
// all chained off one base value.
const po2Line1Id = uid('line');
export const PO_IMPORT: PurchaseOrder = {
  id: uid('po'),
  poNumber: 'PO-GRNCL-00318',
  vendorId: 'ven-apex',
  vendorName: 'Apex Battery Components Pte Ltd',
  entityId: 'ent-1',
  deliveryState: 'Maharashtra',
  deliveryAddress: 'JNPT Bonded Warehouse, Nhava Sheva, Maharashtra 400707',
  currency: 'INR',
  incoterm: 'CIF',
  stage: 'Goods Receipt Pending',
  stageIndex: 4,
  stagePercent: 57,
  owner: 'Arpit Agarwal',
  createdAt: '2026-08-04T18:29:00+05:30',
  createdBy: 'Arpit Agarwal',
  office: 'Chakan MIDC Warehouse',
  submittedBy: 'Arpit Agarwal',
  spendSuperCategory: 'Raw Materials',
  spendCategory: 'Electricals & Components',
  lines: [
    {
      id: po2Line1Id,
      lineNo: 1,
      itemName: 'BLDC Hub Motor Assembly — Imported Batch',
      itemRef: 'PRODUCT-GRNCL-0000214',
      hsn: '8503',
      qty: 16,
      uom: 'Nos',
      unitPrice: 6250,
      unitWeightKg: 8.5,
      unitVolumeCbm: 1,
      deliveryAddress: 'Nhava Sheva',
      deliveryDate: '2026-08-25',
      deliveredQty: 16,
      invoiceQty: 0,
      conditions: [
        fromMaster('VOL-DISC', { id: 'ven-apex', name: 'Apex Battery Components Pte Ltd' }, { level: 'LINE', lineId: po2Line1Id }),
        fromMaster('FUEL-SURC', { id: 'ven-apex', name: 'Apex Battery Components Pte Ltd' }, { level: 'LINE', lineId: po2Line1Id }),
        fromMaster('OCEAN-FRT', { id: 'ven-apex', name: 'Apex Battery Components Pte Ltd' }, { level: 'LINE', lineId: po2Line1Id, rate: 500, qty: 16, status: 'Confirmed', confirmedPct: 100 }),
        fromMaster('MARINE-INS', { id: 'ven-apex', name: 'Apex Battery Components Pte Ltd' }, { level: 'LINE', lineId: po2Line1Id }),
        fromMaster('BCD', { id: 'ven-apex', name: 'Apex Battery Components Pte Ltd' }, { level: 'LINE', lineId: po2Line1Id }),
        fromMaster('SWS', { id: 'ven-apex', name: 'Apex Battery Components Pte Ltd' }, { level: 'LINE', lineId: po2Line1Id }),
        fromMaster('IMPORT-IGST', { id: 'ven-apex', name: 'Apex Battery Components Pte Ltd' }, { level: 'LINE', lineId: po2Line1Id }),
        fromMaster('CHA-FEE', { id: 'ven-apex', name: 'Apex Battery Components Pte Ltd' }, { level: 'LINE', lineId: po2Line1Id, status: 'Confirmed', confirmedPct: 100 }),
        fromMaster('RETENTION', { id: 'ven-apex', name: 'Apex Battery Components Pte Ltd' }, { level: 'LINE', lineId: po2Line1Id }),
      ],
    },
  ],
  headerConditions: [],
};

// PO-3 — multi-line domestic PO (P1 showcase): header condition + distribution
// basis exploding one shipment-level charge across three lines.
const po3Lines = ['item-batt', 'item-harness', 'item-motor'].map((itemId, i) => {
  const item = ITEM_MASTER.find((it) => it.id === itemId)!;
  return {
    id: uid('line'),
    lineNo: i + 1,
    itemName: item.name,
    itemRef: `PRODUCT-GRNCL-000030${i + 1}`,
    hsn: item.hsn,
    qty: [20, 40, 15][i],
    uom: 'Nos',
    unitPrice: [11500, 340, 2100][i],
    unitWeightKg: item.unitWeightKg,
    unitVolumeCbm: item.unitVolumeCbm,
    deliveryAddress: 'Pune',
    deliveryDate: '2026-08-22',
    deliveredQty: 0,
    invoiceQty: 0,
    conditions: [] as AppliedCondition[],
  };
});

export const PO_MULTILINE: PurchaseOrder = {
  id: uid('po'),
  poNumber: 'PO-GRNCL-00341',
  vendorId: 'ven-evacay',
  vendorName: 'Evacay Eelitee',
  entityId: 'ent-1',
  deliveryState: 'Maharashtra',
  deliveryAddress: 'Greencell Mobility Plant 2, MIDC Chakan, Pune, Maharashtra 410501',
  currency: 'INR',
  incoterm: 'DAP',
  stage: 'Sent to Vendor',
  stageIndex: 3,
  stagePercent: 43,
  owner: 'Admin',
  createdAt: '2026-08-05T11:05:00+05:30',
  createdBy: 'Admin',
  office: 'Pune Plant',
  submittedBy: 'Admin',
  spendSuperCategory: 'Raw Materials',
  spendCategory: 'Battery Cell Materials',
  lines: po3Lines,
  headerConditions: [
    fromMaster('HANDLING-CHG', { id: 'ven-evacay', name: 'Evacay Eelitee' }, {
      level: 'HEADER',
      rate: 4500,
      calcBasis: 'FIXED_PER_PO',
      applyToLineIds: po3Lines.map((l) => l.id),
      distributionBasis: 'WEIGHT',
    }),
  ],
};

// ── Bulk raw-material POs (Dashboard list/pagination showcase) ──────────
// A manufacturing buyer like Greencell runs far more POs than the 3 hand-authored
// showcases above — this generates a realistic volume of raw-material purchase
// orders (multiple line items each) so the PO list has enough rows to paginate.

interface RawMaterialTemplate {
  name: string;
  hsn: string;
  uom: string;
  unitWeightKg: number;
  unitVolumeCbm: number;
  priceRange: [number, number];
  qtyRange: [number, number];
  vendorIds: string[];
  spendSuperCategory: string;
  spendCategory: string;
}

const RAW_MATERIALS: RawMaterialTemplate[] = [
  { name: 'Lithium-ion Battery Cell (21700)', hsn: '8507', uom: 'Nos', unitWeightKg: 0.07, unitVolumeCbm: 0.0001, priceRange: [180, 260], qtyRange: [2000, 12000], vendorIds: ['ven-amararaja', 'ven-exide', 'ven-apex'], spendSuperCategory: 'Raw Materials', spendCategory: 'Battery Cell Materials' },
  { name: 'NMC Cathode Powder', hsn: '2841', uom: 'KG', unitWeightKg: 1, unitVolumeCbm: 0.0008, priceRange: [2800, 3400], qtyRange: [200, 900], vendorIds: ['ven-amararaja', 'ven-graphene'], spendSuperCategory: 'Raw Materials', spendCategory: 'Battery Cell Materials' },
  { name: 'Graphite Anode Powder', hsn: '3801', uom: 'KG', unitWeightKg: 1, unitVolumeCbm: 0.0009, priceRange: [950, 1150], qtyRange: [200, 900], vendorIds: ['ven-graphene', 'ven-exide'], spendSuperCategory: 'Raw Materials', spendCategory: 'Battery Cell Materials' },
  { name: 'Battery Separator Film', hsn: '3920', uom: 'Nos', unitWeightKg: 4, unitVolumeCbm: 0.02, priceRange: [8500, 11000], qtyRange: [10, 60], vendorIds: ['ven-uflex', 'ven-graphene'], spendSuperCategory: 'Raw Materials', spendCategory: 'Battery Cell Materials' },
  { name: 'Electrolyte Solution', hsn: '3824', uom: 'KG', unitWeightKg: 1, unitVolumeCbm: 0.001, priceRange: [620, 780], qtyRange: [150, 500], vendorIds: ['ven-exide', 'ven-amararaja'], spendSuperCategory: 'Raw Materials', spendCategory: 'Battery Cell Materials' },
  { name: 'Copper Enamelled Winding Wire', hsn: '8544', uom: 'KG', unitWeightKg: 1, unitVolumeCbm: 0.0006, priceRange: [850, 980], qtyRange: [300, 1200], vendorIds: ['ven-polycab', 'ven-hindalco'], spendSuperCategory: 'Raw Materials', spendCategory: 'Metals & Alloys' },
  { name: 'Aluminium Sheet Coil (Battery Casing Grade)', hsn: '7606', uom: 'KG', unitWeightKg: 1, unitVolumeCbm: 0.0004, priceRange: [260, 310], qtyRange: [800, 3000], vendorIds: ['ven-hindalco'], spendSuperCategory: 'Raw Materials', spendCategory: 'Metals & Alloys' },
  { name: 'Cold Rolled Steel Coil', hsn: '7209', uom: 'KG', unitWeightKg: 1, unitVolumeCbm: 0.0003, priceRange: [58, 72], qtyRange: [2000, 8000], vendorIds: ['ven-tatasteel', 'ven-jsw'], spendSuperCategory: 'Raw Materials', spendCategory: 'Metals & Alloys' },
  { name: 'Busbar Copper Strips', hsn: '7409', uom: 'KG', unitWeightKg: 1, unitVolumeCbm: 0.0004, priceRange: [780, 920], qtyRange: [100, 500], vendorIds: ['ven-polycab', 'ven-hindalco'], spendSuperCategory: 'Raw Materials', spendCategory: 'Metals & Alloys' },
  { name: 'Motor Lamination Stampings', hsn: '8503', uom: 'Nos', unitWeightKg: 0.4, unitVolumeCbm: 0.0005, priceRange: [45, 65], qtyRange: [1500, 6000], vendorIds: ['ven-sona', 'ven-tatasteel'], spendSuperCategory: 'Raw Materials', spendCategory: 'Electricals & Components' },
  { name: 'Neodymium Magnets (Motor Grade)', hsn: '8505', uom: 'Nos', unitWeightKg: 0.05, unitVolumeCbm: 0.00005, priceRange: [95, 140], qtyRange: [1000, 4000], vendorIds: ['ven-sona'], spendSuperCategory: 'Raw Materials', spendCategory: 'Electricals & Components' },
  { name: 'Wiring Harness Connectors', hsn: '8536', uom: 'Nos', unitWeightKg: 0.03, unitVolumeCbm: 0.00003, priceRange: [22, 38], qtyRange: [2000, 8000], vendorIds: ['ven-polycab', 'ven-sona'], spendSuperCategory: 'Raw Materials', spendCategory: 'Electricals & Components' },
  { name: 'BMS Printed Circuit Board (Bare)', hsn: '8534', uom: 'Nos', unitWeightKg: 0.15, unitVolumeCbm: 0.0002, priceRange: [340, 480], qtyRange: [200, 1200], vendorIds: ['ven-polycab'], spendSuperCategory: 'Raw Materials', spendCategory: 'Electricals & Components' },
  { name: 'ABS Enclosure Granules', hsn: '3903', uom: 'KG', unitWeightKg: 1, unitVolumeCbm: 0.0012, priceRange: [145, 190], qtyRange: [500, 2500], vendorIds: ['ven-uflex'], spendSuperCategory: 'Raw Materials', spendCategory: 'Polymer Compounds' },
  { name: 'EPDM Rubber Gasket Sheet', hsn: '4008', uom: 'KG', unitWeightKg: 1, unitVolumeCbm: 0.001, priceRange: [220, 280], qtyRange: [150, 700], vendorIds: ['ven-uflex'], spendSuperCategory: 'Raw Materials', spendCategory: 'Polymer Compounds' },
  { name: 'PVC Insulation Tape', hsn: '3919', uom: 'Nos', unitWeightKg: 0.2, unitVolumeCbm: 0.0003, priceRange: [18, 28], qtyRange: [3000, 10000], vendorIds: ['ven-uflex', 'ven-polycab'], spendSuperCategory: 'Consumables', spendCategory: 'Adhesives & Tapes' },
  { name: 'Stainless Steel Fasteners (M6 Bolt Set)', hsn: '7318', uom: 'Nos', unitWeightKg: 0.02, unitVolumeCbm: 0.00002, priceRange: [3.5, 6], qtyRange: [10000, 40000], vendorIds: ['ven-sundram'], spendSuperCategory: 'Raw Materials', spendCategory: 'Fasteners & Hardware' },
  { name: 'Corrugated Export Packaging Boxes', hsn: '4819', uom: 'Nos', unitWeightKg: 0.6, unitVolumeCbm: 0.03, priceRange: [65, 95], qtyRange: [500, 2500], vendorIds: ['ven-uflex'], spendSuperCategory: 'Packaging', spendCategory: 'Packaging Material' },
];

export const OFFICES: { name: string; state: string; address: string }[] = [
  { name: 'Pune Plant', state: 'Maharashtra', address: 'Greencell Mobility Plant 2, MIDC Chakan, Pune, Maharashtra 410501' },
  { name: 'Chennai Plant', state: 'Tamil Nadu', address: 'Greencell Mobility Plant 3, Sriperumbudur, Chennai, Tamil Nadu 602105' },
  { name: 'Bengaluru Ops', state: 'Karnataka', address: 'Greencell Mobility — Bengaluru Ops, Peenya Industrial Area, Bengaluru 560058' },
  { name: 'Chakan MIDC Warehouse', state: 'Maharashtra', address: 'Greencell Mobility Bonded Warehouse, MIDC Chakan, Pune, Maharashtra 410501' },
];

const SUBMITTERS = ['Admin', 'Priya Sharma', 'Rahul Verma', 'Ananya Iyer', 'Karthik Raman', 'Test User 1', 'Test User 2'];

const STAGE_POOL: { stage: PurchaseOrder['stage']; index: number; percent: number }[] = [
  { stage: 'Draft', index: 1, percent: 14 },
  { stage: 'Pending Approval', index: 2, percent: 29 },
  { stage: 'Sent to Vendor', index: 3, percent: 43 },
  { stage: 'Goods Receipt Pending', index: 4, percent: 57 },
  { stage: 'Goods Receipt Pending', index: 4, percent: 57 },
  { stage: 'Invoice Pending', index: 6, percent: 86 },
  { stage: 'Closed', index: 7, percent: 100 },
  { stage: 'Closed', index: 7, percent: 100 },
];

// Deterministic PRNG (mulberry32) — keeps the generated PO list stable across
// reloads instead of reshuffling every time the module re-evaluates.
function mulberry32(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1));
}

function sampleDistinct<T>(rng: () => number, arr: T[], count: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

// Fixed offset from the 2026-01-01 epoch, in days — avoids new Date()/Date.now() so the
// generated data is reproducible; formatted straight into an ISO string.
function isoDateFromDayOffset(dayOffset: number, hour: number, minute: number): string {
  const base = Date.UTC(2026, 0, 1);
  const d = new Date(base + dayOffset * 86400000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const min = String(minute).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:00+05:30`;
}

const RAW_MATERIAL_PO_COUNT = 42;

function makeRawMaterialPO(rng: () => number, seq: number): PurchaseOrder {
  const office = pick(rng, OFFICES);
  const lineCount = randInt(rng, 2, 4);
  const materials = sampleDistinct(rng, RAW_MATERIALS, lineCount);
  const primaryMaterial = materials[0];
  const vendorId = pick(rng, primaryMaterial.vendorIds);
  const vendor = VENDORS.find((v) => v.id === vendorId)!;
  const { stage, index: stageIndex, percent: stagePercent } = pick(rng, STAGE_POOL);
  const createdDayOffset = randInt(rng, 0, 235); // spread across ~2026-01-01..2026-08-25
  const createdAt = isoDateFromDayOffset(createdDayOffset, randInt(rng, 9, 18), randInt(rng, 0, 59));
  const deliveryDate = isoDateFromDayOffset(createdDayOffset + randInt(rng, 10, 30), 0, 0).slice(0, 10);
  const submittedBy = pick(rng, SUBMITTERS);
  const poNumber = `PO-GRNCL-${(400 + seq).toString().padStart(5, '0')}`;
  const isDelivered = stage === 'Goods Receipt Pending' || stage === 'Invoice Pending' || stage === 'Closed';
  const isInvoiced = stage === 'Invoice Pending' || stage === 'Closed';

  const lines = materials.map((m, i) => {
    const lineId = uid('line');
    const qty = randInt(rng, m.qtyRange[0], m.qtyRange[1]);
    const unitPrice = Math.round((m.priceRange[0] + rng() * (m.priceRange[1] - m.priceRange[0])) * 100) / 100;
    return {
      id: lineId,
      lineNo: i + 1,
      itemName: m.name,
      itemRef: `RM-GRNCL-${(1000 + seq * 10 + i).toString()}`,
      hsn: m.hsn,
      qty,
      uom: m.uom,
      unitPrice,
      unitWeightKg: m.unitWeightKg,
      unitVolumeCbm: m.unitVolumeCbm,
      deliveryAddress: office.address,
      deliveryDate,
      deliveredQty: isDelivered ? qty : 0,
      invoiceQty: isInvoiced ? qty : 0,
      conditions:
        i === 0 && rng() > 0.4
          ? [fromMaster(pick(rng, ['TRADE-DISC', 'HANDLING-CHG', 'ROAD-FRT-GTA']), vendor, { level: 'LINE' as const, lineId })]
          : [],
    };
  });

  return {
    id: uid('po'),
    poNumber,
    vendorId: vendor.id,
    vendorName: vendor.name,
    entityId: office.state === 'Karnataka' ? 'ent-2' : 'ent-1',
    deliveryState: office.state,
    deliveryAddress: office.address,
    currency: 'INR',
    incoterm: pick(rng, ['DAP', 'FOB', 'EXW', 'CIF']),
    stage,
    stageIndex,
    stagePercent,
    owner: submittedBy,
    createdAt,
    createdBy: submittedBy,
    office: office.name,
    submittedBy,
    spendSuperCategory: primaryMaterial.spendSuperCategory,
    spendCategory: primaryMaterial.spendCategory,
    lines,
    headerConditions: [],
  };
}

const rawMaterialRng = mulberry32(20260828);
export const RAW_MATERIAL_POS: PurchaseOrder[] = Array.from({ length: RAW_MATERIAL_PO_COUNT }, (_, i) => makeRawMaterialPO(rawMaterialRng, i + 1));

export const SEED_POS: PurchaseOrder[] = [PO_DOMESTIC, PO_IMPORT, PO_MULTILINE, ...RAW_MATERIAL_POS];
