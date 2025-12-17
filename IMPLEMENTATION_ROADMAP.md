# RFP Project Implementation Roadmap

## Summary of All Gaps & Solutions

| # | Gap | Severity | Status | Solution | Time |
|---|-----|----------|--------|----------|------|
| 1 | Knowledge Base Setup Confusing | 🔴 HIGH | ✅ SOLVED | Dual-model architecture doc | - |
| 2 | No Project Edit Feature | 🔴 HIGH | ✅ IMPLEMENTED | EditProjectModal component | 2h |
| 3 | Profile Filtering Unclear | 🔴 HIGH | 📋 READY | Auto-matching logic + better UX | 3h |
| 4 | Missing Service Connections | 🟡 MEDIUM | 📋 READY | Knowledge filtering + org settings | 5h |
| 5 | Builder UI Same for All | 🟡 MEDIUM | 📋 READY | Section type icons, colors, editors | 6h |
| 6 | Organization Data Missing | 🟡 MEDIUM | 📋 READY | Settings page + org model update | 3h |

---

## Phase 1: Critical Fixes (Week 1-2)

### ✅ Gap 2: Project Edit Functionality - COMPLETED

**Status**: Implementation Done ✅

**What Was Done**:
- Created `EditProjectModal.tsx` component
- Updated `Projects.tsx` to show edit button
- Full editing of all project dimensions

**Testing Checklist**:
- [ ] Go to Projects page
- [ ] Hover over any project card
- [ ] Click three-dot menu (⋯)
- [ ] Change project name
- [ ] Change status, geography, industry
- [ ] Add/remove compliance requirements
- [ ] Click "Save Changes"
- [ ] Verify project updated in list

**Next**: Test immediately to ensure backend API works

---

### 📋 Gap 1: Knowledge Base Architecture - DOCUMENTED

**Status**: Architecture & Guides Complete ✅

**What to Do**:
1. Read `KNOWLEDGE_BASE_ARCHITECTURE.md` (visual guide)
2. Understand dual-model approach:
   - **Profiles**: For filtering (dimensions: geo, industry, compliance)
   - **Folders**: For browsing (hierarchical organization)
3. Communicate to users through help text

**No Code Changes Needed** - This is a conceptual clarification that enables other solutions

---

## Phase 2: High-Impact Improvements (Week 3-4)

### 🚀 Gap 5: Section Type Differentiation - RECOMMENDED NEXT

**Effort**: 6 hours  
**Impact**: High - Visual improvements + UX clarity  
**Files to Create**:

1. **Database Migration** (optional but clean):
```python
# backend/migrations/versions/xxx_add_section_metadata.py

# Add columns to rfp_section_types:
# - icon: "📊", "💰", "🏢", etc.
# - color: "#3B82F6" (hex color for UI)
# - template_type: "narrative", "table", "card", "technical"
# - recommended_word_count: 300
# - has_custom_editor: True/False
```

2. **Section Editors** (React components):
   - `frontend/src/components/sections/editors/NarrativeEditor.tsx` - Text with word count
   - `frontend/src/components/sections/editors/TableEditor.tsx` - Table for pricing/features
   - `frontend/src/components/sections/editors/CardEditor.tsx` - Cards for case studies
   - `frontend/src/components/sections/editors/TechnicalEditor.tsx` - Code + diagrams

3. **Update SectionEditor.tsx**:
   - Get section metadata (icon, color, template_type)
   - Route to appropriate editor component
   - Show visual differentiation

**Quick Implementation**:
```tsx
// Step 1: Update SectionEditor.tsx
const templateTypeToComponent = {
    'narrative': NarrativeEditor,
    'table': TableEditor,
    'card': CardEditor,
    'technical': TechnicalEditor,
};

const EditorComponent = templateTypeToComponent[section.section_type?.template_type] 
    || NarrativeEditor;

// Step 2: Render with metadata
return (
    <div className="space-y-4">
        {/* Visual header showing icon & color */}
        <div 
            className="p-3 rounded-lg flex items-center gap-3"
            style={{ backgroundColor: section.section_type?.color + '20' }}
        >
            <span className="text-3xl">{section.section_type?.icon}</span>
            <div>
                <h3 className="font-semibold">{section.section_type?.name}</h3>
                {section.section_type?.recommended_word_count && (
                    <p className="text-sm text-gray-600">
                        Target: {section.section_type.recommended_word_count} words
                    </p>
                )}
            </div>
        </div>
        
        {/* Use appropriate editor */}
        <EditorComponent section={section} onUpdate={onUpdate} />
    </div>
);
```

