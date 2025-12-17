# WEEK 2-3 DETAILED IMPLEMENTATION PLAN - Gap 5 (Section Differentiation)

**Timeline:** December 23, 2025 - January 3, 2026  
**Focus:** Implement specialized section editors with visual differentiation  
**Total Effort:** 9-13 hours

---

## 📋 Implementation Overview

### What is Gap 5?
Currently, all section types use the same generic text editor. Users see no visual distinction between an "Executive Summary", "Pricing Table", or "Case Study" - they all use identical UI.

### Solution
Create specialized editors for each section type:
- **NarrativeEditor**: For prose-heavy sections (Executive Summary, Q&A)
- **TableEditor**: For tabular data (Pricing, Compliance Matrix, Implementation Plan)
- **CardEditor**: For card-based layouts (Case Studies, Team Members)
- **TechnicalEditor**: For code/architecture (Project Architecture, Estimation)

### Expected Outcome
Users see distinctly different UI based on section type, with appropriate tools for each (word count for narrative, table controls for pricing, card layout for case studies).

---

## 🔧 Database Changes Required

### New Columns for `rfp_section_types`

Add these 4 columns to track metadata for each section type:

```sql
ALTER TABLE rfp_section_types ADD COLUMN icon VARCHAR(100);
ALTER TABLE rfp_section_types ADD COLUMN color VARCHAR(20);
ALTER TABLE rfp_section_types ADD COLUMN template_type VARCHAR(100);
ALTER TABLE rfp_section_types ADD COLUMN recommended_word_count INT;
```

### Migration Script

**File:** `backend/migrations/versions/[timestamp]_add_section_type_metadata.py`

```python
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('rfp_section_types',
        sa.Column('icon', sa.String(100), nullable=True))
    op.add_column('rfp_section_types',
        sa.Column('color', sa.String(20), nullable=True))
    op.add_column('rfp_section_types',
        sa.Column('template_type', sa.String(100), nullable=True))
    op.add_column('rfp_section_types',
        sa.Column('recommended_word_count', sa.Integer(), nullable=True))

def downgrade():
    op.drop_column('rfp_section_types', 'recommended_word_count')
    op.drop_column('rfp_section_types', 'template_type')
    op.drop_column('rfp_section_types', 'color')
    op.drop_column('rfp_section_types', 'icon')
```

### Seed Data

Update all 12 section types with metadata:

```python
# In backend/app/models/rfp_section_type.py or seed script

SECTION_METADATA = {
    "Executive Summary": {
        "icon": "📊",
        "color": "#3B82F6",
        "template_type": "narrative",
        "recommended_word_count": 300
    },
    "Company Profile": {
        "icon": "🏢",
        "color": "#10B981",
        "template_type": "narrative",
        "recommended_word_count": 400
    },
    "Technical Approach": {
        "icon": "🔧",
        "color": "#F59E0B",
        "template_type": "technical",
        "recommended_word_count": 500
    },
    "Pricing": {
        "icon": "💰",
        "color": "#EF4444",
        "template_type": "table",
        "recommended_word_count": 200
    },
    "Compliance Matrix": {
        "icon": "🔒",
        "color": "#8B5CF6",
        "template_type": "table",
        "recommended_word_count": 400
    },
    "Team & Resources": {
        "icon": "👥",
        "color": "#3B82F6",
        "template_type": "card",
        "recommended_word_count": 300
    },
    "Case Studies": {
        "icon": "📈",
        "color": "#8B5CF6",
        "template_type": "card",
        "recommended_word_count": 600
    },
    "Implementation Plan": {
        "icon": "📅",
        "color": "#F59E0B",
        "template_type": "table",
        "recommended_word_count": 400
    },
    "Q&A Responses": {
        "icon": "❓",
        "color": "#10B981",
        "template_type": "narrative",
        "recommended_word_count": 400
    },
    "Clarification Questions": {
        "icon": "⚠️",
        "color": "#FBBF24",
        "template_type": "narrative",
        "recommended_word_count": 300
    },
    "Project Architecture": {
        "icon": "🏗️",
        "color": "#FB923C",
        "template_type": "technical",
        "recommended_word_count": 500
    },
    "Project Estimation": {
        "icon": "📊",
        "color": "#3B82F6",
        "template_type": "table",
        "recommended_word_count": 250
    }
}
```

---

## 🎨 Component Specifications

### 1. NarrativeEditor.tsx

**Purpose:** Long-form text editing for prose sections  
**Section Types:** Executive Summary, Company Profile, Q&A, Clarifications

