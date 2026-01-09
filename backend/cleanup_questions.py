#!/usr/bin/env python3
"""Clean up Service provider's answer prefix from existing questions."""
import re
import sys
sys.path.insert(0, '/app')

from app import create_app
from app.extensions import db
from app.models import Question

app = create_app()

# Pattern with exact U+2019 character (right single quotation mark)
PATTERN = re.compile(
    r"^Service\s+provider\u2019s\s+answer\s+",
    re.IGNORECASE
)

with app.app_context():
    questions = Question.query.filter(
        Question.text.ilike('Service provider%answer%')
    ).all()
    
    print(f"Found {len(questions)} questions with 'Service provider' prefix")
    
    updated_count = 0
    for q in questions:
        original = q.text
        cleaned = PATTERN.sub('', original).strip()
        
        if cleaned != original:
            q.text = cleaned
            updated_count += 1
            if updated_count <= 10:
                print(f"  [{q.id}] {original[:50]}... -> {cleaned[:50]}...")
    
    if updated_count > 0:
        db.session.commit()
        print(f"\n✅ Updated {updated_count} questions")
    else:
        print("\n⚠️ No questions updated")
