"""
Pricing Calculator Agent

AI-powered pricing calculation for RFP proposals.
Calculates pricing based on:
- Rate cards and resource costs
- Effort estimation from requirements
- Historical project data
- Industry benchmarks

Uses configured LLM provider (LiteLLM/Google/OpenAI) from organization settings.
"""
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from .config import AgentConfig

logger = logging.getLogger(__name__)


class PricingCalculatorAgent:
    """
    Agent for calculating and generating pricing for RFP proposals.
    
    Features:
    - Effort estimation from requirements
    - Role-based pricing with rate cards
    - Phase-wise cost breakdown
    - Optional discount calculations
    - Currency support
    """
    
    MASTER_PROMPT = """You are an experienced Enterprise Pricing Analyst and Proposal Cost Estimator.

Your task is to analyze the proposal requirements and generate a comprehensive pricing breakdown.

## Input Data:
{pricing_context}

## Output Format
Generate a JSON response with the following structure:
{{
  "pricing_summary": {{
    "total_cost": 150000,
    "currency": "USD",
    "validity_period": "30 days",
    "payment_terms": "30% upfront, 40% milestone, 30% completion"
  }},
  "effort_breakdown": [
    {{
      "phase": "Discovery & Planning",
      "duration_weeks": 2,
      "effort_hours": 80,
      "resources": [
        {{"role": "Project Manager", "hours": 20, "rate": 150, "cost": 3000}},
        {{"role": "Business Analyst", "hours": 40, "rate": 120, "cost": 4800}},
        {{"role": "Solution Architect", "hours": 20, "rate": 180, "cost": 3600}}
      ],
      "phase_total": 11400
    }}
  ],
  "cost_categories": [
    {{"category": "Professional Services", "amount": 120000}},
    {{"category": "Infrastructure", "amount": 15000}},
    {{"category": "Licenses", "amount": 10000}},
    {{"category": "Training", "amount": 5000}}
  ],
  "assumptions": [
    "Client will provide timely feedback within 3 business days",
    "All development in standard business hours",
    "Cloud infrastructure costs are estimates"
  ],
  "optional_items": [
    {{"item": "Extended Support (12 months)", "cost": 25000}},
    {{"item": "Additional Training Sessions", "cost": 5000}}
  ]
}}

## Guidelines:
- Base pricing on the rate card provided (or use industry standard rates)
- Break down effort by project phase
- Include all resource types needed
- Add realistic assumptions
- Suggest optional/add-on items
- Provide payment milestone suggestions
- Consider project complexity and risk factors

Generate the pricing breakdown now:"""

    # Default rate card (can be overridden by organization settings)
    DEFAULT_RATE_CARD = {
        'project_manager': {'rate': 150, 'currency': 'USD'},
        'business_analyst': {'rate': 120, 'currency': 'USD'},
        'solution_architect': {'rate': 180, 'currency': 'USD'},
        'senior_developer': {'rate': 140, 'currency': 'USD'},
        'developer': {'rate': 100, 'currency': 'USD'},
        'qa_engineer': {'rate': 90, 'currency': 'USD'},
        'devops_engineer': {'rate': 130, 'currency': 'USD'},
        'ui_ux_designer': {'rate': 110, 'currency': 'USD'},
        'technical_writer': {'rate': 80, 'currency': 'USD'},
    }
    
    # Standard project phases
    PROJECT_PHASES = [
        {'name': 'Discovery & Planning', 'typical_percentage': 10},
        {'name': 'Requirements & Design', 'typical_percentage': 15},
        {'name': 'Development', 'typical_percentage': 45},
        {'name': 'Testing & QA', 'typical_percentage': 15},
        {'name': 'Deployment & Training', 'typical_percentage': 10},
        {'name': 'Hypercare & Handover', 'typical_percentage': 5},
    ]

    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self.config = AgentConfig(org_id=org_id, agent_type='pricing_calculator')
        self._rate_card = None
        self._industry_model = None
        logger.info(f"PricingCalculator initialized with provider: {self.config.provider}")
    
    def _get_rate_card(self, organization=None) -> Dict:
        """Get rate card from organization settings or use defaults."""
        if self._rate_card:
            return self._rate_card
        
        rate_card = self.DEFAULT_RATE_CARD.copy()
        
        if organization and hasattr(organization, 'settings') and organization.settings:
            custom_rates = organization.settings.get('rate_card', {})
            if custom_rates:
                rate_card.update(custom_rates)
        
        self._rate_card = rate_card
        return rate_card
    
    def _get_industry_pricing_model(self, industry: str = None, organization=None) -> Dict:
        """
        Get industry-specific pricing model with multipliers and templates.
        
        Different industries have different pricing norms:
        - Healthcare: Higher compliance overhead (+20%)
        - Finance: Higher security requirements (+25%)
        - Government: More documentation (+15%)
        - Retail: Standard pricing
        - Technology: Competitive pricing (-5%)
        """
        # Default industry models
        industry_models = {
            'healthcare': {
                'multiplier': 1.20,
                'name': 'Healthcare',
                'compliance_overhead': 0.15,
                'typical_phases': ['HIPAA Compliance', 'Security Audit'],
                'pricing_notes': 'Includes HIPAA compliance overhead'
            },
            'finance': {
                'multiplier': 1.25,
                'name': 'Financial Services',
                'compliance_overhead': 0.20,
                'typical_phases': ['SOC2 Compliance', 'Security Review'],
                'pricing_notes': 'Includes financial regulatory compliance'
            },
            'government': {
                'multiplier': 1.15,
                'name': 'Government/Public Sector',
                'documentation_overhead': 0.20,
                'typical_phases': ['Documentation', 'Audit Trail'],
                'pricing_notes': 'Includes enhanced documentation requirements'
            },
            'retail': {
                'multiplier': 1.0,
                'name': 'Retail',
                'typical_phases': [],
                'pricing_notes': 'Standard retail project pricing'
            },
            'technology': {
                'multiplier': 0.95,
                'name': 'Technology',
                'typical_phases': ['Agile Sprints'],
                'pricing_notes': 'Competitive technology sector pricing'
            },
            'manufacturing': {
                'multiplier': 1.10,
                'name': 'Manufacturing',
                'typical_phases': ['Integration Testing', 'Factory Acceptance'],
                'pricing_notes': 'Includes equipment integration overhead'
            }
        }
        
        # Check for custom industry models in organization settings
        if organization and hasattr(organization, 'settings') and organization.settings:
            custom_models = organization.settings.get('industry_pricing_models', {})
            if custom_models:
                industry_models.update(custom_models)
        
        # Return specific industry model or default
        if industry:
            industry_key = industry.lower().strip()
            for key, model in industry_models.items():
                if key in industry_key or industry_key in key:
                    logger.info(f"Using {model['name']} pricing model (multiplier: {model['multiplier']})")
                    return model
        
        # Default model
        return {
            'multiplier': 1.0,
            'name': 'General',
            'typical_phases': [],
            'pricing_notes': 'Standard pricing model'
        }
    
    def calculate_pricing(
        self,
        project_data: Dict[str, Any],
        sections: List[Dict[str, Any]],
        questions: List[Dict[str, Any]] = None,
        organization=None,
        complexity: str = 'medium',
        duration_weeks: int = None,
        currency: str = 'USD'
    ) -> Dict[str, Any]:
        """
        Calculate pricing for a proposal.
        
        Args:
            project_data: Project information (name, description, etc.)
            sections: List of proposal sections with requirements
            questions: Optional Q&A items
            organization: Organization model for rate card
            complexity: Project complexity (low, medium, high, very_high)
            duration_weeks: Estimated project duration
            currency: Currency code (USD, INR, EUR, etc.)
            
        Returns:
            Dict with pricing breakdown and recommendations
        """
        try:
            # Get rate card
            rate_card = self._get_rate_card(organization)
            
            # Build context for AI - include currency
            pricing_context = self._build_pricing_context(
                project_data, sections, questions, rate_card, complexity, duration_weeks, currency
            )
            
            # Generate pricing using AI
            prompt = self.MASTER_PROMPT.format(pricing_context=json.dumps(pricing_context, indent=2))
            
            logger.info(f"Generating pricing for: {project_data.get('name', 'Unknown')} in {currency}")
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.5,  # More deterministic for pricing
                max_tokens=4000
            )
            
            # Parse response
            result = self._parse_response(response_text)
            
            # If parsing failed or returned empty/invalid data, use fallback
            if not result or not result.get('pricing_summary'):
                logger.warning("AI returned empty pricing, using fallback")
                result = self._generate_fallback_pricing(project_data, complexity, rate_card, currency)
            
            return {
                'success': True,
                'pricing': result,
                'rate_card_used': rate_card,
                'complexity': complexity,
                'currency': currency,
                'generated_at': datetime.utcnow().isoformat(),
            }

            
        except Exception as e:
            logger.error(f"Pricing calculation error: {str(e)}")
            rate_card = self._get_rate_card(organization)
            return {
                'success': True,  # Still return success with fallback data
                'error': str(e),
                'pricing': self._generate_fallback_pricing(project_data, complexity, rate_card),
                'rate_card_used': rate_card,
                'complexity': complexity,
                'generated_at': datetime.utcnow().isoformat(),
            }

    
    def _build_pricing_context(
        self,
        project_data: Dict,
        sections: List[Dict],
        questions: List[Dict],
        rate_card: Dict,
        complexity: str,
        duration_weeks: int,
        currency: str = 'USD'
    ) -> Dict:
        """Build context for the pricing AI prompt."""
        # Extract requirements from sections
        requirements = []
        for section in sections:
            content = section.get('content', '')
            if content:
                requirements.append({
                    'section': section.get('title', 'Unknown'),
                    'content_preview': content[:500],
                })
        
        # Complexity multipliers
        complexity_factors = {
            'low': 0.8,
            'medium': 1.0,
            'high': 1.3,
            'very_high': 1.6
        }
        
        # Currency conversion hints for AI
        currency_info = {
            'USD': {'symbol': '$', 'name': 'US Dollar'},
            'INR': {'symbol': '₹', 'name': 'Indian Rupee', 'conversion_hint': 'Rates are typically 60-80% of USD rates'},
            'EUR': {'symbol': '€', 'name': 'Euro'},
            'GBP': {'symbol': '£', 'name': 'British Pound'},
            'JPY': {'symbol': '¥', 'name': 'Japanese Yen'},
        }
        
        return {
            'project_name': project_data.get('name', 'Untitled Project'),
            'client_name': project_data.get('client_name', 'Client'),
            'description': project_data.get('description', ''),
            'requirements_summary': requirements[:5],  # Top 5 sections
            'question_count': len(questions) if questions else 0,
            'rate_card': rate_card,
            'complexity': complexity,
            'complexity_factor': complexity_factors.get(complexity, 1.0),
            'estimated_duration_weeks': duration_weeks or 12,
            'phases': self.PROJECT_PHASES,
            'currency': currency,
            'currency_info': currency_info.get(currency, {'symbol': currency, 'name': currency}),
        }

    
    def _parse_response(self, response_text: str) -> Dict:
        """Parse AI response to extract pricing JSON."""
        try:
            # Remove markdown code blocks if present
            text = response_text.strip()
            if text.startswith('```'):
                lines = text.split('\n')
                text = '\n'.join(lines[1:-1])
            text = text.strip()
            
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON in the response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except:
                    pass
            
            logger.warning("Could not parse pricing response, returning fallback")
            return {}
    
    def _generate_fallback_pricing(self, project_data: Dict, complexity: str, rate_card: Dict = None, currency: str = 'USD') -> Dict:
        """Generate fallback pricing when AI fails."""
        # Use rate card or defaults
        rate_card = rate_card or self.DEFAULT_RATE_CARD
        
        # Complexity multipliers
        complexity_multipliers = {'low': 0.8, 'medium': 1.0, 'high': 1.5, 'very_high': 2.0}
        multiplier = complexity_multipliers.get(complexity, 1.0)
        
        # Currency conversion factors (from USD base)
        currency_conversion = {
            'USD': 1.0,
            'INR': 83.0,  # 1 USD = ~83 INR
            'EUR': 0.92,
            'GBP': 0.79,
            'JPY': 149.0,
        }
        conversion_factor = currency_conversion.get(currency, 1.0)
        
        # Currency symbols
        currency_symbols = {
            'USD': '$',
            'INR': '₹',
            'EUR': '€',
            'GBP': '£',
            'JPY': '¥',
        }
        
        # Calculate based on typical project distribution
        # Assume 12-week project with standard team
        base_weeks = 12
        
        # Phase breakdown with effort percentages
        phases = [
            {'phase': 'Discovery & Planning', 'percentage': 10, 'weeks': 1.5},
            {'phase': 'Requirements & Design', 'percentage': 15, 'weeks': 2},
            {'phase': 'Development', 'percentage': 45, 'weeks': 5},
            {'phase': 'Testing & QA', 'percentage': 15, 'weeks': 2},
            {'phase': 'Deployment & Training', 'percentage': 10, 'weeks': 1},
            {'phase': 'Hypercare & Handover', 'percentage': 5, 'weeks': 0.5},
        ]
        
        effort_breakdown = []
        total_cost = 0
        
        for phase in phases:
            # Calculate phase cost based on resource mix
            pm_hours = int(phase['weeks'] * 10 * multiplier)  # 10 hrs/week
            dev_hours = int(phase['weeks'] * 30 * multiplier)  # 30 hrs/week avg
            qa_hours = int(phase['weeks'] * 15 * multiplier) if 'Testing' in phase['phase'] else int(phase['weeks'] * 5 * multiplier)
            
            pm_rate = rate_card.get('project_manager', {}).get('rate', 150)
            dev_rate = rate_card.get('senior_developer', {}).get('rate', 140)
            qa_rate = rate_card.get('qa_engineer', {}).get('rate', 90)
            
            phase_cost = (pm_hours * pm_rate) + (dev_hours * dev_rate) + (qa_hours * qa_rate)
            # Apply currency conversion
            phase_cost_converted = int(phase_cost * conversion_factor)
            total_cost += phase_cost_converted
            
            effort_breakdown.append({
                'phase': phase['phase'],
                'duration_weeks': phase['weeks'],
                'phase_total': phase_cost_converted
            })
        
        return {
            'pricing_summary': {
                'total_cost': int(total_cost),
                'currency': currency,
                'currency_symbol': currency_symbols.get(currency, currency),
                'validity_period': '30 days',
                'payment_terms': '30% upfront, 40% at milestone, 30% on completion'
            },
            'effort_breakdown': effort_breakdown,
            'cost_categories': [
                {'category': 'Professional Services', 'amount': int(total_cost * 0.85)},
                {'category': 'Infrastructure', 'amount': int(total_cost * 0.10)},
                {'category': 'Training', 'amount': int(total_cost * 0.05)}
            ],
            'assumptions': [
                'Standard business hours (40 hrs/week)',
                'Client provides timely feedback',
                'Requirements are well-defined',
                f'Pricing in {currency}',
                'This is an automated estimate - consult sales for detailed quote'
            ],
            'optional_items': [
                {'item': 'Extended Support (12 months)', 'cost': int(total_cost * 0.15)},
                {'item': 'Additional Training', 'cost': int(total_cost * 0.05)}
            ]
        }


    
    def estimate_effort(
        self,
        requirements: List[str],
        complexity: str = 'medium'
    ) -> Dict[str, Any]:
        """
        Quick effort estimation from requirements list.
        
        Args:
            requirements: List of requirement descriptions
            complexity: Overall complexity level
            
        Returns:
            Dict with effort hours and cost estimate
        """
        # Simple heuristic-based estimation
        base_hours_per_requirement = {
            'low': 8,
            'medium': 16,
            'high': 32,
            'very_high': 48
        }
        
        hours_per_req = base_hours_per_requirement.get(complexity, 16)
        total_hours = len(requirements) * hours_per_req
        
        # Average blended rate
        avg_rate = 120
        total_cost = total_hours * avg_rate
        
        return {
            'requirement_count': len(requirements),
            'estimated_hours': total_hours,
            'blended_rate': avg_rate,
            'estimated_cost': total_cost,
            'complexity': complexity,
            'confidence': 'low' if len(requirements) < 3 else 'medium'
        }


def get_pricing_calculator_agent(org_id: int = None) -> PricingCalculatorAgent:
    """Factory function to get Pricing Calculator Agent."""
    return PricingCalculatorAgent(org_id=org_id)
