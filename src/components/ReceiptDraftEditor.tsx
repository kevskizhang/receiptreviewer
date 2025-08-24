import { useState } from 'react';
import type { ReceiptDraft, Item, Person } from '../types';
import PayerSelector from './PayerSelector';

interface ReceiptDraftEditorProps {
  draft: ReceiptDraft;
  onAddItem: (item: Item) => void;
  onUpdateItem: (item: Item) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateTax: (tax: number) => void;
  onUpdateMeta: (meta: Partial<ReceiptDraft>) => void;
}

export default function ReceiptDraftEditor({
  draft,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onUpdateTax,
  onUpdateMeta
}: ReceiptDraftEditorProps) {
  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    category: '',
    payers: [] as string[]
  });

  const handleAddItem = () => {
    if (!newItem.name.trim() || !newItem.price) return;

    const item: Item = {
      id: `item_${Date.now()}`,
      name: newItem.name.trim(),
      price: parseFloat(newItem.price),
      category: newItem.category || undefined,
      payers: newItem.payers
    };

    onAddItem(item);
    setNewItem({
      name: '',
      price: '',
      category: '',
      payers: []
    });
  };

  const receiptSubtotal = draft.items.reduce((sum, item) => sum + item.price, 0);
  const receiptGrand = receiptSubtotal + draft.taxTotal;

  return (
    <div className="receipt-draft-editor">
      <h2>Receipt Details</h2>
      
      <div className="receipt-meta">
        <div className="meta-row">
          <input
            type="text"
            placeholder="Store name (optional)"
            value={draft.storeName || ''}
            onChange={(e) => onUpdateMeta({ storeName: e.target.value })}
          />
          <input
            type="date"
            value={draft.purchasedAt || ''}
            onChange={(e) => onUpdateMeta({ purchasedAt: e.target.value })}
          />
        </div>
      </div>

      <div className="items-section">
        <h3>Items</h3>
        
        <div className="add-item">
          <div className="item-form">
            <input
              type="text"
              placeholder="Item name"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
            />
            <input
              type="number"
              placeholder="Price"
              min="0"
              step="0.01"
              value={newItem.price}
              onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Category"
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
            />
          </div>
          
          <div className="payer-selection">
            <PayerSelector
              people={draft.people}
              selectedPayers={newItem.payers}
              onChange={(payers) => setNewItem({ ...newItem, payers })}
            />
          </div>
          
          <button 
            onClick={handleAddItem} 
            disabled={!newItem.name.trim() || !newItem.price || newItem.payers.length === 0}
          >
            Add Item
          </button>
        </div>

        <div className="items-list">
          {draft.items.length === 0 ? (
            <p className="empty-state">No items added yet</p>
          ) : (
            <table className="items-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Category</th>
                  <th>Payers</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {draft.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    people={draft.people}
                    onUpdate={onUpdateItem}
                    onRemove={onRemoveItem}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="receipt-totals">
        <div className="totals-row">
          <span>Subtotal:</span>
          <span>${receiptSubtotal.toFixed(2)}</span>
        </div>
        <div className="totals-row">
          <span>Tax:</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.taxTotal}
            onChange={(e) => onUpdateTax(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="totals-row total-grand">
          <span>Grand Total:</span>
          <span>${receiptGrand.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

interface ItemRowProps {
  item: Item;
  people: Person[];
  onUpdate: (item: Item) => void;
  onRemove: (itemId: string) => void;
}

function ItemRow({ item, people, onUpdate, onRemove }: ItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editItem, setEditItem] = useState(item);

  const handleSave = () => {
    onUpdate(editItem);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditItem(item);
    setIsEditing(false);
  };

  const payerNames = item.payers
    .map(payerId => people.find(p => p.id === payerId)?.name || payerId)
    .join(', ');
  
  const hasNoPayers = item.payers.length === 0;

  if (isEditing) {
    return (
      <tr className="editing">
        <td>
          <input
            type="text"
            value={editItem.name}
            onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
          />
        </td>
        <td>
          <input
            type="number"
            min="0"
            step="0.01"
            value={editItem.price}
            onChange={(e) => setEditItem({ ...editItem, price: parseFloat(e.target.value) || 0 })}
          />
        </td>
        <td>
          <input
            type="text"
            value={editItem.category || ''}
            onChange={(e) => setEditItem({ ...editItem, category: e.target.value })}
          />
        </td>
        <td>
          <PayerSelector
            people={people}
            selectedPayers={editItem.payers}
            onChange={(payers) => setEditItem({ ...editItem, payers })}
          />
        </td>
        <td>
          <button onClick={handleSave}>Save</button>
          <button onClick={handleCancel}>Cancel</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className={hasNoPayers ? 'no-payers' : ''}>
      <td>{item.name}</td>
      <td>${item.price.toFixed(2)}</td>
      <td>{item.category || '-'}</td>
      <td className={hasNoPayers ? 'needs-assignment' : ''}>
        {payerNames || (
          <span className="no-payers-text">
            <strong>No payers assigned</strong>
          </span>
        )}
      </td>
      <td>
        <button onClick={() => setIsEditing(true)}>
          {hasNoPayers ? 'Assign Payers' : 'Edit'}
        </button>
        <button onClick={() => onRemove(item.id)}>Remove</button>
      </td>
    </tr>
  );
}