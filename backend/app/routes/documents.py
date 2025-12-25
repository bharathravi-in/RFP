import os
import uuid
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from ..extensions import db
from ..models import Document, Project, User

bp = Blueprint('documents', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'docx', 'xlsx', 'doc', 'xls', 'ppt', 'pptx'}


@bp.route('', methods=['GET'])
@jwt_required()
def list_documents():
    """List documents for a project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    project_id = request.args.get('project_id')
    if not project_id:
        return jsonify({'error': 'project_id required'}), 400
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    documents = Document.query.filter_by(project_id=project_id).order_by(Document.created_at.desc()).all()
    
    return jsonify({
        'documents': [d.to_dict() for d in documents]
    }), 200


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_document():
    """Upload a document to a project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    project_id = request.form.get('project_id')
    
    if not project_id:
        return jsonify({'error': 'Project ID required'}), 400
    
    project = Project.query.get(project_id)
    
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': f'File type not allowed. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'}), 400
    
    # Generate unique filename
    original_filename = secure_filename(file.filename)
    ext = original_filename.rsplit('.', 1)[1].lower()
    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    
    # Read file content into memory
    file_data = file.read()
    file_size = len(file_data)
    
    # Create document record with file data in DB
    document = Document(
        filename=unique_filename,
        original_filename=original_filename,
        file_data=file_data,  # Store binary content in DB
        file_type=ext,
        file_size=file_size,
        status='pending',
        project_id=project_id,
        uploaded_by=user_id
    )
    
    db.session.add(document)
    db.session.commit()
    
    # Auto-trigger document parsing
    parse_result = None
    try:
        from .documents import _parse_document_internal
        parse_result = _parse_document_internal(document)
    except Exception as e:
        parse_result = {'error': str(e)}
    
    return jsonify({
        'message': 'Document uploaded and processing started',
        'document': document.to_dict(),
        'parse_result': parse_result
    }), 201


@bp.route('/<int:document_id>', methods=['GET'])
@jwt_required()
def get_document(document_id):
    """Get document details."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    document = Document.query.get(document_id)
    
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    if document.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({
        'document': document.to_dict()
    }), 200


@bp.route('/<int:document_id>/parse', methods=['POST'])
@jwt_required()
def parse_document(document_id):
    """Trigger document parsing and question extraction."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    document = Document.query.get(document_id)
    
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    if document.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    result = _parse_document_internal(document)
    
    if 'error' in result:
        return jsonify(result), 500
    
    return jsonify(result), 200


