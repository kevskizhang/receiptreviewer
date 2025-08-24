import { useReducer } from 'react';
import type { ReceiptDraft, Person, Item, CalculationResult } from './types';
import { compute } from './calculator';
import { validateDraft } from './parsing';
import PeopleBankPanel from './components/PeopleBankPanel';
import ReceiptDraftEditor from './components/ReceiptDraftEditor';
import ResultsPanel from './components/ResultsPanel';
import ImportExportPanel from './components/ImportExportPanel';
import './App.css';

type AppState = {
  draft: ReceiptDraft;
  result: CalculationResult | null;
  warnings: string[];
};

type AppAction = 
  | { type: 'ADD_PERSON'; person: Person }
  | { type: 'REMOVE_PERSON'; personId: string }
  | { type: 'UPDATE_PERSON'; person: Person }
  | { type: 'ADD_ITEM'; item: Item }
  | { type: 'UPDATE_ITEM'; item: Item }
  | { type: 'REMOVE_ITEM'; itemId: string }
  | { type: 'UPDATE_TAX'; tax: number }
  | { type: 'UPDATE_RECEIPT_META'; meta: Partial<ReceiptDraft> }
  | { type: 'LOAD_DRAFT'; draft: ReceiptDraft };

const initialState: AppState = {
  draft: {
    currency: 'USD',
    taxTotal: 0,
    items: [],
    people: []
  },
  result: null,
  warnings: []
};

function appReducer(state: AppState, action: AppAction): AppState {
  let newDraft: ReceiptDraft;

  switch (action.type) {
    case 'ADD_PERSON':
      newDraft = {
        ...state.draft,
        people: [...state.draft.people, action.person]
      };
      break;
    
    case 'REMOVE_PERSON':
      newDraft = {
        ...state.draft,
        people: state.draft.people.filter(p => p.id !== action.personId),
        items: state.draft.items.map(item => ({
          ...item,
          payers: item.payers.filter(payerId => payerId !== action.personId)
        }))
      };
      break;
    
    case 'UPDATE_PERSON':
      newDraft = {
        ...state.draft,
        people: state.draft.people.map(p => 
          p.id === action.person.id ? action.person : p
        )
      };
      break;
    
    case 'ADD_ITEM':
      newDraft = {
        ...state.draft,
        items: [...state.draft.items, action.item]
      };
      break;
    
    case 'UPDATE_ITEM':
      newDraft = {
        ...state.draft,
        items: state.draft.items.map(item => 
          item.id === action.item.id ? action.item : item
        )
      };
      break;
    
    case 'REMOVE_ITEM':
      newDraft = {
        ...state.draft,
        items: state.draft.items.filter(item => item.id !== action.itemId)
      };
      break;
    
    case 'UPDATE_TAX':
      newDraft = {
        ...state.draft,
        taxTotal: action.tax
      };
      break;
    
    case 'UPDATE_RECEIPT_META':
      newDraft = {
        ...state.draft,
        ...action.meta
      };
      break;
    
    case 'LOAD_DRAFT':
      newDraft = action.draft;
      break;
    
    default:
      return state;
  }

  const warnings = validateDraft(newDraft);
  // Always compute results, even with warnings (items without payers are just excluded from calculations)
  const result = compute(newDraft);

  return {
    draft: newDraft,
    result,
    warnings
  };
}

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <div className="app">
      <header>
        <h1>Receipt Reviewer</h1>
        <p>Split receipts and calculate what everyone owes</p>
      </header>
      
      <main className="app-main">
        <div className="app-section">
          <PeopleBankPanel 
            people={state.draft.people}
            onAddPerson={(person) => dispatch({ type: 'ADD_PERSON', person })}
            onUpdatePerson={(person) => dispatch({ type: 'UPDATE_PERSON', person })}
            onRemovePerson={(personId) => dispatch({ type: 'REMOVE_PERSON', personId })}
          />
          
          <div className="import-export-section">
            <ImportExportPanel
              onLoadDraft={(draft) => dispatch({ type: 'LOAD_DRAFT', draft })}
              draft={state.draft}
            />
          </div>
        </div>
        
        <div className="app-section">
          <ReceiptDraftEditor 
            draft={state.draft}
            onAddItem={(item) => dispatch({ type: 'ADD_ITEM', item })}
            onUpdateItem={(item) => dispatch({ type: 'UPDATE_ITEM', item })}
            onRemoveItem={(itemId) => dispatch({ type: 'REMOVE_ITEM', itemId })}
            onUpdateTax={(tax) => dispatch({ type: 'UPDATE_TAX', tax })}
            onUpdateMeta={(meta) => dispatch({ type: 'UPDATE_RECEIPT_META', meta })}
          />
        </div>
        
        <div className="app-section">
          <ResultsPanel 
            result={state.result}
            warnings={state.warnings}
            people={state.draft.people}
            draft={state.draft}
          />
        </div>
      </main>
    </div>
  );
}

export default App
