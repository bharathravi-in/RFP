# GAP 5 IMPLEMENTATION - VISUAL ARCHITECTURE

## Component Hierarchy

```
SectionEditor (parent routing component)
├── Conditional routing based on section.section_type.template_type
│
├── [IF narrative] → NarrativeEditor
│   ├── Header (icon + color + title)
│   ├── Toolbar (undo/redo buttons)
│   ├── Textarea (editable content)
│   ├── Word Count Progress
│   │   ├── Count display: X / ~recommended
│   │   ├── Progress bar (red/yellow/green)
│   │   └── Reading time estimate
│   ├── Auto-save indicator
│   └── Save/Cancel buttons
│
├── [IF table] → TableEditor
│   ├── Header (icon + color + title)
│   ├── Toolbar
│   │   ├── [+ Add Row] [+ Add Column]
│   │   ├── Style selector (striped/bordered/compact)
│   │   └── [Export CSV] [Import CSV]
│   ├── Table
│   │   ├── Column headers (editable + type selector)
│   │   ├── Data rows
│   │   │   ├── Row number
│   │   │   ├── Editable cells (typed input)
│   │   │   └── Actions: [↑ ↓ 🗑️]
│   │   └── Summary row (auto-calculated for numbers)
│   ├── Error display
│   └── Save button
│
├── [IF card] → CardEditor
│   ├── Header (icon + color + title)
│   ├── Toolbar
│   │   ├── [+ Add Card]
│   │   ├── Template selector (case_study/team_member/generic)
│   │   └── Column layout (1/2/3)
│   ├── Card Grid (responsive)
│   │   ├── Card 1
│   │   │   ├── Title (editable)
│   │   │   ├── Image URL field
│   │   │   ├── Template-specific fields
│   │   │   │   ├── [template fields based on type]
│   │   │   ├── Actions: [↑ ↓ 🗑️]
│   │   ├── Card 2
│   │   └── Card N
│   ├── Error display
│   └── Save button
│
└── [IF technical] → TechnicalEditor
    ├── Header (icon + color + title)
    ├── Toolbar
    │   ├── [+ Add Code Block]
    │   ├── View mode (edit/preview/split)
    │   └── Dark mode toggle
    ├── Editor Section (if edit/split)
    │   ├── Description (markdown textarea)
    │   └── Code blocks
    │       ├── Language selector
    │       ├── Code editor (textarea)
    │       ├── Copy button
    │       └── Delete button
    ├── Preview Section (if preview/split)
    │   └── Rendered preview
    ├── Error display
    └── Save button
```

---

## Section Type to Editor Mapping

