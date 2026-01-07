"""
Competitive Analysis Agent

AI-powered competitive analysis for RFP proposals.
Analyzes:
- Competitive landscape
- Strengths and weaknesses vs competitors
- Competitive positioning strategies
- Counter-positioning recommendations

Uses configured LLM provider from organization settings.
"""
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import AgentConfig

logger = logging.getLogger(__name__)


class CompetitiveAnalysisAgent:
    """
    Agent for analyzing competitive landscape and positioning for RFP proposals.
    
    Features:
    - Identify likely competitors for the opportunity
    - Analyze competitive strengths/weaknesses
    - Generate positioning strategies
    - Create counter-objection responses
    """
    
    MASTER_PROMPT = """You are a Senior Competitive Intelligence Analyst specializing in enterprise technology proposals.

Your task is to analyze the competitive landscape for this RFP opportunity and provide strategic positioning recommendations.

## Input Data:
{competitive_context}

## Output Format
Generate a JSON response with the following structure:
{{
  "competitive_landscape": {{
    "market_context": "Brief market analysis",
    "likely_competitors": [
      {{
        "type": "Large System Integrator|Boutique Firm|Product Vendor|Incumbent",
        "typical_strengths": ["Strength 1", "Strength 2"],
        "typical_weaknesses": ["Weakness 1", "Weakness 2"],
        "likely_price_position": "Higher|Similar|Lower"
      }}
    ]
  }},
  "our_position": {{
    "strengths_vs_large_competitors": ["Advantage 1", "Advantage 2"],
    "strengths_vs_small_competitors": ["Advantage 1", "Advantage 2"],
    "areas_to_address": ["Potential concern 1"],
    "recommended_positioning": "How to position ourselves"
  }},
  "competitive_strategies": [
    {{
      "strategy_id": "CS-001",
      "strategy_name": "Strategy Name",
      "description": "Detailed description",
      "when_to_use": "Situation where this applies",
      "key_messages": ["Message 1", "Message 2"],
      "sections_to_emphasize": ["Section names"]
    }}
  ],
  "counter_objections": [
    {{
      "objection": "Potential client concern",
      "response": "How to address this",
      "proof_points": ["Evidence to support"]
    }}
  ],
  "ghost_competitive_statements": [
    {{
      "statement": "Statement that highlights our advantage without naming competitors",
      "target": "What competitor weakness this addresses"
    }}
  ],
  "evaluation_impact": {{
    "technical_score_boosters": ["Ways to increase technical score"],
    "price_score_strategies": ["Ways to optimize price perception"],
    "risk_mitigation_points": ["Ways to reduce perceived risk"]
  }}
}}

## Competitive Analysis Principles:
1. **Never name competitors directly** - Use positioning ("Unlike traditional approaches...")
2. **Focus on client outcomes** - What matters to the evaluators
3. **Use evidence** - Back claims with data and case studies
4. **Address weaknesses proactively** - Turn potential concerns into strengths
5. **Highlight unique value** - What only we can deliver

## Guidelines:
- Analyze the typical competitive landscape for this type of project
- Consider both large and small competitors
- Provide actionable positioning strategies
- Include ghost competitive messaging
- Address common objections preemptively

Perform the competitive analysis now:"""

    # Common competitor types
    COMPETITOR_TYPES = [
        {'type': 'Large System Integrator', 'examples': 'Accenture, Deloitte, TCS'},
        {'type': 'Product Vendor', 'examples': 'Companies selling specific products'},
        {'type': 'Boutique Consulting', 'examples': 'Specialized niche firms'},
        {'type': 'Incumbent Provider', 'examples': 'Current vendor relationship'},
        {'type': 'Regional Player', 'examples': 'Local/regional competitors'},
    ]
    
    # Default competitor profiles for fallback analysis when DB is empty
    DEFAULT_COMPETITOR_PROFILES = {
        'Large System Integrator': {
            'strengths': ['Global delivery capability', 'Brand recognition', 'Deep talent pool'],
            'weaknesses': ['Higher costs', 'Less agility', 'Standardized approaches'],
            'pricing_tier': 'Premium',
            'market_position': 'Enterprise Leader',
            'counter_strategies': [
                'Emphasize personalized attention and agility',
                'Highlight cost efficiency without premium overhead',
                'Show faster time-to-value with streamlined processes'
            ]
        },
        'Boutique Consulting': {
            'strengths': ['Domain expertise', 'Personal attention', 'Flexible pricing'],
            'weaknesses': ['Limited scale', 'Narrow service offerings', 'Resource constraints'],
            'pricing_tier': 'Mid-Market',
            'market_position': 'Niche Specialist',
            'counter_strategies': [
                'Demonstrate broader capabilities across domains',
                'Show enterprise-grade processes and governance',
                'Highlight scalability for growth'
            ]
        },
        'Product Vendor': {
            'strengths': ['Product expertise', 'Out-of-box functionality', 'Roadmap investment'],
            'weaknesses': ['Product-centric bias', 'Customization limitations', 'Vendor lock-in'],
            'pricing_tier': 'Variable',
            'market_position': 'Product Specialist',
            'counter_strategies': [
                'Position as solution-agnostic best-fit advisor',
                'Highlight independence and unbiased recommendations',
                'Show integration expertise across multiple platforms'
            ]
        },
        'Incumbent Provider': {
            'strengths': ['Existing relationship', 'System familiarity', 'Historical context'],
            'weaknesses': ['Status quo bias', 'Potential complacency', 'May lack fresh perspective'],
            'pricing_tier': 'Established',
            'market_position': 'Current Partner',
            'counter_strategies': [
                'Bring fresh perspective and innovative approaches',
                'Highlight new ideas without legacy baggage',
                'Show competitive benchmark insights'
            ]
        }
    }

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self.config = AgentConfig(org_id=org_id, agent_type='competitive_analysis')
        logger.info(f"CompetitiveAnalysisAgent initialized with provider: {self.config.provider}")
    
    def analyze_competition(
        self,
        project_data: Dict[str, Any],
        vendor_profile: Dict[str, Any] = None,
        rfp_requirements: List[str] = None,
        known_competitors: List[str] = None,
        industry: str = None
    ) -> Dict[str, Any]:
        """
        Perform competitive analysis for a proposal.
        Now integrates with Competitor knowledge base for enriched analysis.
        
        Args:
            project_data: Project information
            vendor_profile: Our company capabilities
            rfp_requirements: Key RFP requirements
            known_competitors: Known competitors (if any)
            industry: Target industry
            
        Returns:
            Dict with competitive analysis and strategies
        """
        try:
            # Get competitor intelligence from database
            db_competitors = self._get_competitor_context(
                known_competitors=known_competitors,
                industry=industry,
                client_type=project_data.get('client_type')
            )
            
            # Build context for AI
            competitive_context = self._build_competitive_context(
                project_data, vendor_profile, rfp_requirements,
                known_competitors, industry
            )
            
            # Enrich with database competitor intelligence
            if db_competitors.get('has_data'):
                competitive_context['known_competitor_profiles'] = db_competitors.get('competitors', [])
                competitive_context['historical_win_rates'] = db_competitors.get('win_rates', {})
                competitive_context['effective_counter_strategies'] = db_competitors.get('counter_strategies', [])
            
            # Generate analysis using AI
            prompt = self.MASTER_PROMPT.format(competitive_context=json.dumps(competitive_context, indent=2))
            
            logger.info(f"Analyzing competition for: {project_data.get('name', 'Unknown')}")
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.6,
                max_tokens=5000
            )
            
            # Parse response
            result = self._parse_response(response_text)
            
            return {
                'success': True,
                'analysis': result,
                'strategy_count': len(result.get('competitive_strategies', [])),
                'competitors_from_db': db_competitors.get('competitor_count', 0),
                'analyzed_at': datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            logger.error(f"Competitive analysis error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'analysis': self._generate_fallback_analysis(),
            }
    
    def _get_competitor_context(
        self,
        known_competitors: List[str] = None,
        industry: str = None,
        client_type: str = None
    ) -> Dict[str, Any]:
        """
        Get competitor intelligence from the Competitor database.
        
        Args:
            known_competitors: Names of known competitors for this deal
            industry: Industry to filter competitors by
            client_type: Client type (government, enterprise, etc.)
            
        Returns:
            Dict with competitor profiles, win rates, and counter strategies
        """
        try:
            from app.models import Competitor
            
            # Build query
            query = Competitor.query.filter_by(is_active=True)
            if self.org_id:
                query = query.filter_by(organization_id=self.org_id)
            
            # Filter by known competitor names
            if known_competitors:
                from sqlalchemy import or_
                name_filters = [Competitor.name.ilike(f'%{name}%') for name in known_competitors]
                query = query.filter(or_(*name_filters))
            
            # Get all matching competitors
            competitors = query.limit(10).all()
            
            # Build competitor profiles for AI
            competitor_profiles = []
            win_rates = {}
            counter_strategies = []
            
            for comp in competitors:
                competitor_profiles.append({
                    'name': comp.name,
                    'strengths': comp.strengths[:3] if comp.strengths else [],
                    'weaknesses': comp.weaknesses[:3] if comp.weaknesses else [],
                    'pricing_tier': comp.pricing_tier,
                    'market_position': comp.market_position,
                    'our_win_rate_vs_them': f"{comp.win_rate * 100:.0f}%"
                })
                
                # Track win rates
                win_rates[comp.name] = comp.win_rate
                
                # Collect proven counter strategies
                if comp.counter_strategies:
                    for strategy in comp.counter_strategies[:2]:
                        counter_strategies.append({
                            'competitor': comp.name,
                            'strategy': strategy
                        })
            
            return {
                'has_data': len(competitors) > 0,
                'competitor_count': len(competitors),
                'competitors': competitor_profiles,
                'win_rates': win_rates,
                'counter_strategies': counter_strategies[:5]
            }
            
        except Exception as e:
            logger.warning(f"Could not get competitor context: {e}")
            return {'has_data': False}
    
    def _build_competitive_context(
        self,
        project_data: Dict,
        vendor_profile: Dict,
        rfp_requirements: List[str],
        known_competitors: List[str],
        industry: str
    ) -> Dict:
        """Build context for the competitive analysis prompt."""
        # Determine vendor positioning
        vendor_size = 'Medium'
        if vendor_profile:
            emp_count = vendor_profile.get('employee_count', 0)
            if emp_count > 1000:
                vendor_size = 'Large'
            elif emp_count < 100:
                vendor_size = 'Small/Boutique'
        
        return {
            'project_name': project_data.get('name', 'Untitled Project'),
            'client_name': project_data.get('client_name', 'Client'),
            'project_description': project_data.get('description', ''),
            'project_type': project_data.get('type', 'Technology'),
            'industry': industry or 'General',
            'rfp_requirements': rfp_requirements or [],
            'our_profile': {
                'company_size': vendor_size,
                'years_in_business': vendor_profile.get('years_in_business') if vendor_profile else None,
                'key_strengths': vendor_profile.get('key_strengths', []) if vendor_profile else [],
                'certifications': vendor_profile.get('certifications', []) if vendor_profile else [],
            },
            'known_competitors': known_competitors or [],
            'competitor_types': self.COMPETITOR_TYPES,
        }
    
    def _parse_response(self, response_text: str) -> Dict:
        """Parse AI response to extract analysis JSON."""
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
            
            logger.warning("Could not parse competitive analysis response")
            return {}
    
    def _generate_fallback_analysis(self) -> Dict:
        """Generate fallback analysis when AI fails."""
        return {
            'competitive_landscape': {
                'market_context': 'Competitive analysis requires manual review',
                'likely_competitors': []
            },
            'our_position': {
                'recommended_positioning': 'Emphasize proven track record and client focus'
            },
            'competitive_strategies': [
                {
                    'strategy_id': 'CS-001',
                    'strategy_name': 'Value-Based Differentiation',
                    'description': 'Focus on unique value delivery rather than price',
                    'when_to_use': 'Always applicable',
                    'key_messages': ['Partnership approach', 'Proven methodology']
                }
            ],
            'counter_objections': [],
            'ghost_competitive_statements': []
        }
    
    def generate_counter_objections(
        self,
        objections: List[str],
        vendor_profile: Dict = None
    ) -> List[Dict]:
        """
        Generate responses to specific objections.
        
        Args:
            objections: List of potential objections/concerns
            vendor_profile: Our company profile for context
            
        Returns:
            List of objection-response pairs
        """
        if not objections:
            return []
        
        prompt = f"""Generate professional responses to these potential client objections:

Objections:
{json.dumps(objections, indent=2)}

Our Profile:
{json.dumps(vendor_profile or {}, indent=2)}

For each objection, provide:
1. A direct, confident response
2. Proof points or evidence
3. A reframe that turns the concern into a positive

Return as JSON array:
[{{"objection": "...", "response": "...", "proof_points": ["..."], "reframe": "..."}}]
"""
        
        try:
            response_text = self.config.generate_content(prompt, temperature=0.5, max_tokens=2000)
            
            # Parse response
            text = response_text.strip()
            if text.startswith('```'):
                lines = text.split('\n')
                text = '\n'.join(lines[1:-1])
            
            return json.loads(text.strip())
        except Exception as e:
            logger.error(f"Counter objection generation failed: {e}")
            return [{'objection': obj, 'response': 'Manual response needed'} for obj in objections]
    
    def compare_proposals(
        self,
        our_strengths: List[str],
        competitor_type: str
    ) -> Dict[str, Any]:
        """
        Quick comparison against a competitor type.
        
        Args:
            our_strengths: List of our key strengths
            competitor_type: Type of competitor to compare against
            
        Returns:
            Dict with comparison highlights
        """
        # Simple heuristic-based comparison
        comparisons = {
            'Large System Integrator': {
                'their_strengths': ['Global reach', 'Brand recognition', 'Deep resources'],
                'their_weaknesses': ['Less agile', 'Higher cost', 'Less personalized'],
                'our_advantage': 'Agility, cost efficiency, personalized attention'
            },
            'Boutique Consulting': {
                'their_strengths': ['Specialized expertise', 'Personal attention'],
                'their_weaknesses': ['Limited scale', 'Narrow focus', 'Less resources'],
                'our_advantage': 'Broader capabilities with personalized service'
            },
            'Product Vendor': {
                'their_strengths': ['Product expertise', 'Standard solutions'],
                'their_weaknesses': ['Product-centric', 'Less customization', 'Lock-in risk'],
                'our_advantage': 'Solution-agnostic approach, best-fit recommendations'
            },
            'Incumbent Provider': {
                'their_strengths': ['Existing relationship', 'System knowledge'],
                'their_weaknesses': ['Status quo bias', 'May lack fresh perspective'],
                'our_advantage': 'Fresh perspective, innovative approaches'
            }
        }
        
        comp = comparisons.get(competitor_type, comparisons['Large System Integrator'])
        comp['our_strengths'] = our_strengths
        
        return comp


def get_competitive_analysis_agent(org_id: int = None) -> CompetitiveAnalysisAgent:
    """Factory function to get Competitive Analysis Agent."""
    return CompetitiveAnalysisAgent(org_id=org_id)
