"""
Knowledge Folder Model for hierarchical organization.
"""
from datetime import datetime
from ..extensions import db


# Association table for linking global folders to specific projects
project_knowledge_folders = db.Table(
    'project_knowledge_folders',
    db.Column('project_id', db.Integer, db.ForeignKey('projects.id'), primary_key=True),
    db.Column('folder_id', db.Integer, db.ForeignKey('knowledge_folders.id'), primary_key=True),
    db.Column('linked_at', db.DateTime, default=datetime.utcnow),
    db.Column('linked_by', db.Integer, db.ForeignKey('users.id'), nullable=True)
)


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
    
    # NEW: Global folder settings
    is_global = db.Column(db.Boolean, default=False)  # If True, available to ALL projects in org
    category = db.Column(db.String(100), nullable=True)  # company_info, pricing, products, legal, security, etc.
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization')
    creator = db.relationship('User', foreign_keys=[created_by])
    parent = db.relationship('KnowledgeFolder', remote_side=[id], backref='children')
    items = db.relationship('KnowledgeItem', back_populates='folder', lazy='dynamic')
    
    # NEW: Projects that have linked this folder (for non-global or selective access)
    linked_projects = db.relationship(
        'Project',
        secondary=project_knowledge_folders,
        backref=db.backref('linked_knowledge_folders', lazy='dynamic'),
        lazy='dynamic'
    )
    
    def to_dict(self, include_children=False, include_items=False):
        """Serialize folder to dictionary."""
        from app.models import KnowledgeItem
        
        # Count only parent documents, not chunks
        doc_count = self.items.filter_by(is_active=True).filter(
            KnowledgeItem.parent_id.is_(None)
        ).count()
        
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'parent_id': self.parent_id,
            'icon': self.icon,
            'color': self.color,
            'sort_order': self.sort_order,
            'is_global': self.is_global,  # NEW
            'category': self.category,  # NEW
            'item_count': doc_count,
            'linked_project_count': self.linked_projects.count() if self.linked_projects else 0,  # NEW
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
            # Filter out chunks (items with parent_id) - show only parent documents
            data['items'] = [
                item.to_dict()
                for item in self.items.filter_by(is_active=True).filter(
                    KnowledgeItem.parent_id.is_(None)
                ).all()
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
    
    def is_accessible_by_project(self, project_id: int) -> bool:
        """Check if this folder is accessible by a given project."""
        # Global folders are accessible to all projects in the org
        if self.is_global:
            return True
        # Check if project has explicitly linked this folder
        from app.models import Project
        return self.linked_projects.filter_by(id=project_id).first() is not None
    
    @classmethod
    def get_folders_for_project(cls, project_id: int, org_id: int):
        """Get all folders accessible by a project (global + linked)."""
        from app.models import Project
        project = Project.query.get(project_id)
        if not project:
            return []
        
        # Get all global folders for the org
        global_folders = cls.query.filter_by(
            organization_id=org_id,
            is_global=True,
            is_active=True
        ).all()
        
        # Get folders explicitly linked to this project
        linked_folders = project.linked_knowledge_folders.filter_by(is_active=True).all()
        
        # Combine and deduplicate
        all_folders = {f.id: f for f in global_folders}
        for f in linked_folders:
            all_folders[f.id] = f
        
        return list(all_folders.values())
