#!/usr/bin/env python3
"""Check exact characters in Service provider's answer."""
import sys
sys.path.insert(0, '/app')

from app import create_app
from app.models import Question

app = create_app()

with app.app_context():
    q = Question.query.get(42)
    if q:
        text = q.text
        print(f"First 40 chars: {repr(text[:40])}")
        print(f"Characters:")
        for i, c in enumerate(text[:40]):
            print(f"  [{i}] {repr(c)} = U+{ord(c):04X}")
