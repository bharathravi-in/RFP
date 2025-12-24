"""
Answer Validator Agent

Cross-verifies AI-generated answers against knowledge base to prevent hallucinations
and ensure factual accuracy.
"""
import logging
import json
import re
from typing import Dict, List, Any

from .config import get_agent_config, SessionKeys
from .utils import with_retry, RetryConfig

logger = logging.getLogger(__name__)


class AnswerValidatorAgent:
    """
    Agent that validates generated answers against knowledge sources.
    - Extracts claims from generated answers
    - Verifies each claim against knowledge base
    - Calculates factual accuracy score
    - Flags unverified claims for review
    - Suggests revisions to remove hallucinations
    """
    
    CLAIM_EXTRACTION_PROMPT = """Analyze this RFP answer and extract all factual claims that can be verified.

## Generated Answer
{answer}

## Task
Extract every specific, verifiable claim from this answer. A claim is a statement that:
- Asserts a fact about capabilities, features, or compliance
- Makes a quantitative statement (numbers, percentages, timeframes)
- References certifications, standards, or regulations
- States policy or process details

Do NOT include:
- Generic introductory phrases
- Transitional language
- Obvious statements everyone knows

## Response Format (JSON only)
{{
  "claims": [
    {{
      "claim_text": "Exact claim from the answer",
      "claim_type": "capability|quantitative|certification|policy|process|general",
      "importance": "critical|high|medium|low",
      "verification_needed": true/false
    }}
  ],
  "total_claims": 0,
  "critical_claims_count": 0
}}

Return ONLY valid JSON."""

    VERIFICATION_PROMPT = """Verify if this claim is supported by the provided knowledge context.

## Claim to Verify
{claim}

## Knowledge Context
{context}

## Task
Determine if the claim is:
1. VERIFIED - Directly supported by the context
2. PARTIALLY_VERIFIED - Related information exists but not exact match
3. UNVERIFIED - No supporting information found
4. CONTRADICTED - Context contradicts this claim

## Response Format (JSON only)
{{
  "status": "verified|partially_verified|unverified|contradicted",
  "confidence": 0.0-1.0,
  "supporting_evidence": "Quote from context if found",
  "explanation": "Why this determination was made",
  "suggested_revision": "How to fix if unverified or contradicted"
}}

Return ONLY valid JSON."""

    REVISION_PROMPT = """Revise this RFP answer to remove or qualify unverified claims.

## Original Answer
{answer}

## Unverified Claims
{unverified_claims}

## Verified Claims to Keep
{verified_claims}

## Knowledge Context
{context}

## Task
Rewrite the answer to:
1. Keep all verified claims intact
2. Remove or qualify unverified claims
3. Add "[Needs Verification]" marker for claims that could be true but lack evidence
4. Maintain professional tone and coherence
5. Keep the revised answer roughly the same length

Return ONLY the revised answer text, no JSON or formatting."""

    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='answer_generation')
        self.name = "AnswerValidatorAgent"
    
    def validate_answers(
        self,
        answers: List[Dict] = None,
        knowledge_context: Dict = None,
        session_state: Dict = None
    ) -> Dict:
        """
        Validate generated answers against knowledge base.
        
        Args:
            answers: List of generated answers to validate
            knowledge_context: Context from Knowledge Base Agent
            session_state: Shared state
            
        Returns:
            Validated answers with accuracy scores and revisions
        """
        session_state = session_state or {}
        
        # Get data from session if not provided
        answers = answers or session_state.get(SessionKeys.DRAFT_ANSWERS, [])
        knowledge_context = knowledge_context or session_state.get(SessionKeys.KNOWLEDGE_CONTEXT, {})
        
        if not answers:
            return {"success": False, "error": "No answers to validate"}
        
        validated_answers = []
        total_claims = 0
        verified_claims = 0
        unverified_claims = 0
        
        for answer in answers:
            q_id = answer.get("question_id", 0)
            answer_text = answer.get("answer", "")
            q_context = knowledge_context.get(q_id, {})
            
            try:
                validation = self._validate_single_answer(answer_text, q_context)
                
                # Track stats
                claims = validation.get("claims", [])
                total_claims += len(claims)
                verified_claims += len([c for c in claims if c.get("status") == "verified"])
                unverified_claims += len([c for c in claims if c.get("status") == "unverified"])
                
                # Add validation results to answer
                validated_answer = {
                    **answer,
                    "validation": {
                        "accuracy_score": validation.get("accuracy_score", 0.5),
                        "claims_analyzed": len(claims),
                        "verified_claims": len([c for c in claims if c.get("status") == "verified"]),
                        "unverified_claims": len([c for c in claims if c.get("status") == "unverified"]),
                        "contradicted_claims": len([c for c in claims if c.get("status") == "contradicted"]),
                        "claims_detail": claims
                    },
                    "validated_answer": validation.get("revised_answer", answer_text),
                    "validation_flags": validation.get("flags", [])
                }
                
                validated_answers.append(validated_answer)
                
            except Exception as e:
                logger.error(f"Validation failed for answer {q_id}: {e}")
                validated_answers.append({
                    **answer,
                    "validation": {"error": str(e), "accuracy_score": 0.5},
                    "validation_flags": ["validation_error"]
                })
        
        # Store in session state
        session_state["validated_answers"] = validated_answers
        
        # Add agent message
        messages = session_state.get(SessionKeys.AGENT_MESSAGES, [])
        accuracy = verified_claims / total_claims if total_claims > 0 else 0
        messages.append({
            "agent": self.name,
            "action": "answers_validated",
            "summary": f"Validated {len(validated_answers)} answers ({verified_claims}/{total_claims} claims verified, {accuracy:.0%} accuracy)"
        })
        session_state[SessionKeys.AGENT_MESSAGES] = messages
        
        return {
            "success": True,
            "validated_answers": validated_answers,
            "stats": {
                "total_answers": len(validated_answers),
                "total_claims": total_claims,
                "verified_claims": verified_claims,
                "unverified_claims": unverified_claims,
                "overall_accuracy": round(accuracy, 2)
            },
            "session_state": session_state
        }
    
    def _validate_single_answer(self, answer: str, context: Dict) -> Dict:
        """Validate a single answer against its context."""
        client = self.config.client
        if not client:
            return self._fallback_validation(answer, context)
        
        # Step 1: Extract claims from the answer
        claims = self._extract_claims(answer)
        if not claims:
            return {
                "accuracy_score": 1.0,
                "claims": [],
                "revised_answer": answer,
                "flags": []
            }
        
        # Step 2: Verify each claim against context
        verified_list = []
        for claim in claims:
            verification = self._verify_claim(claim, context)
            verified_list.append({**claim, **verification})
        
        # Step 3: Calculate accuracy score
        if verified_list:
            verified_count = len([c for c in verified_list if c.get("status") == "verified"])
            partial_count = len([c for c in verified_list if c.get("status") == "partially_verified"])
            accuracy = (verified_count + 0.5 * partial_count) / len(verified_list)
        else:
            accuracy = 1.0
        
        # Step 4: Generate revised answer if needed
        unverified = [c for c in verified_list if c.get("status") in ["unverified", "contradicted"]]
        if unverified:
            revised = self._generate_revised_answer(answer, verified_list, context)
            flags = ["has_unverified_claims"]
            if any(c.get("status") == "contradicted" for c in verified_list):
                flags.append("has_contradicted_claims")
        else:
            revised = answer
            flags = []
        
        return {
            "accuracy_score": round(accuracy, 2),
            "claims": verified_list,
            "revised_answer": revised,
            "flags": flags
        }
    
    @with_retry(
        config=RetryConfig(max_attempts=2, initial_delay=0.5),
        fallback_models=['gemini-1.5-pro']
    )
    def _extract_claims(self, answer: str) -> List[Dict]:
        """Extract verifiable claims from answer text."""
        client = self.config.client
        if not client:
            return []
        
        prompt = self.CLAIM_EXTRACTION_PROMPT.format(answer=answer)
        
        try:
            if self.config.is_adk_enabled:
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
                response_text = re.sub(r'^```(?:json)?\n?', '', response_text)
                response_text = re.sub(r'\n?```$', '', response_text)
            
            result = json.loads(response_text)
            return result.get("claims", [])
            
        except Exception as e:
            logger.error(f"Claim extraction error: {e}")
            return []
    
    def _verify_claim(self, claim: Dict, context: Dict) -> Dict:
        """Verify a single claim against context."""
        client = self.config.client
        if not client:
            return {"status": "unverified", "confidence": 0.0}
        
        # Format context
        knowledge_items = context.get("knowledge_items", [])
        similar_answers = context.get("similar_answers", [])
        
        context_text = "\n\n".join([
            f"[{item.get('title', 'Knowledge')}]: {item.get('content', '')}"
            for item in knowledge_items
        ])
        
        if similar_answers:
            context_text += "\n\n### Similar Approved Answers:\n"
            context_text += "\n".join([
                f"- {s.get('answer_content', '')[:300]}"
                for s in similar_answers
            ])
        
        if not context_text.strip():
            context_text = "No context available for verification."
        
        prompt = self.VERIFICATION_PROMPT.format(
            claim=claim.get("claim_text", ""),
            context=context_text
        )
        
        try:
            if self.config.is_adk_enabled:
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
                response_text = re.sub(r'^```(?:json)?\n?', '', response_text)
                response_text = re.sub(r'\n?```$', '', response_text)
            
            return json.loads(response_text)
            
        except Exception as e:
            logger.error(f"Claim verification error: {e}")
            return {"status": "unverified", "confidence": 0.0}
    
    def _generate_revised_answer(
        self,
        original: str,
        claims: List[Dict],
        context: Dict
    ) -> str:
        """Generate revised answer with unverified claims addressed."""
        client = self.config.client
        if not client:
            return original
        
        verified = [c for c in claims if c.get("status") == "verified"]
        unverified = [c for c in claims if c.get("status") in ["unverified", "contradicted"]]
        
        # Format context
        knowledge_items = context.get("knowledge_items", [])
        context_text = "\n".join([
            f"- {item.get('content', '')[:200]}"
            for item in knowledge_items
        ]) if knowledge_items else "No context available."
        
        prompt = self.REVISION_PROMPT.format(
            answer=original,
            unverified_claims=json.dumps([c.get("claim_text", "") for c in unverified], indent=2),
            verified_claims=json.dumps([c.get("claim_text", "") for c in verified], indent=2),
            context=context_text
        )
        
        try:
            if self.config.is_adk_enabled:
                response = client.models.generate_content(
                    model=self.config.model_name,
                    contents=prompt
                )
                return response.text.strip()
            else:
                response = client.generate_content(prompt)
                return response.text.strip()
                
        except Exception as e:
            logger.error(f"Answer revision error: {e}")
            return original
    
    def _fallback_validation(self, answer: str, context: Dict) -> Dict:
        """Fallback validation when AI is unavailable."""
        # Simple heuristic validation
        knowledge_items = context.get("knowledge_items", [])
        
        # Check if answer seems grounded in context
        if not knowledge_items:
            return {
                "accuracy_score": 0.3,
                "claims": [],
                "revised_answer": answer,
                "flags": ["no_context_available"]
            }
        
        # Basic keyword overlap check
        context_text = " ".join([item.get("content", "") for item in knowledge_items]).lower()
        answer_words = set(answer.lower().split())
        context_words = set(context_text.split())
        overlap = len(answer_words & context_words) / len(answer_words) if answer_words else 0
        
        return {
            "accuracy_score": min(0.8, 0.4 + overlap),
            "claims": [],
            "revised_answer": answer,
            "flags": ["fallback_validation"]
        }


def get_answer_validator_agent(org_id: int = None) -> AnswerValidatorAgent:
    """Factory function to get Answer Validator Agent."""
    return AnswerValidatorAgent(org_id=org_id)
