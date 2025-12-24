"""
Feedback Learning Agent

Learns from user edits to AI-generated answers to improve future responses.
Tracks patterns in corrections and provides context for better generation.
"""
import logging
import json
import re
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import get_agent_config, SessionKeys
from .utils import with_retry, RetryConfig

logger = logging.getLogger(__name__)


class FeedbackLearningAgent:
    """
    Agent that learns from user feedback and edits.
    - Tracks edits made to AI-generated answers
    - Identifies patterns in corrections
    - Provides learned context for future answer generation
    - Stores improvement suggestions by category
    """
    
    ANALYSIS_PROMPT = """Analyze the differences between the original AI-generated answer and the user's edited version.

## Original Answer
{original}

## User's Edited Answer
{edited}

## Question Context
Question: {question}
Category: {category}

## Task
Identify what the user changed and why. Extract learnable patterns.

Consider:
1. **Tone Changes**: Did they adjust formality, confidence levels?
2. **Content Additions**: What information did they add?
3. **Content Removals**: What did they remove (likely inaccurate or irrelevant)?
4. **Structural Changes**: Did they reorganize the response?
5. **Terminology Changes**: Did they use different/preferred terms?
6. **Specificity**: Did they make it more/less specific?

## Response Format (JSON only)
{{
  "change_types": ["tone", "content_addition", "content_removal", "structure", "terminology", "specificity"],
  "key_learnings": [
    {{
      "pattern": "Description of what to learn",
      "applies_to": "category or 'all'",
      "confidence": 0.0-1.0,
      "example_before": "Original text snippet",
      "example_after": "Edited text snippet"
    }}
  ],
  "terminology_preferences": [
    {{"avoid": "term to avoid", "prefer": "preferred term"}}
  ],
  "tone_adjustment": "more_formal|less_formal|more_confident|less_confident|none",
  "content_gaps_identified": ["Topics user needed to add"],
  "accuracy_issues": ["Claims that were removed or corrected"],
  "overall_feedback_quality": 0.0-1.0
}}

Return ONLY valid JSON."""

    def __init__(self, org_id: int = None):
        self.config = get_agent_config(org_id=org_id, agent_type='answer_generation')
        self.name = "FeedbackLearningAgent"
        self.org_id = org_id
    
    def analyze_edit(
        self,
        original_answer: str,
        edited_answer: str,
        question_text: str,
        category: str = "general",
        question_id: int = None
    ) -> Dict:
        """
        Analyze a single user edit to extract learnings.
        
        Args:
            original_answer: AI-generated answer
            edited_answer: User's edited version
            question_text: The original question
            category: Question category
            question_id: Optional question ID for tracking
            
        Returns:
            Analysis results with learnable patterns
        """
        # Quick check if there were meaningful edits
        if self._similarity_score(original_answer, edited_answer) > 0.95:
            return {
                "success": True,
                "learnings": [],
                "message": "Minimal edits - no significant patterns to learn"
            }
        
        try:
            analysis = self._analyze_with_ai(
                original=original_answer,
                edited=edited_answer,
                question=question_text,
                category=category
            )
            
            # Store learnings in database
            if analysis.get("key_learnings"):
                self._store_learnings(analysis, category, question_id)
            
            return {
                "success": True,
                "analysis": analysis,
                "learnings_count": len(analysis.get("key_learnings", [])),
                "stored": True
            }
            
        except Exception as e:
            logger.error(f"Edit analysis failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "analysis": self._fallback_analysis(original_answer, edited_answer)
            }
    
    def get_learned_context(
        self,
        category: str = None,
        limit: int = 5
    ) -> Dict:
        """
        Get learned patterns for a category to include in prompts.
        
        Args:
            category: Question category to get patterns for
            limit: Maximum patterns to return
            
        Returns:
            Context with learned patterns and preferences
        """
        learnings = self._get_stored_learnings(category, limit)
        
        if not learnings:
            return {
                "has_learnings": False,
                "context_text": ""
            }
        
        # Format learnings as prompt context
        context_parts = []
        
        # Terminology preferences
        terminology = [l for l in learnings if l.get("type") == "terminology"]
        if terminology:
            context_parts.append("**Terminology Preferences:**")
            for t in terminology[:3]:
                context_parts.append(f"- Prefer '{t.get('prefer')}' over '{t.get('avoid')}'")
        
        # Tone preferences
        tone_learnings = [l for l in learnings if l.get("type") == "tone"]
        if tone_learnings:
            most_common = max(set([t.get("adjustment") for t in tone_learnings]), 
                            key=[t.get("adjustment") for t in tone_learnings].count)
            context_parts.append(f"\n**Tone Preference:** {most_common.replace('_', ' ')}")
        
        # Content patterns
        content_learnings = [l for l in learnings if l.get("type") == "content"]
        if content_learnings:
            context_parts.append("\n**Content Patterns Learned:**")
            for c in content_learnings[:3]:
                context_parts.append(f"- {c.get('pattern', 'No pattern')}")
        
        return {
            "has_learnings": True,
            "learnings_count": len(learnings),
            "context_text": "\n".join(context_parts),
            "raw_learnings": learnings
        }
    
    def bulk_analyze_edits(
        self,
        edits: List[Dict]
    ) -> Dict:
        """
        Analyze multiple edits to find patterns.
        
        Args:
            edits: List of {original, edited, question, category}
            
        Returns:
            Aggregated patterns across edits
        """
        all_learnings = []
        processed = 0
        
        for edit in edits:
            result = self.analyze_edit(
                original_answer=edit.get("original", ""),
                edited_answer=edit.get("edited", ""),
                question_text=edit.get("question", ""),
                category=edit.get("category", "general")
            )
            
            if result.get("success"):
                all_learnings.extend(result.get("analysis", {}).get("key_learnings", []))
                processed += 1
        
        # Aggregate patterns
        aggregated = self._aggregate_learnings(all_learnings)
        
        return {
            "success": True,
            "edits_processed": processed,
            "total_learnings": len(all_learnings),
            "aggregated_patterns": aggregated
        }
    
    @with_retry(
        config=RetryConfig(max_attempts=2, initial_delay=0.5),
        fallback_models=['gemini-1.5-pro']
    )
    def _analyze_with_ai(
        self,
        original: str,
        edited: str,
        question: str,
        category: str
    ) -> Dict:
        """Use AI to analyze the edit."""
        client = self.config.client
        if not client:
            return self._fallback_analysis(original, edited)
        
        prompt = self.ANALYSIS_PROMPT.format(
            original=original,
            edited=edited,
            question=question,
            category=category
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
            logger.error(f"AI analysis error: {e}")
            return self._fallback_analysis(original, edited)
    
    def _fallback_analysis(self, original: str, edited: str) -> Dict:
        """Simple fallback analysis without AI."""
        # Calculate basic metrics
        original_words = set(original.lower().split())
        edited_words = set(edited.lower().split())
        
        added = edited_words - original_words
        removed = original_words - edited_words
        
        change_types = []
        if len(added) > 5:
            change_types.append("content_addition")
        if len(removed) > 5:
            change_types.append("content_removal")
        if abs(len(edited) - len(original)) / max(len(original), 1) > 0.2:
            change_types.append("structure")
        
        return {
            "change_types": change_types or ["minor_edits"],
            "key_learnings": [],
            "terminology_preferences": [],
            "tone_adjustment": "none",
            "content_gaps_identified": list(added)[:5] if len(added) > 5 else [],
            "accuracy_issues": list(removed)[:5] if len(removed) > 5 else [],
            "overall_feedback_quality": 0.5
        }
    
    def _similarity_score(self, text1: str, text2: str) -> float:
        """Calculate simple similarity between texts."""
        if not text1 or not text2:
            return 0.0
        
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1 & words2
        union = words1 | words2
        
        return len(intersection) / len(union)
    
    def _store_learnings(self, analysis: Dict, category: str, question_id: int = None):
        """Store learnings in database."""
        try:
            from app.models import FeedbackLearning
            from app.extensions import db
            
            for learning in analysis.get("key_learnings", []):
                record = FeedbackLearning(
                    org_id=self.org_id,
                    category=category,
                    pattern=learning.get("pattern", ""),
                    applies_to=learning.get("applies_to", category),
                    confidence=learning.get("confidence", 0.5),
                    learning_type="content",
                    created_at=datetime.utcnow()
                )
                db.session.add(record)
            
            # Store terminology preferences
            for term in analysis.get("terminology_preferences", []):
                record = FeedbackLearning(
                    org_id=self.org_id,
                    category=category,
                    pattern=json.dumps(term),
                    applies_to=category,
                    confidence=0.8,
                    learning_type="terminology",
                    created_at=datetime.utcnow()
                )
                db.session.add(record)
            
            # Store tone adjustment if significant
            tone = analysis.get("tone_adjustment", "none")
            if tone != "none":
                record = FeedbackLearning(
                    org_id=self.org_id,
                    category=category,
                    pattern=tone,
                    applies_to=category,
                    confidence=0.7,
                    learning_type="tone",
                    created_at=datetime.utcnow()
                )
                db.session.add(record)
            
            db.session.commit()
            logger.info(f"Stored {len(analysis.get('key_learnings', []))} learnings for category {category}")
            
        except ImportError:
            logger.warning("FeedbackLearning model not found - learnings not persisted")
        except Exception as e:
            logger.error(f"Failed to store learnings: {e}")
    
    def _get_stored_learnings(self, category: str = None, limit: int = 5) -> List[Dict]:
        """Retrieve stored learnings from database."""
        try:
            from app.models import FeedbackLearning
            
            query = FeedbackLearning.query.filter_by(org_id=self.org_id)
            
            if category:
                # Get category-specific and general learnings
                query = query.filter(
                    (FeedbackLearning.category == category) | 
                    (FeedbackLearning.applies_to == "all")
                )
            
            learnings = query.order_by(
                FeedbackLearning.confidence.desc()
            ).limit(limit).all()
            
            return [
                {
                    "type": l.learning_type,
                    "pattern": l.pattern,
                    "category": l.category,
                    "confidence": l.confidence,
                    **(json.loads(l.pattern) if l.learning_type == "terminology" else {})
                }
                for l in learnings
            ]
            
        except ImportError:
            logger.warning("FeedbackLearning model not found")
            return []
        except Exception as e:
            logger.error(f"Failed to get learnings: {e}")
            return []
    
    def _aggregate_learnings(self, learnings: List[Dict]) -> Dict:
        """Aggregate multiple learnings into patterns."""
        if not learnings:
            return {}
        
        # Group by applies_to
        by_category = {}
        for l in learnings:
            cat = l.get("applies_to", "general")
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(l)
        
        # Find common patterns
        common_patterns = []
        pattern_counts = {}
        for l in learnings:
            pattern = l.get("pattern", "")[:50]  # Truncate for grouping
            if pattern not in pattern_counts:
                pattern_counts[pattern] = 0
            pattern_counts[pattern] += 1
        
        for pattern, count in pattern_counts.items():
            if count >= 2:  # Appears in multiple edits
                common_patterns.append({
                    "pattern": pattern,
                    "frequency": count,
                    "confidence": min(0.9, 0.5 + count * 0.1)
                })
        
        return {
            "categories_affected": list(by_category.keys()),
            "common_patterns": common_patterns[:5],
            "total_unique_patterns": len(pattern_counts)
        }


def get_feedback_learning_agent(org_id: int = None) -> FeedbackLearningAgent:
    """Factory function to get Feedback Learning Agent."""
    return FeedbackLearningAgent(org_id=org_id)
