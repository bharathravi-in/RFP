"""
Diagram Generation Agent

AI-powered agent that generates Mermaid.js diagrams for RFP proposals:
- Architecture diagrams
- Organization charts
- Flowcharts
- Sequence diagrams
- Entity Relationship diagrams
- Gantt charts
"""
import logging
import re
from typing import Dict, Optional, List
from flask import current_app

import google.generativeai as genai

logger = logging.getLogger(__name__)


# Diagram type configurations
DIAGRAM_TYPES = {
    'architecture': {
        'name': 'Architecture Diagram',
        'description': 'System architecture showing components and their relationships',
        'mermaid_type': 'graph TB',
        'example': '''graph TB
    subgraph Client
        A[Web Browser] --> B[Mobile App]
    end
    subgraph Backend
        C[API Gateway] --> D[Auth Service]
        C --> E[Core Service]
        E --> F[(Database)]
    end
    A --> C
    B --> C''',
    },
    'org_chart': {
        'name': 'Organization Chart',
        'description': 'Team structure and reporting hierarchy',
        'mermaid_type': 'graph TB',
        'example': '''graph TB
    A[CEO] --> B[CTO]
    A --> C[CFO]
    A --> D[COO]
    B --> E[Dev Lead]
    B --> F[QA Lead]
    E --> G[Developer 1]
    E --> H[Developer 2]''',
    },
    'flowchart': {
        'name': 'Flowchart',
        'description': 'Process flow or workflow diagram',
        'mermaid_type': 'flowchart LR',
        'example': '''flowchart LR
    A[Start] --> B{Decision}
    B -->|Yes| C[Process 1]
    B -->|No| D[Process 2]
    C --> E[End]
    D --> E''',
    },
    'sequence': {
        'name': 'Sequence Diagram',
        'description': 'Interaction sequence between components',
        'mermaid_type': 'sequenceDiagram',
        'example': '''sequenceDiagram
    participant Client
    participant API
    participant Database
    Client->>API: Request
    API->>Database: Query
    Database-->>API: Result
    API-->>Client: Response''',
    },
    'erd': {
        'name': 'Entity Relationship Diagram',
        'description': 'Database schema and relationships',
        'mermaid_type': 'erDiagram',
        'example': '''erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    PRODUCT ||--o{ LINE-ITEM : "ordered in"
    USER {
        int id
        string name
        string email
    }
    ORDER {
        int id
        date created_at
    }''',
    },
    'gantt': {
        'name': 'Gantt Chart',
        'description': 'Project timeline and phases',
        'mermaid_type': 'gantt',
        'example': '''gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    section Phase 1
    Planning           :a1, 2024-01-01, 30d
    Requirements       :a2, after a1, 20d
    section Phase 2
    Development        :a3, after a2, 60d
    Testing            :a4, after a3, 30d
    section Phase 3
    Deployment         :a5, after a4, 10d''',
    },
}