**Testing Checklist**:
- [ ] Go to ProposalBuilder
- [ ] See different colors/icons for different sections
- [ ] Executive Summary: Blue icon, narrative editor, word count 300
- [ ] Pricing: Red icon, table editor
- [ ] Case Studies: Purple icon, card editor
- [ ] Each has appropriate UI for its type

---

### 📋 Gap 6: Organization Data Setup - FOUNDATION

**Effort**: 3 hours  
**Impact**: High - Enables org context for all features  
**Files to Create**:

1. **New API Endpoint** (`backend/app/routes/organizations.py`):
```python
@bp.route('/organization', methods=['GET', 'PUT'])
@jwt_required()
def organization_settings():
    """Get/update organization settings."""
    user = User.query.get(get_jwt_identity())
    org = Organization.query.get(user.organization_id)
    
    if request.method == 'GET':
        return jsonify(org.to_dict())
    
    # PUT
    data = request.get_json()
    org.settings = {
        **org.settings,
        'logo': data.get('logo'),
        'description': data.get('description'),
        'default_language': data.get('default_language', 'en'),
        'default_compliance': data.get('default_compliance', []),
        'ai_preferences': data.get('ai_preferences', {}),
    }
    db.session.commit()
    return jsonify(org.to_dict())
```

2. **Update Settings Page** (`frontend/src/pages/Settings.tsx`):
   - Add "Organization" tab
   - Show: Logo, Description, Default Language, Compliance, Team

3. **Add to Navigation**:
   - Settings → Organization tab (alongside Account tab if exists)

**Testing Checklist**:
- [ ] Go to Settings
- [ ] See Organization tab
- [ ] Upload company logo
- [ ] Set default language
- [ ] Select default compliance frameworks
- [ ] Save settings
- [ ] Settings persist after page reload

---

## Phase 3: Advanced Features (Week 5-6)

### 📋 Gap 3: Smart Profile Recommendation

**Effort**: 3 hours  
**Impact**: High - Improves knowledge base utilization  
**Files to Update**:

1. **Backend Endpoint** (new):
```python
@bp.route('/<int:project_id>/recommended-profiles', methods=['GET'])
def get_recommended_profiles(project_id):
    """Get knowledge profiles matching project dimensions."""
    project = Project.query.get(project_id)
    
    matching = []
    for profile in KnowledgeProfile.query.filter_by(
        organization_id=project.organization_id,
        is_active=True
    ).all():
        if profile.matches_dimensions(
            geography=project.geography,
            industry=project.industry,
            client_type=project.client_type,
            compliance=project.compliance_requirements
        ):
            matching.append(profile)
    
    return jsonify({
        'matching_profiles': [p.to_dict() for p in matching],
        'total': len(matching)
    })
```

2. **Frontend Integration** (in EditProjectModal):
```tsx
// Show matched profiles
const [matchedProfiles, setMatchedProfiles] = useState([]);

useEffect(() => {
    // After user selects geography/industry/compliance
    if (project.id && (geography || industry || clientType)) {
        loadRecommendedProfiles();
    }
}, [geography, industry, clientType]);

const loadRecommendedProfiles = async () => {
    const response = await projectsApi.getRecommendedProfiles(project.id);
    setMatchedProfiles(response.data.matching_profiles);
};

return (
    <>
        {/* ... form fields ... */}
        
        {/* Show matched profiles */}
        {matchedProfiles.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-3">
                    📌 {matchedProfiles.length} profiles match your selections
                </p>
                {matchedProfiles.map(profile => (
                    <label key={profile.id} className="flex items-center gap-2">
                        <input 
                            type="checkbox"
                            checked={selectedProfileIds.includes(profile.id)}
                            onChange={() => toggleProfile(profile.id)}
                        />
                        <span className="text-sm">{profile.name}</span>
                    </label>
                ))}
            </div>
        )}
    </>
);
```

**Testing Checklist**:
- [ ] Create/Edit project with Geography + Industry
- [ ] See "X profiles match your selections" message
- [ ] Auto-suggested profiles are correct
- [ ] Can toggle suggested profiles
- [ ] Profiles persist after save

---

### 📋 Gap 4: Knowledge Filtering & Integration

**Effort**: 5 hours  
**Impact**: High - Makes knowledge base actually useful  
**Files to Create**:

