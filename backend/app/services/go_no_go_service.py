"""Go/No-Go Analysis Service for pre-RFP evaluation."""
from datetime import datetime
import os
import logging
from ..extensions import db
from ..models import Project, KnowledgeItem, User

logger = logging.getLogger(__name__)

# Weight configuration for scoring dimensions
DIMENSION_WEIGHTS = {
    'resources': 0.25,
    'timeline': 0.25,
    'experience': 0.30,
    'competition': 0.20
}

# Cache for LLM provider
_llm_provider_cache = {}


def get_ai_client(org_id: int = None):
    """Get dynamic LLM client based on organization config."""
    global _llm_provider_cache
    
    # Try dynamic provider first
    if org_id:
        try:
            from app.services.llm_service_helper import get_llm_provider
            provider = get_llm_provider(org_id, 'go_no_go')
            if provider:
                logger.info(f"GoNoGo using dynamic provider: {provider.provider_name}")
                return provider
        except Exception as e:
            logger.warning(f"Could not load dynamic LLM: {e}")
    
    # Fallback to legacy Google
    try:
        import google.generativeai as genai
        api_key = os.environ.get('GOOGLE_API_KEY') or os.environ.get('GEMINI_API_KEY')
        if api_key:
            genai.configure(api_key=api_key)
            model_name = os.environ.get('GOOGLE_MODEL', 'gemini-2.0-flash')
            return genai.GenerativeModel(model_name)
    except Exception as e:
        logger.warning(f"Legacy Google init failed: {e}")
    
    return None


def calculate_resource_score(criteria: dict) -> dict:
    """
    Calculate resource availability score.
    
    Inputs from criteria:
    - team_available: number of team members available (0-10)
    - required_team_size: estimated team size needed
    - key_skills_available: boolean or score 0-100
    """
    team_available = criteria.get('team_available', 0)
    required_team = criteria.get('required_team_size', 3)
    skills_available = criteria.get('key_skills_available', 50)
    
    # Calculate team coverage (capped at 100%)
    team_coverage = min((team_available / max(required_team, 1)) * 100, 100)
    
    # Combined score: 60% team coverage, 40% skills
    score = (team_coverage * 0.6) + (skills_available * 0.4)
    
    if score >= 80:
        details = f"Strong team capacity: {team_available} members available with key skills in place."
    elif score >= 50:
        details = f"Moderate capacity: {team_available} of {required_team} needed team members available."
    else:
        details = f"Resource constraint: Only {team_available} of {required_team} needed members available."
    
    return {
        'score': round(score, 1),
        'details': details,
        'breakdown': {
            'team_coverage': round(team_coverage, 1),
            'skills_score': skills_available
        }
    }


def calculate_timeline_score(project: Project, criteria: dict) -> dict:
    """
    Calculate timeline feasibility score based on due date and typical response times.
    """
    if not project.due_date:
        return {
            'score': 50.0,
            'details': "No due date specified. Timeline feasibility unknown.",
            'breakdown': {'days_available': None, 'typical_days': 14}
        }
    
    days_until_due = (project.due_date - datetime.utcnow()).days
    typical_response_days = criteria.get('typical_response_days', 14)
    
    if days_until_due <= 0:
        score = 0
        details = "Past due date - timeline not feasible."
    elif days_until_due >= typical_response_days * 2:
        score = 100
        details = f"Ample time available: {days_until_due} days (typical: {typical_response_days} days)."
    elif days_until_due >= typical_response_days:
        score = 75 + ((days_until_due - typical_response_days) / typical_response_days * 25)
        details = f"Comfortable timeline: {days_until_due} days available."
    elif days_until_due >= typical_response_days * 0.5:
        score = 50 + ((days_until_due - typical_response_days * 0.5) / (typical_response_days * 0.5) * 25)
        details = f"Tight timeline: {days_until_due} days available (typical: {typical_response_days})."
    else:
        score = (days_until_due / (typical_response_days * 0.5)) * 50
        details = f"Very tight timeline: Only {days_until_due} days until due date."
    
    return {
        'score': round(min(score, 100), 1),
        'details': details,
        'breakdown': {
            'days_available': days_until_due,
            'typical_days': typical_response_days
        }
    }


