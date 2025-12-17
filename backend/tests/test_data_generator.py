"""
Test Data Generator for Gap 5 Performance Testing
Generates large datasets for testing editor performance
"""

import json
from datetime import datetime, timedelta
import random

def generate_large_text(word_count=5000):
    """Generate Lorem Ipsum-style text for NarrativeEditor testing."""
    lorem = """Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt 
    ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris 
    nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit 
    esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt 
    in culpa qui officia deserunt mollit anim id est laborum."""
    
    words = lorem.split()
    full_text = []
    
    while len(" ".join(full_text).split()) < word_count:
        full_text.extend(random.sample(words, min(50, len(words))))
    
    # Join into paragraphs
    text = " ".join(full_text[:word_count])
    paragraphs = [text[i:i+500] for i in range(0, len(text), 500)]
    
    return "\n\n".join(paragraphs)


def generate_large_table(rows=100, columns=5):
    """Generate table data for TableEditor testing."""
    column_names = [f"Column {i+1}" for i in range(columns)]
    column_types = ["text", "number", "currency", "date"]
    
    columns_data = [
        {"name": col, "type": random.choice(column_types)}
        for col in column_names
    ]
    
    rows_data = []
    for i in range(rows):
        row = {}
        for col in columns_data:
            if col["type"] == "number":
                row[col["name"]] = random.randint(1, 1000)
            elif col["type"] == "currency":
                row[col["name"]] = f"${random.randint(100, 100000)}.{random.randint(0, 99):02d}"
            elif col["type"] == "date":
                date = datetime.now() - timedelta(days=random.randint(0, 365))
                row[col["name"]] = date.strftime("%Y-%m-%d")
            else:  # text
                row[col["name"]] = f"Data {i}-{col['name']}"
        rows_data.append(row)
    
    return {
        "columns": columns_data,
        "rows": rows_data,
        "style": "striped"
    }


def generate_many_cards(count=50, template="generic"):
    """Generate card data for CardEditor testing."""
    cards = []
    
    field_templates = {
        "case_study": ["title", "challenge", "solution", "results"],
        "team_member": ["title", "role", "bio", "skills"],
        "generic": ["title", "description"]
    }
    
    fields = field_templates.get(template, field_templates["generic"])
    
    for i in range(count):
        card = {
            "id": str(i + 1),
            "title": f"Card {i + 1}",
            "description": f"Description for card {i + 1}. This is sample content.",
        }
        
        if template == "case_study":
            card.update({
                "challenge": f"Challenge {i + 1}",
                "solution": f"Solution {i + 1}",
                "results": f"Results {i + 1}"
            })
        elif template == "team_member":
            card.update({
                "role": f"Role {i + 1}",
                "bio": f"Bio for team member {i + 1}",
                "skills": f"Skill1, Skill2, Skill3"
            })
        
        if i % 3 == 0:  # Add image to some cards
            card["image"] = "https://via.placeholder.com/300x200"
        
        card["metadata"] = {
            "created": datetime.now().isoformat(),
            "index": i
        }
        
        cards.append(card)
    
    return {
        "cards": cards,
        "templateType": template,
        "columnLayout": 2
    }


def generate_code_blocks(count=20, languages=None):
    """Generate code blocks for TechnicalEditor testing."""
    if languages is None:
        languages = ["javascript", "python", "sql", "java", "bash", "yaml", "json", "html"]
    
    sample_code = {
        "javascript": """function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
console.log(fibonacci(10));""",
        "python": """def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)
print(fibonacci(10))""",
        "sql": """SELECT 
    customer_id, 
    COUNT(*) as order_count,
    SUM(total_amount) as total_spent
FROM orders
GROUP BY customer_id
ORDER BY total_spent DESC;""",
        "java": """public class Fibonacci {
    public static int fib(int n) {
        if (n <= 1) return n;
        return fib(n - 1) + fib(n - 2);
    }
}""",
        "bash": """#!/bin/bash
for i in {1..10}; do
    echo "Iteration $i"
    sleep 1
done""",
        "yaml": """database:
  host: localhost
  port: 5432
  name: mydb
  credentials:
    user: admin
    pass: secret""",
        "json": """{
  "name": "My Project",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0"
  }
}""",
        "html": """<div class="container">
  <h1>Title</h1>
  <p>Content goes here</p>
</div>"""
    }
    
    blocks = []
    for i in range(count):
        lang = random.choice(languages)
        code = sample_code.get(lang, "# Sample code")
        
        blocks.append({
            "id": str(i + 1),
            "language": lang,
            "code": code
        })
    
    return {
        "description": "Technical approach with multiple code examples",
        "codeBlocks": blocks
    }


def generate_test_section(section_type, size="medium"):
    """
    Generate test data for a specific section type.
    
    Args:
        section_type: 'narrative', 'table', 'card', or 'technical'
        size: 'small', 'medium', 'large', 'extra_large'
    
    Returns:
        dict: Section content data
    """
    size_config = {
        "small": {"text_words": 1000, "table_rows": 20, "cards": 10, "code_blocks": 5},
        "medium": {"text_words": 3000, "table_rows": 50, "cards": 25, "code_blocks": 10},
        "large": {"text_words": 5000, "table_rows": 100, "cards": 50, "code_blocks": 20},
        "extra_large": {"text_words": 10000, "table_rows": 200, "cards": 100, "code_blocks": 30}
    }
    
    config = size_config.get(size, size_config["medium"])
    
    if section_type == "narrative":
        return generate_large_text(config["text_words"])
    elif section_type == "table":
        return json.dumps(generate_large_table(config["table_rows"], 5))
    elif section_type == "card":
        return json.dumps(generate_many_cards(config["cards"], "generic"))
    elif section_type == "technical":
        return json.dumps(generate_code_blocks(config["code_blocks"]))
    else:
        return "Invalid section type"


if __name__ == "__main__":
    # Example usage
    print("Generating test data samples...")
    
    # Test narrative (5000 words)
    print("\n1. Large Text (5000 words):")
    text = generate_large_text(100)  # Just 100 words for demo
    print(f"Generated text (truncated): {text[:100]}...")
    
    # Test table (100 rows)
    print("\n2. Large Table (100 rows x 5 columns):")
    table = generate_large_table(10, 5)  # Just 10 rows for demo
    print(f"Columns: {[col['name'] for col in table['columns']]}")
    print(f"Rows generated: {len(table['rows'])}")
    
    # Test cards (50 cards)
    print("\n3. Many Cards (50 cards):")
    cards = generate_many_cards(10)  # Just 10 for demo
    print(f"Template: {cards['templateType']}")
    print(f"Cards generated: {len(cards['cards'])}")
    
    # Test code blocks (20 blocks)
    print("\n4. Code Blocks (20 blocks):")
    code = generate_code_blocks(5)  # Just 5 for demo
    print(f"Languages: {set(b['language'] for b in code['codeBlocks'])}")
    print(f"Blocks generated: {len(code['codeBlocks'])}")
    
    print("\nTest data generation complete!")