**Component Structure:**
```typescript
interface NarrativeEditorProps {
  section: Section;
  onSave: (content: string) => Promise<void>;
  readOnly?: boolean;
}

interface NarrativeEditorState {
  content: string;
  wordCount: number;
  saving: boolean;
  error: string | null;
}
```

**Features:**
- Rich text editor (support bold, italic, lists, links)
- Real-time word count with target indicator
- Auto-save after 2 seconds of inactivity
- Character limit: 5000
- Progress bar showing recommended word count
- Undo/redo buttons
- Format toolbar (B, I, U, Lists, Link)

**UI Layout:**
```
┌─ NarrativeEditor
├─ Header: Section name + icon + color
├─ Toolbar: [B] [I] [U] [List] [Link] [Undo] [Redo]
├─ Editor Area (textarea or ContentEditable)
├─ Footer:
│  ├─ Word count: XXX / 300 (target)
│  ├─ Progress bar
│  └─ Estimated reading time
├─ Auto-save indicator
└─ Save/Cancel buttons
```

**File:** `frontend/src/components/editors/NarrativeEditor.tsx`  
**Effort:** 2-3 hours  
**Dependencies:**
- Existing toast notifications
- tailwindcss for styling
- Custom hooks for auto-save

---

### 2. TableEditor.tsx

**Purpose:** Tabular data editing for pricing, compliance, timelines  
**Section Types:** Pricing, Compliance Matrix, Implementation Plan, Estimation

**Component Structure:**
```typescript
interface TableEditorProps {
  section: Section;
  onSave: (tableData: TableData) => Promise<void>;
  readOnly?: boolean;
}

interface TableData {
  headers: string[];
  rows: (string | number)[][];
  style: 'striped' | 'bordered' | 'compact';
}
```

**Features:**
- Add/remove rows and columns
- Edit cell content inline
- Column type selection (text, number, currency, date)
- Export to CSV
- Row calculations (sum, average for number columns)
- Style switcher (striped, bordered, compact)
- Drag to reorder rows
- Copy/paste from Excel

**UI Layout:**
```
┌─ TableEditor
├─ Header: Section name + icon + color
├─ Toolbar:
│  ├─ [+ Add Row] [+ Add Column]
│  ├─ [Export CSV] [Import CSV]
│  └─ [Style: Striped ▼]
├─ Table Container:
│  ├─ Column headers (editable)
│  ├─ Data rows (editable cells)
│  ├─ Row actions: [Delete] [Duplicate]
│  └─ Footer: Summary row (auto-calculated)
└─ Save/Cancel buttons
```

**File:** `frontend/src/components/editors/TableEditor.tsx`  
**Effort:** 3-4 hours  
**Dependencies:**
- Table library (could use custom or lightweight lib)
- CSV parsing library
- Calculate/sum utilities

---

### 3. CardEditor.tsx

**Purpose:** Card-based layouts for case studies, team members  
**Section Types:** Case Studies, Team & Resources

**Component Structure:**
```typescript
interface CardEditorProps {
  section: Section;
  onSave: (cards: CardData[]) => Promise<void>;
  readOnly?: boolean;
}

interface CardData {
  title: string;
  description: string;
  image?: string;
  metadata: Record<string, string>;
  customFields?: Record<string, any>;
}
```

**Features:**
- Add/remove cards
- Card template selection:
  - **Case Study**: Title, Challenge, Solution, Results (metrics)
  - **Team Member**: Name, Role, Bio, Skills, Photo
- Drag to reorder cards
- Rich text for descriptions
- Image upload for card thumbnails
- Metadata editor (key-value pairs)
- Card preview panel

**UI Layout:**
```
┌─ CardEditor
├─ Header: Section name + icon + color
├─ Toolbar:
│  ├─ [+ Add Card]
│  ├─ [Template: Case Study ▼]
│  └─ [Column Layout: 1 2 3 ▼]
├─ Card Canvas:
│  ├─ Card 1:
│  │  ├─ Title (editable)
│  │  ├─ Image (upload)
│  │  ├─ Description (rich text)
│  │  ├─ Fields: Challenge, Solution, Results...
│  │  └─ Actions: [Delete] [Duplicate] [Move ↑↓]
│  ├─ Card 2: ...
│  └─ Card 3: ...
├─ Preview Panel (right side)
└─ Save/Cancel buttons
```

**File:** `frontend/src/components/editors/CardEditor.tsx`  
**Effort:** 3-4 hours  
**Dependencies:**
- Image upload component
- Rich text editor
- Drag-and-drop library (react-dnd or similar)

---

### 4. TechnicalEditor.tsx

**Purpose:** Code and technical content editing  
**Section Types:** Project Architecture, Technical Approach

