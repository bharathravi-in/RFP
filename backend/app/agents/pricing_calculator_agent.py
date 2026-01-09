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

Your task is to analyze the proposal requirements and generate a comprehensive, defensible pricing breakdown.

## Input Data:
{pricing_context}

## Output Format
Generate a JSON response with the following structure:
{{
  "pricing_summary": {{
    "total_cost": 150000,
    "currency": "USD",
    "currency_symbol": "$",
    "validity_period": "30 days",
    "validity_date": "YYYY-MM-DD",
    "payment_terms": "30% upfront, 40% milestone, 30% completion",
    "pricing_basis": "Time & Materials with Cap|Fixed Price|Blended"
  }},
  "effort_breakdown": [
    {{
      "phase": "Discovery & Planning",
      "phase_description": "What happens in this phase",
      "duration_weeks": 2,
      "effort_hours": 80,
      "resources": [
        {{
          "role": "Project Manager",
          "hours": 20,
          "hourly_rate": 150,
          "cost": 3000,
          "utilization": "25%"
        }}
      ],
      "phase_total": 11400,
      "deliverables": ["Project charter", "Requirements document"]
    }}
  ],
  "team_composition": {{
    "total_resources": 6,
    "blended_rate": 125,
    "team_structure": [
      {{"role": "Project Manager", "count": 1, "engagement": "25-50%"}},
      {{"role": "Senior Developer", "count": 2, "engagement": "100%"}}
    ]
  }},
  "cost_categories": [
    {{"category": "Professional Services", "amount": 120000, "percentage": 80}},
    {{"category": "Infrastructure", "amount": 15000, "percentage": 10}},
    {{"category": "Contingency", "amount": 15000, "percentage": 10}}
  ],
  "pricing_justification": {{
    "rate_basis": "Market rates for [Country] as of [Date]",
    "rate_source": "Industry benchmarks (Gartner, internal historical data)",
    "overhead_explanation": {{
      "factor": 1.25,
      "includes": ["Payroll taxes (12%)", "Benefits (8%)", "Infrastructure (5%)"]
    }},
    "complexity_adjustment": {{
      "level": "medium",
      "multiplier": 1.0,
      "rationale": "Standard enterprise project complexity"
    }}
  }},
  "assumptions": [
    {{
      "assumption": "Client provides feedback within 3 business days",
      "impact_if_violated": "Timeline extension may be required"
    }}
  ],
  "exclusions": [
    {{
      "item": "Third-party software licenses",
      "note": "Client responsibility"
    }}
  ],
  "validity_explanation": {{
    "period_days": 30,
    "reasons": [
      "Talent market volatility",
      "Exchange rate fluctuations",
      "Cloud pricing changes"
    ]
  }},
  "optional_items": [
    {{"item": "Extended Support (12 months)", "cost": 25000, "value_add": "Reduced risk"}}
  ],
  "pricing_validation": {{
    "all_phases_covered": true,
    "rates_within_market_range": true,
    "contingency_included": true,
    "confidence_level": "HIGH|MEDIUM|LOW",
    "confidence_rationale": "Basis for pricing confidence"
  }}
}}

## MANDATORY CONSTRAINTS (MUST FOLLOW):
1. Include 10-15% contingency buffer in estimates
2. Justify all rates with market benchmark reference
3. Explain validity period (30 days) with specific reasons
4. Document ALL assumptions with impact if violated
5. List all exclusions clearly
6. Provide team composition breakdown
7. Include pricing validation section

## FORBIDDEN PATTERNS:
- Unrealistic low prices to win deals
- Hidden costs or ambiguous scope
- Missing contingency (every project has unknowns)
- Vague assumptions ("TBD", "To be discussed")
- Missing validity period