1. **Backend Service** (`backend/app/services/knowledge_filtering_service.py`):
```python
class KnowledgeFilteringService:
    """Filter knowledge items by project context."""
    
    @staticmethod
    def filter_for_project(project_id, section_type_slug=None):
        """
        Get relevant knowledge items for a project.
        
        Filters by:
        1. Project dimensions (geography, industry, compliance)
        2. Assigned knowledge profiles
        3. Section type's knowledge scope
        """
        project = Project.query.get(project_id)
        
        # Start with items from assigned profiles
        items = KnowledgeItem.query.filter(
            KnowledgeItem.knowledge_profile_id.in_(
                [p.id for p in project.knowledge_profiles]
            )
        ).all()
        
        # Filter by project dimensions
        filtered = [
            item for item in items
            if KnowledgeFilteringService._matches_dimensions(item, project)
        ]
        
        return filtered
    
    @staticmethod
    def _matches_dimensions(item, project):
        """Check if item matches project dimensions."""
        if item.geography and item.geography != project.geography:
            return False
        if item.industry and item.industry != project.industry:
            return False
        if item.client_type and item.client_type != project.client_type:
            return False
        return True
```

2. **Update Proposal Generation**:
   - Use `KnowledgeFilteringService` when generating section content
   - Pass filtered knowledge to AI model

3. **Frontend**:
   - Show which knowledge sources were used in proposal
   - "Generated using: X case studies, Y compliance docs"

---

## Implementation Checklist

### Week 1
- [ ] Test Project Edit functionality
- [ ] Read KNOWLEDGE_BASE_ARCHITECTURE.md
- [ ] Share knowledge base guide with team

### Week 2
- [ ] Start Section Type Differentiation (Gap 5)
  - [ ] Add metadata to section types
  - [ ] Create table and card editors
  - [ ] Update SectionEditor routing
  - [ ] Test visual differentiation

### Week 3
- [ ] Organization Settings (Gap 6)
  - [ ] Create Settings page Organization tab
  - [ ] Add org settings API
  - [ ] Test logo upload & defaults

- [ ] Smart Profile Recommendation (Gap 3)
  - [ ] Add matching endpoint
  - [ ] Update EditProjectModal UI
  - [ ] Test auto-matching

### Week 4
- [ ] Knowledge Filtering (Gap 4)
  - [ ] Create filtering service
  - [ ] Integrate with proposal generation
  - [ ] Test knowledge relevance

---

## Files Created/Updated Summary

### Created Files ✅
- `frontend/src/components/modals/EditProjectModal.tsx` - Project editor
- `ANALYSIS_AND_GAPS.md` - Gap analysis
- `SOLUTION_GUIDE.md` - Solutions guide
- `KNOWLEDGE_BASE_ARCHITECTURE.md` - Architecture diagrams
- `IMPLEMENTATION_ROADMAP.md` (this file)

### Updated Files ✅
- `frontend/src/pages/Projects.tsx` - Added edit functionality

### Files to Create (Pending)
- Section type editors (narrative, table, card, technical)
- Organization settings page
- Knowledge filtering service
- API endpoints for recommendations & org settings

---

## Quick Reference: What Users Will See

### After Gap 2 (Project Edit) ✅
```
Projects page → Hover over project → Click ⋯ → Edit Project Dialog
Users can now modify any project dimension or settings
```

### After Gap 5 (Section Differentiation)
```
Proposal Builder:
- Executive Summary: 📊 Blue section with 300-word target
- Pricing: 💰 Red section with table editor
- Case Studies: 📈 Purple section with card layout
- Compliance: 🔒 Green section with matrix editor
```

### After Gap 6 (Organization Setup)
```
Settings → Organization tab:
- Upload company logo
- Set company description
- Select default compliance frameworks
- Configure AI preferences
```

### After Gap 3 (Smart Recommendations)
```
Edit Project → Select Geography + Industry
"✓ 3 profiles match your selections"
- "US Healthcare HIPAA" (auto-suggested)
- "US Healthcare Compliance" (auto-suggested)
```

---

## Success Metrics

### Gap 2 (Project Edit)
- ✅ Users can edit project details
- ✅ All changes persist
- ✅ No errors on update

### Gap 5 (Section Differentiation)
- ✅ Visual distinction between section types
- ✅ Appropriate editors for each type
- ✅ Word count targets visible

### Gap 6 (Organization Setup)
- ✅ Users can set organization defaults
- ✅ Logo displays throughout app
- ✅ Defaults applied to new projects

### Gap 3 (Profile Recommendations)
- ✅ Profiles auto-suggested based on dimensions
- ✅ Users understand the connection
- ✅ Profile adoption increases

### Gap 4 (Knowledge Filtering)
- ✅ Proposals use relevant knowledge
- ✅ Content matches project context
- ✅ Quality score increases

---

## Contact & Support

For questions about:
- **Architecture**: See KNOWLEDGE_BASE_ARCHITECTURE.md
- **Specific solutions**: See SOLUTION_GUIDE.md
- **All gaps overview**: See ANALYSIS_AND_GAPS.md

Ready to implement the next solution? Choose:
1. **Section Type Differentiation** (visual impact)
2. **Organization Setup** (foundational)
3. **Smart Profile Recommendation** (user experience)