def _parse_document_internal(document):
    """Internal function to parse document and extract questions."""
    import tempfile
    from datetime import datetime
    from ..services.document_service import DocumentService
    from ..services.extraction_service import QuestionExtractor
    from ..models import Question
    
    # Update status
    document.status = 'processing'
    db.session.commit()
    
    try:
        # Write file data to temp file for processing
        temp_file_path = None
        if document.file_data:
            temp_file = tempfile.NamedTemporaryFile(
                delete=False,
                suffix=f'.{document.file_type}'
            )
            temp_file.write(document.file_data)
            temp_file.close()
            temp_file_path = temp_file.name
        elif document.file_path:
            temp_file_path = document.file_path
        
        if not temp_file_path:
            document.status = 'failed'
            document.error_message = 'No file data available'
            db.session.commit()
            return {'error': 'No file data available'}
        
        # Extract text from document
        doc_service = DocumentService()
        extracted_text = doc_service.extract_text(temp_file_path, document.file_type)
        
        # Clean up temp file
        if document.file_data and temp_file_path:
            import os as temp_os
            try:
                temp_os.unlink(temp_file_path)
            except:
                pass
        
        if not extracted_text:
            document.status = 'failed'
            document.error_message = 'Could not extract text from document'
            db.session.commit()
            return {'error': 'Text extraction failed'}
        
        # Save extracted text
        document.extracted_text = extracted_text
        document.file_metadata = {
            'word_count': len(extracted_text.split()),
            'char_count': len(extracted_text),
        }
        
        # Extract questions
        extractor = QuestionExtractor()
        questions_data = extractor.extract_questions(extracted_text, use_ai=True)
        
        # Question category classification keywords
        category_keywords = {
            'security': ['security', 'encryption', 'authentication', 'password', 'access control', 
                        'firewall', 'vulnerability', 'penetration', 'gdpr', 'hipaa', 'soc', 'iso 27001',
                        'data protection', 'privacy', 'compliance', 'audit'],
            'technical': ['technical', 'architecture', 'infrastructure', 'api', 'integration',
                         'database', 'platform', 'cloud', 'mobile', 'system', 'software', 'hardware'],
            'pricing': ['pricing', 'cost', 'fee', 'budget', 'payment', 'license', 'commercial'],
            'implementation': ['implementation', 'timeline', 'schedule', 'phase', 'milestone', 
                              'deployment', 'go-live', 'rollout', 'project plan'],
            'support': ['support', 'maintenance', 'sla', 'service level', 'helpdesk', 'availability'],
            'team': ['team', 'staff', 'resource', 'personnel', 'experience', 'qualification', 'resume'],
            'training': ['training', 'documentation', 'manual', 'knowledge transfer', 'user guide'],
            'references': ['reference', 'case study', 'past performance', 'similar project', 'client'],
        }
        
        # Create Question records with category classification
        for q_data in questions_data:
            # Classify question category based on content
            q_text_lower = q_data['text'].lower()
            detected_category = 'general'
            detected_section = q_data.get('section', 'Q&A / Questionnaire')
            
            for category, keywords in category_keywords.items():
                if any(kw in q_text_lower for kw in keywords):
                    detected_category = category
                    # Map category to appropriate section name  
                    section_map = {
                        'security': 'Security & Compliance',
                        'technical': 'Technical Approach',
                        'pricing': 'Pricing & Commercial',
                        'implementation': 'Implementation Plan',
                        'support': 'Support & Maintenance',
                        'team': 'Team & Qualifications',
                        'training': 'Training & Documentation',
                        'references': 'References & Experience',
                    }
                    detected_section = section_map.get(category, detected_section)
                    break
            
            question = Question(
                text=q_data['text'],
                section=detected_section,
                category=detected_category,
                order=q_data.get('order', 0),
                status='pending',
                project_id=document.project_id,
                document_id=document.id
            )
            db.session.add(question)

        
        # Update document status
        document.status = 'completed'
        document.processed_at = datetime.utcnow()
        db.session.commit()
        
        # AUTO-ANALYZE RFP AND CREATE SECTIONS
        analysis_result = None
        sections_created = []
        try:
            from ..services.rfp_analysis_agent import RFPAnalysisAgent
            from ..models import RFPSectionType
            
            agent = RFPAnalysisAgent()
            
            # 1. Analyze the RFP document
            analysis_result = agent.analyze_rfp(document.id)
            
            if analysis_result and not analysis_result.get('error'):
                # 2. Get recommended section types
                recommended_sections = analysis_result.get('recommended_sections', [])
                
                if recommended_sections:
                    # Map slugs to section type IDs
                    section_type_ids = []
                    for slug in recommended_sections:
                        section_type = RFPSectionType.query.filter_by(slug=slug, is_active=True).first()
                        if section_type:
                            section_type_ids.append(section_type.id)
                    
                    if section_type_ids:
                        # 3. Auto-create sections with AI content generation
                        created_sections = agent.auto_create_sections(
                            project_id=document.project_id,
                            section_type_ids=section_type_ids,
                            with_generation=True,
                            document_id=document.id
                        )
                        sections_created = created_sections
        except Exception as analysis_error:
            # Log but don't fail - document is still processed
            print(f"Auto-analysis error: {analysis_error}")
            analysis_result = {'error': str(analysis_error)}
        
        # Update project status and completion after successful analysis
        project = document.project
        if project:
            # Update status from draft to in_progress
            if project.status == 'draft':
                project.status = 'in_progress'
            
            # Calculate completion based on questions answered and sections created
            completion = project.calculate_completion()
            project.completion_percent = completion
            
            db.session.commit()
        
        return {
            'message': 'Document parsed and analyzed successfully',
            'document': document.to_dict(),
            'questions_extracted': len(questions_data),
            'analysis': analysis_result,
            'sections_created': len(sections_created) if sections_created else 0
        }
        
    except Exception as e:
        document.status = 'failed'
        document.error_message = str(e)
        db.session.commit()
        return {'error': f'Processing failed: {str(e)}'}


