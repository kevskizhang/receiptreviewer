# ReceiptReviewer (Per-Session) — Spec & Implementation Plan

## 0) Scope & assumptions

* **People Bank**: a session-local list of people (names + optional IDs/handles).
* **Ingest**: user adds items manually or uploads CSV/JSON (OCR/LLM is out of scope).
* **Draft → Confirm**: items render in a draft editor; user confirms to compute results.
* **Tax**: a single **order-level** tax amount; allocate **proportional to each person’s pre-tax subtotal**.
* **Rounding**: perform all math in high precision; **round to 2 decimals at the very end per person**; then penny-reconcile to ensure sums match.
* **Editability**: any edit re-runs the calculation on the current session state.
* **No backend**: all state is in memory; optionally **Export/Import JSON** to persist between sessions.

---

## 1) Data structures (TypeScript)

```ts
// Session state (in memory only)
type Person = { id: string; name: string; handle?: string };

type PayerWeight =
  | number                     // weight (e.g., 1, 2.5)
  | { weight: number };        // future extensibility

type ItemShare = Record<string /*personId*/, PayerWeight>; // e.g., {"kev":1,"ali":1,"bob":1}

type Item = {
  id: string;
  name: string;
  quantity: number;            // default 1
  unitPrice?: number;          // optional if total provided
  total: number;               // required line total before tax
  category?: string;
  shares: ItemShare;           // at least one person; weights not required to sum to 1
  meta?: Record<string, unknown>;
};

type ReceiptDraft = {
  title?: string;
  storeName?: string;
  purchasedAt?: string;        // "YYYY-MM-DD"
  currency: "USD" | string;
  taxTotal: number;            // order-level tax >= 0
  items: Item[];
  people: Person[];            // the "bank"
};

type PersonBreakdown = {
  personId: string;
  subtotal: number;            // sum of assigned line shares (pre-tax)
  taxShare: number;            // proportional to subtotal
  total: number;               // subtotal + taxShare
  _fractional: { subtotal: number; taxShare: number; total: number }; // high precision pre-round
};

type CalculationResult = {
  perPerson: PersonBreakdown[];
  receiptSubtotal: number;     // sum of item totals
  receiptTax: number;          // from draft.taxTotal
  receiptGrand: number;        // subtotal + tax
  rounding: {
    method: "half-up";         // deterministic policy
    residualApplied: Array<{ personId: string; delta: number }>;
  };
  warnings: string[];          // e.g., "Item X has no payers"
};
```

---

## 2) Import schemas

### CSV (human-friendly)

* **Columns** (minimum): `name, quantity, unit_price, total, payers`
* Optional columns: `category`
* **payers** syntax:

  * Comma-sep names or IDs → equal split (e.g., `kevin,alice,bob`)
  * Weighted: `kevin:2,alice:1,bob:1`

**Example**

```
name,quantity,unit_price,total,category,payers
Oranges,3,1.00,3.00,Produce,kevin,alice,bob
Apple,1,1.50,1.50,Produce,kevin
```

### JSON (machine-precise)

```json
{
  "title": "Trader Joe's Run",
  "storeName": "Trader Joe's",
  "purchasedAt": "2025-08-22",
  "currency": "USD",
  "taxTotal": 0.36,
  "people": [
    {"id": "kev", "name": "Kevin"},
    {"id": "ali", "name": "Alice"},
    {"id": "bob", "name": "Bob"}
  ],
  "items": [
    {
      "id": "i1",
      "name": "Oranges",
      "quantity": 3,
      "unitPrice": 1.0,
      "total": 3.0,
      "category": "Produce",
      "shares": {"kev": 1, "ali": 1, "bob": 1}
    },
    {
      "id": "i2",
      "name": "Apple",
      "quantity": 1,
      "unitPrice": 1.5,
      "total": 1.5,
      "category": "Produce",
      "shares": {"kev": 1}
    }
  ]
}
```

---

## 3) Parsing & validation