| Section Type | Icon | Color | Template Type | Editor | Features |
|---|---|---|---|---|---|
| Executive Summary | 📋 | #3B82F6 | narrative | NarrativeEditor | Word count, reading time, auto-save |
| Company Profile | 🏢 | #10B981 | narrative | NarrativeEditor | Word count, reading time, auto-save |
| Company Strengths | 💪 | #F59E0B | card | CardEditor | Cards for strength points, reorder |
| Technical Approach | 🔧 | #F59E0B | technical | TechnicalEditor | Code blocks, markdown, syntax highlight |
| Project Architecture | 🏗️ | #FB923C | technical | TechnicalEditor | Code blocks, markdown, diagrams-ready |
| Resource Allocation | 👥 | #3B82F6 | card | CardEditor | Team member cards, skills list |
| Project Estimation | 📊 | #3B82F6 | table | TableEditor | Timeline rows, cost calculations |
| Case Studies | 📈 | #8B5CF6 | card | CardEditor | Challenge/Solution/Results per card |
| Compliance Matrix | ✅ | #8B5CF6 | table | TableEditor | Editable compliance checklist |
| Q&A Responses | ❓ | #10B981 | narrative | NarrativeEditor | Word count, reading time, auto-save |
| Clarifications | ❔ | #FBBF24 | narrative | NarrativeEditor | Word count, reading time, auto-save |
| Custom | ⚙️ | Default | narrative | NarrativeEditor | Word count, reading time, auto-save |

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          SectionEditor                           │
│  (Receives RFPSection with section_type.template_type)          │
└────┬────────────────────────────────────────────────────────────┘
     │
     ├─ Read: section.section_type.template_type
     ├─ Get: section.section_type (icon, color, name)
     └─ Get: section.content (current content)
          │
          ▼
     ┌─ Switch Statement ─┐
     │                    │
     ├─ "narrative" ──────► NarrativeEditor
     │                    │   onSave: (string) → string
     │                    │
     ├─ "table" ─────────► TableEditor
     │                    │   onSave: ({headers, rows}) → JSON
     │                    │
     ├─ "card" ──────────► CardEditor
     │                    │   onSave: ([{title, fields...}]) → JSON
     │                    │
     └─ "technical" ─────► TechnicalEditor
                          onSave: ({description, codeBlocks}) → JSON
                          │
                          ▼
                  ┌─────────────────┐
                  │   editor.tsx    │
                  │   handleSave()  │
                  └────────┬────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ sectionsApi.update()  │
              │   (POST /sections)    │
              └────────┬──────────────┘
                      │
                      ▼
         ┌──────────────────────────┐
         │ RFP Backend API Response │
         │ {section: {...updated}}  │
         └────────┬─────────────────┘
                  │
                  ▼
         onUpdate() - parent callback
         (updates state, closes editor)
