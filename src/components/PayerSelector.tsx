import type { Person } from '../types';

interface PayerSelectorProps {
  people: Person[];
  selectedPayers: string[];
  onChange: (payers: string[]) => void;
}

export default function PayerSelector({ people, selectedPayers, onChange }: PayerSelectorProps) {
  const togglePayer = (personId: string) => {
    if (selectedPayers.includes(personId)) {
      onChange(selectedPayers.filter(id => id !== personId));
    } else {
      onChange([...selectedPayers, personId]);
    }
  };

  const selectAll = () => {
    onChange(people.map(p => p.id));
  };

  const selectNone = () => {
    onChange([]);
  };

  if (people.length === 0) {
    return <span className="no-people">No people added yet</span>;
  }

  return (
    <div className="payer-selector">
      <div className="payer-controls">
        <button type="button" onClick={selectAll} className="select-all">
          All
        </button>
        <button type="button" onClick={selectNone} className="select-none">
          None
        </button>
      </div>
      
      <div className="payer-chips">
        {people.map((person) => (
          <button
            key={person.id}
            type="button"
            className={`payer-chip ${selectedPayers.includes(person.id) ? 'selected' : ''}`}
            onClick={() => togglePayer(person.id)}
          >
            {person.name}
          </button>
        ))}
      </div>
    </div>
  );
}