**Component Structure:**
```typescript
interface TechnicalEditorProps {
  section: Section;
  onSave: (content: TechnicalContent) => Promise<void>;
  readOnly?: boolean;
}

interface TechnicalContent {
  description: string;
  codeBlocks: CodeBlock[];
  diagrams: Diagram[];
  metadata: Record<string, string>;
}
```

**Features:**
- Markdown editor with preview
- Code block editor with syntax highlighting
- Language selector (JavaScript, Python, SQL, etc.)
- Diagram support (ASCII art or Mermaid)
- Copy code blocks button
- Dark mode for editor
- Table of contents for structure
- Link to external resources

**UI Layout:**
```
┌─ TechnicalEditor
├─ Header: Section name + icon + color
├─ Toolbar:
│  ├─ [+ Add Code Block] [+ Add Diagram]
│  ├─ [View: Edit | Preview | Split]
│  └─ [Dark Mode Toggle]
├─ Editor Area:
│  ├─ Description field (markdown)
│  ├─ Section: Code Blocks
│  │  ├─ Block 1:
│  │  │  ├─ Language: [JavaScript ▼]
│  │  │  ├─ Code editor (with syntax highlighting)
│  │  │  └─ Actions: [Copy] [Delete]
│  │  └─ Block 2: ...
│  ├─ Section: Diagrams
│  │  ├─ Diagram 1: (Mermaid preview)
│  │  └─ Diagram 2: ...
├─ Preview Panel (side-by-side)
└─ Save/Cancel buttons
```

**File:** `frontend/src/components/editors/TechnicalEditor.tsx`  
**Effort:** 2-3 hours  
**Dependencies:**
- Markdown editor library
- Syntax highlighting library (Prism or Highlight.js)
- Mermaid for diagrams
- Code copy utilities

---

### 5. SectionEditor.tsx Update

**Purpose:** Route to appropriate editor based on section type  
**Current State:** All sections use generic editor  
**Change:** Add conditional rendering to show correct editor

**Implementation:**
```typescript
// In SectionEditor.tsx

import NarrativeEditor from './NarrativeEditor';
import TableEditor from './TableEditor';
import CardEditor from './CardEditor';
import TechnicalEditor from './TechnicalEditor';

interface SectionEditorProps {
  section: Section;
  onSave: (content: any) => Promise<void>;
}

export const SectionEditor: React.FC<SectionEditorProps> = ({ 
  section, 
  onSave 
}) => {
  // Get template type from section metadata
  const templateType = section.type?.template_type || 'narrative';

  switch (templateType) {
    case 'narrative':
      return <NarrativeEditor section={section} onSave={onSave} />;
    
    case 'table':
      return <TableEditor section={section} onSave={onSave} />;
    
    case 'card':
      return <CardEditor section={section} onSave={onSave} />;
    
    case 'technical':
      return <TechnicalEditor section={section} onSave={onSave} />;
    
    default:
      return <NarrativeEditor section={section} onSave={onSave} />;
  }
};
```

**Changes:**
- Import all 4 new editor components
- Add conditional rendering based on `template_type`
- Update to fetch section metadata from API
- Pass through props correctly

**File:** `frontend/src/components/SectionEditor.tsx`  
**Effort:** 1-2 hours  
**Dependencies:** All 4 editor components

---

## 📅 Implementation Schedule

### Week of December 23-27 (Mon-Fri)

**Monday, Dec 23**
- [ ] 9:00-10:00: Database migration setup
  - Create migration file
  - Test with development database
  - Verify columns added successfully
- [ ] 10:00-11:00: Seed data upload
  - Update 12 section types with metadata
  - Verify data in database
  - Test API returns metadata
- [ ] 11:00-12:00: Setup environment for new components
  - Create components directory structure
  - Setup TypeScript interfaces
  - Review styling patterns
- [ ] 13:00-17:00: Start NarrativeEditor
  - Component skeleton
  - Rich text editor integration
  - Word count tracking
  - **Deliverable:** Core NarrativeEditor functional

**Tuesday, Dec 24**
- [ ] 9:00-12:00: Complete NarrativeEditor
  - Auto-save functionality
  - Error handling
  - Progress bar
  - Styling and responsiveness
- [ ] 13:00-15:00: Unit tests for NarrativeEditor
  - Test word count calculation
  - Test auto-save trigger
  - Test error states
- [ ] 15:00-17:00: Code review & refinement
  - Follow code patterns guide
  - TypeScript strict mode
  - Accessibility (a11y) review
- [ ] **Deliverable:** NarrativeEditor complete + tested

**Wednesday, Dec 25**
- Holiday - NO WORK