def calculate_experience_score(project: Project, org_id: int) -> dict:
    """
    Calculate past experience match score by searching knowledge base.
    """
    # Build search terms from project attributes
    search_terms = []
    if project.industry:
        search_terms.append(project.industry)
    if project.client_type:
        search_terms.append(project.client_type)
    if project.geography:
        search_terms.append(project.geography)
    if project.name:
        search_terms.extend(project.name.split()[:5])
    
    if not search_terms:
        return {
            'score': 50.0,
            'details': "Project details not specified. Cannot assess experience match.",
            'breakdown': {'matching_items': 0, 'search_terms': []}
        }
    
    # Search knowledge base for matching items
    search_query = ' '.join(search_terms)
    
    try:
        matching_items = KnowledgeItem.query.filter(
            KnowledgeItem.organization_id == org_id,
            KnowledgeItem.is_active == True,
            db.or_(
                KnowledgeItem.title.ilike(f'%{search_terms[0]}%'),
                KnowledgeItem.content.ilike(f'%{search_terms[0]}%'),
                KnowledgeItem.industry == project.industry,
                KnowledgeItem.client_type == project.client_type,
                KnowledgeItem.geography == project.geography
            )
        ).limit(10).all()
        
        match_count = len(matching_items)
        
        if match_count >= 5:
            score = 90
            details = f"Strong experience match: Found {match_count} relevant knowledge items."
        elif match_count >= 3:
            score = 70
            details = f"Good experience match: Found {match_count} relevant knowledge items."
        elif match_count >= 1:
            score = 50
            details = f"Some prior experience: Found {match_count} related knowledge items."
        else:
            score = 30
            details = "Limited prior experience in this domain. Consider knowledge building."
        
        return {
            'score': score,
            'details': details,
            'breakdown': {
                'matching_items': match_count,
                'search_terms': search_terms[:5],
                'matched_titles': [item.title for item in matching_items[:3]]
            }
        }
    except Exception as e:
        logger.error(f"Experience search failed: {e}")
        return {
            'score': 50.0,
            'details': "Unable to assess experience match due to search error.",
            'breakdown': {'error': str(e)}
        }


def calculate_competitive_score(criteria: dict) -> dict:
    """
    Calculate competitive position score based on manual inputs.
    
    Factors from criteria:
    - incumbent_advantage: boolean (are we the incumbent?)
    - relationship_score: 0-100 (client relationship strength)
    - pricing_competitiveness: 0-100
    - unique_capabilities: 0-100
    """
    is_incumbent = criteria.get('incumbent_advantage', False)
    relationship = criteria.get('relationship_score', 50)
    pricing = criteria.get('pricing_competitiveness', 50)
    unique_caps = criteria.get('unique_capabilities', 50)
    
    # Calculate base score
    base_score = (relationship * 0.35) + (pricing * 0.30) + (unique_caps * 0.35)
    
    # Incumbent bonus (up to 15 points)
    if is_incumbent:
        base_score = min(base_score + 15, 100)
    
    score = round(base_score, 1)
    
    if score >= 75:
        details = "Strong competitive position with good client relationship and unique capabilities."
    elif score >= 50:
        details = "Moderate competitive position. Consider highlighting differentiators."
    else:
        details = "Challenging competitive environment. Evaluate strategic fit carefully."
    
    return {
        'score': score,
        'details': details,
        'breakdown': {
            'is_incumbent': is_incumbent,
            'relationship_score': relationship,
            'pricing_score': pricing,
            'unique_capabilities': unique_caps
        }
    }