class DiagramAgent:
    """
    AI Agent that generates Mermaid.js diagrams based on context.
    """
    
    def __init__(self):
        """Initialize the agent with AI model."""
        self.ai_enabled = bool(current_app.config.get('GOOGLE_API_KEY'))
        if self.ai_enabled:
            genai.configure(api_key=current_app.config['GOOGLE_API_KEY'])
            self.model = genai.GenerativeModel(
                current_app.config.get('GOOGLE_MODEL', 'gemini-1.5-flash')
            )
    
    def get_diagram_types(self) -> List[Dict]:
        """Return available diagram types."""
        return [
            {
                'type': key,
                'name': val['name'],
                'description': val['description'],
            }
            for key, val in DIAGRAM_TYPES.items()
        ]
    
    def generate_diagram(
        self,
        diagram_type: str,
        context: str,
        title: Optional[str] = None,
        additional_instructions: Optional[str] = None,
        knowledge_context: Optional[str] = None
    ) -> Dict:
        """
        Generate a Mermaid diagram based on context.
        
        Args:
            diagram_type: Type of diagram (architecture, org_chart, flowchart, etc.)
            context: Description or context for the diagram
            title: Optional title for the diagram
            additional_instructions: Optional extra instructions
            knowledge_context: Optional knowledge base context
            
        Returns:
            Dict with 'mermaid_code', 'title', 'description'
        """
        if diagram_type not in DIAGRAM_TYPES:
            return {
                'error': f'Invalid diagram type. Valid types: {list(DIAGRAM_TYPES.keys())}'
            }
        
        config = DIAGRAM_TYPES[diagram_type]
        
        if not self.ai_enabled:
            return {
                'mermaid_code': config['example'],
                'title': title or config['name'],
                'description': 'Example diagram (AI not configured)',
                'diagram_type': diagram_type,
            }
        
        prompt = self._build_prompt(
            diagram_type=diagram_type,
            config=config,
            context=context,
            title=title,
            additional_instructions=additional_instructions,
            knowledge_context=knowledge_context
        )
        
        try:
            response = self.model.generate_content(prompt)
            mermaid_code = self._extract_mermaid_code(response.text)
            
            # Sanitize the code to fix common issues
            mermaid_code = self._sanitize_mermaid_code(mermaid_code)
            
            # Validate the mermaid code
            if not self._validate_mermaid(mermaid_code, diagram_type):
                logger.warning("Generated Mermaid code may have issues, using as-is")
            
            return {
                'mermaid_code': mermaid_code,
                'title': title or config['name'],
                'description': f'AI-generated {config["name"].lower()} based on context',
                'diagram_type': diagram_type,
            }
            
        except Exception as e:
            logger.error(f"Diagram generation failed: {e}")
            return {
                'error': str(e),
                'mermaid_code': config['example'],
                'title': title or config['name'],
                'description': 'Fallback example (generation failed)',
                'diagram_type': diagram_type,
            }
    
    def _build_prompt(
        self,
        diagram_type: str,
        config: Dict,
        context: str,
        title: Optional[str],
        additional_instructions: Optional[str],
        knowledge_context: Optional[str]
    ) -> str:
        """Build the AI prompt for diagram generation."""
        
        prompt = f"""You are a Mermaid.js diagram generator. Generate ONLY valid Mermaid code.

TASK: Create a {config['name']}

MERMAID SYNTAX: {config['mermaid_type']}

CONTEXT:
{context}

{f'ADDITIONAL CONTEXT:{chr(10)}{knowledge_context}' if knowledge_context else ''}

{f'SPECIAL INSTRUCTIONS:{chr(10)}{additional_instructions}' if additional_instructions else ''}

CRITICAL SYNTAX RULES (MUST FOLLOW):
1. Output ONLY the Mermaid diagram code
2. Start with: {config['mermaid_type']}
3. NO explanations, NO markdown fences, NO comments
4. Subgraph names MUST be single words with NO spaces (e.g., "subgraph Frontend" not "subgraph Front End")
5. Node labels in brackets MUST NOT contain parentheses (use dashes instead)
   - WRONG: UI[User Interface (Web)]
   - CORRECT: UI[User Interface - Web]
6. Keep node IDs short and simple (A, B, C or short names like API, DB)
7. Use --> for connections

EXAMPLE OUTPUT:
{config['example']}

YOUR OUTPUT (Mermaid code only):"""
        
        return prompt
    
    def _extract_mermaid_code(self, response_text: str) -> str:
        """Extract Mermaid code from AI response, handling verbose responses."""
        text = response_text.strip()
        
        # Try to find mermaid code block first (```mermaid ... ```)
        mermaid_block = re.search(r'```mermaid\s*\n([\s\S]*?)```', text)
        if mermaid_block:
            return mermaid_block.group(1).strip()
        
        # Try to find any code block that looks like Mermaid
        code_blocks = re.findall(r'```(?:\w*)\s*\n([\s\S]*?)```', text)
        for code in code_blocks:
            code = code.strip()
            if any(code.lower().startswith(kw) for kw in ['graph', 'flowchart', 'sequencediagram', 'erdiagram', 'gantt']):
                return code
        
        # Line-by-line extraction - find where Mermaid code starts and ends
        lines = text.split('\n')
        mermaid_lines = []
        in_diagram = False
        
        # Patterns that indicate we're still in valid Mermaid code
        mermaid_line_patterns = [
            r'^\s*(graph|flowchart|sequenceDiagram|erDiagram|gantt)',  # Diagram start
            r'^\s*subgraph\s+',  # Subgraph
            r'^\s*end\s*$',  # Subgraph end
            r'^\s*\w+\s*[\[\(\{]',  # Node definitions like A[text], B(text), C{text}
            r'^\s*\w+\s*--',  # Arrows: A --> B
            r'^\s*\w+\s*-\.',  # Dotted arrows
            r'^\s*\w+\s*==',  # Thick arrows
            r'^\s*\w+\s*-[->|x]',  # Various arrows
            r'^\s*\w+--\>',  # Standard arrows
            r'^\s*participant\s+',  # Sequence diagram
            r'^\s*\w+->>',  # Sequence arrows
            r'^\s*\w+-->>',  # Sequence return arrows
            r'^\s*note\s+',  # Notes
            r'^\s*loop\s+',  # Loops
            r'^\s*alt\s+',  # Alternatives
            r'^\s*style\s+\w+\s+fill',  # Style definitions
            r'^\s*section\s+',  # Gantt sections
            r'^\s*\w+\s+:\s*\w+',  # Gantt tasks
            r'^\s*title\s+',  # Titles
            r'^\s*dateFormat',  # Gantt date format
            r'^\s*\w+\s*\|\|',  # ERD relationships
            r'^\s*\w+\s*\{',  # ERD entity start
            r'^\s*\w+\s+\w+\s*$',  # ERD attributes like "int id"
            r'^\s*\}',  # ERD entity end
        ]
        
        # Patterns that indicate end of Mermaid code (explanatory text)
        stop_patterns = [
            r'^[A-Z][a-z]+.*:$',  # Headers like "Explanation:", "Components:"
            r'^\*\*',  # Bold markdown
            r'^#{1,3}\s+',  # Markdown headers
            r'^Diagram\s+',  # "Diagram Components..."
            r'^Here\'s',  # Explanatory text
            r'^This\s+diagram',  # Explanatory text
            r'^To\s+',  # "To customize..."
            r'^Note:',  # Notes
            r'^Important:',  # Warnings
            r'^Customiz',  # "Customizing..."
            r'^Component',  # "Components..."
            r'^The\s+following',  # Explanatory
        ]
        
        for line in lines:
            stripped = line.strip()
            
            # Check if this line starts a diagram
            if re.match(r'^(graph|flowchart|sequenceDiagram|erDiagram|gantt)', stripped, re.IGNORECASE):
                in_diagram = True
            
            if in_diagram:
                # Check if we should stop (hit explanatory text)
                if any(re.match(pattern, stripped, re.IGNORECASE) for pattern in stop_patterns):
                    break
                
                # Check if line looks like valid Mermaid code or is empty (for formatting)
                is_mermaid = any(re.match(pattern, line, re.IGNORECASE) for pattern in mermaid_line_patterns)
                is_continuation = len(stripped) > 0 and (
                    stripped.startswith(('-->', '---', '-.', '==', '|', '}', 'end')) or
                    '-->' in stripped or
                    '-->|' in stripped or
                    stripped.endswith((';', '}', ')')) or
                    re.match(r'^\s+\w', line)  # Indented content
                )
                
                if is_mermaid or is_continuation or stripped == '':
                    mermaid_lines.append(line)
                elif stripped and not any(c in stripped for c in ['[', '(', '{', '--', '|', ':']):
                    # This looks like plain text, probably end of diagram
                    break
        
        if mermaid_lines:
            # Clean up: remove trailing empty lines
            while mermaid_lines and not mermaid_lines[-1].strip():
                mermaid_lines.pop()
            return '\n'.join(mermaid_lines).strip()
        
        # Fallback: return as-is
        return text.strip()
    
    def _validate_mermaid(self, code: str, diagram_type: str) -> bool:
        """Basic validation of Mermaid code structure."""
        config = DIAGRAM_TYPES.get(diagram_type)
        if not config:
            return False
        
        # Check if it starts with the expected Mermaid type
        expected_starts = {
            'architecture': ['graph', 'flowchart'],
            'org_chart': ['graph', 'flowchart'],
            'flowchart': ['flowchart', 'graph'],
            'sequence': ['sequenceDiagram'],
            'erd': ['erDiagram'],
            'gantt': ['gantt'],
        }
        
        valid_starts = expected_starts.get(diagram_type, [])
        code_lower = code.lower().strip()
        
        return any(code_lower.startswith(start.lower()) for start in valid_starts)
    
    def _sanitize_mermaid_code(self, code: str) -> str:
        """Sanitize Mermaid code to fix common syntax issues."""
        lines = code.split('\n')
        sanitized_lines = []
        
        for line in lines:
            sanitized_line = line
            
            # Skip empty lines and pure comment lines
            if not sanitized_line.strip() or sanitized_line.strip().startswith('%%'):
                continue
            
            # Remove inline comments (anything after %%)
            if '%%' in sanitized_line:
                sanitized_line = sanitized_line.split('%%')[0].rstrip()
            
            # Skip linkStyle lines - they can be complex
            if sanitized_line.strip().startswith('linkStyle'):
                continue
            
            # Fix subgraph names with spaces
            # e.g., "subgraph User Layer" -> "subgraph UserLayer"
            subgraph_match = re.match(r'^(\s*subgraph\s+)(.+)$', sanitized_line)
            if subgraph_match:
                prefix = subgraph_match.group(1)
                name = subgraph_match.group(2).strip()
                # Remove spaces and special characters from subgraph name
                name = re.sub(r'[^a-zA-Z0-9_]', '', name)
                sanitized_line = f'{prefix}{name}'
                sanitized_lines.append(sanitized_line)
                continue
            
            # Remove all HTML tags from the line
            sanitized_line = re.sub(r'<[^>]+>', '', sanitized_line)
            
            # Fix node labels - find all bracket patterns and clean them
            # Handle square brackets: A[label text]
            def clean_square_bracket_label(match):
                node_id = match.group(1)
                label = match.group(2)
                # Remove parentheses content or replace with dashes
                label = re.sub(r'\([^)]*\)', '', label)
                # Clean up the label
                label = label.replace('[', '').replace(']', '')
                label = label.replace('"', "'")
                label = label.replace('/', '-')
                label = re.sub(r'\s+', ' ', label).strip()
                if not label:
                    label = node_id
                return f'{node_id}[{label}]'
            
            sanitized_line = re.sub(r'(\w+)\[([^\]]+)\]', clean_square_bracket_label, sanitized_line)
            
            # Handle round brackets (stadium shape): A(label text)
            def clean_round_bracket_label(match):
                full_match = match.group(0)
                # Skip if this is part of an arrow or style
                if '-->' in full_match or 'style' in full_match:
                    return full_match
                node_id = match.group(1)
                label = match.group(2)
                # Remove nested parentheses
                label = re.sub(r'\([^)]*\)', '', label)
                label = label.replace('"', "'")
                label = label.replace('/', '-')
                label = re.sub(r'\s+', ' ', label).strip()
                if not label:
                    label = node_id
                return f'{node_id}({label})'
            
            # Only apply to node definitions, not arrows
            if '-->' not in sanitized_line and sanitized_line.strip().startswith(tuple('ABCDEFGHIJKLMNOPQRSTUVWXYZ')):
                sanitized_line = re.sub(r'(\w+)\(([^)]+)\)', clean_round_bracket_label, sanitized_line)
            
            # Handle diamond shape: A{label text}
            def clean_curly_bracket_label(match):
                node_id = match.group(1)
                label = match.group(2)
                label = re.sub(r'\([^)]*\)', '', label)
                label = label.replace('"', "'")
                label = re.sub(r'\s+', ' ', label).strip()
                if not label:
                    label = node_id
                return f'{node_id}{{{label}}}'
            
            sanitized_line = re.sub(r'(\w+)\{([^}]+)\}', clean_curly_bracket_label, sanitized_line)
            
            # Fix style lines with spaces in names
            style_match = re.match(r'^(\s*style\s+)([^\s]+\s+[^\s]+)(\s+.*)$', sanitized_line)
            if style_match and ' ' in style_match.group(2):
                prefix = style_match.group(1)
                name = re.sub(r'[^a-zA-Z0-9_]', '', style_match.group(2).split()[0])
                rest = style_match.group(3)
                sanitized_line = f'{prefix}{name}{rest}'
            
            # Clean up any remaining issues
            sanitized_line = sanitized_line.rstrip()
            
            if sanitized_line.strip():
                sanitized_lines.append(sanitized_line)
        
        return '\n'.join(sanitized_lines)
    
    def regenerate_with_feedback(
        self,
        original_code: str,
        diagram_type: str,
        feedback: str
    ) -> Dict:
        """Regenerate a diagram based on user feedback."""
        if not self.ai_enabled:
            return {
                'error': 'AI not configured',
                'mermaid_code': original_code,
            }
        
        config = DIAGRAM_TYPES.get(diagram_type, {})
        
        prompt = f"""Modify this Mermaid.js diagram based on the user's feedback.

ORIGINAL DIAGRAM:
{original_code}

USER FEEDBACK:
{feedback}

REQUIREMENTS:
1. Apply the user's requested changes
2. Keep the diagram type the same ({config.get('name', diagram_type)})
3. Output ONLY valid Mermaid.js code
4. Maintain readability and professional appearance

Output ONLY the updated Mermaid code, no explanations:"""
        
        try:
            response = self.model.generate_content(prompt)
            mermaid_code = self._extract_mermaid_code(response.text)
            
            return {
                'mermaid_code': mermaid_code,
                'diagram_type': diagram_type,
            }
        except Exception as e:
            logger.error(f"Diagram regeneration failed: {e}")
            return {
                'error': str(e),
                'mermaid_code': original_code,
            }


def get_diagram_agent() -> DiagramAgent:
    """Factory function to get a DiagramAgent instance."""
    return DiagramAgent()