**Thursday, Dec 26**
- [ ] 9:00-10:00: Review TableEditor requirements
  - Plan data structure
  - Library selection (custom vs external)
  - Layout approach
- [ ] 10:00-13:00: TableEditor implementation (Part 1)
  - Component skeleton
  - Column management (add/remove)
  - Row editing
- [ ] 13:00-17:00: TableEditor implementation (Part 2)
  - CSV import/export
  - Cell calculations
  - Style switcher
  - **Deliverable:** TableEditor core functional

**Friday, Dec 27**
- [ ] 9:00-12:00: TableEditor completion & testing
  - Unit tests
  - Integration with SectionEditor
  - Styling refinement
- [ ] 13:00-15:00: Start CardEditor
  - Template definition
  - Add/remove cards
  - Basic form fields
- [ ] 15:00-17:00: Planning & review
  - Review progress
  - Adjust Week 2 plan if needed
  - Prepare CardEditor for next week
- [ ] **Deliverable:** TableEditor complete + tested

### Week of December 30 - January 3 (Mon-Fri)

**Monday, Dec 30**
- [ ] 9:00-12:00: CardEditor implementation (Part 1)
  - Component setup
  - Card form structure
  - Image upload
- [ ] 13:00-17:00: CardEditor implementation (Part 2)
  - Template switching
  - Drag-to-reorder
  - Metadata editor
  - **Deliverable:** CardEditor functional

**Tuesday, Dec 31**
- [ ] 9:00-12:00: CardEditor completion & testing
  - Unit tests
  - Edge cases
  - Styling refinement
- [ ] 13:00-15:00: TechnicalEditor implementation
  - Markdown editor
  - Code block management
  - Syntax highlighting
- [ ] 15:00-17:00: Diagram support & testing
  - Mermaid integration (if time permits)
  - Or defer to following week
- [ ] **Deliverable:** CardEditor complete + tested

**Wednesday, Jan 1**
- Holiday - NO WORK

**Thursday, Jan 2**
- [ ] 9:00-10:00: TechnicalEditor refinement
  - Complete any pending features
  - Unit tests
  - Styling review
- [ ] 10:00-13:00: SectionEditor routing implementation
  - Update conditional rendering
  - Test all 4 editors integrate
  - Test editor switching
- [ ] 13:00-15:00: Integration testing
  - Test end-to-end: create section → open editor → save
  - Test all 12 section types → correct editor loads
  - Test metadata display
- [ ] 15:00-17:00: Bug fixes & refinement
  - Fix any issues found in testing
  - Performance optimization
  - UX polish
  - **Deliverable:** All 4 editors integrated + routing working

**Friday, Jan 3**
- [ ] 9:00-11:00: End-to-end testing
  - Test complete workflow for each section type
  - Mobile responsiveness
  - Error handling
- [ ] 11:00-13:00: Documentation & code cleanup
  - Add component comments/JSDoc
  - Update README
  - Code formatting
- [ ] 13:00-15:00: Final review & staging
  - Code review with team (if applicable)
  - Prepare for production deployment
  - Create testing checklist
- [ ] 15:00-17:00: Performance & accessibility check
  - Lighthouse audit
  - a11y testing
  - Load time checks
- [ ] **Deliverable:** All components ready for production

---

## 🧪 Testing Checklist

### Unit Tests (Per Component)

**NarrativeEditor:**
- [ ] Word count updates on text change
- [ ] Word count doesn't exceed max (5000)
- [ ] Auto-save triggers after 2 seconds
- [ ] Undo/redo buttons work
- [ ] Format buttons apply styles
- [ ] Save button submits to API
- [ ] Error toast shows on API failure

**TableEditor:**
- [ ] Can add rows and columns
- [ ] Can delete rows and columns
- [ ] Cell content edits persist
- [ ] Column type selection changes behavior
- [ ] CSV export generates valid CSV
- [ ] CSV import populates table
- [ ] Calculations (sum, avg) work for number columns
- [ ] Row order can be changed

**CardEditor:**
- [ ] Can add cards
- [ ] Can remove cards
- [ ] Card fields save correctly
- [ ] Image upload works
- [ ] Drag to reorder cards
- [ ] Template switching works
- [ ] Metadata key-value pairs save
- [ ] Card preview updates in real-time

**TechnicalEditor:**
- [ ] Markdown preview renders
- [ ] Code blocks save with language
- [ ] Syntax highlighting displays
- [ ] Copy code button works
- [ ] Add/remove code blocks works
- [ ] Diagrams render (if implemented)

### Integration Tests

