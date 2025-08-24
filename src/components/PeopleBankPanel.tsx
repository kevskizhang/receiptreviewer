import { useState } from 'react';
import type { Person } from '../types';

interface PeopleBankPanelProps {
  people: Person[];
  onAddPerson: (person: Person) => void;
  onUpdatePerson: (person: Person) => void;
  onRemovePerson: (personId: string) => void;
}

export default function PeopleBankPanel({
  people,
  onAddPerson,
  onUpdatePerson,
  onRemovePerson
}: PeopleBankPanelProps) {
  const [newPersonName, setNewPersonName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAddPerson = () => {
    if (!newPersonName.trim()) return;

    const id = `person_${Date.now()}`;
    onAddPerson({
      id,
      name: newPersonName.trim()
    });
    setNewPersonName('');
  };

  const handleStartEdit = (person: Person) => {
    setEditingId(person.id);
    setEditName(person.name);
  };

  const handleSaveEdit = () => {
    if (!editName.trim() || !editingId) return;

    onUpdatePerson({
      id: editingId,
      name: editName.trim()
    });
    setEditingId(null);
    setEditName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  return (
    <div className="people-bank-panel">
      <h2>People</h2>
      
      <div className="add-person">
        <input
          type="text"
          placeholder="Add person name..."
          value={newPersonName}
          onChange={(e) => setNewPersonName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddPerson()}
        />
        <button onClick={handleAddPerson} disabled={!newPersonName.trim()}>
          Add
        </button>
      </div>

      <div className="people-list">
        {people.length === 0 ? (
          <p className="empty-state">No people added yet. Add someone to get started!</p>
        ) : (
          people.map((person) => (
            <div key={person.id} className="person-item">
              {editingId === person.id ? (
                <div className="edit-person">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    autoFocus
                  />
                  <button onClick={handleSaveEdit} disabled={!editName.trim()}>
                    Save
                  </button>
                  <button onClick={handleCancelEdit}>Cancel</button>
                </div>
              ) : (
                <div className="view-person">
                  <span className="person-name">{person.name}</span>
                  <div className="person-actions">
                    <button onClick={() => handleStartEdit(person)}>Edit</button>
                    <button onClick={() => onRemovePerson(person.id)}>Remove</button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}