def generate_ai_recommendation(project: Project, scores: dict, criteria: dict, org_id: int = None) -> str:
    """
    Generate AI recommendation based on analysis scores.
    """
    model = get_ai_client(org_id)
    if not model:
        # Fallback to rule-based recommendation
        overall = scores['overall']
        if overall >= 70:
            return "Based on the analysis, this opportunity shows strong potential. Recommend proceeding (GO)."
        elif overall >= 50:
            return "This opportunity has moderate potential. Consider the risks and benefits carefully before deciding."
        else:
            return "This opportunity presents significant challenges. Recommend declining (NO-GO) unless strategic considerations override."
    
    try:
        prompt = f"""You are an RFP strategy advisor. Based on the following Go/No-Go analysis for an RFP opportunity, provide a concise 2-3 sentence recommendation.

Project: {project.name}
Industry: {project.industry or 'Not specified'}
Client: {project.client_name or 'Not specified'}
Value: ${project.project_value or 'Not specified'}

Analysis Scores (0-100):
- Resource Availability: {scores['resources']['score']} - {scores['resources']['details']}
- Timeline Feasibility: {scores['timeline']['score']} - {scores['timeline']['details']}
- Past Experience Match: {scores['experience']['score']} - {scores['experience']['details']}
- Competitive Position: {scores['competition']['score']} - {scores['competition']['details']}

Overall Win Probability: {scores['overall']}%

Provide a clear GO or NO-GO recommendation with brief reasoning. Be direct and actionable."""

        # Handle both dynamic provider and legacy model
        if hasattr(model, 'generate_content'):
            # Could be legacy GenAI model or dynamic provider
            response = model.generate_content(prompt)
            if hasattr(response, 'text'):
                return response.text.strip()
            return str(response).strip()
        else:
            return str(model.generate_content(prompt)).strip()
            
    except Exception as e:
        logger.error(f"AI recommendation failed: {e}")
        overall = scores['overall']
        if overall >= 70:
            return "Based on the analysis, this opportunity shows strong potential. Recommend proceeding (GO)."
        elif overall >= 50:
            return "This opportunity has moderate potential. Consider the risks and benefits carefully before deciding."
        else:
            return "This opportunity presents significant challenges. Recommend declining (NO-GO) unless strategic considerations override."


def run_go_no_go_analysis(project_id: int, criteria: dict, user_id: int) -> dict:
    """
    Run full Go/No-Go analysis for a project.
    
    Args:
        project_id: ID of the project to analyze
        criteria: Dictionary with evaluation inputs
        user_id: ID of the user running the analysis
    
    Returns:
        Complete analysis result with scores and recommendation
    """
    project = Project.query.get(project_id)
    if not project:
        raise ValueError(f"Project {project_id} not found")
    
    user = User.query.get(user_id)
    if not user:
        raise ValueError(f"User {user_id} not found")
    
    org_id = project.organization_id
    
    # Calculate dimension scores
    resource_result = calculate_resource_score(criteria)
    timeline_result = calculate_timeline_score(project, criteria)
    experience_result = calculate_experience_score(project, org_id)
    competitive_result = calculate_competitive_score(criteria)
    
    # Calculate weighted overall score
    overall_score = (
        resource_result['score'] * DIMENSION_WEIGHTS['resources'] +
        timeline_result['score'] * DIMENSION_WEIGHTS['timeline'] +
        experience_result['score'] * DIMENSION_WEIGHTS['experience'] +
        competitive_result['score'] * DIMENSION_WEIGHTS['competition']
    )
    
    scores = {
        'resources': resource_result,
        'timeline': timeline_result,
        'experience': experience_result,
        'competition': competitive_result,
        'overall': round(overall_score, 1)
    }
    
    # Generate AI recommendation
    ai_recommendation = generate_ai_recommendation(project, scores, criteria, org_id)
    
    # Determine status
    if overall_score >= 70:
        status = 'go'
    elif overall_score < 45:
        status = 'no_go'
    else:
        status = 'pending'  # Needs human decision
    
    # Build final analysis result
    analysis = {
        'scores': scores,
        'weights': DIMENSION_WEIGHTS,
        'criteria_used': criteria,
        'ai_recommendation': ai_recommendation,
        'analyzed_by': user_id,
        'analyzed_at': datetime.utcnow().isoformat()
    }
    
    # Update project with analysis results
    project.go_no_go_status = status
    project.go_no_go_score = overall_score
    project.go_no_go_analysis = analysis
    project.go_no_go_completed_at = datetime.utcnow()
    
    db.session.commit()
    
    return {
        'status': status,
        'win_probability': round(overall_score, 1),
        'breakdown': {
            'resources': resource_result,
            'timeline': timeline_result,
            'experience': experience_result,
            'competition': competitive_result
        },
        'ai_recommendation': ai_recommendation,
        'completed_at': project.go_no_go_completed_at.isoformat()
    }