- [ ] SectionEditor routes to correct editor based on template_type
- [ ] All 12 section types load correct editor
- [ ] Editing in one editor doesn't affect others
- [ ] Save from editor updates section content
- [ ] Unsaved changes warning appears
- [ ] Cancel button discards changes
- [ ] Loading spinner shows during API call
- [ ] Error handling shows appropriate message

### Visual/UX Tests

- [ ] Section icon displays in header
- [ ] Section color accent visible
- [ ] Recommended word count shows in progress bar
- [ ] Responsive on mobile (< 768px)
- [ ] Responsive on tablet (768-1024px)
- [ ] Responsive on desktop (> 1024px)
- [ ] Dark mode works (if applicable)
- [ ] Accessibility: keyboard navigation works
- [ ] Accessibility: screen reader friendly
- [ ] Accessibility: sufficient color contrast

### End-to-End Tests

- [ ] User creates project
- [ ] User adds section of each type
- [ ] User edits each section with appropriate editor
- [ ] User saves changes
- [ ] User closes project and reopens
- [ ] Changes persisted correctly
- [ ] UI shows correct editor for each section type

---

## 🚨 Risk Mitigation

### Risk 1: Database Migration Timing
**Risk:** Holiday schedule could delay migration or cause issues  
**Mitigation:**
- Create migration file early (Dec 23)
- Test thoroughly in development
- Have rollback procedure ready
- Backup production before running

### Risk 2: Component Complexity
**Risk:** Editors could get too complex, causing delays  
**Mitigation:**
- Start with minimal feature set
- Build iteratively
- Test early and often
- Can add features in future iterations

### Risk 3: Styling Consistency
**Risk:** Each editor uses different styling patterns, inconsistent UI  
**Mitigation:**
- Follow CODE_PATTERNS_GUIDE.md
- Use existing component library
- Consistent color scheme
- Review all styling in final QA

### Risk 4: API Data Inconsistency
**Risk:** Section content structure differs between editor types  
**Mitigation:**
- Define clear data schemas for each type
- Validate data before save
- Handle gracefully if data format unexpected
- Migration script to convert old data

### Risk 5: Performance
**Risk:** Large table or many cards could slow down  
**Mitigation:**
- Implement virtualization for large datasets
- Lazy load images for cards
- Debounce auto-save
- Monitor performance with Lighthouse

---

## 📊 Success Metrics

### Completion Criteria

By end of Week 2-3:
- ✅ Database updated with 4 new columns
- ✅ All 12 section types have metadata populated
- ✅ 4 specialized editors created and tested
- ✅ SectionEditor routes to correct editor
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ Visual/UX tests all pass
- ✅ No critical bugs identified
- ✅ Code reviewed and approved
- ✅ Ready for production deployment

### Quality Metrics

- Unit test coverage: >80% for each component
- No console errors in development
- No console warnings (except expected ones)
- Lighthouse performance: >85
- Lighthouse accessibility: >90
- All buttons/links keyboard accessible
- Mobile responsive (viewport 320px - 2560px)

---

## 📦 Deliverables

**Code Files:**
1. `frontend/src/components/editors/NarrativeEditor.tsx`
2. `frontend/src/components/editors/TableEditor.tsx`
3. `frontend/src/components/editors/CardEditor.tsx`
4. `frontend/src/components/editors/TechnicalEditor.tsx`
5. Updated `frontend/src/components/SectionEditor.tsx`
6. `backend/migrations/versions/[date]_add_section_type_metadata.py`
7. Updated `backend/app/models/rfp_section_type.py` (seed data)

**Documentation:**
1. `GAP_5_IMPLEMENTATION_NOTES.md` - Implementation learnings
2. `EDITOR_API_SPEC.md` - Data format for each editor type
3. `TESTING_REPORT.md` - Test results and coverage

**Testing:**
1. Unit test files for each component
2. Integration test file for SectionEditor routing
3. Manual testing checklist (printable)

---

## 🎯 Next Steps After Week 2-3

**Immediate (Week of Jan 6):**
1. Deploy Gap 5 to production
2. Monitor for issues
3. Gather user feedback
4. Make quick fixes if needed

**Week 2-3 (Jan 13-24):**
Choose next gap to implement:
- **Gap 3:** Profile recommendations (3 hours)
- **Gap 4:** Knowledge filtering service (5 hours)
- **Gap 6:** Organization data setup (3-4 hours, more complex)

**Decision:** Based on user feedback from Gap 5, choose which delivers most value

---

**Status:** Ready to begin  
**Start Date:** December 23, 2025  
**Expected Completion:** January 3, 2026

Next: Begin Week 2 with database migration on December 23
