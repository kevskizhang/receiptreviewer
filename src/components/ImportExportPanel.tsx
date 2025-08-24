import { useRef } from 'react';
import type { ReceiptDraft } from '../types';
import { parseCsvToDraft, parseJsonToDraft } from '../parsing';

interface ImportExportPanelProps {
  onLoadDraft: (draft: ReceiptDraft) => void;
  draft: ReceiptDraft;
}

export default function ImportExportPanel({ onLoadDraft, draft }: ImportExportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let parsedDraft: ReceiptDraft;

      if (file.name.toLowerCase().endsWith('.csv')) {
        // For CSV, we need to provide a people bank. Extract from existing draft or create basic ones
        const existingPeople = draft.people.length > 0 ? draft.people : [];
        parsedDraft = parseCsvToDraft(text, existingPeople);
      } else if (file.name.toLowerCase().endsWith('.json')) {
        parsedDraft = parseJsonToDraft(JSON.parse(text));
      } else {
        throw new Error('Unsupported file type. Please upload a CSV or JSON file.');
      }

      onLoadDraft(parsedDraft);
    } catch (error) {
      alert(`Error importing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const exportDraft = () => {
    const exportData = {
      ...draft,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-draft-${draft.storeName || 'export'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const createSampleCSV = () => {
    const csvContent = `name,price,category
Pizza,15.99,Food
Soda,5.00,Drinks
Salad,8.50,Food
Dessert,6.99,Food`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-receipt.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="import-export-panel">
      <h3>Import / Export</h3>
      
      <div className="import-section">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        
        <div className="import-buttons">
          <button onClick={() => fileInputRef.current?.click()}>
            Import CSV/JSON
          </button>
          <button onClick={createSampleCSV} className="sample-button">
            Download Sample CSV
          </button>
        </div>
        
        <p className="import-help">
          <small>
            💡 You can import receipts without payer assignments. 
            Items will be highlighted for manual payer assignment after import.
          </small>
        </p>
      </div>
      
      <div className="export-section">
        <button onClick={exportDraft} disabled={draft.items.length === 0}>
          Export Current Draft
        </button>
      </div>
    </div>
  );
}