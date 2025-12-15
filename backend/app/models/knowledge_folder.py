"""
Knowledge Folder Model for hierarchical organization.
"""
from datetime import datetime
from ..extensions import db


class KnowledgeFolder(db.Model):
    """Folder for organizing knowledge items hierarchically."""
    __tablename__ = 'knowledge_folders'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('knowledge_folders.id'), nullable=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    icon = db.Column(db.String(50), default='folder')  # Emoji or icon name
    color = db.Column(db.String(20), nullable=True)  # Hex color
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization')
    creator = db.relationship('User', foreign_keys=[created_by])
    parent = db.relationship('KnowledgeFolder', remote_side=[id], backref='children')
    items = db.relationship('KnowledgeItem', back_populates='folder', lazy='dynamic')
    
    def to_dict(self, include_children=False, include_items=False):
        """Serialize folder to dictionary."""
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'parent_id': self.parent_id,
            'icon': self.icon,
            'color': self.color,
            'sort_order': self.sort_order,
            'item_count': self.items.filter_by(is_active=True).count(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_children:
            data['children'] = [
                child.to_dict(include_children=True)
                for child in self.children
                if child.is_active
            ]
        
        if include_items:
            data['items'] = [
                item.to_dict()
                for item in self.items.filter_by(is_active=True).all()
            ]
        
        return data
    
    def get_path(self):
        """Get full folder path as list of folder names."""
        path = [self.name]
        current = self
        while current.parent:
            current = current.parent
            path.insert(0, current.name)
        return path
    
    def get_all_items(self, include_subfolders=True):
        """Get all items in this folder and optionally subfolders."""
        items = list(self.items.filter_by(is_active=True).all())
        
        if include_subfolders:
            for child in self.children:
                if child.is_active:
                    items.extend(child.get_all_items(include_subfolders=True))
        
        return items