## Guidelines:
- Base pricing on the rate card provided (or use industry standard rates)
- Break down effort by project phase
- Include all resource types needed
- Add realistic assumptions with impact analysis
- Suggest optional/add-on items
- Provide payment milestone suggestions
- Consider project complexity and risk factors
- Be transparent about pricing methodology

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
    
    # Country-specific rate cards with LOCAL MARKET RATES
    # These are actual hourly rates in local currency, NOT conversions from USD
    COUNTRY_RATE_CARDS = {
        "USA": {
            "name": "United States",
            "currency": "USD",
            "roles": {
                "project_manager": 150,
                "business_analyst": 120,
                "solution_architect": 180,
                "senior_developer": 140,
                "developer": 110,
                "qa_engineer": 90,
                "devops_engineer": 130,
                "ui_ux_designer": 110,
                "technical_writer": 80
            },
            "overhead_factor": 1.25  # US overhead (benefits, facilities, etc.)
        },
        "IND": {
            "name": "India",
            "currency": "INR",
            "roles": {
                "project_manager": 2500,      # ₹2500/hr - local market rate
                "business_analyst": 1800,
                "solution_architect": 3500,
                "senior_developer": 2200,
                "developer": 1600,
                "qa_engineer": 1200,
                "devops_engineer": 2600,
                "ui_ux_designer": 1800,
                "technical_writer": 1000
            },
            "overhead_factor": 1.15  # Lower overhead in India
        },
        "AUS": {
            "name": "Australia",
            "currency": "AUD",
            "roles": {
                "project_manager": 170,
                "business_analyst": 140,
                "solution_architect": 200,
                "senior_developer": 160,
                "developer": 130,
                "qa_engineer": 110,
                "devops_engineer": 150,
                "ui_ux_designer": 130,
                "technical_writer": 95
            },
            "overhead_factor": 1.30  # Higher overhead in Australia
        },
        "GBR": {
            "name": "United Kingdom",
            "currency": "GBP",
            "roles": {
                "project_manager": 125,
                "business_analyst": 100,
                "solution_architect": 150,
                "senior_developer": 115,
                "developer": 90,
                "qa_engineer": 75,
                "devops_engineer": 110,
                "ui_ux_designer": 95,
                "technical_writer": 65
            },
            "overhead_factor": 1.28
        },
        "DEU": {
            "name": "Germany",
            "currency": "EUR",
            "roles": {
                "project_manager": 135,
                "business_analyst": 110,
                "solution_architect": 160,
                "senior_developer": 125,
                "developer": 100,
                "qa_engineer": 85,
                "devops_engineer": 120,
                "ui_ux_designer": 105,
                "technical_writer": 70
            },
            "overhead_factor": 1.35  # Higher social costs in Germany
        },
        "SGP": {
            "name": "Singapore",
            "currency": "SGD",
            "roles": {
                "project_manager": 180,
                "business_analyst": 140,
                "solution_architect": 220,
                "senior_developer": 170,
                "developer": 130,
                "qa_engineer": 100,
                "devops_engineer": 160,
                "ui_ux_designer": 130,
                "technical_writer": 90
            },
            "overhead_factor": 1.20
        },
        "UAE": {
            "name": "United Arab Emirates",
            "currency": "AED",
            "roles": {
                "project_manager": 550,
                "business_analyst": 420,
                "solution_architect": 680,
                "senior_developer": 500,
                "developer": 380,
                "qa_engineer": 280,
                "devops_engineer": 480,
                "ui_ux_designer": 400,
                "technical_writer": 250
            },
            "overhead_factor": 1.18
        },
        "CAN": {
            "name": "Canada",
            "currency": "CAD",
            "roles": {
                "project_manager": 145,
                "business_analyst": 115,
                "solution_architect": 175,
                "senior_developer": 135,
                "developer": 105,
                "qa_engineer": 85,
                "devops_engineer": 125,
                "ui_ux_designer": 105,
                "technical_writer": 75
            },
            "overhead_factor": 1.22
        },
        "JPN": {
            "name": "Japan",
            "currency": "JPY",
            "roles": {
                "project_manager": 12000,
                "business_analyst": 9500,
                "solution_architect": 15000,
                "senior_developer": 11000,
                "developer": 8500,
                "qa_engineer": 7000,
                "devops_engineer": 10500,
                "ui_ux_designer": 9000,
                "technical_writer": 6500
            },
            "overhead_factor": 1.25
        },
        "CHN": {
            "name": "China",
            "currency": "CNY",
            "roles": {
                "project_manager": 800,
                "business_analyst": 600,
                "solution_architect": 1000,
                "senior_developer": 750,
                "developer": 550,
                "qa_engineer": 400,
                "devops_engineer": 700,
                "ui_ux_designer": 600,
                "technical_writer": 350
            },
            "overhead_factor": 1.18
        },
        "SAU": {
            "name": "Saudi Arabia",
            "currency": "SAR",
            "roles": {
                "project_manager": 520,
                "business_analyst": 400,
                "solution_architect": 650,
                "senior_developer": 480,
                "developer": 360,
                "qa_engineer": 260,
                "devops_engineer": 450,
                "ui_ux_designer": 380,
                "technical_writer": 240
            },
            "overhead_factor": 1.20
        },
        "CHE": {
            "name": "Switzerland",
            "currency": "CHF",
            "roles": {
                "project_manager": 200,
                "business_analyst": 160,
                "solution_architect": 240,
                "senior_developer": 185,
                "developer": 145,
                "qa_engineer": 120,
                "devops_engineer": 175,
                "ui_ux_designer": 150,
                "technical_writer": 105
            },
            "overhead_factor": 1.40  # High overhead in Switzerland
        }
    }

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
        currency: str = 'USD',
        country: str = 'USA'
    ) -> Dict[str, Any]:
        """
        Calculate pricing for a proposal using LOCAL MARKET RATES.
        
        Args:
            project_data: Project information (name, description, etc.)
            sections: List of proposal sections with requirements
            questions: Optional Q&A items
            organization: Organization model for rate card
            complexity: Project complexity (low, medium, high, very_high)
            duration_weeks: Estimated project duration
            currency: Currency code for DISPLAY ONLY
            country: Country code for delivery location (determines rate card)
            
        Returns:
            Dict with pricing breakdown and recommendations
        """
        try:
            # Get country-specific rate card (LOCAL MARKET RATES, not conversions)
            country_rate_card = self.COUNTRY_RATE_CARDS.get(country)
            if not country_rate_card:
                # Fallback to USA if unknown country
                logger.warning(f"Unknown country {country}, falling back to USA rates")
                country_rate_card = self.COUNTRY_RATE_CARDS["USA"]
                country = "USA"
            
            country_name = country_rate_card["name"]
            local_currency = country_rate_card["currency"]
            local_rates = country_rate_card["roles"]
            overhead_factor = country_rate_card["overhead_factor"]
            
            logger.info(f"Using {country_name} rate card with local {local_currency} rates")
            
            # Build context for AI with country-specific rates
            pricing_context = self._build_pricing_context(
                project_data, sections, questions, local_rates, complexity, 
                duration_weeks, currency, country, country_rate_card
            )
            
            # Generate pricing using AI
            prompt = self.MASTER_PROMPT.format(pricing_context=json.dumps(pricing_context, indent=2))
            
            logger.info(f"Generating pricing for: {project_data.get('name', 'Unknown')} - {country_name} delivery")
            
            response_text = self.config.generate_content(
                prompt,
                temperature=0.5,  # More deterministic for pricing
                max_tokens=4000
            )
            
            # Parse response
            result = self._parse_response(response_text)
            
            # If parsing failed or returned empty/invalid data, use fallback
            if not result or not result.get('pricing_summary'):
                logger.warning("AI returned empty pricing, using fallback with local rates")
                result = self._generate_fallback_pricing(
                    project_data, complexity, currency, country
                )
            
            return {
                'success': True,
                'pricing': result,
                'rate_card_used': local_rates,
                'complexity': complexity,
                'currency': currency,
                'country': country,
                'country_name': country_name,
                'local_currency': local_currency,
                'overhead_factor': overhead_factor,
                'generated_at': datetime.utcnow().isoformat(),
            }

            
        except Exception as e:
            logger.error(f"Pricing calculation error: {str(e)}")
            return {
                'success': True,  # Still return success with fallback data
                'error': str(e),
                'pricing': self._generate_fallback_pricing(
                    project_data, complexity, currency, country
                ),
                'complexity': complexity,
                'country': country,
                'generated_at': datetime.utcnow().isoformat(),
            }

    
    def _build_pricing_context(
        self,
        project_data: Dict,
        sections: List[Dict],
        questions: List[Dict],
        local_rates: Dict,
        complexity: str,
        duration_weeks: int,
        currency: str = 'USD',
        country: str = 'USA',
        country_rate_card: Dict = None
    ) -> Dict:
        """Build context for the pricing AI prompt with LOCAL MARKET RATES."""
        # Extract requirements from sections
        requirements = []
        for section in sections:
            content = section.get('content', '')
            if content:
                requirements.append({
                    'section': section.get('title', 'Unknown'),
                    'content_preview': content[:500],
                })
        
        # Complexity multipliers (affects effort, not rates)
        complexity_factors = {
            'low': 0.8,
            'medium': 1.0,
            'high': 1.3,
            'very_high': 1.6
        }
        
        # Currency symbols for display
        currency_symbols = {
            'USD': '$', 'INR': '₹', 'EUR': '€', 'GBP': '£', 'JPY': '¥',
            'AUD': 'A$', 'CAD': 'C$', 'SGD': 'S$', 'AED': 'د.إ',
            'SAR': '﷼', 'CHF': 'CHF', 'CNY': '¥',
        }
        
        # Get country info from rate card
        country_name = country_rate_card.get('name', country) if country_rate_card else country
        local_currency = country_rate_card.get('currency', 'USD') if country_rate_card else 'USD'
        overhead_factor = country_rate_card.get('overhead_factor', 1.25) if country_rate_card else 1.25
        
        # Build the CRITICAL pricing instruction that prevents USD conversion
        pricing_instruction = f"""
CRITICAL PRICING RULES:
1. Use ONLY the provided {country_name} hourly rates below. These are LOCAL MARKET RATES.
2. DO NOT convert from USD. DO NOT apply any currency multipliers.
3. All calculations must use these exact hourly rates in {local_currency}:
   - Project Manager: {local_rates.get('project_manager', 0)} {local_currency}/hr
   - Senior Developer: {local_rates.get('senior_developer', 0)} {local_currency}/hr
   - Developer: {local_rates.get('developer', 0)} {local_currency}/hr
   - QA Engineer: {local_rates.get('qa_engineer', 0)} {local_currency}/hr
   - Solution Architect: {local_rates.get('solution_architect', 0)} {local_currency}/hr
4. Apply overhead factor of {overhead_factor} to total labor costs.
5. Display currency is {currency} (symbol: {currency_symbols.get(currency, currency)}).
6. If display currency differs from {local_currency}, the values should still be in {local_currency} - currency is cosmetic only.
"""
        
        return {
            'project_name': project_data.get('name', 'Untitled Project'),
            'client_name': project_data.get('client_name', 'Client'),
            'description': project_data.get('description', ''),
            'requirements_summary': requirements[:5],
            'question_count': len(questions) if questions else 0,
            'local_rate_card': local_rates,
            'country': country,
            'country_name': country_name,
            'local_currency': local_currency,
            'overhead_factor': overhead_factor,
            'complexity': complexity,
            'complexity_factor': complexity_factors.get(complexity, 1.0),
            'estimated_duration_weeks': duration_weeks or 12,
            'phases': self.PROJECT_PHASES,
            'display_currency': currency,
            'display_currency_symbol': currency_symbols.get(currency, currency),
            'pricing_instruction': pricing_instruction,
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
    
    def _generate_fallback_pricing(
        self, 
        project_data: Dict, 
        complexity: str, 
        currency: str = 'USD',
        country: str = 'USA'
    ) -> Dict:
        """
        Generate fallback pricing using LOCAL MARKET RATES.
        
        This is the correct approach:
        1. Get country's rate card with local hourly rates
        2. Calculate: hours × local_rate × overhead
        3. NO USD conversion, NO multipliers
        """
        # Get country-specific rate card
        country_rate_card = self.COUNTRY_RATE_CARDS.get(country)
        if not country_rate_card:
            logger.warning(f"Unknown country {country}, falling back to USA rates")
            country_rate_card = self.COUNTRY_RATE_CARDS["USA"]
            country = "USA"
        
        country_name = country_rate_card["name"]
        local_currency = country_rate_card["currency"]
        local_rates = country_rate_card["roles"]
        overhead_factor = country_rate_card["overhead_factor"]
        
        # Complexity multipliers (affects effort hours, not rates)
        complexity_multipliers = {'low': 0.8, 'medium': 1.0, 'high': 1.5, 'very_high': 2.0}
        complexity_factor = complexity_multipliers.get(complexity, 1.0)
        
        # Currency symbols for display
        currency_symbols = {
            'USD': '$', 'INR': '₹', 'EUR': '€', 'GBP': '£', 'JPY': '¥',
            'AUD': 'A$', 'CAD': 'C$', 'SGD': 'S$', 'AED': 'د.إ', 
            'SAR': '﷼', 'CHF': 'CHF', 'CNY': '¥',
        }
        
        # Phase breakdown with effort percentages (12-week project)
        phases = [
            {'phase': 'Discovery & Planning', 'percentage': 10, 'weeks': 1.5},
            {'phase': 'Requirements & Design', 'percentage': 15, 'weeks': 2},
            {'phase': 'Development', 'percentage': 45, 'weeks': 5},
            {'phase': 'Testing & QA', 'percentage': 15, 'weeks': 2},
            {'phase': 'Deployment & Training', 'percentage': 10, 'weeks': 1},
            {'phase': 'Hypercare & Handover', 'percentage': 5, 'weeks': 0.5},
        ]
        
        effort_breakdown = []
        total_labor_cost = 0
        
        # Get LOCAL hourly rates (NOT USD rates!)
        pm_rate = local_rates.get('project_manager', 150)
        dev_rate = local_rates.get('senior_developer', 140)
        qa_rate = local_rates.get('qa_engineer', 90)
        arch_rate = local_rates.get('solution_architect', 180)
        
        for phase in phases:
            # Calculate hours based on phase and complexity
            pm_hours = int(phase['weeks'] * 10 * complexity_factor)  # 10 hrs/week
            dev_hours = int(phase['weeks'] * 30 * complexity_factor)  # 30 hrs/week avg
            qa_hours = int(phase['weeks'] * 15 * complexity_factor) if 'Testing' in phase['phase'] else int(phase['weeks'] * 5 * complexity_factor)
            arch_hours = int(phase['weeks'] * 5 * complexity_factor) if 'Planning' in phase['phase'] or 'Design' in phase['phase'] else 0
            
            # Calculate phase cost using LOCAL rates directly
            phase_labor_cost = (
                (pm_hours * pm_rate) +
                (dev_hours * dev_rate) +
                (qa_hours * qa_rate) +
                (arch_hours * arch_rate)
            )
            
            # Apply overhead factor
            phase_total = int(phase_labor_cost * overhead_factor)
            total_labor_cost += phase_total
            
            effort_breakdown.append({
                'phase': phase['phase'],
                'duration_weeks': phase['weeks'],
                'phase_total': phase_total
            })
        
        # Format total for display
        total_cost = int(total_labor_cost)
        
        return {
            'pricing_summary': {
                'total_cost': total_cost,
                'currency': local_currency,  # Use local currency, not display currency
                'currency_symbol': currency_symbols.get(local_currency, local_currency),
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
                f'Pricing uses {country_name} local market rates',
                f'All values in {local_currency}',
                f'Overhead factor: {overhead_factor}x applied',
                'This is an automated estimate - consult sales for detailed quote'
            ],
            'cost_explanation': f"Calculated using {country_name} local hourly rates (PM: {local_currency}{pm_rate}/hr, Dev: {local_currency}{dev_rate}/hr) with {overhead_factor}x overhead.",
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
