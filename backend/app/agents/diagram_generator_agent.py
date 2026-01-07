"""
Diagram Generator Agent

AI-powered agent that analyzes RFP documents and generates
Mermaid.js diagrams for visualization (architecture, flowcharts, timelines, etc.)
"""
import logging
import json
import re
from typing import Dict, List, Any, Optional

from .config import get_agent_config, SessionKeys
from .utils import with_retry, RetryConfig

logger = logging.getLogger(__name__)


class DiagramType:
    """Available diagram types."""
    ARCHITECTURE = "architecture"
    FLOWCHART = "flowchart"
    SEQUENCE = "sequence"
    TIMELINE = "timeline"
    ENTITY_RELATIONSHIP = "er"
    MINDMAP = "mindmap"


DIAGRAM_TYPE_INFO = {
    DiagramType.ARCHITECTURE: {
        "name": "Architecture Diagram",
        "description": "System components and their relationships",
        "mermaid_type": "flowchart TB",
        "icon": "CubeIcon"
    },
    DiagramType.FLOWCHART: {
        "name": "Business Process Flowchart",
        "description": "Process flows and decision points",
        "mermaid_type": "flowchart LR",
        "icon": "ArrowPathIcon"
    },
    DiagramType.SEQUENCE: {
        "name": "Sequence Diagram",
        "description": "Interactions between systems or actors",
        "mermaid_type": "sequenceDiagram",
        "icon": "ArrowsRightLeftIcon"
    },
    DiagramType.TIMELINE: {
        "name": "Timeline / Gantt Chart",
        "description": "Project milestones and deadlines",
        "mermaid_type": "gantt",
        "icon": "CalendarIcon"
    },
    DiagramType.ENTITY_RELATIONSHIP: {
        "name": "Entity Relationship Diagram",
        "description": "Data entities and their relationships",
        "mermaid_type": "erDiagram",
        "icon": "CircleStackIcon"
    },
    DiagramType.MINDMAP: {
        "name": "Mind Map",
        "description": "Hierarchical topic overview",
        "mermaid_type": "mindmap",
        "icon": "SparklesIcon"
    }
}