```ts
function parseCsvToDraft(csv: string, peopleBank: Person[], currency = "USD"): ReceiptDraft
function parseJsonToDraft(json: unknown): ReceiptDraft

function validateDraft(draft: ReceiptDraft): string[] /*warnings*/ // non-fatal issues only
```

Validation rules:

* `items[].total` must be ≥ 0; `quantity` ≥ 0.
* Each item must have at least one payer with a positive weight.
* `taxTotal` ≥ 0.
* People referenced in `shares` must exist in `draft.people`; offer mapping by name if IDs absent.

Normalization:

* Convert missing or nonpositive weights to 0 and warn.
* Normalize weights per item so **effective weights sum to 1** (internally) for calculations.

---

## 4) Calculation algorithm (high precision → final rounding)

```ts
function compute(draft: ReceiptDraft): CalculationResult
```

Steps:

1. **Precompute receiptSubtotal** = Σ `item.total`.
2. **Per-item shares**:

   * Let `W = Σ weights` for that item (post-normalization).
   * For each participant p: `share_p_item = item.total * (weight_p / W)`.
3. **Per-person subtotal**:

   * `subtotal_p = Σ share_p_item` across all items.
4. **Tax allocation** (order-level, proportional to pre-tax subtotals):

   * Let `S = Σ subtotal_p` (should equal `receiptSubtotal` within epsilon).
   * If `S == 0 && taxTotal > 0`: set all `taxShare_p = 0` and push warning.
   * Else `taxShare_p = draft.taxTotal * (subtotal_p / S)`.
5. **Totals (pre-round)**:

   * `total_p = subtotal_p + taxShare_p` (keep **full precision**, e.g., decimal.js).
6. **Final rounding to cents**:

   * **Method**: `half-up` (e.g., 2.345 → 2.35; −2.345 → −2.35).
   * For each person: `roundedTotal_p = round2(total_p)`.
7. **Penny reconciliation** (ensure per-person cents sum equals receipt grand total):

   * `grandRounded = round2(receiptSubtotal + taxTotal)`.
   * Compute `delta = grandRounded − Σ roundedTotal_p`.
   * If `delta ≠ 0`, distribute ±\$0.01 to the **largest fractional remainders** in `total_p` (descending), breaking ties by stable personId ordering, until `delta` is 0. Record adjustments in `rounding.residualApplied`.

Return per-person breakdown and receipt aggregates.

---

## 5) Editing & recalculation

* **All edits are local** to the draft (in memory).
* Any change (items, shares, tax, people) triggers `compute(draft)` and updates the visible results.
* Provide **Undo/Redo** stacks (array of patches) within session only.
* **Export/Import**: allow download/upload of the current `ReceiptDraft` (and optionally last `CalculationResult`) as JSON.

---

## 6) UI flow (single-page)

1. **People Bank**

   * Add / rename / remove people (id auto-gen; name unique per session).
2. **Receipt Draft**

   * Add items (name, qty, unit, unitPrice, total).
   * Quick **payers** selector with avatars; toggle to add; long-press to set weight.
   * Inline tax input (single number).
   * Table totals (live): subtotal, tax, grand total.
3. **Confirm & Results**

   * Show per-person rows: `Name | Subtotal | Tax | Total Owed`.
   * “Copy breakdown” and “Export JSON”.
   * “Edit again” returns to Draft; changes re-compute live.

Accessibility & speed:

* Keyboard shortcuts (↑/↓ rows; `E` = even split across selected; numbers set weight).
* Inline warnings banner.

---

## 7) Minimal components (React, in-memory)

* `PeopleBankPanel`
* `ReceiptDraftEditor` (items table + tax field)
* `PayerSelector` (chips + weights)
* `ResultsPanel`
* `ImportCSVButton`, `ImportJSONButton`, `ExportJSONButton`

State:

* `useReducer` or a tiny store (e.g., Zustand) **in memory** only.
* No network calls; all pure functions.

---

## 8) Example test cases (deterministic)

**TC1: Basic split + tax**

Input:

* People: Kevin(kev), Alice(ali), Bob(bob)
* Items:

  * Oranges \$3.00, shares kev:1, ali:1, bob:1
  * Apple \$1.50, shares kev:1
