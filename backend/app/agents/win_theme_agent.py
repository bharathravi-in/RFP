"""
Win Theme Agent

AI-powered win theme generator for RFP proposals.
Generates:
- Key differentiators and unique value propositions
- Winning themes that resonate with the client
- Competitive advantages to highlight
- Ghost competitive messaging

Uses configured LLM provider from organization settings.
"""
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import AgentConfig

logger = logging.getLogger(__name__)


class WinThemeAgent:
    """
    Agent for generating winning themes and differentiators for RFP proposals.
    
    Features:
    - Analyze RFP requirements to identify win themes
    - Generate differentiators based on vendor strengths
    - Create compelling value propositions
    - Suggest ghost competitive messaging
    """
    
    MASTER_PROMPT = """You are a Senior Proposal Strategist and Capture Manager with expertise in developing winning themes for enterprise proposals.

Your task is to analyze the RFP requirements and vendor capabilities to generate compelling win themes and differentiators.

## Input Data:
{theme_context}

## Output Format
Generate a JSON response with the following structure:
{{
  "win_themes": [
    {{
      "theme_id": "WT-001",
      "theme_title": "Theme Title",
      "theme_statement": "One sentence theme statement",
      "customer_benefit": "How this benefits the client",
      "proof_points": ["Evidence 1", "Evidence 2", "Evidence 3"],
      "sections_to_apply": ["Executive Summary", "Why Choose Us"],
      "priority": "primary|secondary|supporting"
    }}
  ],
  "differentiators": [
    {{
      "differentiator_id": "DIFF-001",
      "title": "Differentiator Title",
      "description": "What makes us different",
      "versus_competition": "How this compares to typical competitors",
      "evidence": "Proof or data supporting this",
      "impact": "high|medium|low"
    }}
  ],
  "value_propositions": [
    {{
      "proposition": "Value statement",
      "target_audience": "Who this resonates with",
      "supporting_message": "Additional context"
    }}
  ],
  "ghost_competitive_points": [
    {{
      "point": "Subtle competitive advantage to highlight",
      "positioning": "How to position without naming competitors"
    }}
  ],
  "key_messages": {{
    "elevator_pitch": "30-second pitch for this opportunity",
    "executive_message": "Message for C-level executives",
    "technical_message": "Message for technical evaluators"
  }}
}}

## Win Theme Principles:
1. **Customer-Centric**: Focus on client outcomes, not our features
2. **Differentiated**: Highlight what makes us uniquely qualified
3. **Credible**: Back every claim with evidence
4. **Consistent**: Apply themes throughout the proposal
5. **Compelling**: Create emotional resonance

## Guidelines:
- Generate 3-5 primary win themes
- Each theme should be memorable and repeatable
- Include proof points for every theme
- Consider the evaluation criteria
- Create ghost competitive points that don't name competitors
- Tailor messages to different stakeholders

Generate the win themes now:"""

    # Standard theme categories
    THEME_CATEGORIES = [
        'Innovation & Technology',
        'Experience & Track Record',
        'Team & Expertise',
        'Methodology & Approach',
        'Value & ROI',
        'Risk Mitigation',
        'Partnership & Support',
        'Speed & Efficiency',
    ]
    
    # Outcome learning configuration
    OUTCOME_LEARNING_CONFIG = {
        'min_projects_for_insights': 5,        # Min won projects needed
        'max_historical_projects': 20,         # Max projects to analyze
        'theme_weight_multipliers': {
            'won': 1.5,                        # Boost themes from won projects
            'lost': 0.5                        # Reduce weight of themes from lost
        },
        'outcome_relevance_decay_days': 365,   # Recent outcomes weighted more
        'industry_match_boost': 1.3,           # Boost for same industry
        'client_type_match_boost': 1.2         # Boost for same client type
    }
    
    # Theme effectiveness tracking patterns
    THEME_EFFECTIVENESS_TRACKING = {
        'high_win_rate_themes': [
            'Partnership & Support',
            'Risk Mitigation',
            'Experience & Track Record'
        ],
        'context_dependent_themes': [
            'Innovation & Technology',  # Better for enterprise
            'Speed & Efficiency'        # Better for startups
        ],
        'avoid_in_government': [
            'Innovation & Technology',  # Government prefers proven
            'Speed & Efficiency'        # Less valued in govt RFPs
        ]
    }

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self.config = AgentConfig(org_id=org_id, agent_type='win_theme')
        logger.info(f"WinThemeAgent initialized with provider: {self.config.provider}")
    
    def generate_win_themes(
        self,
        project_data: Dict[str, Any],
        rfp_requirements: List[str] = None,
        vendor_profile: Dict[str, Any] = None,
        evaluation_criteria: List[str] = None,
        competitor_info: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Generate win themes for a proposal.
        Now incorporates learning from past project outcomes (won/lost).
        
        Args:
            project_data: Project information
            rfp_requirements: Key RFP requirements
            vendor_profile: Company capabilities and strengths
            evaluation_criteria: How proposal will be evaluated
            competitor_info: Optional known competitor information
            
        Returns:
            Dict with win themes, differentiators, and value propositions
        """
        try:
            # Get outcome-based insights from past projects
            outcome_insights = self._get_outcome_insights(
                industry=project_data.get('industry'),
                client_type=project_data.get('client_type')
            )
            
            # Build context for AI
            theme_context = self._build_theme_context(
                project_data, rfp_requirements, vendor_profile,
                evaluation_criteria, competitor_info
            )
            
            # Add outcome insights to context
            if outcome_insights.get('has_data'):
                theme_context['past_winning_patterns'] = outcome_insights.get('winning_patterns', [])
                theme_context['themes_to_avoid'] = outcome_insights.get('losing_patterns', [])
                theme_context['win_rate_by_theme'] = outcome_insights.get('theme_effectiveness', {})
            
            # Generate themes using AI
            prompt = self.MASTER_PROMPT.format(theme_context=json.dumps(theme_context, indent=2))
            
            logger.info(f"Generating win themes for: {project_data.get('name', 'Unknown')}")
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.7,  # Some creativity needed
                max_tokens=5000
            )
            
            # Parse response
            result = self._parse_response(response_text)
            
            return {
                'success': True,
                'themes': result,
                'theme_count': len(result.get('win_themes', [])),
                'differentiator_count': len(result.get('differentiators', [])),
                'outcome_insights_used': outcome_insights.get('has_data', False),
                'generated_at': datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Win theme generation error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'themes': self._generate_fallback_themes(project_data),
            }
    
    def _get_outcome_insights(
        self,
        industry: str = None,
        client_type: str = None
    ) -> Dict[str, Any]:
        """
        Get insights from past project outcomes (won/lost) to inform theme generation.
        
        Analyzes:
        - Won projects: What themes/approaches led to wins
        - Lost projects: What to avoid based on loss reasons
        """
        try:
            from app.models import Project, ProjectStrategy
            from sqlalchemy import func
            
            # Query won projects
            won_query = Project.query.filter_by(outcome='won')
            if self.org_id:
                won_query = won_query.filter_by(organization_id=self.org_id)
            if industry:
                won_query = won_query.filter_by(industry=industry)
            if client_type:
                won_query = won_query.filter_by(client_type=client_type)
                
            won_projects = won_query.order_by(Project.outcome_date.desc()).limit(10).all()
            
            # Query lost projects
            lost_query = Project.query.filter_by(outcome='lost')
            if self.org_id:
                lost_query = lost_query.filter_by(organization_id=self.org_id)
            if industry:
                lost_query = lost_query.filter_by(industry=industry)
                
            lost_projects = lost_query.order_by(Project.outcome_date.desc()).limit(5).all()
            
            # Extract winning patterns from strategies
            winning_patterns = []
            for project in won_projects:
                strategy = ProjectStrategy.query.filter_by(project_id=project.id).first()
                if strategy and strategy.win_themes:
                    for theme in strategy.win_themes[:2]:
                        winning_patterns.append({
                            'theme': theme.get('theme_title', 'Unknown'),
                            'client_type': project.client_type,
                            'industry': project.industry,
                            'contract_value': project.contract_value
                        })
            
            # Extract losing patterns from loss reasons
            losing_patterns = []
            loss_reasons = {}
            for project in lost_projects:
                reason = project.loss_reason or 'unknown'
                loss_reasons[reason] = loss_reasons.get(reason, 0) + 1
                if project.outcome_notes:
                    losing_patterns.append({
                        'reason': reason,
                        'notes': project.outcome_notes[:100]
                    })
            
            # Calculate theme effectiveness (if strategies stored)
            theme_effectiveness = {}
            
            return {
                'has_data': len(won_projects) + len(lost_projects) > 0,
                'won_count': len(won_projects),
                'lost_count': len(lost_projects),
                'winning_patterns': winning_patterns[:5],
                'losing_patterns': losing_patterns[:3],
                'common_loss_reasons': dict(sorted(loss_reasons.items(), key=lambda x: -x[1])[:3]),
                'theme_effectiveness': theme_effectiveness
            }
            
        except Exception as e:
            logger.warning(f"Could not get outcome insights: {e}")
            return {'has_data': False}

    
    def _build_theme_context(
        self,
        project_data: Dict,
        rfp_requirements: List[str],
        vendor_profile: Dict,
        evaluation_criteria: List[str],
        competitor_info: Dict
    ) -> Dict:
        """Build context for the win theme prompt."""
        # Extract vendor strengths
        vendor_strengths = []
        if vendor_profile:
            if vendor_profile.get('years_in_business'):
                vendor_strengths.append(f"{vendor_profile['years_in_business']}+ years of experience")
            if vendor_profile.get('employee_count'):
                vendor_strengths.append(f"{vendor_profile['employee_count']}+ employees")
            if vendor_profile.get('certifications'):
                vendor_strengths.append(f"Certifications: {', '.join(vendor_profile['certifications'][:3])}")
            if vendor_profile.get('industry_focus'):
                vendor_strengths.append(f"Industry expertise in {vendor_profile['industry_focus']}")
        
        return {
            'project_name': project_data.get('name', 'Untitled Project'),
            'client_name': project_data.get('client_name', 'Client'),
            'project_description': project_data.get('description', ''),
            'rfp_requirements': rfp_requirements or [],
            'vendor_strengths': vendor_strengths,
            'vendor_profile': vendor_profile or {},
            'evaluation_criteria': evaluation_criteria or [
                'Technical approach',
                'Team qualifications',
                'Price/value',
                'Past performance',
                'Understanding of requirements'
            ],
            'competitor_context': competitor_info or {},
            'theme_categories': self.THEME_CATEGORIES,
        }
    
    def _parse_response(self, response_text: str) -> Dict:
        """Parse AI response to extract themes JSON."""
        try:
            text = response_text.strip()
            if text.startswith('```'):
                lines = text.split('\n')
                text = '\n'.join(lines[1:-1])
            text = text.strip()
            
            return json.loads(text)
        except json.JSONDecodeError:
            import re
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except:
                    pass
            
            logger.warning("Could not parse win themes response")
            return {}
    
    def _generate_fallback_themes(self, project_data: Dict) -> Dict:
        """Generate fallback themes when AI fails."""
        return {
            'win_themes': [
                {
                    'theme_id': 'WT-001',
                    'theme_title': 'Partnership for Success',
                    'theme_statement': 'We deliver proven solutions with a commitment to your success',
                    'customer_benefit': 'Reduced risk through experienced partner',
                    'proof_points': ['Experienced team', 'Proven methodology'],
                    'sections_to_apply': ['Executive Summary', 'Why Choose Us'],
                    'priority': 'primary'
                }
            ],
            'differentiators': [],
            'value_propositions': [],
            'key_messages': {
                'elevator_pitch': 'Manual theme development recommended'
            }
        }
    
    def apply_themes_to_section(
        self,
        section_content: str,
        win_themes: List[Dict],
        section_name: str
    ) -> str:
        """
        Enhance a section with relevant win themes.
        
        Args:
            section_content: Original section content
            win_themes: List of win theme objects
            section_name: Name of the section
            
        Returns:
            Enhanced section content
        """
        # Find themes applicable to this section
        applicable_themes = [
            t for t in win_themes 
            if section_name in t.get('sections_to_apply', [])
        ]
        
        if not applicable_themes:
            return section_content
        
        # Build theme-enhanced prompt
        prompt = f"""Enhance this proposal section by incorporating the following win themes naturally:

Section: {section_name}

Win Themes to Incorporate:
{json.dumps(applicable_themes, indent=2)}

Original Content:
{section_content}

Guidelines:
- Weave themes naturally into the content
- Don't add new sections, enhance existing content
- Keep the same structure and flow
- Make themes feel organic, not forced

Return the enhanced content:"""
        
        try:
            enhanced = self.config.generate_content(prompt, temperature=0.6, max_tokens=3000)
            return enhanced.strip()
        except Exception as e:
            logger.error(f"Theme application failed: {e}")
            return section_content


def get_win_theme_agent(org_id: int = None) -> WinThemeAgent:
    """Factory function to get Win Theme Agent."""
    return WinThemeAgent(org_id=org_id)
