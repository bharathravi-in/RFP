#!/bin/bash

# Seed default data for RFP Application

echo "Seeding default data for RFP application..."
echo "==========================================="

cd "$(dirname "$0")/backend"

python3 << 'PYEOF'
from app import create_app, db
from app.models import seed_section_types

app = create_app()
with app.app_context():
    try:
        print("✓ Seeding section types...")
        seed_section_types(db.session)
        print("  - 12 section types seeded")
        
        print("✓ Data seeded successfully!")
        print("")
        print("Available section types:")
        print("  1. Executive Summary")
        print("  2. Company Overview")
        print("  3. Technical Approach")
        print("  4. Pricing")
        print("  5. Compliance")
        print("  6. Team & Resources")
        print("  7. Case Studies & References")
        print("  8. Implementation Plan")
        print("  9. Q&A Responses")
        print("  10. Clarifications & Gaps")
        print("  11. Assumptions")
        print("  12. References")
        
    except Exception as e:
        print(f"✗ Error seeding data: {e}")
        exit(1)
PYEOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Seeding complete!"
    echo "The application is now ready to use."
else
    echo "❌ Seeding failed. Please check the error above."
    exit 1
fi