* Tax: \$0.36

Calcs:

* Subtotals: Kevin 2.50, Alice 1.00, Bob 1.00 (sum 4.50)
* Tax shares: Kevin 0.36\*(2.5/4.5)=0.20; Alice 0.08; Bob 0.08
* Totals (pre-round): K 2.70, A 1.08, B 1.08 → already 2 decimals
* Grand: 4.86; Sum per-person: 4.86 → no reconciliation.

**Expected output**

```
Kevin: subtotal 2.50, tax 0.20, total 2.70
Alice: subtotal 1.00, tax 0.08, total 1.08
Bob:   subtotal 1.00, tax 0.08, total 1.08
```

**TC2: Weighted shares + penny reconciliation**

* People: A,B,C
* Items:

  * Coffee Beans \$10.00, shares A:3, B:1 (C excluded)
* Tax: \$0.83

Subtotals: A 7.50, B 2.50, C 0
Tax shares (pre-round):

* A: 0.83\*(7.5/10)=0.6225
* B: 0.83\*(2.5/10)=0.2075
* C: 0
  Totals (pre-round):
* A: 8.1225
* B: 2.7075
* C: 0
  Rounded (half-up): A 8.12, B 2.71, C 0 → Sum 10.83 = Grand 10.83 (no residual).
  (Adjust test so a ±\$0.01 residual occurs and verify it goes to the largest remainder.)

**TC3: Missing weights / zero participants**

* An item with `payers=""` → warn and ignore that item’s cost (or prevent confirm).
* A payer with weight 0 → excluded from normalization with warning.

---

## 9) Functions to implement (copy/paste targets)

```ts
// parsing
export function parseCsvToDraft(csv: string, bank: Person[], currency?: string): ReceiptDraft
export function parseJsonToDraft(json: unknown): ReceiptDraft

// validation & normalization
export function validateDraft(d: ReceiptDraft): string[]
export function normalizeShares(item: Item, people: Person[]): { norm: Record<string, number>; warnings: string[] }

// math
export function compute(d: ReceiptDraft): CalculationResult
export function round2HalfUp(n: number): number
export function reconcilePennies(result: CalculationResult): CalculationResult

// utilities
export function exportDraftJSON(d: ReceiptDraft): string
export function importDraftJSON(text: string): ReceiptDraft
```

---

## 10) Error & warning copy (examples)

* “Item **{name}** has no valid payers—assign at least one to continue.”
* “Some payer weights were non-positive; they were ignored for **{name}**.”
* “Tax cannot be negative; set to 0.”
* “Rounded totals adjusted by ±\$0.01 to match the receipt grand total.”

---

## 11) Example CSV + JSON (ready to test)

**CSV**

```
name,quantity,unit_price,total,category,payers
Oranges,3,1.00,3.00,Produce,Kevin,Alice,Bob
Apple,1,1.50,1.50,Produce,Kevin
```

**JSON**

```
{
  "store": "Trader Joe's",
  "purchased_at": "2025-08-22",
  "currency": "USD",
  "people": ["kevin","alice","bob"],
  "items": [
    {
      "name": "Oranges",
      "qty": 3,
      "unit_price": 1.0,
      "total_price": 3.0,
      "category": "Produce",
      "taxable": true,
      "shares": {"kevin":1, "alice":1, "bob":1}
    },
    {
      "name": "Apple",
      "qty": 1,
      "unit_price": 1.5,
      "total_price": 1.5,
      "category": "Produce",
      "taxable": true,
      "shares": {"kevin":1}
    }
  ],
  "order_level": {
    "discounts": [
      {"name":"Order Discount","amount": -3.0, "eligibility":"category:Frozen|Dairy"}
    ],
    "fees": [
      {"name":"Delivery Fee","amount": 5.0, "allocation_basis":"participants"}
    ],
    "tax": {
      "type": "order",
      "amount": 1.24,
      "allocation_basis": "taxable_subtotal"
    },
    "tip": {"amount": 3.00, "allocation_basis": "participants"}
  }
}
```