"""Vendor Profile Service - Business logic for vendor profile management."""
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

from app.extensions import db
from app.models import (
    VendorProfile, VendorClient, VendorSuccessStory,
    VendorCapability, VendorTestimonial, Organization
)

logger = logging.getLogger(__name__)


class VendorProfileService:
    """Service for managing vendor profiles and related entities."""
    
    @staticmethod
    def get_or_create_profile(organization_id: int) -> VendorProfile:
        """Get existing profile or create new one for organization."""
        profile = VendorProfile.query.filter_by(organization_id=organization_id).first()
        
        if not profile:
            org = Organization.query.get(organization_id)
            profile = VendorProfile(
                organization_id=organization_id,
                company_name=org.name if org else None
            )
            db.session.add(profile)
            db.session.commit()
        
        return profile
    
    @staticmethod
    def update_profile(organization_id: int, data: Dict) -> VendorProfile:
        """Update vendor profile with provided data."""
        profile = VendorProfileService.get_or_create_profile(organization_id)
        
        # Update fields
        for key, value in data.items():
            if hasattr(profile, key):
                setattr(profile, key, value)
        
        profile.updated_at = datetime.utcnow()
        db.session.commit()
        
        return profile
    
    @staticmethod
    def get_profile_summary(organization_id: int) -> Dict:
        """Get complete profile summary with counts."""
        profile = VendorProfileService.get_or_create_profile(organization_id)
        
        return {
            **profile.to_dict(),
            'stats': {
                'clients_count': profile.clients.count(),
                'ongoing_clients': profile.clients.filter_by(relationship_status='ongoing').count(),
                'success_stories_count': profile.success_stories.count(),
                'featured_stories': profile.success_stories.filter_by(is_featured=True).count(),
                'capabilities_count': profile.capabilities.count(),
                'testimonials_count': profile.testimonials.count(),
            }
        }
    
    # Client Management
    @staticmethod
    def add_client(vendor_profile_id: int, data: Dict) -> VendorClient:
        """Add a new client to vendor profile."""
        client = VendorClient(vendor_profile_id=vendor_profile_id, **data)
        db.session.add(client)
        db.session.commit()
        return client
    
    @staticmethod
    def update_client(client_id: int, data: Dict) -> VendorClient:
        """Update client information."""
        client = VendorClient.query.get_or_404(client_id)
        
        for key, value in data.items():
            if hasattr(client, key):
                setattr(client, key, value)
        
        client.updated_at = datetime.utcnow()
        db.session.commit()
        return client
    
    @staticmethod
    def delete_client(client_id: int) -> bool:
        """Delete a client."""
        client = VendorClient.query.get_or_404(client_id)
        db.session.delete(client)
        db.session.commit()
        return True
    
    @staticmethod
    def get_clients(vendor_profile_id: int, filters: Optional[Dict] = None) -> List[VendorClient]:
        """Get all clients with optional filtering."""
        query = VendorClient.query.filter_by(vendor_profile_id=vendor_profile_id)
        
        if filters:
            if filters.get('relationship_status'):
                query = query.filter_by(relationship_status=filters['relationship_status'])
            if filters.get('client_industry'):
                query = query.filter_by(client_industry=filters['client_industry'])
            if filters.get('client_size'):
                query = query.filter_by(client_size=filters['client_size'])
            if filters.get('is_public') is not None:
                query = query.filter_by(is_public=filters['is_public'])
        
        return query.order_by(VendorClient.start_date.desc()).all()
    
    # Success Story Management
    @staticmethod
    def add_success_story(vendor_profile_id: int, data: Dict) -> VendorSuccessStory:
        """Add a new success story."""
        story = VendorSuccessStory(vendor_profile_id=vendor_profile_id, **data)
        db.session.add(story)
        db.session.commit()
        return story
    
    @staticmethod
    def update_success_story(story_id: int, data: Dict) -> VendorSuccessStory:
        """Update success story."""
        story = VendorSuccessStory.query.get_or_404(story_id)
        
        for key, value in data.items():
            if hasattr(story, key):
                setattr(story, key, value)
        
        story.updated_at = datetime.utcnow()
        db.session.commit()
        return story
    
    @staticmethod
    def delete_success_story(story_id: int) -> bool:
        """Delete a success story."""
        story = VendorSuccessStory.query.get_or_404(story_id)
        db.session.delete(story)
        db.session.commit()
        return True
    
    @staticmethod
    def toggle_featured_story(story_id: int) -> VendorSuccessStory:
        """Toggle featured status of a story."""
        story = VendorSuccessStory.query.get_or_404(story_id)
        story.is_featured = not story.is_featured
        db.session.commit()
        return story
    
    @staticmethod
    def get_success_stories(vendor_profile_id: int, filters: Optional[Dict] = None) -> List[VendorSuccessStory]:
        """Get all success stories with optional filtering."""
        query = VendorSuccessStory.query.filter_by(vendor_profile_id=vendor_profile_id)
        
        if filters:
            if filters.get('industry'):
                query = query.filter_by(industry=filters['industry'])
            if filters.get('is_featured') is not None:
                query = query.filter_by(is_featured=filters['is_featured'])
            if filters.get('tags'):
                # Filter by tags (JSON contains)
                for tag in filters['tags']:
                    query = query.filter(VendorSuccessStory.tags.contains([tag]))
        
        return query.order_by(VendorSuccessStory.is_featured.desc(), 
                            VendorSuccessStory.display_order.asc()).all()
    
    # Capability Management
    @staticmethod
    def add_capability(vendor_profile_id: int, data: Dict) -> VendorCapability:
        """Add a new capability."""
        capability = VendorCapability(vendor_profile_id=vendor_profile_id, **data)
        db.session.add(capability)
        db.session.commit()
        return capability
    
    @staticmethod
    def update_capability(capability_id: int, data: Dict) -> VendorCapability:
        """Update capability."""
        capability = VendorCapability.query.get_or_404(capability_id)
        
        for key, value in data.items():
            if hasattr(capability, key):
                setattr(capability, key, value)
        
        capability.updated_at = datetime.utcnow()
        db.session.commit()
        return capability
    
    @staticmethod
    def delete_capability(capability_id: int) -> bool:
        """Delete a capability."""
        capability = VendorCapability.query.get_or_404(capability_id)
        db.session.delete(capability)
        db.session.commit()
        return True
    
    @staticmethod
    def get_capabilities(vendor_profile_id: int, core_only: bool = False) -> List[VendorCapability]:
        """Get all capabilities."""
        query = VendorCapability.query.filter_by(vendor_profile_id=vendor_profile_id)
        
        if core_only:
            query = query.filter_by(is_core_capability=True)
        
        return query.order_by(VendorCapability.is_core_capability.desc(),
                            VendorCapability.display_order.asc()).all()
    
    # Testimonial Management
    @staticmethod
    def add_testimonial(vendor_profile_id: int, data: Dict) -> VendorTestimonial:
        """Add a new testimonial."""
        testimonial = VendorTestimonial(vendor_profile_id=vendor_profile_id, **data)
        db.session.add(testimonial)
        db.session.commit()
        return testimonial
    
    @staticmethod
    def update_testimonial(testimonial_id: int, data: Dict) -> VendorTestimonial:
        """Update testimonial."""
        testimonial = VendorTestimonial.query.get_or_404(testimonial_id)
        
        for key, value in data.items():
            if hasattr(testimonial, key):
                setattr(testimonial, key, value)
        
        testimonial.updated_at = datetime.utcnow()
        db.session.commit()
        return testimonial
    
    @staticmethod
    def delete_testimonial(testimonial_id: int) -> bool:
        """Delete a testimonial."""
        testimonial = VendorTestimonial.query.get_or_404(testimonial_id)
        db.session.delete(testimonial)
        db.session.commit()
        return True
    
    @staticmethod
    def verify_testimonial(testimonial_id: int, method: str) -> VendorTestimonial:
        """Mark testimonial as verified."""
        testimonial = VendorTestimonial.query.get_or_404(testimonial_id)
        testimonial.is_verified = True
        testimonial.verification_method = method
        testimonial.verification_date = datetime.utcnow()
        db.session.commit()
        return testimonial
    
    @staticmethod
    def get_testimonials(vendor_profile_id: int, verified_only: bool = False) -> List[VendorTestimonial]:
        """Get all testimonials."""
        query = VendorTestimonial.query.filter_by(vendor_profile_id=vendor_profile_id)
        
        if verified_only:
            query = query.filter_by(is_verified=True)
        
        return query.order_by(VendorTestimonial.is_featured.desc(),
                            VendorTestimonial.rating.desc()).all()
