"""RFP Section models for flexible proposal building"""
from datetime import datetime
from app import db


class RFPSectionType(db.Model):
    """
    Defines available section types and their generation configuration.
    Examples: Company Profile, Technical Approach, Resource Allocation, etc.
    """
    __tablename__ = 'rfp_section_types'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)  # e.g., "Company Profile"
    slug = db.Column(db.String(50), unique=True, nullable=False)  # e.g., "company_profile"
    description = db.Column(db.Text)
    icon = db.Column(db.String(50))  # Emoji or icon name for UI
    default_prompt = db.Column(db.Text)  # AI generation prompt template
    required_inputs = db.Column(db.JSON, default=list)  # Required user inputs before generation
    knowledge_scopes = db.Column(db.JSON, default=list)  # Which KB categories to search
    is_system = db.Column(db.Boolean, default=False)  # Built-in vs custom section types
    is_active = db.Column(db.Boolean, default=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = db.relationship('Organization', backref='section_types')
    sections = db.relationship('RFPSection', back_populates='section_type', lazy='dynamic')
    templates = db.relationship('SectionTemplate', back_populates='section_type', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'description': self.description,
            'icon': self.icon,
            'default_prompt': self.default_prompt,
            'required_inputs': self.required_inputs or [],
            'knowledge_scopes': self.knowledge_scopes or [],
            'is_system': self.is_system,
            'is_active': self.is_active,
            'organization_id': self.organization_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class RFPSection(db.Model):
    """
    Instance of a section within a project.
    Each project can have multiple sections of different types.
    """
    __tablename__ = 'rfp_sections'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    section_type_id = db.Column(db.Integer, db.ForeignKey('rfp_section_types.id'), nullable=False)
    title = db.Column(db.String(255))  # Custom title override
    order = db.Column(db.Integer, default=0)  # Display order in proposal
    status = db.Column(db.String(50), default='draft')  # draft, generated, reviewed, approved
    content = db.Column(db.Text)  # Generated/edited content
    inputs = db.Column(db.JSON, default=dict)  # User-provided inputs for generation
    ai_generation_params = db.Column(db.JSON, default=dict)  # Tone, length, etc.
    confidence_score = db.Column(db.Float)
    sources = db.Column(db.JSON, default=list)  # Knowledge sources used
    flags = db.Column(db.JSON, default=list)  # Review flags
    version = db.Column(db.Integer, default=1)
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    project = db.relationship('Project', backref=db.backref('sections', lazy='dynamic', order_by='RFPSection.order'))
    section_type = db.relationship('RFPSectionType', back_populates='sections')
    reviewer = db.relationship('User', foreign_keys=[reviewed_by])
    
    def to_dict(self, include_content=True):
        result = {
            'id': self.id,
            'project_id': self.project_id,
            'section_type_id': self.section_type_id,
            'section_type': self.section_type.to_dict() if self.section_type else None,
            'title': self.title or (self.section_type.name if self.section_type else ''),
            'order': self.order,
            'status': self.status,
            'inputs': self.inputs or {},
            'ai_generation_params': self.ai_generation_params or {},
            'confidence_score': self.confidence_score,
            'sources': self.sources or [],
            'flags': self.flags or [],
            'version': self.version,
            'reviewed_by': self.reviewed_by,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_content:
            result['content'] = self.content
        return result


class SectionTemplate(db.Model):
    """
    Reusable templates for section content.
    Templates can have variables like {{company_name}} that get substituted.
    """
    __tablename__ = 'section_templates'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    section_type_id = db.Column(db.Integer, db.ForeignKey('rfp_section_types.id'), nullable=True)
    content = db.Column(db.Text, nullable=False)  # Template content with {{variables}}
    variables = db.Column(db.JSON, default=list)  # List of variable names used
    description = db.Column(db.Text)
    is_default = db.Column(db.Boolean, default=False)  # Default template for section type
    is_active = db.Column(db.Boolean, default=True)
    organization_id = db.Column(db.Integer, db.ForeignKey('organizations.id'), nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    section_type = db.relationship('RFPSectionType', back_populates='templates')
    organization = db.relationship('Organization', backref='section_templates')
    creator = db.relationship('User', foreign_keys=[created_by])
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'section_type_id': self.section_type_id,
            'section_type': self.section_type.to_dict() if self.section_type else None,
            'content': self.content,
            'variables': self.variables or [],
            'description': self.description,
            'is_default': self.is_default,
            'is_active': self.is_active,
            'organization_id': self.organization_id,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
    
    def render(self, context: dict) -> str:
        """Render template with variable substitution"""
        result = self.content
        for var in self.variables or []:
            placeholder = '{{' + var + '}}'
            value = context.get(var, '')
            result = result.replace(placeholder, str(value))
        return result


# Default section types to seed
DEFAULT_SECTION_TYPES = [
    {
        'slug': 'executive_summary',
        'name': 'Executive Summary',
        'icon': '📋',
        'description': 'High-level overview of the proposal covering key points and value proposition',
        'required_inputs': ['project_name', 'client_name'],
        'knowledge_scopes': ['company_profile', 'case_studies'],
        'default_prompt': '''Write a compelling executive summary for an RFP proposal.
Project: {{project_name}}
Client: {{client_name}}

Include:
- Brief company introduction
- Understanding of client needs
- Proposed solution overview
- Key differentiators
- Expected outcomes and value

Keep it concise (2-3 paragraphs) and persuasive.''',
        'is_system': True,
    },
    {
        'slug': 'company_profile',
        'name': 'Company Profile',
        'icon': '🏢',
        'description': 'Company background, history, and core capabilities',
        'required_inputs': [],
        'knowledge_scopes': ['company_info'],
        'default_prompt': '''Generate a professional company profile section including:
- Company overview and founding story
- Mission and vision
- Core services and capabilities
- Key statistics (employees, years in business, clients served)
- Industry focus areas

Use a professional, confident tone.''',
        'is_system': True,
    },
    {
        'slug': 'company_strengths',
        'name': 'Company Strengths',
        'icon': '💪',
        'description': 'Key differentiators and competitive advantages',
        'required_inputs': [],
        'knowledge_scopes': ['achievements', 'case_studies', 'company_info'],
        'default_prompt': '''Highlight our key strengths and competitive advantages based on:
{{context}}

Format as 4-6 compelling strength points with brief explanations.
Focus on what sets us apart from competitors.''',
        'is_system': True,
    },
    {
        'slug': 'technical_approach',
        'name': 'Technical Approach',
        'icon': '🔧',
        'description': 'Methodology, technologies, and solution approach',
        'required_inputs': ['project_description', 'tech_requirements'],
        'knowledge_scopes': ['tech_docs', 'architecture', 'methodologies'],
        'default_prompt': '''Create a technical approach section for:
Project: {{project_description}}
Requirements: {{tech_requirements}}

Include:
- Development methodology (Agile/Scrum recommended)
- Technology stack recommendations
- Architecture overview
- Quality assurance approach
- DevOps and deployment strategy''',
        'is_system': True,
    },
    {
        'slug': 'project_architecture',
        'name': 'Project Architecture',
        'icon': '🏗️',
        'description': 'System architecture and technical design',
        'required_inputs': ['tech_stack', 'scale_requirements'],
        'knowledge_scopes': ['architecture_patterns', 'tech_docs'],
        'default_prompt': '''Design a system architecture for:
Tech Stack: {{tech_stack}}
Scale Requirements: {{scale_requirements}}

Include:
- High-level architecture diagram description
- Component breakdown
- Data flow
- Integration points
- Scalability considerations
- Security architecture''',
        'is_system': True,
    },
    {
        'slug': 'resource_allocation',
        'name': 'Resource Allocation',
        'icon': '👥',
        'description': 'Team structure, roles, and allocation plan',
        'required_inputs': ['project_duration', 'team_size_range'],
        'knowledge_scopes': ['team_templates', 'roles'],
        'default_prompt': '''Propose a team structure for:
Duration: {{project_duration}}
Team Size: {{team_size_range}}

Include:
- Team composition with roles
- Experience level requirements
- Allocation percentages by phase
- Key personnel profiles
- Communication structure''',
        'is_system': True,
    },
    {
        'slug': 'project_estimation',
        'name': 'Project Estimation',
        'icon': '📊',
        'description': 'Timeline, milestones, and effort estimates',
        'required_inputs': ['scope_summary', 'budget_range'],
        'knowledge_scopes': ['estimation_templates'],
        'default_prompt': '''Create a project estimation for:
Scope: {{scope_summary}}
Budget Range: {{budget_range}}

Include:
- Project phases with durations
- Key milestones
- Effort breakdown by activity
- Risk buffer considerations
- Payment milestone suggestions''',
        'is_system': True,
    },
    {
        'slug': 'case_studies',
        'name': 'Case Studies & References',
        'icon': '📚',
        'description': 'Relevant past project examples and client references',
        'required_inputs': ['industry', 'project_type'],
        'knowledge_scopes': ['case_studies', 'testimonials'],
        'default_prompt': '''Select and present relevant case studies for:
Industry: {{industry}}
Project Type: {{project_type}}

For each case study include:
- Client name (if shareable) or industry
- Challenge description
- Solution provided
- Technologies used
- Results achieved''',
        'is_system': True,
    },
    {
        'slug': 'compliance_matrix',
        'name': 'Compliance Matrix',
        'icon': '✅',
        'description': 'Requirements compliance mapping table',
        'required_inputs': ['requirements_list'],
        'knowledge_scopes': ['compliance', 'policies'],
        'default_prompt': '''Create a compliance matrix for these requirements:
{{requirements_list}}

Format as a table with columns:
- Requirement ID
- Requirement Description
- Compliance Status (Compliant/Partial/Alternative)
- Our Approach/Evidence''',
        'is_system': True,
    },
    {
        'slug': 'qa_questionnaire',
        'name': 'Q&A / Questionnaire',
        'icon': '❓',
        'description': 'Answer individual questions from the RFP',
        'required_inputs': [],
        'knowledge_scopes': ['all'],
        'default_prompt': '''Answer this RFP question professionally and accurately:
{{question}}

Use knowledge from our database to provide a factual, confident response.
Cite sources where applicable.''',
        'is_system': True,
    },
    {
        'slug': 'custom',
        'name': 'Custom Section',
        'icon': '✏️',
        'description': 'Free-form section with AI writing assistance',
        'required_inputs': ['section_prompt'],
        'knowledge_scopes': ['all'],
        'default_prompt': '''{{section_prompt}}

Write professional content based on the above instructions.
Use relevant knowledge from our database.''',
        'is_system': True,
    },
]


def seed_section_types(db_session):
    """Seed default section types if they don't exist"""
    from sqlalchemy.exc import IntegrityError
    
    for section_data in DEFAULT_SECTION_TYPES:
        existing = RFPSectionType.query.filter_by(slug=section_data['slug']).first()
        if not existing:
            section_type = RFPSectionType(**section_data)
            db_session.add(section_type)
    
    try:
        db_session.commit()
        print(f"Seeded {len(DEFAULT_SECTION_TYPES)} section types")
    except IntegrityError:
        db_session.rollback()
        print("Section types already exist, skipping seed")