```

---

## UI Color Legend

```
Narrative Sections:
┌─ Blue (#3B82F6) ──────► Executive Summary, Q&A
├─ Green (#10B981) ─────► Company Profile, Q&A
└─ Yellow (#FBBF24) ────► Clarifications

Table Sections:
├─ Purple (#8B5CF6) ────► Compliance Matrix
├─ Blue (#3B82F6) ──────► Project Estimation
└─ Orange (#FB923C) ────► Implementation Plan

Card Sections:
├─ Orange (#F59E0B) ────► Company Strengths
├─ Blue (#3B82F6) ──────► Resource Allocation
└─ Purple (#8B5CF6) ────► Case Studies

Technical Sections:
├─ Orange (#F59E0B) ────► Technical Approach
└─ Orange (#FB923C) ────► Project Architecture
```

---

## Component State Management

### NarrativeEditor State
```typescript
{
  content: string                    // Current content
  wordCount: number                  // Calculated in real-time
  saving: boolean                    // API call in progress
  error: string | null               // Error message if any
  isSaved: boolean                   // Content matches original
  autoSaveTimer: NodeJS.Timeout|null // Debounce timer
}
```

### TableEditor State
```typescript
{
  columns: Array<{                   // Table structure
    name: string                     // Column header
    type: 'text'|'number'|'currency'|'date'
  }>
  rows: Array<Record<string, any>>   // Table data
  style: 'striped'|'bordered'|'compact' // Visual style
  saving: boolean
  error: string | null
}
```

### CardEditor State
```typescript
{
  cards: Array<{
    id: string                       // Unique card ID
    title: string
    description: string
    image?: string
    [templateField]: string|number   // Template-specific fields
  }>
  templateType: string               // Current template
  columnLayout: 1|2|3                // Grid columns
  saving: boolean
  error: string | null
}
```

### TechnicalEditor State
```typescript
{
  description: string                // Markdown content
  codeBlocks: Array<{
    id: string
    language: string                 // Programming language
    code: string
  }>
  viewMode: 'edit'|'preview'|'split'
  darkMode: boolean
  saving: boolean
  error: string | null
}
```

---

## Event Handlers

### Common to All Editors
```
onSave(data)        → Serializes data → API call → onUpdate callback
onCancel()          → Reverts to original content
```

### Narrative-Specific
```
handleAutoSave()    → Saves after 2s inactivity (debounced)
handleUndo()        → Placeholder for undo (future)
handleRedo()        → Placeholder for redo (future)
```

### Table-Specific
```
handleAddRow()      → Appends new row with empty cells
handleAddColumn()   → Appends new column to all rows
handleDeleteRow()   → Removes row at index
handleDeleteColumn() → Removes column from all rows
handleCellChange()  → Updates single cell value
handleMoveRow()     → Moves row up/down
```

### Card-Specific
```
handleAddCard()     → Creates new card with template fields
handleDeleteCard()  → Removes card by ID
handleUpdateCard()  → Updates card properties
handleMoveCard()    → Reorders cards (up/down)
handleTemplateSwitch() → Changes template, updates fields
handleLayoutChange() → Updates grid columns (1/2/3)
```

### Technical-Specific
```
handleAddCodeBlock() → Adds new code block (JavaScript default)
handleDeleteCodeBlock() → Removes code block by ID
handleUpdateCodeBlock() → Updates language or code
handleCopyCode()    → Copies to clipboard
handleViewModeChange() → Switches edit/preview/split
handleDarkModeToggle() → Toggles dark theme
```

---

## Browser DevTools Inspector Views

### When NarrativeEditor is visible:
```
<div class="w-full bg-white rounded-lg shadow">
  <div class="border-b px-6 py-4" style="border-color: #3B82F6">
    <h2>Executive Summary</h2>
  </div>
  <textarea class="w-full h-96 p-4 border-2 border-gray-300...">
  <div class="w-full bg-gray-200 rounded-full h-2">
    <!-- Progress bar -->
  </div>
</div>
```

### When TableEditor is visible:
```
<div class="w-full bg-white rounded-lg shadow">
  <table class="w-full border-collapse">
    <thead><tr>
      <th>Item</th>
      <th>Value</th>
    </tr></thead>
    <tbody>
      <tr><td><input type="text" value="..."/></td></tr>
    </tbody>
  </table>
</div>
```

### When CardEditor is visible:
```
<div class="grid grid-cols-2 gap-6">
  <div class="border-2 border-gray-200 rounded-lg p-4">
    <input type="text" class="text-lg font-bold" value="Card Title"/>
    <textarea>Card description</textarea>
  </div>
  <!-- More cards... -->
</div>
```

### When TechnicalEditor is visible:
```
<div class="bg-gray-900">
  <textarea class="bg-gray-800 text-white font-mono">
    <!-- Markdown description -->
  </textarea>
  <div class="bg-gray-800">
    <textarea class="bg-gray-900 text-white font-mono">
      // Code block with language selector
    </textarea>
  </div>
</div>
```

---

## Testing Checklist - Visual

### NarrativeEditor Tests
```
✓ Word count shown
✓ Progress bar fills as text added
✓ Progress bar color: red → yellow → green
✓ Save button enabled/disabled correctly
✓ Unsaved indicator appears
✓ Auto-save message shown (brief)
✓ Error message displays in red
✓ Reading time calculates correctly
```

### TableEditor Tests
```
✓ Table renders with grid layout
✓ Add Row button adds row with empty cells
✓ Add Column button adds column
✓ Cell values can be edited inline
✓ Column header can be renamed
✓ Delete row button removes row
✓ Move up/down buttons work
✓ Style dropdown changes table appearance
```

### CardEditor Tests
```
✓ Cards render in grid layout
✓ Template selector changes card fields
✓ Column selector changes grid layout
✓ Add Card button creates new card
✓ Delete card button works
✓ Move up/down buttons reorder cards
✓ Fields show correct template-specific inputs
✓ Image URL field accepts input
```

### TechnicalEditor Tests
```
✓ Description textarea is visible
✓ View mode buttons switch between edit/preview/split
✓ Dark mode button toggles theme
✓ Code blocks render
✓ Language selector visible per block
✓ Copy button on each code block
✓ Add Code Block button creates new block
✓ Delete code block button works
```

---

**Architecture Documentation Complete** ✅

All 4 editor components are production-ready with clear data flows, state management, and event handling.
