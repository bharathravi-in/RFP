"""
Proposal Version routes for managing document versions.
"""
from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import ProposalVersion, Project, User, RFPSection, Question, SectionVersion

bp = Blueprint('versions', __name__)


@bp.route('/projects/<int:project_id>/versions', methods=['GET'])
@jwt_required()
def list_versions(project_id):
    """List all versions for a project."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    versions = ProposalVersion.query.filter_by(project_id=project_id)\
        .order_by(ProposalVersion.version_number.desc()).all()
    
    return jsonify({
        'versions': [v.to_dict() for v in versions],
        'total': len(versions)
    }), 200


@bp.route('/projects/<int:project_id>/versions', methods=['POST'])
@jwt_required()
def create_version(project_id):
    """Create a new version by exporting current proposal state."""
    from app.services.export_service import generate_proposal_docx
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    if project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json() or {}
    title = data.get('title', '')
    description = data.get('description', '')
    include_qa = data.get('include_qa', True)
    
    if not title:
        return jsonify({'error': 'Title is required'}), 400
    
    # Get next version number
    max_version = db.session.query(db.func.max(ProposalVersion.version_number))\
        .filter_by(project_id=project_id).scalar() or 0
    next_version = max_version + 1
    
    # Get sections for export
    sections = RFPSection.query.filter_by(project_id=project_id)\
        .order_by(RFPSection.order).all()
    
    # Get questions if include_qa is True
    questions = None
    if include_qa:
        questions = Question.query.filter_by(project_id=project_id).all()
    
    # Generate the DOCX
    try:
        buffer = generate_proposal_docx(project, sections, include_qa, questions, project.organization)
        file_data = buffer.getvalue()
        file_size = len(file_data)
    except Exception as e:
        return jsonify({'error': f'Failed to generate document: {str(e)}'}), 500
    
    # Create sections snapshot for restoration
    sections_snapshot = []
    for section in sections:
        snapshot = {
            'section_type_id': section.section_type_id,
            'title': section.title,
            'content': section.content,
            'order': section.order,
            'status': section.status,
            'inputs': section.inputs,
            'ai_generation_params': section.ai_generation_params,
            'confidence_score': section.confidence_score,
            'sources': section.sources,
            'flags': section.flags,
        }
        sections_snapshot.append(snapshot)
    
    # Create the version record
    version = ProposalVersion(
        project_id=project_id,
        version_number=next_version,
        title=title,
        description=description,
        file_data=file_data,
        file_type='docx',
        file_size=file_size,
        sections_snapshot=sections_snapshot,
        created_by=user_id,
    )
    
    db.session.add(version)
    db.session.commit()
    
    return jsonify({
        'message': 'Version created successfully',
        'version': version.to_dict()
    }), 201


@bp.route('/versions/<int:version_id>', methods=['GET'])
@jwt_required()
def get_version(version_id):
    """Get version details."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    version = ProposalVersion.query.get(version_id)
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    if version.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({'version': version.to_dict()}), 200


