"""
Vendor Profile Agent

Retrieves and formats vendor profile data (clients, success stories, capabilities, testimonials)
to provide rich context for AI-powered RFP answer generation.
"""
import logging
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session

from app.models import (
    VendorProfile, VendorClient, VendorSuccessStory,
    VendorCapability, VendorTestimonial, Organization
)

logger = logging.getLogger(__name__)


class VendorProfileAgent:
    """
    Agent for retrieving and formatting vendor profile information
    to inject into LLM context for personalized RFP responses.
    """
    
    @staticmethod
    def get_relevant_clients(
        organization_id: int,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[VendorClient]:
        """
        Get relevant clients based on RFP context.
        
        Args:
            organization_id: Organization ID
            filters: Optional filters (industry, size, location, etc.)
            
        Returns:
            List of matching vendor clients
        """
        try:
            profile = VendorProfile.query.filter_by(organization_id=organization_id).first()
            if not profile:
                return []
            
            query = VendorClient.query.filter_by(
                vendor_profile_id=profile.id,
                is_public=True
            )
            
            if filters:
                if filters.get('industry'):
                    query = query.filter(
                        VendorClient.client_industry.ilike(f"%{filters['industry']}%")
                    )
                if filters.get('size'):
                    query = query.filter_by(client_size=filters['size'])
                if filters.get('ongoing_only'):
                    query = query.filter_by(relationship_status='ongoing')
            
            return query.order_by(VendorClient.start_date.desc()).limit(10).all()
            
        except Exception as e:
            logger.error(f"Error retrieving clients: {e}")
            return []
    
    @staticmethod
    def get_relevant_success_stories(
        organization_id: int,
        context: Optional[Dict[str, Any]] = None
    ) -> List[VendorSuccessStory]:
        """
        Get relevant success stories based on RFP requirements.
        
        Args:
            organization_id: Organization ID
            context: RFP context (industry, tags, technologies, etc.)
            
        Returns:
            List of matching success stories
        """
        try:
            profile = VendorProfile.query.filter_by(organization_id=organization_id).first()
            if not profile:
                return []
            
            query = VendorSuccessStory.query.filter_by(
                vendor_profile_id=profile.id,
                is_public=True
            )
            
            if context:
                if context.get('industry'):
                    query = query.filter(
                        VendorSuccessStory.industry.ilike(f"%{context['industry']}%")
                    )
                if context.get('technologies'):
                    # Filter stories that include any of the mentioned technologies
                    for tech in context['technologies']:
                        query = query.filter(
                            VendorSuccessStory.technologies_used.contains([tech])
                        )
            
            # Prioritize featured stories
            return query.order_by(
                VendorSuccessStory.is_featured.desc(),
                VendorSuccessStory.display_order.asc()
            ).limit(5).all()
            
        except Exception as e:
            logger.error(f"Error retrieving success stories: {e}")
            return []
    
    @staticmethod
    def get_relevant_capabilities(
        organization_id: int,
        required_capabilities: Optional[List[str]] = None
    ) -> List[VendorCapability]:
        """
        Get relevant capabilities matching RFP requirements.
        
        Args:
            organization_id: Organization ID
            required_capabilities: List of required capability keywords
            
        Returns:
            List of matching capabilities
        """
        try:
            profile = VendorProfile.query.filter_by(organization_id=organization_id).first()
            if not profile:
                return []
            
            query = VendorCapability.query.filter_by(vendor_profile_id=profile.id)
            
            if required_capabilities:
                # Filter capabilities that match any required keyword
                filters = []
                for cap in required_capabilities:
                    filters.append(VendorCapability.capability_name.ilike(f"%{cap}%"))
                    filters.append(VendorCapability.description.ilike(f"%{cap}%"))
                
                from sqlalchemy import or_
                query = query.filter(or_(*filters))
            
            # Prioritize core capabilities and expertise
            return query.order_by(
                VendorCapability.is_core_capability.desc(),
                VendorCapability.expertise_level.desc(),
                VendorCapability.years_of_experience.desc()
            ).limit(10).all()
            
        except Exception as e:
            logger.error(f"Error retrieving capabilities: {e}")
            return []
    
    @staticmethod
    def get_relevant_testimonials(
        organization_id: int,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[VendorTestimonial]:
        """
        Get relevant client testimonials.
        
        Args:
            organization_id: Organization ID
            filters: Optional filters (industry, rating, verified, etc.)
            
        Returns:
            List of testimonials
        """
        try:
            profile = VendorProfile.query.filter_by(organization_id=organization_id).first()
            if not profile:
                return []
            
            query = VendorTestimonial.query.filter_by(
                vendor_profile_id=profile.id,
                is_public=True
            )
            
            if filters:
                if filters.get('verified_only'):
                    query = query.filter_by(is_verified=True)
                if filters.get('min_rating'):
                    query = query.filter(
                        VendorTestimonial.rating >= filters['min_rating']
                    )
            
            # Prioritize featured, verified, and highly-rated testimonials
            return query.order_by(
                VendorTestimonial.is_featured.desc(),
                VendorTestimonial.is_verified.desc(),
                VendorTestimonial.rating.desc()
            ).limit(5).all()
            
        except Exception as e:
            logger.error(f"Error retrieving testimonials: {e}")
            return []
    
    @staticmethod
    def format_vendor_context_for_llm(
        organization_id: int,
        rfp_context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Format comprehensive vendor context for LLM injection.
        
        Args:
            organization_id: Organization ID
            rfp_context: RFP requirements and context
            
        Returns:
            Formatted vendor context string for LLM
        """
        try:
            profile = VendorProfile.query.filter_by(organization_id=organization_id).first()
            if not profile:
                return ""
            
            context_parts = []
            
            # Company Overview
            context_parts.append("=== COMPANY PROFILE ===")
            context_parts.append(f"Company: {profile.company_name}")
            if profile.years_in_business:
                context_parts.append(f"Years in Business: {profile.years_in_business}")
            if profile.employee_count_range:
                context_parts.append(f"Team Size: {profile.employee_count_range}")
            if profile.company_description:
                context_parts.append(f"Description: {profile.company_description}")
            if profile.certifications:
                context_parts.append(f"Certifications: {', '.join(profile.certifications)}")
            context_parts.append("")
            
            # Relevant Clients
            clients = VendorProfileAgent.get_relevant_clients(
                organization_id,
                rfp_context.get('filters') if rfp_context else None
            )
            if clients:
                context_parts.append("=== RELEVANT CLIENT EXPERIENCE ===")
                for client in clients[:5]:  # Top 5 most relevant
                    context_parts.append(f"- {client.client_name}: {client.client_industry}, {client.client_size}")
                    if client.services_provided:
                        context_parts.append(f"  Services: {', '.join(client.services_provided)}")
                    if client.project_count:
                        context_parts.append(f"  Projects Delivered: {client.project_count}")
                context_parts.append("")
            
            # Success Stories
            stories = VendorProfileAgent.get_relevant_success_stories(
                organization_id,
                rfp_context
            )
            if stories:
                context_parts.append("=== SUCCESS STORIES ===")
                for story in stories[:3]:  # Top 3 most relevant
                    context_parts.append(f"\nStory: {story.title}")
                    context_parts.append(f"Client: {story.client_name} ({story.industry})")
                    if story.challenge:
                        context_parts.append(f"Challenge: {story.challenge[:200]}...")
                    if story.solution:
                        context_parts.append(f"Solution: {story.solution[:200]}...")
                    if story.impact:
                        context_parts.append(f"Impact: {story.impact[:200]}...")
                    if story.impact_metrics:
                        metrics = [f"{k}: {v.get('value')}{v.get('unit', '')}" 
                                 for k, v in story.impact_metrics.items()]
                        context_parts.append(f"Results: {', '.join(metrics)}")
                context_parts.append("")
            
            # Capabilities
            capabilities = VendorProfileAgent.get_relevant_capabilities(
                organization_id,
                rfp_context.get('required_capabilities') if rfp_context else None
            )
            if capabilities:
                context_parts.append("=== KEY CAPABILITIES ===")
                for cap in capabilities[:5]:
                    context_parts.append(f"- {cap.capability_name} ({cap.expertise_level})")
                    if cap.years_of_experience:
                        context_parts.append(f"  Experience: {cap.years_of_experience} years")
                    if cap.description:
                        context_parts.append(f"  {cap.description[:150]}...")
                context_parts.append("")
            
            # Testimonials
            testimonials = VendorProfileAgent.get_relevant_testimonials(
                organization_id,
                {'verified_only': True, 'min_rating': 4}
            )
            if testimonials:
                context_parts.append("=== CLIENT TESTIMONIALS ===")
                for test in testimonials[:2]:
                    rating_stars = "★" * int(test.rating) if test.rating else ""
                    context_parts.append(f"- \"{test.testimonial_text[:150]}...\"")
                    context_parts.append(f"  - {test.client_name}, {test.client_designation} {rating_stars}")
                context_parts.append("")
            
            return "\n".join(context_parts)
            
        except Exception as e:
            logger.error(f"Error formatting vendor context: {e}")
            return ""


# Standalone function for quick access
def get_vendor_context(organization_id: int, rfp_context: Optional[Dict] = None) -> str:
    """
    Quick access function to get formatted vendor context.
    
    Args:
        organization_id: Organization ID
        rfp_context: Optional RFP context for filtering
        
    Returns:
        Formatted vendor context string
    """
    return VendorProfileAgent.format_vendor_context_for_llm(organization_id, rfp_context)