class DiagramGeneratorAgent:
    """
    Agent that analyzes RFP documents and generates Mermaid.js diagrams.
    
    Supports multiple diagram types:
    - Architecture diagrams (system components)
    - Business process flowcharts
    - Sequence diagrams (system interactions)
    - Timeline/Gantt charts (project milestones)
    - Entity relationship diagrams
    - Mind maps (topic overview)
    """
    
    # Validation rules for mermaid diagrams
    DIAGRAM_VALIDATION_RULES = {
        'max_node_label_length': 30,
        'max_nodes_per_diagram': 50,
        'max_lines': 100,
        'forbidden_chars_in_labels': ['(', ')', ':', '"', "'", '&', '<', '>'],
        'required_header': {
            'flowchart': ['flowchart TB', 'flowchart LR', 'flowchart TD', 'flowchart RL'],
            'sequence': ['sequenceDiagram'],
            'gantt': ['gantt'],
            'erDiagram': ['erDiagram'],
            'mindmap': ['mindmap']
        }
    }
    
    # Common mermaid syntax fix patterns
    DIAGRAM_FIX_PATTERNS = {
        # Pattern: (regex, replacement, description)
        'unicode_arrows': [
            (r'→', '-->', 'Unicode right arrow'),
            (r'←', '<--', 'Unicode left arrow'),
            (r'↔', '<-->', 'Unicode bidir arrow'),
            (r'➡', '-->', 'Heavy right arrow'),
            (r'⇒', '-->', 'Double right arrow'),
        ],
        'label_fixes': [
            (r'\(([^)]*)\)', '', 'Remove parentheses content'),
            (r'"', '', 'Remove double quotes'),
            (r"'", '', 'Remove single quotes'),
            (r'&', 'and', 'Replace ampersand'),
        ],
        'structural_fixes': [
            (r'\[\s*\]', '[Node]', 'Fix empty brackets'),
            (r'\{\s*\}', '{Decision}', 'Fix empty braces'),
            (r'subgraph\s*\n', 'subgraph Group\n', 'Fix empty subgraph'),
        ]
    }
    
    ARCHITECTURE_PROMPT = """You are an expert system architect. Analyze this RFP document and create a Mermaid.js architecture diagram.

**CRITICAL MERMAID SYNTAX RULES:**
- Keep node labels SHORT (max 15 characters)
- Use ONLY alphanumeric characters and spaces in labels
- NO parentheses, colons, or special characters in labels
- Each node on its own line
- Example good: A[Web App] B[API Server]
- Example BAD: A[Web Application (Frontend)] <- parentheses cause errors

**INSTRUCTIONS:**
1. Identify key systems and components
2. Use simple, short labels (e.g., "Web App" not "Web Application Frontend")
3. Create clear data flows

**DOCUMENT TEXT:**
{text}

**RESPOND WITH VALID JSON ONLY:**
{{
  "title": "Architecture diagram title",
  "description": "Brief description",
  "mermaid_code": "flowchart TB\\n    subgraph Frontend\\n        A[Web App]\\n        B[Mobile App]\\n    end\\n    subgraph Backend\\n        C[API Gateway]\\n        D[Auth Service]\\n    end\\n    A --> C\\n    B --> C",
  "components": ["Component 1", "Component 2"],
  "notes": "Notes about the architecture"
}}

Return ONLY valid JSON. Use \\n for newlines in mermaid_code."""

    FLOWCHART_PROMPT = """You are an expert business analyst. Create a Mermaid.js flowchart for this RFP document.

**CRITICAL MERMAID SYNTAX RULES:**
- Keep node labels SHORT (max 15 characters)
- Use ONLY alphanumeric characters and spaces in labels
- NO parentheses, colons, or special characters in labels
- Each node on its own line

**DOCUMENT TEXT:**
{text}

**RESPOND WITH VALID JSON ONLY:**
{{
  "title": "Process flowchart title",
  "description": "Brief description",
  "mermaid_code": "flowchart LR\\n    A[Start] --> B{{Decision}}\\n    B -->|Yes| C[Action 1]\\n    B -->|No| D[Action 2]\\n    C --> E[End]\\n    D --> E",
  "steps": ["Step 1", "Step 2"],
  "notes": "Process notes"
}}

Return ONLY valid JSON. Use \\n for newlines."""

    SEQUENCE_PROMPT = """You are an expert system designer. Analyze this RFP document and create a Mermaid.js sequence diagram showing interactions between different systems, users, or components.

**INSTRUCTIONS:**
1. Identify actors (users, systems, services)
2. Identify the sequence of interactions
3. Include request/response flows
4. Show any async or parallel operations

**DOCUMENT TEXT:**
{text}

**RESPOND WITH VALID JSON ONLY:**
{{
  "title": "Sequence diagram title",
  "description": "Brief description of what this diagram shows",
  "mermaid_code": "sequenceDiagram\\n    participant U as User\\n    participant S as System\\n    participant D as Database\\n    U->>S: Request\\n    S->>D: Query\\n    D-->>S: Results\\n    S-->>U: Response",
  "actors": ["Actor 1", "Actor 2"],
  "notes": "Any important notes about the interactions"
}}

Return ONLY valid JSON, no markdown formatting or code blocks. Make sure mermaid_code uses proper escaping for newlines (\\n)."""

    TIMELINE_PROMPT = """You are an expert project manager. Create a Mermaid.js Gantt chart for this RFP.

**CRITICAL MERMAID SYNTAX RULES:**
- Use simple task names (no special characters)
- Use YYYY-MM-DD date format
- Keep section names short

**DOCUMENT TEXT:**
{text}

**RESPOND WITH VALID JSON ONLY:**
{{
  "title": "Project timeline",
  "description": "Brief description",
  "mermaid_code": "gantt\\n    title Project Timeline\\n    dateFormat YYYY-MM-DD\\n    section Phase 1\\n        Task 1: 2024-01-01, 30d\\n        Task 2: 2024-01-15, 20d\\n    section Phase 2\\n        Task 3: 2024-02-01, 25d",
  "milestones": ["Milestone 1"],
  "notes": "Timeline notes"
}}

Return ONLY valid JSON. Use \\n for newlines."""

    ER_PROMPT = """You are an expert data architect. Analyze this RFP document and create a Mermaid.js entity-relationship diagram showing the key data entities and their relationships.

**INSTRUCTIONS:**
1. Identify data entities mentioned or implied (users, orders, products, etc.)
2. Identify relationships between entities
3. Identify key attributes for each entity
4. Create a clear ER diagram

**DOCUMENT TEXT:**
{text}

**RESPOND WITH VALID JSON ONLY:**
{{
  "title": "Data model title",
  "description": "Brief description of what this diagram shows",
  "mermaid_code": "erDiagram\\n    USER ||--o{{ ORDER : places\\n    ORDER ||--|{{ LINE-ITEM : contains\\n    PRODUCT ||--o{{ LINE-ITEM : includes",
  "entities": ["Entity 1", "Entity 2"],
  "notes": "Any important notes about the data model"
}}

Return ONLY valid JSON, no markdown formatting or code blocks. Make sure mermaid_code uses proper escaping for newlines (\\n)."""

    MINDMAP_PROMPT = """You are an expert analyst. Analyze this RFP document and create a Mermaid.js mind map showing the key topics, requirements, and their relationships in a hierarchical structure.

**INSTRUCTIONS:**
1. Identify the main topic or project name
2. Identify major categories (technical, business, compliance, etc.)
3. Identify sub-topics under each category
4. Create a clear hierarchical mind map

**DOCUMENT TEXT:**
{text}

**RESPOND WITH VALID JSON ONLY:**
{{
  "title": "Mind map title",
  "description": "Brief description of what this mind map shows",
  "mermaid_code": "mindmap\\n  root((RFP Overview))\\n    Technical\\n      Security\\n      Integration\\n    Business\\n      Timeline\\n      Budget",
  "topics": ["Topic 1", "Topic 2"],
  "notes": "Any important notes"
}}

Return ONLY valid JSON, no markdown formatting or code blocks. Make sure mermaid_code uses proper escaping for newlines (\\n)."""

    CONTEXTUAL_DIAGRAM_PROMPT = """You are an expert technical visualizer. Analyze the following question and its knowledge context to create a Mermaid.js diagram that best illustrates the answer.

**QUESTION:**
{question}

**KNOWLEDGE CONTEXT:**
{context}

**INSTRUCTIONS:**
1. Choose the best diagram type (architecture, flowchart, sequence, or er).
2. Create a Mermaid.js diagram that visually answers the question.
3. Keep labels short and comply with all Mermaid syntax rules.
4. If an architecture diagram, focus on components mentioned in the context.
5. If a process, use a flowchart.

**CRITICAL MERMAID SYNTAX RULES:**
- Keep node labels SHORT (max 15 characters)
- Use ONLY alphanumeric characters and spaces in labels
- NO parentheses, colons, or special characters in labels

**RESPOND WITH VALID JSON ONLY:**
{{
  "title": "Diagram title",
  "description": "Brief description",
  "mermaid_code": "mermaid syntax here",
  "diagram_type": "architecture|flowchart|sequence|er",
  "notes": "Explanation of the visualization"
}}
"""

    PROMPTS = {
        DiagramType.ARCHITECTURE: ARCHITECTURE_PROMPT,
        DiagramType.FLOWCHART: FLOWCHART_PROMPT,
        DiagramType.SEQUENCE: SEQUENCE_PROMPT,
        DiagramType.TIMELINE: TIMELINE_PROMPT,
        DiagramType.ENTITY_RELATIONSHIP: ER_PROMPT,
        DiagramType.MINDMAP: MINDMAP_PROMPT,
    }

    def __init__(self, org_id: int = None, config=None):
        self.org_id = org_id
        self.config = config or get_agent_config(org_id, agent_type='diagram_generation')
        self.name = "DiagramGeneratorAgent"
    
    def generate_for_context(
        self,
        question: str,
        context: str,
        session_state: Dict = None
    ) -> Dict:
        """
        Generate a diagram specifically for a question and its knowledge context.
        
        Args:
            question: The RFP question being answered
            context: The knowledge base context retrieved for this question
            session_state: Shared state
            
        Returns:
            Dictionary with diagram code and metadata
        """
        client = self.config.client
        if not client:
            return {"success": False, "error": "AI client not configured"}

        prompt = self.CONTEXTUAL_DIAGRAM_PROMPT.format(
            question=question,
            context=context[:15000]
        )

        try:
            # Re-use _generate_with_ai but with the custom prompt
            # We bypass the standard diagram_type routing here
            if self.config.is_adk_enabled:
                from google import genai
                response = client.models.generate_content(
                    model=self.config.model_name,
                    contents=prompt
                )
                response_text = response.text
            else:
                response = client.generate_content(prompt)
                response_text = response.text
            
            # Clean and parse JSON
            response_text = response_text.strip()
            if response_text.startswith('```'):
                response_text = re.sub(r'^```(?:json)?\s*\n?', '', response_text)
                response_text = re.sub(r'\n?```\s*$', '', response_text)
            
            result = json.loads(response_text)
            
            # Sanitize and clean
            if result.get("mermaid_code"):
                result["mermaid_code"] = self._clean_mermaid_code(result["mermaid_code"])
            
            result["diagram_type_info"] = DIAGRAM_TYPE_INFO.get(result.get("diagram_type", "architecture"), {})
            
            return {
                "success": True,
                "diagram": result
            }
        except Exception as e:
            logger.error(f"Contextual diagram generation failed: {e}")
            return {"success": False, "error": str(e)}

    def generate_diagram(
        self,
        document_text: str,
        diagram_type: str = DiagramType.ARCHITECTURE,
        session_state: Dict = None
    ) -> Dict:
        """
        Generate a Mermaid.js diagram from RFP document.
        
        Args:
            document_text: Extracted text from the RFP document
            diagram_type: Type of diagram to generate
            session_state: Shared state for agent communication
            
        Returns:
            Dictionary with diagram code and metadata
        """
        session_state = session_state or {}
        
        if diagram_type not in self.PROMPTS:
            return {
                "success": False,
                "error": f"Unknown diagram type: {diagram_type}. Available: {list(self.PROMPTS.keys())}"
            }
        
        try:
            result = self._generate_with_ai(document_text, diagram_type)
            
            # Validate mermaid code
            if result.get("mermaid_code"):
                result["mermaid_code"] = self._clean_mermaid_code(result["mermaid_code"])
            
            # Add metadata
            result["diagram_type"] = diagram_type
            result["diagram_type_info"] = DIAGRAM_TYPE_INFO.get(diagram_type, {})
            
            # Store in session state
            diagrams = session_state.get("generated_diagrams", [])
            diagrams.append(result)
            session_state["generated_diagrams"] = diagrams
            
            return {
                "success": True,
                "diagram": result,
                "session_state": session_state
            }
            
        except Exception as e:
            logger.error(f"Diagram generation failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "diagram_type": diagram_type
            }
    
    def generate_all_diagrams(
        self,
        document_text: str,
        diagram_types: List[str] = None
    ) -> Dict:
        """
        Generate multiple diagram types for a document.
        
        Args:
            document_text: Extracted text from the RFP document
            diagram_types: List of diagram types to generate (default: all)
            
        Returns:
            Dictionary with all generated diagrams
        """
        if diagram_types is None:
            diagram_types = [DiagramType.ARCHITECTURE, DiagramType.FLOWCHART, DiagramType.TIMELINE]
        
        session_state = {}
        results = []
        errors = []
        
        for dtype in diagram_types:
            result = self.generate_diagram(document_text, dtype, session_state)
            if result.get("success"):
                results.append(result["diagram"])
            else:
                errors.append({"type": dtype, "error": result.get("error")})
        
        return {
            "success": len(results) > 0,
            "diagrams": results,
            "errors": errors if errors else None,
            "total_generated": len(results),
            "total_failed": len(errors)
        }
    
    @with_retry(
        config=RetryConfig(max_attempts=3, initial_delay=1.0),
        fallback_models=['gemini-1.5-pro']
    )
    def _generate_with_ai(self, text: str, diagram_type: str) -> Dict:
        """Use AI to generate diagram code."""
        client = self.config.client
        if not client:
            raise ValueError("AI client not configured")
        
        prompt_template = self.PROMPTS[diagram_type]
        prompt = prompt_template.format(text=text[:20000])  # Limit text length
        
        try:
            if self.config.is_adk_enabled:
                from google import genai
                response = client.models.generate_content(
                    model=self.config.model_name,
                    contents=prompt
                )
                response_text = response.text
            else:
                response = client.generate_content(prompt)
                response_text = response.text
            
            # Clean and parse JSON
            response_text = response_text.strip()
            
            # Remove markdown code fences (```json or ``` at start/end)
            if response_text.startswith('```'):
                # Remove opening fence with optional language specifier
                response_text = re.sub(r'^```(?:json)?\s*\n?', '', response_text)
                # Remove closing fence
                response_text = re.sub(r'\n?```\s*$', '', response_text)
            
            # Also handle case where response starts with 'json' without backticks
            if response_text.strip().startswith('json'):
                response_text = re.sub(r'^json\s*', '', response_text.strip())
            
            response_text = response_text.strip()
            logger.info(f"Cleaned response (first 200 chars): {response_text[:200]}")
            
            return json.loads(response_text)
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}")
            logger.error(f"Failed to parse response: {response_text[:500]}")
            # Try to extract mermaid code from response
            return self._fallback_parse(response_text, diagram_type)
        except Exception as e:
            logger.error(f"AI generation error: {e}")
            raise
    
    def _fallback_parse(self, text: str, diagram_type: str) -> Dict:
        """Try to extract diagram from malformed response."""
        # Look for mermaid code block
        mermaid_match = re.search(r'```mermaid\n(.*?)```', text, re.DOTALL)
        if mermaid_match:
            return {
                "title": f"{DIAGRAM_TYPE_INFO[diagram_type]['name']}",
                "description": "Auto-extracted diagram",
                "mermaid_code": mermaid_match.group(1).strip(),
                "notes": "Diagram was extracted from AI response"
            }
        
        # Look for any code block
        code_match = re.search(r'```\n?(.*?)```', text, re.DOTALL)
        if code_match:
            return {
                "title": f"{DIAGRAM_TYPE_INFO[diagram_type]['name']}",
                "description": "Auto-extracted diagram",
                "mermaid_code": code_match.group(1).strip(),
                "notes": "Diagram was extracted from AI response"
            }
        
        raise ValueError("Could not parse AI response into diagram")
    
    def _clean_mermaid_code(self, code: str) -> str:
        """Clean and sanitize mermaid code for common syntax issues."""
        if not code:
            return code
            
        # Handle literal escaped newlines (\\n as two characters)
        code = code.replace('\\n', '\n')
        
        # Also handle double-escaped newlines (\\\\n)
        code = code.replace('\\\\n', '\n')
        
        # Remove any markdown code fences
        code = re.sub(r'^```(?:mermaid)?\n?', '', code)
        code = re.sub(r'\n?```$', '', code)
        
        # Fix common mermaid syntax issues
        code = self._sanitize_mermaid_syntax(code)
        
        # Ensure proper line breaks
        code = code.strip()
        
        logger.info(f"Cleaned mermaid code (first 100 chars): {code[:100]}")
        
        return code
    
    def _sanitize_mermaid_syntax(self, code: str) -> str:
        """Fix common mermaid syntax issues in AI-generated code."""
        logger.info(f"BEFORE sanitization: {code[:200]}")
        
        # Replace Unicode arrows with Mermaid-compatible arrows
        code = code.replace('→', '-->')
        code = code.replace('←', '<--')
        code = code.replace('↔', '<-->')
        code = code.replace('➡', '-->')
        code = code.replace('⬅', '<--')
        code = code.replace('⇒', '-->')
        code = code.replace('⇐', '<--')
        
        # Remove other problematic Unicode characters (but keep basic punctuation)
        code = re.sub(r'[^\x20-\x7E\n\r\t]', '', code)
        
        # Fix malformed connection lines with multiple arrows
        # e.g., "KU --> WA Accesses KU --> MA" becomes "KU --> WA" and "KU --> MA"
        lines = code.split('\n')
        fixed_lines = []
        
        for line in lines:
            stripped = line.strip()
            
            # Skip empty lines, comments, or keywords
            if not stripped or stripped.startswith('%') or stripped.startswith('flowchart') or stripped.startswith('subgraph') or stripped == 'end':
                fixed_lines.append(line)
                continue
            
            # Fix colon-based labels (invalid syntax like "A --> B: label" should be "A -->|label| B")
            # Pattern: NodeA --> NodeB: Some Label
            colon_label_match = re.match(r'^(\s*)(\S+)\s*(-->|<--|---)\s*(\S+):\s*(.+)$', stripped)
            if colon_label_match:
                indent = colon_label_match.group(1)
                node_a = colon_label_match.group(2)
                arrow = colon_label_match.group(3)
                node_b = colon_label_match.group(4)
                label = colon_label_match.group(5).strip()
                # Clean the label (remove special chars, limit length)
                label = re.sub(r'[^\w\s]', '', label)
                label = label[:30] if len(label) > 30 else label
                fixed_lines.append(f"{indent}{node_a} {arrow}|{label}| {node_b}")
                continue
            
            # Count arrows in the line
            arrow_count = stripped.count('-->') + stripped.count('<--') + stripped.count('---')
            
            if arrow_count > 1:
                # Multiple arrows - try to fix by splitting into valid connections
                # This handles cases like "A --> B --> C" which should be "A --> B" and "B --> C"
                parts = re.split(r'(-->|<--|---)', stripped)
                if len(parts) >= 3:
                    # Try to extract valid pairs
                    current_node = parts[0].strip()
                    for i in range(1, len(parts), 2):
                        if i + 1 < len(parts):
                            arrow = parts[i]
                            next_node = parts[i + 1].strip()
                            # Skip if node names contain invalid text
                            if current_node and next_node and len(current_node) < 50 and len(next_node) < 50:
                                fixed_lines.append(f"    {current_node} {arrow} {next_node}")
                                current_node = next_node
                else:
                    # Can't fix, skip this line
                    logger.warning(f"Skipping malformed line: {stripped}")
            else:
                fixed_lines.append(line)
        
        code = '\n'.join(fixed_lines)
        
        # Fix node labels - remove or escape problematic characters inside brackets
        def clean_node_label(match):
            prefix = match.group(1)  # Everything before the bracket content
            label = match.group(2)   # Content inside brackets
            suffix = match.group(3)  # Closing bracket
            
            # Clean the label:
            # 1. Remove parentheses and their content
            label = re.sub(r'\([^)]*\)', '', label)
            # 2. Replace colons with dashes (except in URLs)
            if 'http' not in label.lower():
                label = label.replace(':', ' -')
            # 3. Remove quotes
            label = label.replace('"', '').replace("'", '')
            # 4. Remove ampersands
            label = label.replace('&', 'and')
            # 5. Remove arrows inside labels
            label = label.replace('-->', '').replace('<--', '').replace('---', '')
            # 6. Limit length
            label = label.strip()
            if len(label) > 30:
                label = label[:27] + '...'
            # 7. Remove multiple spaces
            label = re.sub(r'\s+', ' ', label)
            
            return f"{prefix}{label}{suffix}"
        
        # Clean square bracket labels: [label]
        code = re.sub(r'(\[)([^\]]+)(\])', clean_node_label, code)
        
        # Clean curly bracket labels: {label}
        code = re.sub(r'(\{)([^\}]+)(\})', clean_node_label, code)
        
        # Clean double parentheses labels (mindmap root): ((label))
        code = re.sub(r'(\(\()([^)]+)(\)\))', clean_node_label, code)
        
        # Fix empty brackets
        code = re.sub(r'\[\s*\]', '[Node]', code)
        code = re.sub(r'\{\s*\}', '{Decision}', code)
        
        # Fix empty subgraph names
        code = re.sub(r'subgraph\s*\n', 'subgraph Group\n', code)
        code = re.sub(r'subgraph\s*$', 'subgraph Group', code)
        
        # Fix invalid node IDs (must start with letter or underscore)
        code = re.sub(r'^(\s*)(\d+)(\s*[\[\{])', r'\1node_\2\3', code, flags=re.MULTILINE)
        
        # Remove lines with only whitespace
        lines = code.split('\n')
        lines = [line for line in lines if line.strip()]
        
        # Join back and clean up excessive newlines
        code = '\n'.join(lines)
        code = re.sub(r'\n{3,}', '\n\n', code)
        
        logger.info(f"AFTER sanitization: {code[:200]}")
        
        return code
    
    def get_available_types(self) -> List[Dict]:
        """Get list of available diagram types with metadata."""
        return [
            {
                "id": dtype,
                **info
            }
            for dtype, info in DIAGRAM_TYPE_INFO.items()
        ]


def get_diagram_generator_agent(org_id: int = None) -> DiagramGeneratorAgent:
    """Factory function to get Diagram Generator Agent."""
    return DiagramGeneratorAgent(org_id=org_id)
