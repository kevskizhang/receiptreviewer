import type { CalculationResult, Person, ReceiptDraft } from '../types';

interface ResultsPanelProps {
  result: CalculationResult | null;
  warnings: string[];
  people: Person[];
  draft: ReceiptDraft;
}

export default function ResultsPanel({ result, warnings, people, draft }: ResultsPanelProps) {
  const copyBreakdown = () => {
    if (!result) return;

    const lines = [
      `Receipt Breakdown - ${draft.storeName || 'Receipt'}`,
      `Date: ${draft.purchasedAt || 'Not specified'}`,
      '',
      'Per Person:'
    ];

    result.perPerson.forEach(breakdown => {
      const person = people.find(p => p.id === breakdown.personId);
      const name = person?.name || breakdown.personId;
      lines.push(
        `${name}: Subtotal $${breakdown.subtotal.toFixed(2)}, Tax $${breakdown.taxShare.toFixed(2)}, Total $${breakdown.total.toFixed(2)}`
      );
    });

    lines.push(
      '',
      `Receipt Total: $${result.receiptGrand.toFixed(2)}`
    );

    if (result.rounding.residualApplied.length > 0) {
      lines.push('', 'Rounding adjustments:');
      result.rounding.residualApplied.forEach(adj => {
        const person = people.find(p => p.id === adj.personId);
        lines.push(`${person?.name || adj.personId}: ${adj.delta > 0 ? '+' : ''}$${adj.delta.toFixed(2)}`);
      });
    }

    navigator.clipboard.writeText(lines.join('\n'));
  };

  const exportJSON = () => {
    const exportData = {
      ...draft,
      calculationResult: result,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${draft.storeName || 'export'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="results-panel">
      <h2>Results</h2>
      
      {warnings.length > 0 && (
        <div className="warnings">
          <h3>Warnings</h3>
          <ul>
            {warnings.map((warning, index) => (
              <li key={index} className="warning">{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {result ? (
        <div className="calculation-results">
          <div className="per-person-breakdown">
            <h3>What Everyone Owes</h3>
            <table className="breakdown-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Subtotal</th>
                  <th>Tax Share</th>
                  <th>Total Owed</th>
                </tr>
              </thead>
              <tbody>
                {result.perPerson.map(breakdown => {
                  const person = people.find(p => p.id === breakdown.personId);
                  return (
                    <tr key={breakdown.personId}>
                      <td className="person-name">{person?.name || breakdown.personId}</td>
                      <td>${breakdown.subtotal.toFixed(2)}</td>
                      <td>${breakdown.taxShare.toFixed(2)}</td>
                      <td className="total-owed">${breakdown.total.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="receipt-summary">
            <h3>Receipt Summary</h3>
            <div className="summary-row">
              <span>Subtotal:</span>
              <span>${result.receiptSubtotal.toFixed(2)}</span>
            </div>
            <div className="summary-row">
              <span>Tax:</span>
              <span>${result.receiptTax.toFixed(2)}</span>
            </div>
            <div className="summary-row total">
              <span>Grand Total:</span>
              <span>${result.receiptGrand.toFixed(2)}</span>
            </div>
          </div>

          {result.rounding.residualApplied.length > 0 && (
            <div className="rounding-adjustments">
              <h4>Rounding Adjustments</h4>
              <p className="rounding-note">
                Small adjustments were made to ensure totals match exactly:
              </p>
              <ul>
                {result.rounding.residualApplied.map((adj, index) => {
                  const person = people.find(p => p.id === adj.personId);
                  return (
                    <li key={index}>
                      {person?.name || adj.personId}: {adj.delta > 0 ? '+' : ''}${adj.delta.toFixed(2)}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="result-actions">
            <button onClick={copyBreakdown} className="copy-button">
              Copy Breakdown
            </button>
            <button onClick={exportJSON} className="export-button">
              Export JSON
            </button>
          </div>
        </div>
      ) : (
        <div className="no-results">
          <p>Add people and items to see the breakdown</p>
        </div>
      )}
    </div>
  );
}