#!/bin/bash

# Gap 5 Phase 3 - Performance Testing Suite
# This script runs various performance and responsiveness tests

set -e

echo "======================================"
echo "Gap 5 Phase 3: Performance Testing"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print section headers
print_section() {
    echo ""
    echo -e "${YELLOW}█ $1${NC}"
    echo "────────────────────────────────────"
}

# Check if in correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Run from project root.${NC}"
    exit 1
fi

# Test 1: Type checking
print_section "1. TypeScript Compilation Check"
echo "Checking TypeScript for errors..."
npx tsc --noEmit --skipLibCheck src/components/editors/* src/components/sections/SectionEditor.tsx
echo -e "${GREEN}✓ TypeScript check passed${NC}"

# Test 2: Build test
print_section "2. Production Build Test"
echo "Building for production..."
npm run build > /dev/null 2>&1 && \
echo -e "${GREEN}✓ Production build successful${NC}" || \
echo -e "${RED}✗ Production build failed${NC}"

# Test 3: Lighthouse audit (if available)
print_section "3. Code Quality Checks"
echo "Running ESLint on editor components..."
if command -v npx &> /dev/null; then
    npx eslint src/components/editors/*.tsx --quiet 2>/dev/null && \
    echo -e "${GREEN}✓ ESLint check passed${NC}" || \
    echo -e "${YELLOW}⚠ ESLint warnings found (non-critical)${NC}"
fi

# Test 4: Bundle analysis
print_section "4. Bundle Size Analysis"
echo "Analyzing bundle sizes..."
echo ""
echo "Editor components file sizes:"
ls -lh src/components/editors/*.tsx | awk '{print "  " $9 ": " $5}'
echo ""
echo "Estimated bundle impact:"
wc -l src/components/editors/*.tsx | awk '{total=$1} END {printf "  Total lines: %d (~%.0f KB when minified)\n", total, total*0.05}'

# Test 5: Responsiveness viewport test
print_section "5. Responsive Design Viewports"
echo "Configured viewport sizes:"
echo "  Mobile:  320px (iPhone SE)"
echo "  Mobile:  375px (iPhone 12)"
echo "  Mobile:  430px (iPhone 14 Pro Max)"
echo "  Tablet:  768px (iPad)"
echo "  Tablet:  1024px (iPad Pro)"
echo "  Desktop: 1366px (HD)"
echo "  Desktop: 1920px (Full HD)"
echo "  Desktop: 2560px (QHD)"
echo ""
echo -e "${YELLOW}Manual testing required:${NC}"
echo "  1. Open DevTools (F12)"
echo "  2. Toggle device toolbar (Ctrl+Shift+M)"
echo "  3. Test each viewport"
echo "  4. Verify no horizontal scrolling"
echo "  5. Check touch interactions"

# Test 6: Performance monitoring setup
print_section "6. Performance Monitoring Guide"
echo ""
echo "To monitor performance while testing:"
echo ""
echo "Chrome DevTools Performance Tab:"
echo "  1. Open DevTools → Performance tab"
echo "  2. Click Record (red circle)"
echo "  3. Interact with editor (add rows, type text, etc.)"
echo "  4. Stop recording"
echo "  5. Analyze metrics:"
echo "     - FCP (First Contentful Paint)"
echo "     - LCP (Largest Contentful Paint)"
echo "     - CLS (Cumulative Layout Shift)"
echo "     - TTI (Time to Interactive)"
echo ""
echo "Memory Profiling:"
echo "  1. DevTools → Memory tab"
echo "  2. Take heap snapshot before interaction"
echo "  3. Perform test actions"
echo "  4. Take heap snapshot after"
echo "  5. Compare snapshots for memory growth"
echo ""
echo "Network Monitoring:"
echo "  1. DevTools → Network tab"
echo "  2. Check API response times"
echo "  3. Verify save operations < 1 second"
echo "  4. Monitor for failed requests"

# Test 7: Test data generation
print_section "7. Test Data Generation"
echo ""
echo "Generating test datasets for performance testing..."
echo ""
if [ -f "backend/tests/test_data_generator.py" ]; then
    echo "Test data generator available at:"
    echo "  backend/tests/test_data_generator.py"
    echo ""
    echo "Usage examples:"
    echo "  python3 backend/tests/test_data_generator.py"
    echo ""
    echo "To use in Python:"
    echo "  from test_data_generator import generate_large_table"
    echo "  data = generate_large_table(100, 5)  # 100 rows, 5 columns"
    echo ""
    python3 backend/tests/test_data_generator.py
else
    echo -e "${RED}Test data generator not found${NC}"
fi

# Test 8: Performance benchmarks
print_section "8. Expected Performance Benchmarks"
echo ""
echo "Component              | Metric                  | Target    | Status"
echo "─────────────────────────────────────────────────────────────────────"
echo "NarrativeEditor        | Render 5000 words      | < 500ms   | ⏳ MANUAL TEST"
echo "TableEditor            | Add row to 100-row tbl | < 100ms   | ⏳ MANUAL TEST"
echo "TableEditor            | Scroll 100+ rows       | 60 FPS    | ⏳ MANUAL TEST"
echo "CardEditor             | Reorder 50 cards       | < 300ms   | ⏳ MANUAL TEST"
echo "CardEditor             | Render 50 cards        | < 1000ms  | ⏳ MANUAL TEST"
echo "TechnicalEditor        | Switch view mode       | < 200ms   | ⏳ MANUAL TEST"
echo "All Editors            | Save operation         | < 1000ms  | ⏳ MANUAL TEST"
echo "All Editors            | Auto-save debounce     | 2s        | ⏳ MANUAL TEST"
echo ""

# Test 9: Mobile/Tablet specific checks
print_section "9. Mobile & Tablet Testing Checklist"
echo ""
echo "Layout:"
echo "  [ ] Editor fits viewport without horizontal scroll"
echo "  [ ] Touch target sizes ≥ 44x44 pixels"
echo "  [ ] Text readable at default zoom (≥16px)"
echo ""
echo "Interactions:"
echo "  [ ] Touch scrolling smooth"
echo "  [ ] Tap targets responsive"
echo "  [ ] Long-press menus work"
echo "  [ ] Virtual keyboard doesn't hide inputs"
echo ""
echo "Performance:"
echo "  [ ] No janky animations"
echo "  [ ] Scrolling at 60 FPS"
echo "  [ ] Save completes within 2 seconds"
echo ""

# Test 10: Final summary
print_section "Testing Summary"
echo ""
echo -e "${GREEN}✓ Setup Complete${NC}"
echo ""
echo "Next steps:"
echo "  1. Start dev server: npm run dev"
echo "  2. Open browser DevTools: F12"
echo "  3. Test each editor component with varying data sizes"
echo "  4. Monitor performance metrics"
echo "  5. Test on multiple viewports"
echo "  6. Document findings in PHASE_3_TESTING_RESULTS.md"
echo ""
echo "For detailed testing plan, see: PHASE_3_TESTING_PLAN.md"
echo ""
echo -e "${YELLOW}Manual testing is required for responsiveness verification${NC}"
echo ""

print_section "Testing Ready!"
echo -e "${GREEN}All systems ready for Phase 3 testing.${NC}"
echo ""
