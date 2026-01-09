"""
Answer Generator Agent

Generates AI-powered answers for RFP questions using RAG approach.
Includes vendor profile context for personalized responses.
"""
import logging
import json
from typing import Dict, List, Any, Optional

from .config import get_agent_config, SessionKeys
from .utils import with_retry, RetryConfig  # NEW
from .vendor_profile_agent import get_vendor_context  # NEW

logger = logging.getLogger(__name__)


class AnswerGeneratorAgent:
    """
    Agent that generates answers for RFP questions.
    - Uses context from Knowledge Base Agent
    - Generates category-specific answers
    - Configurable tone and length
    """
    
    # Category-specific instructions
    CATEGORY_INSTRUCTIONS = {
        'security': """For security questions:
- Be precise about security claims
- Reference certifications (SOC 2, ISO 27001)
- Include encryption standards where relevant
- Never overstate capabilities""",
        
        'compliance': """For compliance questions:
- Reference frameworks accurately
- Be clear about certification status
- Note geographic/industry considerations""",
        
        'technical': """For technical questions:
- Provide specific technical details
- Include version numbers and standards
- Mention integration capabilities""",
        
        'pricing': """For pricing questions:
- Be clear about pricing structure
- Note variables affecting pricing
- Suggest contacting sales for quotes""",
        
        'legal': """For legal questions:
- Use cautious, precise language
- Avoid binding commitments
- Suggest involving legal teams""",
        
        'product': """For product questions:
- Focus on current capabilities
- Distinguish roadmap vs available now
- Reference documentation"""
    }
    
    # Answer format templates
    FORMAT_TEMPLATES = {
        'paragraph': {
            'description': 'Standard paragraph format for narrative answers',
            'instruction': 'Write the answer in clear, flowing paragraphs. Each paragraph should focus on one main point.',
            'best_for': ['explanations', 'descriptions', 'general responses']
        },
        'bullet': {
            'description': 'Bullet point format for lists and features',
            'instruction': 'Format the answer as bullet points. Start each point with a dash (-). Be concise but complete for each point.',
            'best_for': ['features', 'requirements', 'capabilities', 'multiple items']
        },
        'numbered': {
            'description': 'Numbered list for sequential steps or priorities',
            'instruction': 'Format the answer as a numbered list (1., 2., 3.). Use for sequential information or ranked items.',
            'best_for': ['processes', 'procedures', 'steps', 'prioritized items']
        },
        'table': {
            'description': 'Tabular format for comparisons or structured data',
            'instruction': 'Format the answer as a markdown table with clear headers. Use for comparisons or structured data.',
            'best_for': ['comparisons', 'specifications', 'matrices', 'structured data']
        },
        'hybrid': {
            'description': 'Mixed format with intro paragraph followed by bullet points',
            'instruction': 'Start with 1-2 introductory sentences, then provide details as bullet points.',
            'best_for': ['complex topics', 'detailed explanations', 'comprehensive responses']
        }
    }
    
    # Length estimation parameters  
    LENGTH_PARAMS = {
        'short': {'min_words': 30, 'max_words': 80, 'sentences': '1-2'},
        'medium': {'min_words': 80, 'max_words': 200, 'sentences': '3-5'},
        'long': {'min_words': 200, 'max_words': 500, 'sentences': '5-10'},
        'comprehensive': {'min_words': 400, 'max_words': 1000, 'sentences': '8-15'}
    }
    
    # Evidence-bound generation requirements (NEW)
    EVIDENCE_TYPES = {
        'architecture': ['architecture', 'system', 'infrastructure', 'platform', 'framework', 'integration'],
        'metric': ['%', 'hours', 'days', 'weeks', 'reduction', 'increase', 'improved', 'saved', 'achieved'],
        'delivery': ['phase', 'milestone', 'sprint', 'iteration', 'deployment', 'rollout', 'implementation'],
        'constraint': ['requirement', 'constraint', 'compliance', 'regulation', 'standard', 'certification'],
        'case_study': ['client', 'project', 'similar', 'previously', 'case', 'example', 'deployed']
    }
    
    # Anti-pattern phrases to avoid (NEW)
    ANTI_PATTERNS = [
        'comprehensive solution',
        'seamless integration',
        'best-in-class',
        'robust platform',
        'cutting-edge technology',
        'state-of-the-art',
        'world-class',
        'industry-leading',
        'innovative approach',
        'holistic solution',
        'end-to-end',
        'leverage synergies',
        'digital transformation journey',
        'paradigm shift',
        'value-added',
        'scalable and flexible',
        'proven track record',
        'unique value proposition'
    ]
    
    GENERATION_PROMPT = """You are an expert RFP response writer. Think step-by-step to generate accurate, well-sourced answers.

## NARRATIVE CONTEXT (Single Source of Truth)
{narrative_context}

## STEP 1: Understand the Question
Analyze what is being asked:
- Question: {question}
- Category: {category}
- Is it asking for: facts / capabilities / processes / compliance / pricing?

## STEP 2: Review Available Context
Knowledge Base Items:
{context}

Similar Approved Answers:
{similar_answers}

## STEP 3: Plan Your Response
{category_instructions}

Requirements:
- Tone: {tone}
- Length: {length_instruction}
- **IMPORTANT: Cite your sources using [Source: Document Name] format**
- Only make claims supported by the context above
- If information is missing, acknowledge limitations
- Match the style of similar approved answers

## STEP 4: Citation Guidelines
- When referencing specific facts or claims, cite the source: [Source: Knowledge Base Item Title]
- If referring to a previous approved answer, cite: [Source: Similar Answer]
- For claims without direct source, indicate: [Needs Verification]
- Always prefer cited claims over uncited ones

## STEP 5: Write the Answer
Based on your analysis, write a clear, accurate response WITH inline citations.
Do NOT include the step numbers or analysis in your final answer.
Write the answer directly, professionally, and concisely.

**OUTPUT FORMAT:**
Your answer text here with inline citations [Source: Document Name] where appropriate.

Sources Used:
- [List each source referenced]"""
    
    # Structured output format for better parsing - ENHANCED for enterprise grade
    STRUCTURED_OUTPUT_PROMPT = """Generate a response in the following JSON format:
{{
  "answer": "Your complete answer text with [Source: X] citations inline",
  "answer_format": "paragraph|bullet|numbered|table|hybrid",
  "word_count": 0,
  "sources_used": [
    {{"source_name": "Source 1", "source_type": "knowledge_base|vendor_profile|case_study|standard", "relevance": 0.0-1.0}}
  ],
  "confidence_score": 0.0-1.0,
  "confidence_level": "HIGH|MEDIUM|LOW",
  "confidence_reasoning": "Why this confidence level",
  "key_claims": [
    {{
      "claim": "Specific claim text",
      "source": "Source name or 'Needs Verification'",
      "verified": true/false,
      "claim_type": "factual|capability|metric|commitment"
    }}
  ],
  "evidence_types_used": ["architecture|metric|delivery|constraint|case_study"],
  "assumptions_made": [
    {{"assumption": "What was assumed", "impact_if_wrong": "What happens if this assumption is incorrect"}}
  ],
  "forbidden_phrases_check": {{
    "passed": true/false,
    "phrases_found": ["list of marketing buzzwords found"],
    "self_corrected": true/false
  }},
  "client_specificity": {{
    "client_name_used": true/false,
    "client_mentions": 0,
    "constraints_acknowledged": ["list of client constraints addressed"]
  }},
  "quality_self_assessment": {{
    "specificity_score": 0-100,
    "evidence_density": 0-100,
    "actionability": 0-100,
    "overall_grade": "A|B|C|D|F"
  }},
  "limitations": "Any limitations or missing information",
  "needs_review": true/false,
  "review_reason": "Why manual review is needed (if applicable)"
}}
"""

    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='answer_generation')
        self.name = "AnswerGeneratorAgent"
        self._narrative_context = None
    
    def generate_answers(
        self,
        questions: List[Dict] = None,
        knowledge_context: Dict = None,
        tone: str = "professional",
        length: str = "medium",
        session_state: Dict = None,
        narrative_context: Dict = None
    ) -> Dict:
        """
        Generate answers for questions using context.
        
        Args:
            questions: List of questions to answer
            knowledge_context: Context mapping from Knowledge Base Agent
            tone: professional, formal, or friendly
            length: short, medium, or long
            session_state: Shared state
            narrative_context: Context from ProposalNarrativeArchitectAgent (P0)
            
        Returns:
            Generated answers with metadata
        """
        session_state = session_state or {}
        
        # Get data from session if not provided
        questions = questions or session_state.get(SessionKeys.EXTRACTED_QUESTIONS, [])
        knowledge_context = knowledge_context or session_state.get(SessionKeys.KNOWLEDGE_CONTEXT, {})
        
        # Get narrative context from session if not provided directly
        narrative_context = narrative_context or session_state.get('narrative_context', {})
        self._narrative_context = narrative_context
        
        if not questions:
            return {"success": False, "error": "No questions to answer"}
        
        draft_answers = []
        
        for question in questions:
            q_id = question.get("id", 0)
            q_text = question.get("text", "")
            q_category = question.get("category", "general")
            
            # Get context for this question
            q_context = knowledge_context.get(q_id, {})
            
            try:
                answer = self._generate_answer(
                    question=q_text,
                    category=q_category,
                    context=q_context,
                    tone=tone,
                    length=length,
                    narrative_context=narrative_context,
                    organization_id=session_state.get('organization_id')  # NEW
                )
            except Exception as e:
                logger.error(f"Answer generation failed for question {q_id}: {e}")
                answer = {
                    "content": f"[Error generating answer: {str(e)}]",
                    "confidence": 0.0,
                    "flags": ["generation_error"]
                }
            
            draft_answers.append({
                "question_id": q_id,
                "question_text": q_text,
                "category": q_category,
                "answer": answer["content"],
                "confidence_score": answer.get("confidence", 0.5),
                "flags": answer.get("flags", []),
                "sources": q_context.get("knowledge_items", [])[:3],
                "narrative_aligned": bool(narrative_context)
            })
        
        # Store in session state
        session_state[SessionKeys.DRAFT_ANSWERS] = draft_answers
        
        # Add agent message
        messages = session_state.get(SessionKeys.AGENT_MESSAGES, [])
        high_confidence = len([a for a in draft_answers if a["confidence_score"] >= 0.7])
        messages.append({
            "agent": self.name,
            "action": "answers_generated",
            "summary": f"Generated {len(draft_answers)} answers ({high_confidence} high confidence)"
        })
        session_state[SessionKeys.AGENT_MESSAGES] = messages
        
        return {
            "success": True,
            "answers": draft_answers,
            "stats": {
                "total": len(draft_answers),
                "high_confidence": high_confidence,
                "needs_review": len([a for a in draft_answers if a["confidence_score"] < 0.5])
            },
            "session_state": session_state
        }
    
    @with_retry(
        config=RetryConfig(max_attempts=2, initial_delay=0.5),
        fallback_models=['gemini-1.5-pro']
    )
    def _generate_answer(
        self,
        question: str,
        category: str,
        context: Dict,
        tone: str,
        length: str,
        narrative_context: Dict = None,
        organization_id: int = None
    ) -> Dict:
        """Generate a single answer with narrative grounding and vendor context."""
        client = self.config.client
        if not client:
            return self._placeholder_answer(question)
        
        # Format knowledge context
        knowledge_items = context.get("knowledge_items", [])
        context_text = "\n\n".join([
            f"[{item['title']}] {item['content']}"
            for item in knowledge_items
        ]) if knowledge_items else "No specific context available."
        
        # Format similar answers
        similar = context.get("similar_answers", [])
        similar_text = "\n\n".join([
            f"Q: {s['question_text'][:100]}...\nA: {s['answer_content']}"
            for s in similar
        ]) if similar else "No similar answers available."
        
        # Get vendor profile context (NEW)
        vendor_context = ""
        if organization_id:
            try:
                rfp_context = {
                    'category': category,
                    'question': question
                }
                vendor_context = get_vendor_context(organization_id, rfp_context)
            except Exception as e:
                logger.warning(f"Failed to load vendor context: {e}")
        
        # Length instruction
        length_map = {
            'short': 'Keep answer to 2-3 sentences.',
            'medium': 'Provide balanced answer, 4-6 sentences.',
            'long': 'Provide detailed answer with examples.'
        }
        
        # Build narrative context section
        narrative_text = self._format_narrative_context(narrative_context)
        
        # Enhanced prompt with vendor context
        prompt_parts = [
            f"Question: {question}",
            f"\nCategory: {category}",
            self.CATEGORY_INSTRUCTIONS.get(category, ""),
            f"\n\n{length_map.get(length, length_map['medium'])}",
            f"Tone: {tone}",
        ]
        
        if vendor_context:
            prompt_parts.append(f"\n\nVENDOR PROFILE CONTEXT:\n{vendor_context}")
            prompt_parts.append("\nIMPORTANT: Use the vendor profile information above to personalize your answer. Reference specific clients, success stories, or capabilities when relevant to the question.")
        
        if narrative_text:
            prompt_parts.append(f"\n\nNARRATIVE CONTEXT:\n{narrative_text}")
        
        prompt_parts.extend([
            f"\n\nKNOWLEDGE BASE CONTEXT:\n{context_text}",
            f"\n\nSIMILAR PAST ANSWERS:\n{similar_text}",
            "\n\nGenerate a comprehensive, evidence-based answer that:"
            "\n- Directly addresses the question"
            "\n- Uses vendor profile examples where relevant (clients, success stories, metrics)"
            "\n- Maintains narrative consistency"
            "\n- Includes specific details from the knowledge base"
            "\n- Sounds authentic and personalized to our company"
        ])
        
        prompt = "\n".join(prompt_parts)
        
        try:
            if self.config.is_adk_enabled:
                response = client.models.generate_content(
                    model=self.config.model_name,
                    contents=prompt
                )
                content = response.text
            else:
                response = client.generate_content(prompt)
                content = response.text
            
            # Calculate confidence
            confidence = self._calculate_confidence(context, similar)
            flags = []
            if confidence < 0.5:
                flags.extend(["low_confidence", "needs_review"])
            elif confidence < 0.7:
                flags.append("review_recommended")
            
            return {
                "content": content.strip(),
                "confidence": confidence,
                "flags": flags
            }
            
        except Exception as e:
            logger.error(f"Generation error: {e}")
            return self._placeholder_answer(question)
    
    def _calculate_confidence(self, context: Dict, similar: List) -> float:
        """Calculate confidence score based on context quality."""
        score = 0.4  # Base
        
        knowledge_items = context.get("knowledge_items", [])
        if knowledge_items:
            max_relevance = max(item.get("relevance", 0) for item in knowledge_items)
            if max_relevance > 0.8:
                score += 0.2
            if len(knowledge_items) >= 3:
                score += 0.1
        
        if similar:
            max_similarity = max(s.get("similarity_score", 0) for s in similar)
            if max_similarity > 0.85:
                score += 0.25
        
        return min(1.0, round(score, 2))
    
    def _placeholder_answer(self, question: str) -> Dict:
        """Return placeholder when AI is unavailable."""
        return {
            "content": f"[AI service unavailable. Question: {question[:100]}...]",
            "confidence": 0.0,
            "flags": ["ai_unavailable", "needs_manual_answer"]
        }
    
    def _format_narrative_context(self, narrative_context: Dict) -> str:
        """Format narrative context for prompt injection."""
        if not narrative_context:
            return "No narrative context available. Generate a professional, balanced response."
        
        lines = []
        
        client_name = narrative_context.get('client_name', 'Client')
        lines.append(f"Client: {client_name}")
        
        if narrative_context.get('core_problem'):
            lines.append(f"Core Problem: {narrative_context['core_problem']}")
        
        if narrative_context.get('solution_thesis'):
            lines.append(f"Solution Thesis: {narrative_context['solution_thesis']}")
        
        # Value pillars
        pillars = narrative_context.get('value_pillars', [])
        if pillars:
            pillar_names = [p.get('pillar', '') for p in pillars[:3] if p.get('pillar')]
            if pillar_names:
                lines.append(f"Value Pillars: {', '.join(pillar_names)}")
        
        # Constraints
        constraints = narrative_context.get('client_constraints', [])
        if constraints:
            lines.append(f"Client Constraints: {', '.join(constraints[:3])}")
        
        # Tone
        tone_directive = narrative_context.get('tone_directive', {})
        if tone_directive:
            voice = tone_directive.get('voice', 'professional')
            style = tone_directive.get('style', 'consultative')
            lines.append(f"Tone: {voice}, {style}")
            
            avoid = tone_directive.get('avoid', [])
            if avoid:
                lines.append(f"AVOID these phrases: {', '.join(avoid[:5])}")
        
        lines.append(f"\nREQUIRED: Reference {client_name} by name and acknowledge constraints where relevant.")
        
        return '\n'.join(lines)
    
    def validate_evidence_density(self, content: str) -> Dict[str, Any]:
        """
        Validate that answer contains sufficient evidence.
        
        Every paragraph should include at least one of:
        - Architecture reference
        - Metric or number
        - Delivery method
        - Constraint acknowledgement
        
        Returns validation result with evidence types found.
        """
        content_lower = content.lower()
        evidence_found = {}
        
        for evidence_type, keywords in self.EVIDENCE_TYPES.items():
            matches = [kw for kw in keywords if kw.lower() in content_lower]
            if matches:
                evidence_found[evidence_type] = matches
        
        # Calculate evidence density score
        total_types = len(self.EVIDENCE_TYPES)
        found_types = len(evidence_found)
        density_score = found_types / total_types
        
        # Check paragraph-level evidence (simplified)
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
        paragraphs_with_evidence = 0
        
        for para in paragraphs:
            para_lower = para.lower()
            has_evidence = False
            for keywords in self.EVIDENCE_TYPES.values():
                if any(kw.lower() in para_lower for kw in keywords):
                    has_evidence = True
                    break
            if has_evidence:
                paragraphs_with_evidence += 1
        
        paragraph_coverage = paragraphs_with_evidence / len(paragraphs) if paragraphs else 0
        
        return {
            'evidence_found': evidence_found,
            'evidence_types_count': found_types,
            'density_score': round(density_score, 2),
            'paragraphs_checked': len(paragraphs),
            'paragraphs_with_evidence': paragraphs_with_evidence,
            'paragraph_coverage': round(paragraph_coverage, 2),
            'sufficient_evidence': density_score >= 0.4 and paragraph_coverage >= 0.5,
            'recommendation': 'Pass' if density_score >= 0.4 else 'Add more evidence (metrics, architecture, case studies)'
        }
    
    def detect_anti_patterns(self, content: str) -> Dict[str, Any]:
        """
        Detect generic/anti-pattern phrases that reduce proposal quality.
        
        Returns list of anti-patterns found and quality assessment.
        """
        content_lower = content.lower()
        patterns_found = []
        
        for pattern in self.ANTI_PATTERNS:
            if pattern.lower() in content_lower:
                patterns_found.append(pattern)
        
        # Calculate quality penalty
        quality_penalty = len(patterns_found) * 0.1
        quality_score = max(0, 1.0 - quality_penalty)
        
        # Determine severity
        if len(patterns_found) == 0:
            severity = 'none'
            recommendation = 'Content is free of generic phrases'
        elif len(patterns_found) <= 2:
            severity = 'low'
            recommendation = f'Remove generic phrases: {", ".join(patterns_found)}'
        elif len(patterns_found) <= 4:
            severity = 'medium'
            recommendation = f'Content has too many generic phrases. Rewrite with specifics.'
        else:
            severity = 'high'
            recommendation = 'Content appears AI-generated. Major rewrite needed with client-specific details.'
        
        return {
            'patterns_found': patterns_found,
            'count': len(patterns_found),
            'quality_score': round(quality_score, 2),
            'severity': severity,
            'recommendation': recommendation,
            'passes_quality_check': len(patterns_found) <= 2
        }
    
    def validate_answer(self, content: str, client_name: str = None) -> Dict[str, Any]:
        """
        Comprehensive answer validation combining all checks.
        
        Returns overall validation result with recommendations.
        """
        evidence_result = self.validate_evidence_density(content)
        anti_pattern_result = self.detect_anti_patterns(content)
        
        # Check client name usage
        client_referenced = False
        client_count = 0
        if client_name:
            client_count = content.lower().count(client_name.lower())
            client_referenced = client_count > 0
        
        # Calculate overall score
        overall_score = (
            evidence_result['density_score'] * 0.4 +
            anti_pattern_result['quality_score'] * 0.4 +
            (0.2 if client_referenced else 0)
        )
        
        # Determine if answer needs regeneration
        needs_regeneration = (
            not evidence_result['sufficient_evidence'] or
            not anti_pattern_result['passes_quality_check'] or
            (client_name and not client_referenced)
        )
        
        return {
            'overall_score': round(overall_score, 2),
            'passes_validation': not needs_regeneration,
            'needs_regeneration': needs_regeneration,
            'evidence': evidence_result,
            'anti_patterns': anti_pattern_result,
            'client_reference': {
                'name': client_name,
                'referenced': client_referenced,
                'count': client_count
            },
            'recommendations': self._build_recommendations(
                evidence_result, anti_pattern_result, client_referenced, client_name
            )
        }
    
    def _build_recommendations(
        self, 
        evidence: Dict, 
        anti_patterns: Dict,
        client_referenced: bool,
        client_name: str
    ) -> List[str]:
        """Build list of improvement recommendations."""
        recommendations = []
        
        if not evidence['sufficient_evidence']:
            recommendations.append(evidence['recommendation'])
        
        if not anti_patterns['passes_quality_check']:
            recommendations.append(anti_patterns['recommendation'])
        
        if client_name and not client_referenced:
            recommendations.append(f'Add reference to {client_name} by name')
        
        if not recommendations:
            recommendations.append('Answer meets quality standards')
        
        return recommendations
    
    def regenerate_answer(
        self,
        question: Dict,
        original_answer: str,
        improvement_hints: List[str] = None,
        narrative_context: Dict = None,
        session_state: Dict = None
    ) -> Dict:
        """
        Regenerate an answer with specific improvement hints.
        
        Used by auto-regeneration loop for low-scoring sections.
        
        Args:
            question: Original question dict
            original_answer: The original answer that needs improvement
            improvement_hints: List of specific issues to address
            narrative_context: Narrative context for coherence
            session_state: Current session state
            
        Returns:
            Dict with regenerated answer
        """
        try:
            question_text = question.get('text', str(question))
            category = question.get('category', 'general')
            
            # Build improvement prompt
            hints_text = "\n".join(improvement_hints or [])
            default_hints = "- Make content more specific\n- Add evidence and examples\n- Remove generic language"
            issues_to_fix = hints_text if hints_text else default_hints
            narrative_text = self._format_narrative_context(narrative_context) if narrative_context else "Focus on client value and specificity"
            
            regeneration_prompt = f"""You are a Senior Proposal Expert. Your previous answer scored LOW and needs improvement.

## Original Question
{question_text}

## Previous Answer (NEEDS IMPROVEMENT)
{original_answer[:1500]}...

## Issues to Fix
{issues_to_fix}

## Narrative Context
{narrative_text}

## Your Task
Rewrite the answer to address ALL the issues above.

Requirements:
- Add specific evidence, metrics, or examples
- Remove generic phrases like "leveraging", "state-of-the-art", "robust solution"
- Reference the client context where appropriate
- Be concrete and actionable

Generate the improved answer (NO explanation, just the content):"""

            client = self.config.client
            
            if self.config.is_adk_enabled:
                response = client.models.generate_content(
                    model=self.config.model_name,
                    contents=regeneration_prompt
                )
                answer = response.text.strip()
            elif client:
                response = client.generate_content(regeneration_prompt)
                answer = response.text.strip()
            else:
                # Fallback
                return {
                    'success': False,
                    'answer': original_answer,
                    'reason': 'No AI client available'
                }
            
            return {
                'success': True,
                'answer': answer,
                'regenerated': True,
                'hints_applied': improvement_hints or []
            }
            
        except Exception as e:
            logger.error(f"Answer regeneration failed: {e}")
            return {
                'success': False,
                'answer': original_answer,
                'error': str(e)
            }


def get_answer_generator_agent(org_id: int = None) -> AnswerGeneratorAgent:
    """Factory function to get Answer Generator Agent."""
    return AnswerGeneratorAgent(org_id=org_id)

