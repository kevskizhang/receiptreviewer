import type { Person, ReceiptDraft, Item, CSVRow } from './types';

export function parseCsvToDraft(
  csv: string,
  peopleBank: Person[],
  currency: string = "USD"
): ReceiptDraft {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have header and at least one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const requiredHeaders = ['name', 'price'];
  
  for (const required of requiredHeaders) {
    if (!headers.includes(required)) {
      throw new Error(`Missing required column: ${required}`);
    }
  }

  const items: Item[] = [];
  const warnings: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: CSVRow = {
      name: '',
      price: '',
      payers: ''
    };

    headers.forEach((header, index) => {
      if (values[index] !== undefined) {
        (row as any)[header] = values[index];
      }
    });

    const price = parseFloat(row.price);

    if (isNaN(price) || price < 0) {
      warnings.push(`Invalid price for ${row.name}, skipping row`);
      continue;
    }

    // Parse payers - handle missing payers column gracefully
    const payers: string[] = [];
    
    if (row.payers && row.payers.trim()) {
      const payerNames = row.payers.split(',').map(p => p.trim()).filter(p => p);
      
      for (const payerName of payerNames) {
        const person = peopleBank.find(p => 
          p.name.toLowerCase() === payerName.toLowerCase() || 
          p.id === payerName
        );
        if (person) {
          payers.push(person.id);
        } else {
          warnings.push(`Unknown payer "${payerName}" for ${row.name} - you can assign payers manually`);
        }
      }
    }

    // Don't skip items with no payers - allow manual assignment

    items.push({
      id: `item_${i}`,
      name: row.name,
      price,
      category: row.category,
      payers
    });
  }

  if (warnings.length > 0) {
    console.warn('CSV parsing warnings:', warnings);
  }

  return {
    currency,
    taxTotal: 0,
    items,
    people: peopleBank
  };
}

export function parseJsonToDraft(json: unknown): ReceiptDraft {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid JSON format');
  }

  const data = json as any;

  // Validate required fields
  if (!Array.isArray(data.items)) {
    throw new Error('items must be an array');
  }
  if (!Array.isArray(data.people)) {
    throw new Error('people must be an array');
  }

  const people: Person[] = data.people.map((p: any, index: number) => {
    if (typeof p === 'string') {
      return { id: p, name: p };
    }
    return {
      id: p.id || `person_${index}`,
      name: p.name || p.id || `Person ${index + 1}`,
      handle: p.handle
    };
  });

  const items: Item[] = data.items.map((item: any, index: number) => ({
    id: item.id || `item_${index}`,
    name: item.name || `Item ${index + 1}`,
    price: item.price || item.total || item.total_price || 0,
    category: item.category,
    payers: Array.isArray(item.payers) ? item.payers : 
           (item.shares ? Object.keys(item.shares) : []),
    meta: item.meta
  }));

  return {
    title: data.title,
    storeName: data.storeName || data.store,
    purchasedAt: data.purchasedAt || data.purchased_at,
    currency: data.currency || 'USD',
    taxTotal: data.taxTotal || data.tax?.amount || 0,
    items,
    people
  };
}

export function validateDraft(draft: ReceiptDraft): string[] {
  const warnings: string[] = [];

  // Validate tax
  if (draft.taxTotal < 0) {
    warnings.push('Tax cannot be negative');
  }

  // Validate items
  for (const item of draft.items) {
    if (item.price < 0) {
      warnings.push(`Item "${item.name}" has negative price`);
    }
    if (item.payers.length === 0) {
      warnings.push(`Item "${item.name}" has no payers assigned - assign payers to include in calculations`);
    }

    // Check if all payers exist in people bank
    for (const payerId of item.payers) {
      if (!draft.people.find(p => p.id === payerId)) {
        warnings.push(`Unknown payer "${payerId}" for item "${item.name}"`);
      }
    }
  }

  // Check for duplicate person IDs
  const personIds = draft.people.map(p => p.id);
  const duplicateIds = personIds.filter((id, index) => personIds.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    warnings.push(`Duplicate person IDs: ${duplicateIds.join(', ')}`);
  }

  return warnings;
}