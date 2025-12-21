"""Section Version model for tracking section edit history."""
from datetime import datetime
from ..extensions import db


class SectionVersion(db.Model):
    """
    Stores historical versions of section content.
    Created automatically when section content is modified.
    """
    __tablename__ = 'section_versions'
    
    id = db.Column(db.Integer, primary_key=True)
    section_id = db.Column(db.Integer, db.ForeignKey('rfp_sections.id', ondelete='CASCADE'), nullable=False)
    version_number = db.Column(db.Integer, nullable=False)  # Matches section.version at time of save
    content = db.Column(db.Text)  # Content at this version
    title = db.Column(db.String(255))  # Title at this version
    status = db.Column(db.String(50))  # Status at this version
    confidence_score = db.Column(db.Float)  # Confidence at this version
    change_type = db.Column(db.String(50), default='edit')  # edit, generate, regenerate, restore
    change_summary = db.Column(db.String(500))  # Brief description of what changed
    changed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    section = db.relationship('RFPSection', backref=db.backref('history', lazy='dynamic', order_by='SectionVersion.version_number.desc()'))
    changed_by_user = db.relationship('User', foreign_keys=[changed_by])
    
    def to_dict(self):
        """Serialize version to dictionary."""
        return {
            'id': self.id,
            'section_id': self.section_id,
            'version_number': self.version_number,
            'content': self.content,
            'title': self.title,
            'status': self.status,
            'confidence_score': self.confidence_score,
            'change_type': self.change_type,
            'change_summary': self.change_summary,
            'changed_by': self.changed_by,
            'changed_by_name': self.changed_by_user.name if self.changed_by_user else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


def save_section_version(section, user_id, change_type='edit', change_summary=None):
    """
    Helper function to save a section version before changes.
    Should be called BEFORE modifying the section content.
    
    Args:
        section: The RFPSection object to snapshot
        user_id: ID of the user making the change
        change_type: Type of change (edit, generate, regenerate, restore)
        change_summary: Optional description of the change
    
    Returns:
        SectionVersion object
    """
    version = SectionVersion(
        section_id=section.id,
        version_number=section.version,
        content=section.content,
        title=section.title,
        status=section.status,
        confidence_score=section.confidence_score,
        change_type=change_type,
        change_summary=change_summary,
        changed_by=user_id,
    )
    db.session.add(version)
    return version
