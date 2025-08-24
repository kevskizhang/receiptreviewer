import Decimal from 'decimal.js';
import type { ReceiptDraft, CalculationResult, PersonBreakdown } from './types';

// Configure Decimal.js for high precision
Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function round2HalfUp(n: number): number {
  return new Decimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function compute(draft: ReceiptDraft): CalculationResult {
  const warnings: string[] = [];
  
  // Initialize per-person tracking
  const personMap = new Map<string, {
    subtotal: Decimal;
    taxShare: Decimal;
    total: Decimal;
  }>();

  // Initialize all people with zero values
  for (const person of draft.people) {
    personMap.set(person.id, {
      subtotal: new Decimal(0),
      taxShare: new Decimal(0),
      total: new Decimal(0)
    });
  }

  // Calculate receipt subtotal and per-person subtotals
  let receiptSubtotal = new Decimal(0);

  for (const item of draft.items) {
    const itemPrice = new Decimal(item.price);
    receiptSubtotal = receiptSubtotal.plus(itemPrice);

    if (item.payers.length === 0) {
      warnings.push(`Item "${item.name}" has no payers`);
      continue;
    }

    // Equal split among all payers (no weights)
    const sharePerPayer = itemPrice.dividedBy(item.payers.length);

    for (const payerId of item.payers) {
      const personData = personMap.get(payerId);
      if (personData) {
        personData.subtotal = personData.subtotal.plus(sharePerPayer);
      } else {
        warnings.push(`Unknown payer "${payerId}" for item "${item.name}"`);
      }
    }
  }

  // Calculate tax allocation (proportional to subtotals)
  const taxTotal = new Decimal(draft.taxTotal);
  const totalSubtotal = Array.from(personMap.values())
    .reduce((sum, person) => sum.plus(person.subtotal), new Decimal(0));

  if (totalSubtotal.isZero() && taxTotal.greaterThan(0)) {
    warnings.push('Cannot allocate tax when no items have payers');
  } else if (totalSubtotal.greaterThan(0)) {
    for (const [, personData] of personMap) {
      personData.taxShare = taxTotal.times(personData.subtotal).dividedBy(totalSubtotal);
    }
  }

  // Calculate totals (pre-round)
  for (const personData of personMap.values()) {
    personData.total = personData.subtotal.plus(personData.taxShare);
  }

  // Round to cents
  const perPersonRounded: PersonBreakdown[] = [];
  let totalRoundedSum = new Decimal(0);

  for (const [personId, personData] of personMap) {
    const roundedSubtotal = round2HalfUp(personData.subtotal.toNumber());
    const roundedTaxShare = round2HalfUp(personData.taxShare.toNumber());
    const roundedTotal = round2HalfUp(personData.total.toNumber());

    totalRoundedSum = totalRoundedSum.plus(roundedTotal);

    perPersonRounded.push({
      personId,
      subtotal: roundedSubtotal,
      taxShare: roundedTaxShare,
      total: roundedTotal,
      _fractional: {
        subtotal: personData.subtotal.toNumber(),
        taxShare: personData.taxShare.toNumber(),
        total: personData.total.toNumber()
      }
    });
  }

  // Penny reconciliation
  const receiptGrand = receiptSubtotal.plus(taxTotal);
  const grandRounded = round2HalfUp(receiptGrand.toNumber());
  const delta = new Decimal(grandRounded).minus(totalRoundedSum);

  const residualApplied: Array<{ personId: string; delta: number }> = [];

  if (!delta.isZero()) {
    // Sort by fractional remainder (descending), then by personId for stability
    const sortedBreakdowns = [...perPersonRounded].sort((a, b) => {
      const aRemainder = new Decimal(a._fractional.total).minus(a.total).abs();
      const bRemainder = new Decimal(b._fractional.total).minus(b.total).abs();
      
      const remainderDiff = bRemainder.minus(aRemainder).toNumber();
      if (remainderDiff !== 0) return remainderDiff > 0 ? 1 : -1;
      
      return a.personId.localeCompare(b.personId);
    });

    let remainingDelta = delta.toNumber();
    const deltaDirection = remainingDelta > 0 ? 0.01 : -0.01;

    for (const breakdown of sortedBreakdowns) {
      if (Math.abs(remainingDelta) < 0.005) break;

      breakdown.total = round2HalfUp(breakdown.total + deltaDirection);
      residualApplied.push({
        personId: breakdown.personId,
        delta: deltaDirection
      });
      
      remainingDelta -= deltaDirection;
    }
  }

  return {
    perPerson: perPersonRounded,
    receiptSubtotal: receiptSubtotal.toNumber(),
    receiptTax: taxTotal.toNumber(),
    receiptGrand: receiptGrand.toNumber(),
    rounding: {
      method: "half-up",
      residualApplied
    },
    warnings
  };
}