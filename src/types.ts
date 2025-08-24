export type Person = {
  id: string;
  name: string;
  handle?: string;
};

export type Item = {
  id: string;
  name: string;
  price: number;
  category?: string;
  payers: string[]; // simplified - just person IDs, equal split
  meta?: Record<string, unknown>;
};

export type ReceiptDraft = {
  title?: string;
  storeName?: string;
  purchasedAt?: string;
  currency: string;
  taxTotal: number;
  items: Item[];
  people: Person[];
};

export type PersonBreakdown = {
  personId: string;
  subtotal: number;
  taxShare: number;
  total: number;
  _fractional: {
    subtotal: number;
    taxShare: number;
    total: number;
  };
};

export type CalculationResult = {
  perPerson: PersonBreakdown[];
  receiptSubtotal: number;
  receiptTax: number;
  receiptGrand: number;
  rounding: {
    method: "half-up";
    residualApplied: Array<{ personId: string; delta: number }>;
  };
  warnings: string[];
};

export type CSVRow = {
  name: string;
  price: string;
  category?: string;
  payers: string;
};