@bp.route('/<int:document_id>', methods=['DELETE'])
@jwt_required()
def delete_document(document_id):
    """Delete a document."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    document = Document.query.get(document_id)
    
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    if document.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Delete file
    if document.file_path and os.path.exists(document.file_path):
        os.remove(document.file_path)
    
    db.session.delete(document)
    db.session.commit()
    
    return jsonify({'message': 'Document deleted'}), 200


@bp.route('/<int:document_id>/analyze', methods=['POST'])
@jwt_required()
def analyze_document(document_id):
    """Analyze an RFP document to extract structure and suggest proposal sections."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    document = Document.query.get(document_id)
    
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    if document.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Check if document has been parsed
    if document.status != 'completed' or not document.extracted_text:
        # Auto-parse if needed
        result = _parse_document_internal(document)
        if 'error' in result:
            return jsonify(result), 500
    
    # Run analysis
    from ..services.rfp_analysis_agent import get_rfp_analysis_agent
    agent = get_rfp_analysis_agent()
    analysis = agent.analyze_rfp(document_id)
    
    if 'error' in analysis:
        return jsonify(analysis), 500
    
    return jsonify({
        'message': 'RFP analysis complete',
        **analysis
    }), 200


@bp.route('/<int:document_id>/auto-build', methods=['POST'])
@jwt_required()
def auto_build_proposal(document_id):
    """Automatically create proposal sections based on RFP analysis."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    document = Document.query.get(document_id)
    
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    if document.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json() or {}
    section_type_ids = data.get('section_type_ids', [])
    
    if not section_type_ids:
        return jsonify({'error': 'No section types provided'}), 400
    
    # Create sections with content generation
    from ..services.rfp_analysis_agent import get_rfp_analysis_agent
    agent = get_rfp_analysis_agent()
    result = agent.auto_create_sections(
        project_id=document.project_id,
        section_type_ids=section_type_ids,
        with_generation=data.get('generate_content', True),  # Default to True
        document_id=document_id  # Pass document for context
    )
    
    if 'error' in result:
        return jsonify(result), 500
    
    return jsonify({
        'message': 'Proposal sections created with content',
        **result
    }), 201


@bp.route('/<int:document_id>/preview', methods=['GET'])
@jwt_required()
def preview_document(document_id):
    """Get document content for preview/viewing."""
    from flask import Response, send_file
    import tempfile
    import io
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    document = Document.query.get(document_id)
    
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    if document.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    if not document.file_data:
        return jsonify({'error': 'No file data available'}), 404
    
    file_type = document.file_type.lower()
    
    # PDF - return directly
    if file_type == 'pdf':
        return Response(
            document.file_data,
            mimetype='application/pdf',
            headers={
                'Content-Disposition': f'inline; filename="{document.original_filename}"'
            }
        )
    
    # DOCX - convert to HTML
    if file_type in ['docx', 'doc']:
        try:
            import mammoth
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_type}')
            temp_file.write(document.file_data)
            temp_file.close()
            
            with open(temp_file.name, 'rb') as f:
                result = mammoth.convert_to_html(f)
                html_content = result.value
            
            os.unlink(temp_file.name)
            
            # Wrap in styled HTML
            styled_html = f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; line-height: 1.6; }}
        h1, h2, h3 {{ color: #1f2937; }}
        p {{ margin: 0.5em 0; }}
        table {{ border-collapse: collapse; width: 100%; margin: 1em 0; }}
        th, td {{ border: 1px solid #e5e7eb; padding: 8px; text-align: left; }}
        th {{ background: #f3f4f6; }}
    </style>
</head>
<body>{html_content}</body>
</html>'''
            
            return Response(styled_html, mimetype='text/html')
            
        except Exception as e:
            return jsonify({'error': f'Failed to convert DOCX: {str(e)}'}), 500
    
    # XLSX - convert to HTML table
    if file_type in ['xlsx', 'xls']:
        try:
            from openpyxl import load_workbook
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_type}')
            temp_file.write(document.file_data)
            temp_file.close()
            
            wb = load_workbook(temp_file.name)
            os.unlink(temp_file.name)
            
            html_tables = []
            for sheet_name in wb.sheetnames:
                sheet = wb[sheet_name]
                html = f'<h2>{sheet_name}</h2><table>'
                for row_idx, row in enumerate(sheet.iter_rows(values_only=True), 1):
                    if row_idx == 1:
                        html += '<thead><tr>'
                        html += ''.join(f'<th>{cell if cell else ""}</th>' for cell in row)
                        html += '</tr></thead><tbody>'
                    else:
                        html += '<tr>'
                        html += ''.join(f'<td>{cell if cell else ""}</td>' for cell in row)
                        html += '</tr>'
                html += '</tbody></table>'
                html_tables.append(html)
            
            styled_html = f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }}
        h2 {{ color: #1f2937; margin-top: 2em; }}
        table {{ border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 14px; }}
        th, td {{ border: 1px solid #e5e7eb; padding: 8px; text-align: left; }}
        th {{ background: #f3f4f6; font-weight: 600; }}
        tr:hover {{ background: #f9fafb; }}
    </style>
</head>
<body>{''.join(html_tables)}</body>
</html>'''
            
            return Response(styled_html, mimetype='text/html')
            
        except Exception as e:
            return jsonify({'error': f'Failed to convert XLSX: {str(e)}'}), 500
    
    # PPTX - convert to HTML with slide content
    if file_type in ['pptx', 'ppt']:
        try:
            from pptx import Presentation
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_type}')
            temp_file.write(document.file_data)
            temp_file.close()
            
            prs = Presentation(temp_file.name)
            os.unlink(temp_file.name)
            
            slides_html = []
            for slide_idx, slide in enumerate(prs.slides, 1):
                slide_content = []
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        slide_content.append(f'<p>{shape.text}</p>')
                
                slides_html.append(f'''
                <div class="slide">
                    <div class="slide-header">Slide {slide_idx}</div>
                    <div class="slide-content">{''.join(slide_content) if slide_content else '<p class="empty">No text content</p>'}</div>
                </div>
                ''')
            
            styled_html = f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f3f4f6; }}
        .slide {{ background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; overflow: hidden; }}
        .slide-header {{ background: #3b82f6; color: white; padding: 10px 16px; font-weight: 600; }}
        .slide-content {{ padding: 20px; min-height: 150px; }}
        .slide-content p {{ margin: 0.5em 0; }}
        .empty {{ color: #9ca3af; font-style: italic; }}
    </style>
</head>
<body>{''.join(slides_html)}</body>
</html>'''
            
            return Response(styled_html, mimetype='text/html')
            
        except Exception as e:
            return jsonify({'error': f'Failed to convert PPTX: {str(e)}'}), 500
    
    # Unsupported type
    return jsonify({'error': f'Preview not supported for {file_type}'}), 400


@bp.route('/<int:document_id>/download', methods=['GET'])
@jwt_required()
def download_document(document_id):
    """Download the original document file."""
    from flask import Response
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    document = Document.query.get(document_id)
    
    if not document:
        return jsonify({'error': 'Document not found'}), 404
    
    if document.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    if not document.file_data:
        return jsonify({'error': 'No file data available'}), 404
    
    # Determine MIME type
    mime_types = {
        'pdf': 'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'doc': 'application/msword',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xls': 'application/vnd.ms-excel',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'ppt': 'application/vnd.ms-powerpoint',
    }
    
    mime_type = mime_types.get(document.file_type.lower(), 'application/octet-stream')
    
    return Response(
        document.file_data,
        mimetype=mime_type,
        headers={
            'Content-Disposition': f'attachment; filename="{document.original_filename}"'
        }
    )