@bp.route('/versions/<int:version_id>/preview', methods=['GET'])
@jwt_required()
def preview_version(version_id):
    """Get version content for preview (convert to HTML)."""
    import tempfile
    import os
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    version = ProposalVersion.query.get(version_id)
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    if version.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    if not version.file_data:
        return jsonify({'error': 'No file data available'}), 404
    
    # Convert DOCX to HTML using mammoth
    if version.file_type == 'docx':
        try:
            import mammoth
            
            # Write to temp file
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.docx')
            temp_file.write(version.file_data)
            temp_file.close()
            
            # Convert to HTML
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
        body {{ 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            padding: 40px; 
            max-width: 900px; 
            margin: 0 auto; 
            line-height: 1.7;
            color: #1f2937;
            background: #ffffff;
        }}
        h1 {{ color: #111827; font-size: 28px; margin-top: 32px; margin-bottom: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }}
        h2 {{ color: #374151; font-size: 22px; margin-top: 28px; margin-bottom: 12px; }}
        h3 {{ color: #4b5563; font-size: 18px; margin-top: 24px; margin-bottom: 10px; }}
        p {{ margin: 12px 0; }}
        ul, ol {{ margin: 12px 0; padding-left: 24px; }}
        li {{ margin: 6px 0; }}
        table {{ border-collapse: collapse; width: 100%; margin: 16px 0; }}
        th, td {{ border: 1px solid #e5e7eb; padding: 10px 14px; text-align: left; }}
        th {{ background: #f3f4f6; font-weight: 600; }}
        tr:hover {{ background: #f9fafb; }}
        strong {{ color: #111827; }}
        .version-header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 24px;
            margin: -40px -40px 30px -40px;
            border-radius: 0;
        }}
        .version-header h1 {{
            color: white;
            margin: 0;
            border: none;
            padding: 0;
            font-size: 24px;
        }}
        .version-meta {{
            font-size: 14px;
            opacity: 0.9;
            margin-top: 8px;
        }}
    </style>
</head>
<body>
    <div class="version-header">
        <h1>{version.title}</h1>
        <div class="version-meta">Version {version.version_number} • Created {version.created_at.strftime('%B %d, %Y at %I:%M %p')}</div>
    </div>
    {html_content}
</body>
</html>'''
            
            return Response(styled_html, mimetype='text/html')
            
        except Exception as e:
            return jsonify({'error': f'Failed to convert document: {str(e)}'}), 500
    
    return jsonify({'error': f'Preview not supported for {version.file_type}'}), 400


@bp.route('/versions/<int:version_id>/download', methods=['GET'])
@jwt_required()
def download_version(version_id):
    """Download the original DOCX file."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    version = ProposalVersion.query.get(version_id)
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    if version.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    if not version.file_data:
        return jsonify({'error': 'No file data available'}), 404
    
    # Determine filename
    project_name = version.project.name.replace(' ', '_')
    filename = f'{project_name}_v{version.version_number}.docx'
    
    return Response(
        version.file_data,
        mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"'
        }
    )


@bp.route('/versions/<int:version_id>', methods=['DELETE'])
@jwt_required()
def delete_version(version_id):
    """Delete a version."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    version = ProposalVersion.query.get(version_id)
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    if version.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    db.session.delete(version)
    db.session.commit()
    
    return jsonify({'message': 'Version deleted'}), 200


@bp.route('/versions/<int:version_id>/restore', methods=['POST'])
@jwt_required()
def restore_version(version_id):
    """
    Restore proposal to a previous version.
    Creates a backup of current state before restoring.
    """
    from app.services.export_service import generate_proposal_docx
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    version = ProposalVersion.query.get(version_id)
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    if version.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    if not version.sections_snapshot:
        return jsonify({'error': 'This version does not have section data for restoration'}), 400
    
    project = version.project
    project_id = project.id
    
    # Step 1: Create a backup of current state before restoring
    current_sections = RFPSection.query.filter_by(project_id=project_id)\
        .order_by(RFPSection.order).all()
    
    # Create backup snapshot
    backup_snapshot = []
    for section in current_sections:
        snapshot = {
            'section_type_id': section.section_type_id,
            'title': section.title,
            'content': section.content,
            'order': section.order,
            'status': section.status,
            'inputs': section.inputs,
            'ai_generation_params': section.ai_generation_params,
            'confidence_score': section.confidence_score,
            'sources': section.sources,
            'flags': section.flags,
        }
        backup_snapshot.append(snapshot)
    
    # Generate backup DOCX
    try:
        questions = Question.query.filter_by(project_id=project_id).all()
        buffer = generate_proposal_docx(project, current_sections, True, questions, project.organization)
        backup_file_data = buffer.getvalue()
        backup_file_size = len(backup_file_data)
    except Exception as e:
        return jsonify({'error': f'Failed to create backup: {str(e)}'}), 500
    
    # Get next version number for backup
    max_version = db.session.query(db.func.max(ProposalVersion.version_number))\
        .filter_by(project_id=project_id).scalar() or 0
    next_version = max_version + 1
    
    # Create backup version
    backup_version = ProposalVersion(
        project_id=project_id,
        version_number=next_version,
        title=f'Auto-backup before restore (from v{version.version_number})',
        description=f'Automatic backup created before restoring to version "{version.title}"',
        file_data=backup_file_data,
        file_type='docx',
        file_size=backup_file_size,
        sections_snapshot=backup_snapshot,
        is_restoration_point=True,
        restored_from_version=version.version_number,
        created_by=user_id,
    )
    db.session.add(backup_version)
    
    # Step 2: Delete current sections
    for section in current_sections:
        db.session.delete(section)
    
    # Step 3: Restore sections from snapshot
    restored_sections = []
    for order, section_data in enumerate(version.sections_snapshot):
        new_section = RFPSection(
            project_id=project_id,
            section_type_id=section_data.get('section_type_id'),
            title=section_data.get('title', 'Untitled'),
            content=section_data.get('content'),
            order=order,
            status=section_data.get('status', 'draft'),
            inputs=section_data.get('inputs', {}),
            ai_generation_params=section_data.get('ai_generation_params', {}),
            confidence_score=section_data.get('confidence_score'),
            sources=section_data.get('sources', []),
            flags=section_data.get('flags', []),
        )
        db.session.add(new_section)
        restored_sections.append(new_section)
    
    db.session.commit()
    
    return jsonify({
        'message': f'Successfully restored to version {version.version_number}',
        'backup_version': backup_version.to_dict(),
        'restored_sections_count': len(restored_sections),
    }), 200


@bp.route('/versions/<int:version_id>/compare/<int:other_version_id>', methods=['GET'])
@jwt_required()
def compare_versions(version_id, other_version_id):
    """
    Compare two proposal versions and return structured diff.
    Uses Python difflib to generate line-by-line differences.
    """
    import difflib
    
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    # Fetch both versions
    version_a = ProposalVersion.query.get(version_id)
    version_b = ProposalVersion.query.get(other_version_id)
    
    if not version_a or not version_b:
        return jsonify({'error': 'One or both versions not found'}), 404
    
    # Check they belong to same project
    if version_a.project_id != version_b.project_id:
        return jsonify({'error': 'Versions must belong to the same project'}), 400
    
    # Check access
    if version_a.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get section snapshots (default to empty list if not available)
    snapshot_a = version_a.sections_snapshot or []
    snapshot_b = version_b.sections_snapshot or []
    
    # Build lookup by title for matching sections
    sections_a = {s.get('title', f"Section {i}"): s for i, s in enumerate(snapshot_a)}
    sections_b = {s.get('title', f"Section {i}"): s for i, s in enumerate(snapshot_b)}
    
    all_titles = set(sections_a.keys()) | set(sections_b.keys())
    
    section_diffs = []
    stats = {
        'total_sections': len(all_titles),
        'added': 0,
        'removed': 0,
        'modified': 0,
        'unchanged': 0,
    }
    
    for title in sorted(all_titles):
        section_a = sections_a.get(title)
        section_b = sections_b.get(title)
        
        if section_a and not section_b:
            # Section exists only in version A (removed in B)
            section_diffs.append({
                'title': title,
                'status': 'removed',
                'content_a': section_a.get('content', ''),
                'content_b': None,
                'diff_lines': [],
            })
            stats['removed'] += 1
            
        elif section_b and not section_a:
            # Section exists only in version B (added in B)
            section_diffs.append({
                'title': title,
                'status': 'added',
                'content_a': None,
                'content_b': section_b.get('content', ''),
                'diff_lines': [],
            })
            stats['added'] += 1
            
        else:
            # Section exists in both - compare content
            content_a = section_a.get('content', '') or ''
            content_b = section_b.get('content', '') or ''
            
            if content_a == content_b:
                section_diffs.append({
                    'title': title,
                    'status': 'unchanged',
                    'content_a': content_a,
                    'content_b': content_b,
                    'diff_lines': [],
                })
                stats['unchanged'] += 1
            else:
                # Generate unified diff
                lines_a = content_a.splitlines(keepends=True)
                lines_b = content_b.splitlines(keepends=True)
                
                diff = list(difflib.unified_diff(
                    lines_a, lines_b,
                    fromfile=f'v{version_a.version_number}',
                    tofile=f'v{version_b.version_number}',
                    lineterm=''
                ))
                
                # Parse diff into structured format
                diff_lines = []
                for line in diff[2:]:  # Skip the file headers
                    if line.startswith('+') and not line.startswith('+++'):
                        diff_lines.append({'type': 'added', 'content': line[1:]})
                    elif line.startswith('-') and not line.startswith('---'):
                        diff_lines.append({'type': 'removed', 'content': line[1:]})
                    elif line.startswith('@@'):
                        diff_lines.append({'type': 'context', 'content': line})
                    else:
                        diff_lines.append({'type': 'unchanged', 'content': line[1:] if line.startswith(' ') else line})
                
                section_diffs.append({
                    'title': title,
                    'status': 'modified',
                    'content_a': content_a,
                    'content_b': content_b,
                    'diff_lines': diff_lines,
                })
                stats['modified'] += 1
    
    return jsonify({
        'version_a': version_a.to_dict(),
        'version_b': version_b.to_dict(),
        'section_diffs': section_diffs,
        'stats': stats,
    }), 200


@bp.route('/versions/<int:version_id>/branch', methods=['POST'])
@jwt_required()
def branch_version(version_id):
    """
    Create an editable draft from a previous version.
    This replaces current sections with the version's snapshot,
    allowing the user to edit and build upon the historical version.
    
    Request body:
    {
        "mode": "replace" | "merge",  // replace=overwrite current, merge=add alongside
        "clear_current": true/false   // only used in merge mode
    }
    """
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.role not in ['admin', 'editor']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    version = ProposalVersion.query.get(version_id)
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    if version.project.organization_id != user.organization_id:
        return jsonify({'error': 'Access denied'}), 403
    
    if not version.sections_snapshot:
        return jsonify({'error': 'This version does not have section data for editing'}), 400
    
    data = request.get_json() or {}
    mode = data.get('mode', 'replace')  # Default: replace current sections
    
    project = version.project
    project_id = project.id
    
    # Step 1: Delete current sections (for replace mode)
    if mode == 'replace':
        current_sections = RFPSection.query.filter_by(project_id=project_id).all()
        section_ids = [s.id for s in current_sections]
        # Delete section versions first (due to FK constraint)
        if section_ids:
            SectionVersion.query.filter(SectionVersion.section_id.in_(section_ids)).delete(synchronize_session=False)
        # Now delete sections
        for section in current_sections:
            db.session.delete(section)
        db.session.flush()
    
    # Step 2: Create new sections from the version snapshot
    created_sections = []
    for i, section_data in enumerate(version.sections_snapshot):
        new_section = RFPSection(
            project_id=project_id,
            section_type_id=section_data.get('section_type_id'),
            title=section_data.get('title', 'Untitled Section'),
            content=section_data.get('content', ''),
            order=section_data.get('order', i),
            status='draft',  # Always start as draft for editing
            inputs=section_data.get('inputs'),
            ai_generation_params=section_data.get('ai_generation_params'),
            confidence_score=section_data.get('confidence_score'),
            sources=section_data.get('sources'),
            flags=section_data.get('flags'),
        )
        db.session.add(new_section)
        created_sections.append(new_section)
    
    # Step 3: Update project to reflect the branch
    project.status = 'in_progress'
    
    db.session.commit()
    
    return jsonify({
        'message': f'Created editable draft from version {version.version_number}',
        'version_id': version_id,
        'version_title': version.title,
        'sections_created': len(created_sections),
        'sections': [s.to_dict() for s in created_sections],
    }), 201
