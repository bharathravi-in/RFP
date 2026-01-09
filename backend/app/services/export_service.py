"""
Export service for generating RFP response documents.
"""
import io
import re
from docx import Document
from docx.shared import Pt, Inches, RGBColor, Twips
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from datetime import datetime


def setup_document_styles(doc):
    """
    Configure professional enterprise-ready document styles.
    Sets up heading styles, body text, and margins.
    """
    # Set document margins (1 inch = 914400 EMUs)
    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1.25)
        section.right_margin = Inches(1)
    
    # Configure Heading 1 style
    try:
        h1_style = doc.styles['Heading 1']
        h1_style.font.name = 'Calibri'
        h1_style.font.size = Pt(18)
        h1_style.font.bold = True
        h1_style.font.color.rgb = RGBColor(31, 73, 125)  # Professional blue
        h1_style.paragraph_format.space_before = Pt(24)
        h1_style.paragraph_format.space_after = Pt(12)
    except KeyError:
        pass
    
    # Configure Heading 2 style
    try:
        h2_style = doc.styles['Heading 2']
        h2_style.font.name = 'Calibri'
        h2_style.font.size = Pt(14)
        h2_style.font.bold = True
        h2_style.font.color.rgb = RGBColor(54, 95, 145)
        h2_style.paragraph_format.space_before = Pt(18)
        h2_style.paragraph_format.space_after = Pt(8)
    except KeyError:
        pass
    
    # Configure Normal paragraph style
    try:
        normal_style = doc.styles['Normal']
        normal_style.font.name = 'Calibri'
        normal_style.font.size = Pt(11)
        normal_style.paragraph_format.line_spacing_rule = WD_LINE_SPACING.MULTIPLE
        normal_style.paragraph_format.line_spacing = 1.15
        normal_style.paragraph_format.space_after = Pt(8)
    except KeyError:
        pass


def safe_add_heading(doc, text, level=1):
    """
    Safely add a heading, falling back to manual styling if style doesn't exist.
    This handles templates that may lack standard Word heading styles.
    """
    try:
        return doc.add_heading(text, level)
    except KeyError:
        # Fallback: create paragraph with manual heading styling
        para = doc.add_paragraph()
        run = para.add_run(text)
        
        if level == 0:  # Title
            run.font.size = Pt(28)
            run.font.bold = True
            run.font.color.rgb = RGBColor(31, 73, 125)
        elif level == 1:
            run.font.size = Pt(18)
            run.font.bold = True
            run.font.color.rgb = RGBColor(31, 73, 125)
        elif level == 2:
            run.font.size = Pt(14)
            run.font.bold = True
            run.font.color.rgb = RGBColor(54, 95, 145)
        else:
            run.font.size = Pt(12)
            run.font.bold = True
        
        run.font.name = 'Calibri'
        return para


def safe_add_paragraph(doc, text='', style=None):
    """
    Safely add a paragraph with optional style, falling back to manual styling if style doesn't exist.
    This handles templates that may lack standard Word paragraph styles.
    """
    try:
        if style:
            para = doc.add_paragraph(text, style=style)
        else:
            para = doc.add_paragraph(text)
        return para
    except KeyError:
        # Fallback: create paragraph without style, apply manual formatting
        para = doc.add_paragraph()
        if text:
            run = para.add_run(text)
            run.font.name = 'Calibri'
            run.font.size = Pt(11)
            # Add bullet character for list styles
            if style and 'bullet' in style.lower():
                run.text = '• ' + text
            elif style and 'number' in style.lower():
                run.text = text
        return para


def add_document_header(doc, project_name, organization_name=None):
    """
    Add professional header with company name and project to all pages.
    """
    for section in doc.sections:
        header = section.header
        header_para = header.paragraphs[0] if header.paragraphs else header.add_paragraph()
        
        # Left side: Company/Organization name
        if organization_name:
            run = header_para.add_run(organization_name)
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(100, 100, 100)
            run.font.bold = True
            
            run = header_para.add_run('    |    ')
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(180, 180, 180)
        
        # Right side: Project name
        run = header_para.add_run(project_name[:40] + ('...' if len(project_name) > 40 else ''))
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(128, 128, 128)
        run.italic = True
        
        header_para.alignment = WD_ALIGN_PARAGRAPH.CENTER


def add_section_divider(doc):
    """Add a professional section divider line."""
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = para.add_run('─' * 40)
    run.font.color.rgb = RGBColor(200, 200, 200)
    run.font.size = Pt(10)


def add_real_toc(doc, heading_text='Table of Contents', sections=None):
    """
    Add a Table of Contents with actual section entries.
    
    Since python-docx cannot auto-update Word TOC fields, we create a
    manual TOC that lists all section titles with their section numbers.
    This approach ensures the TOC is visible immediately without needing
    to right-click and update.
    
    Args:
        doc: Document object
        heading_text: Title for the TOC
        sections: List of RFPSection objects to include in TOC
    """
    # Add TOC heading
    toc_heading = doc.add_heading(heading_text, level=1)
    toc_heading.alignment = WD_ALIGN_PARAGRAPH.LEFT
    
    # If sections provided, add manual entries
    if sections:
        # Standard pre-sections
        pre_sections = [
            ('Revision History', 1),
            ('Vendor Eligibility & Credentials', 1),
        ]
        
        # Add pre-section entries
        for title, level in pre_sections:
            p = doc.add_paragraph()
            # Add indent based on level
            p.paragraph_format.left_indent = Inches(0.25 * (level - 1))
            run = p.add_run(f"• {title}")
            run.font.size = Pt(11)
            run.font.color.rgb = RGBColor(0, 0, 0)
        
        # Add numbered section entries
        section_num = 1
        for section in sections:
            if section.content:  # Only include sections with content
                p = doc.add_paragraph()
                # Get section title
                section_title = section.title or (section.section_type.name if section.section_type else f'Section {section_num}')
                run = p.add_run(f"{section_num}. {section_title}")
                run.font.size = Pt(11)
                run.font.color.rgb = RGBColor(0, 0, 0)
                section_num += 1
        
        # Add Q&A Responses if applicable
        p = doc.add_paragraph()
        run = p.add_run(f"{section_num}. Q&A Responses")
        run.font.size = Pt(11)
        run.font.color.rgb = RGBColor(0, 0, 0)
    else:
        # Fallback: Create Word TOC field (requires manual update)
        paragraph = doc.add_paragraph()
        
        # Create field character elements for Word TOC field
        fld_char_begin = OxmlElement('w:fldChar')
        fld_char_begin.set(qn('w:fldCharType'), 'begin')
        
        instr_text = OxmlElement('w:instrText')
        instr_text.set(qn('xml:space'), 'preserve')
        instr_text.text = ' TOC \\o "1-3" \\h \\z \\u '
        
        fld_char_separate = OxmlElement('w:fldChar')
        fld_char_separate.set(qn('w:fldCharType'), 'separate')
        
        placeholder = OxmlElement('w:t')
        placeholder.text = 'Right-click and select "Update Field" to generate Table of Contents'
        
        fld_char_end = OxmlElement('w:fldChar')
        fld_char_end.set(qn('w:fldCharType'), 'end')
        
        run1 = paragraph.add_run()
        run1._r.append(fld_char_begin)
        run1._r.append(instr_text)
        run1._r.append(fld_char_separate)
        
        run2 = paragraph.add_run()
        run2._r.append(placeholder)
        
        run3 = paragraph.add_run()
        run3._r.append(fld_char_end)
    
    # Add spacing after TOC
    doc.add_paragraph()
    
    return None



def style_table(table):
    """Apply professional styling to a table."""
    # Set table alignment
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    
    # Style header row
    if table.rows:
        header_row = table.rows[0]
        for cell in header_row.cells:
            # Set background color for header
            shading = OxmlElement('w:shd')
            shading.set(qn('w:fill'), '1F497D')  # Dark blue
            cell._tc.get_or_add_tcPr().append(shading)
            
            # Set text color to white
            for para in cell.paragraphs:
                for run in para.runs:
                    run.font.color.rgb = RGBColor(255, 255, 255)
                    run.font.bold = True
    
    # Style alternating rows
    for idx, row in enumerate(table.rows[1:], 1):
        if idx % 2 == 0:
            for cell in row.cells:
                shading = OxmlElement('w:shd')
                shading.set(qn('w:fill'), 'F5F5F5')  # Light gray
                cell._tc.get_or_add_tcPr().append(shading)


def add_revision_history_table(doc, project, organization=None):
    """
    Add a revision history table to the document for professional tracking.
    
    Args:
        doc: Document object
        project: Project model instance
        organization: Organization model instance
    """
    # Revision History heading
    heading = doc.add_heading('Revision History', level=2)
    heading.runs[0].font.color.rgb = RGBColor(75, 0, 130)
    
    # Create revision table
    table = doc.add_table(rows=1, cols=4)
    table.style = 'Table Grid'
    
    # Header row
    header_cells = table.rows[0].cells
    headers = ['Version', 'Date', 'Author', 'Description']
    for i, header in enumerate(headers):
        header_cells[i].text = header
        header_cells[i].paragraphs[0].runs[0].font.bold = True
        header_cells[i].paragraphs[0].runs[0].font.size = Pt(10)
        # Add header background
        shading = OxmlElement('w:shd')
        shading.set(qn('w:fill'), '4B0082')  # Indigo
        header_cells[i]._tc.get_or_add_tcPr().append(shading)
        header_cells[i].paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
    
    # Get version info
    version_number = getattr(project, 'version', 1) or 1
    current_date = datetime.now()
    
    # Get author name from VendorProfile model
    author_name = 'Proposal Team'
    if organization:
        try:
            from app.models import VendorProfile
            vendor_profile = VendorProfile.query.filter_by(
                organization_id=organization.id
            ).first()
            if vendor_profile and vendor_profile.company_name:
                author_name = vendor_profile.company_name
        except Exception:
            pass  # Keep default
    
    # Add current version row
    row = table.add_row()
    row.cells[0].text = f'{version_number}.0'
    row.cells[1].text = current_date.strftime('%Y-%m-%d')
    row.cells[2].text = author_name
    row.cells[3].text = 'Initial proposal submission'
    
    # Style all cells
    for cell in row.cells:
        cell.paragraphs[0].runs[0].font.size = Pt(10) if cell.paragraphs[0].runs else None
    
    # Add a previous version placeholder if version > 1
    if version_number > 1:
        prev_row = table.add_row()
        prev_row.cells[0].text = f'{version_number - 1}.0'
        prev_row.cells[1].text = (current_date.replace(day=max(1, current_date.day - 7))).strftime('%Y-%m-%d')
        prev_row.cells[2].text = author_name
        prev_row.cells[3].text = 'Draft revision'
    
    doc.add_paragraph()  # Spacing after table


def add_markdown_to_doc(doc, content):
    """
    Convert markdown content to Word document formatting.
    Handles: headers, bold, italic, lists, code blocks, and paragraphs.
    """
    if not content:
        return
    
    lines = content.split('\n')
    current_list_items = []
    is_in_list = False
    is_in_code_block = False
    code_block_content = []
    code_block_language = ''
    
    def flush_list():
        nonlocal current_list_items, is_in_list
        if current_list_items:
            for item in current_list_items:
                # Remove list markers
                clean_item = re.sub(r'^[\*\-]\s*|^\d+\.\s*', '', item)
                para = safe_add_paragraph(doc, style='List Bullet')
                add_formatted_text(para, clean_item)
            current_list_items = []
            is_in_list = False
    
    def add_formatted_text(paragraph, text):
        """Add text with inline formatting (bold, italic)."""
        # Pattern for bold, italic, code
        pattern = r'(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))'
        last_end = 0
        
        for match in re.finditer(pattern, text):
            # Add text before match
            if match.start() > last_end:
                paragraph.add_run(text[last_end:match.start()])
            
            if match.group(2):  # Bold italic ***text***
                run = paragraph.add_run(match.group(2))
                run.bold = True
                run.italic = True
            elif match.group(3):  # Bold **text**
                run = paragraph.add_run(match.group(3))
                run.bold = True
            elif match.group(4):  # Italic *text*
                run = paragraph.add_run(match.group(4))
                run.italic = True
            elif match.group(5):  # Code `text`
                run = paragraph.add_run(match.group(5))
                run.font.name = 'Courier New'
                run.font.size = Pt(10)
            elif match.group(6) and match.group(7):  # Link [text](url)
                run = paragraph.add_run(match.group(6))
                run.underline = True
            
            last_end = match.end()
        
        # Add remaining text
        if last_end < len(text):
            paragraph.add_run(text[last_end:])
    
    for line in lines:
        stripped = line.strip()
        
        # Handle code blocks (including mermaid) - check both original and stripped line
        if stripped.startswith('```') or line.lstrip().startswith('```'):
            if is_in_code_block:
                # End of code block
                flush_list()
                if code_block_language == 'mermaid':
                    # For mermaid, render the diagram as an image
                    mermaid_code = '\n'.join(code_block_content)
                    try:
                        from .mermaid_service import render_mermaid_to_bytes_io
                        diagram_buffer = render_mermaid_to_bytes_io(mermaid_code)
                        if diagram_buffer:
                            # Add the diagram image to the document
                            doc.add_picture(diagram_buffer, width=Inches(5.5))
                            # Add caption
                            caption_para = doc.add_paragraph()
                            caption_run = caption_para.add_run('Figure: Architecture Diagram')
                            caption_run.italic = True
                            caption_run.font.size = Pt(10)
                            caption_run.font.color.rgb = RGBColor(100, 100, 100)
                            caption_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        else:
                            # Fallback: Add placeholder text if rendering failed
                            para = doc.add_paragraph()
                            run = para.add_run('[Diagram could not be rendered - see web application]')
                            run.italic = True
                            run.font.size = Pt(10)
                            run.font.color.rgb = RGBColor(100, 100, 100)
                    except Exception as e:
                        # Error handling: Add placeholder text
                        para = doc.add_paragraph()
                        run = para.add_run(f'[Diagram rendering error - see web application]')
                        run.italic = True
                        run.font.size = Pt(10)
                        run.font.color.rgb = RGBColor(100, 100, 100)
                elif code_block_content:
                    # For other non-empty code blocks, add as monospace text
                    para = doc.add_paragraph()
                    code_text = '\n'.join(code_block_content)
                    run = para.add_run(code_text)
                    run.font.name = 'Courier New'
                    run.font.size = Pt(9)
                code_block_content = []
                is_in_code_block = False
                code_block_language = ''
            else:
                # Start of code block - extract language
                flush_list()
                is_in_code_block = True
                # Get the part after ```
                lang_part = stripped[3:] if stripped.startswith('```') else line.lstrip()[3:]
                code_block_language = lang_part.strip().lower()
            continue
        
        if is_in_code_block:
            code_block_content.append(line)
            continue
        
        # Skip empty lines
        if not stripped:
            flush_list()
            continue
        
        # Headers
        if stripped.startswith('### '):
            flush_list()
            heading = doc.add_heading(level=3)
            add_formatted_text(heading, stripped[4:])
            continue
        elif stripped.startswith('## '):
            flush_list()
            heading = doc.add_heading(level=2)
            add_formatted_text(heading, stripped[3:])
            continue
        elif stripped.startswith('# '):
            flush_list()
            heading = doc.add_heading(level=1)
            add_formatted_text(heading, stripped[2:])
            continue
        
        # Lists (bullet or numbered)
        if re.match(r'^[\*\-]\s', stripped) or re.match(r'^\d+\.\s', stripped):
            is_in_list = True
            current_list_items.append(stripped)
            continue
        
        # Horizontal rule
        if re.match(r'^[-*_]{3,}$', stripped):
            flush_list()
            doc.add_paragraph('_' * 50)
            continue
        
        # Regular paragraph
        flush_list()
        para = doc.add_paragraph()
        add_formatted_text(para, stripped)
    
    # Flush any remaining list
    flush_list()


def generate_docx(project, questions):
    """
    Generate a DOCX document with project responses.
    
    Args:
        project: Project model instance
        questions: List of Question model instances with answers
    
    Returns:
        BytesIO buffer containing the DOCX file
    """
    doc = Document()
    
    # Title
    title = doc.add_heading(f'RFP Response: {project.name}', 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Metadata
    doc.add_paragraph(f'Generated: {datetime.now().strftime("%B %d, %Y")}')
    doc.add_paragraph(f'Total Questions: {len(questions)}')
    approved_count = sum(1 for q in questions if q.status == 'approved')
    doc.add_paragraph(f'Approved Answers: {approved_count}')
    
    doc.add_paragraph()  # Space
    
    # Group questions by section
    sections = {}
    for q in questions:
        section = q.section or 'General'
        if section not in sections:
            sections[section] = []
        sections[section].append(q)
    
    # Add each section
    for section_name, section_questions in sections.items():
        doc.add_heading(section_name, level=1)
        
        for i, question in enumerate(section_questions, 1):
            # Question
            q_para = doc.add_paragraph()
            q_run = q_para.add_run(f'Q{i}: {question.text}')
            q_run.bold = True
            
            # Answer
            answer = question.current_answer
            if answer and answer.content:
                add_markdown_to_doc(doc, answer.content)
                
                # Status indicator
                status_para = doc.add_paragraph()
                status_run = status_para.add_run(f'Status: {question.status.upper()}')
                status_run.italic = True
                status_run.font.size = Pt(10)
                
                if answer.confidence_score:
                    conf_run = status_para.add_run(f' | Confidence: {int(answer.confidence_score * 100)}%')
                    conf_run.italic = True
                    conf_run.font.size = Pt(10)
            else:
                no_answer = doc.add_paragraph('No answer provided.')
                no_answer.runs[0].italic = True
            
            doc.add_paragraph()  # Space between questions
    
    # Save to buffer
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    
    return buffer


def generate_xlsx(project, questions):
    """
    Generate an XLSX spreadsheet with project responses.
    """
    import pandas as pd
    
    data = []
    for i, q in enumerate(questions, 1):
        answer = q.current_answer
        data.append({
            'No.': i,
            'Section': q.section or 'General',
            'Question': q.text,
            'Answer': answer.content if answer else '',
            'Status': q.status,
            'Confidence': f"{int(answer.confidence_score * 100)}%" if answer and answer.confidence_score else '',
            'AI Generated': 'Yes' if answer and answer.is_ai_generated else 'No'
        })
    
    df = pd.DataFrame(data)
    
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df.to_excel(writer, sheet_name='RFP Responses', index=False)
    
    buffer.seek(0)
    return buffer


def add_page_footer(doc, version_text):
    """Add page footer with page numbers and version to all sections."""
    for section in doc.sections:
        footer = section.footer
        footer_para = footer.paragraphs[0] if footer.paragraphs else footer.add_paragraph()
        footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        # Add version on left
        run = footer_para.add_run(f'{version_text}')
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(128, 128, 128)
        
        # Add separator
        run = footer_para.add_run('    |    ')
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(128, 128, 128)
        
        # Add page number field
        run = footer_para.add_run('Page ')
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(128, 128, 128)
        
        # PAGE field
        fld_char1 = OxmlElement('w:fldChar')
        fld_char1.set(qn('w:fldCharType'), 'begin')
        instr_text = OxmlElement('w:instrText')
        instr_text.text = 'PAGE'
        fld_char2 = OxmlElement('w:fldChar')
        fld_char2.set(qn('w:fldCharType'), 'separate')
        fld_char3 = OxmlElement('w:fldChar')
        fld_char3.set(qn('w:fldCharType'), 'end')
        
        run2 = footer_para.add_run()
        run2._r.append(fld_char1)
        run2._r.append(instr_text)
        run2._r.append(fld_char2)
        run2._r.append(fld_char3)
        
        run = footer_para.add_run(' of ')
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(128, 128, 128)
        
        # NUMPAGES field
        fld_char1 = OxmlElement('w:fldChar')
        fld_char1.set(qn('w:fldCharType'), 'begin')
        instr_text = OxmlElement('w:instrText')
        instr_text.text = 'NUMPAGES'
        fld_char2 = OxmlElement('w:fldChar')
        fld_char2.set(qn('w:fldCharType'), 'separate')
        fld_char3 = OxmlElement('w:fldChar')
        fld_char3.set(qn('w:fldCharType'), 'end')
        
        run3 = footer_para.add_run()
        run3._r.append(fld_char1)
        run3._r.append(instr_text)
        run3._r.append(fld_char2)
        run3._r.append(fld_char3)


def add_vendor_visibility_section(doc, project, organization=None):
    """
    Add Vendor Visibility / Eligibility section to the proposal.
    Surfaces vendor credentials and eligibility criteria.
    """
    doc.add_heading('Vendor Profile & Eligibility', level=1)
    
    doc.add_paragraph()
    
    # Introduction text
    intro = doc.add_paragraph()
    intro_run = intro.add_run('This section provides an overview of our organization\'s credentials and eligibility to fulfill the requirements of this RFP.')
    intro_run.font.size = Pt(10)
    intro_run.italic = True
    intro_run.font.color.rgb = RGBColor(100, 100, 100)
    
    doc.add_paragraph()
    
    # ========================================
    # GET VENDOR PROFILE FROM DATABASE MODEL
    # ========================================
    # Read from VendorProfile model (not organization.settings which is outdated)
    vendor_profile_data = {}
    vendor_profile_model = None
    
    if organization:
        try:
            from app.models import VendorProfile
            vendor_profile_model = VendorProfile.query.filter_by(
                organization_id=organization.id
            ).first()
            
            if vendor_profile_model:
                vendor_profile_data = vendor_profile_model.to_dict()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Could not load VendorProfile: {e}")
    
    # Company Information Table
    doc.add_heading('Company Information', level=2)
    
    # Map VendorProfile model fields to display fields
    company_info = [
        ('Company Name', vendor_profile_data.get('company_name') or (organization.name if organization else 'Not specified')),
        ('Registration Country', vendor_profile_data.get('registration_country') or 'Not specified'),
        ('Years in Business', str(vendor_profile_data.get('years_in_business')) if vendor_profile_data.get('years_in_business') else 'Not specified'),
        ('Employee Count', vendor_profile_data.get('employee_count_range') or 'Not specified'),
        ('Headquarters', vendor_profile_data.get('headquarters_location') or 'Not specified'),
    ]
    
    # Create table for company info
    table = doc.add_table(rows=len(company_info), cols=2)
    table.style = 'Table Grid'
    
    for i, (label, value) in enumerate(company_info):
        row = table.rows[i]
        cell1 = row.cells[0]
        cell2 = row.cells[1]
        
        run1 = cell1.paragraphs[0].add_run(label)
        run1.bold = True
        run1.font.size = Pt(10)
        
        run2 = cell2.paragraphs[0].add_run(str(value))
        run2.font.size = Pt(10)
    
    doc.add_paragraph()
    
    # Certifications & Compliance
    doc.add_heading('Certifications & Compliance', level=2)
    
    certifications = vendor_profile_data.get('certifications') or []
    if not certifications:
        # Default certifications if not specified
        certifications = ['SOC 2 Type II', 'ISO 27001', 'GDPR Compliant']
    
    for cert in certifications:
        cert_para = safe_add_paragraph(doc, style='List Bullet')
        cert_run = cert_para.add_run(cert)
        cert_run.font.size = Pt(10)
    
    doc.add_paragraph()
    
    # Industry Experience
    doc.add_heading('Industry Experience', level=2)
    
    industries = vendor_profile_data.get('industries_served') or []
    if not industries:
        # Check if project has industry info
        if hasattr(project, 'industry') and project.industry:
            industries = [project.industry]
        else:
            industries = ['Technology', 'Financial Services', 'Healthcare']
    
    industries_para = doc.add_paragraph()
    industries_run = industries_para.add_run('Our organization has extensive experience serving clients in the following industries:')
    industries_run.font.size = Pt(10)
    
    for industry in industries:
        ind_para = safe_add_paragraph(doc, style='List Bullet')
        ind_run = ind_para.add_run(industry)
        ind_run.font.size = Pt(10)
    
    doc.add_paragraph()
    
    # Geographic Presence
    doc.add_heading('Geographic Presence', level=2)
    
    geographies = vendor_profile_data.get('office_locations') or []
    if not geographies:
        # Check if project has geography info
        if hasattr(project, 'geography') and project.geography:
            geographies = [project.geography]
        else:
            geographies = ['Global', 'North America', 'Europe', 'Asia Pacific']
    
    geo_para = doc.add_paragraph()
    geo_run = geo_para.add_run('We have operational presence and capability to deliver services in:')
    geo_run.font.size = Pt(10)
    
    for geo in geographies:
        geo_item = safe_add_paragraph(doc, style='List Bullet')
        geo_item_run = geo_item.add_run(geo)
        geo_item_run.font.size = Pt(10)
    
    doc.add_page_break()


def generate_proposal_docx(project, sections, include_qa=True, questions=None, organization=None, template_path=None, compliance_items=None, strategy=None):
    """
    Generate a full proposal DOCX with all sections.
    
    Args:
        project: Project model instance
        sections: List of RFPSection model instances
        include_qa: Whether to include Q&A section
        questions: List of Question model instances (if include_qa is True)
        organization: Organization model instance for vendor profile
        template_path: Optional path to DOCX template file to use as base
        compliance_items: List of ComplianceItem model instances (optional)
        strategy: ProjectStrategy model instance with win themes, pricing, etc. (optional)
    
    Returns:
        BytesIO buffer containing the DOCX file
    """
    import os
    import logging
    logger = logging.getLogger(__name__)
    
    # Track if we're using a template (affects style handling)
    using_template = False
    
    # Load template or create new document
    if template_path and os.path.exists(template_path):
        try:
            doc = Document(template_path)
            logger.info(f"Using DOCX template: {template_path}")
            using_template = True
            # Clear existing content from template but keep styles and section properties
            # We must preserve sectPr elements for table width calculations
            from docx.oxml.ns import qn
            for element in doc.element.body[:]:
                # Don't remove sectPr (section properties) - needed for page layout/table widths
                if element.tag != qn('w:sectPr'):
                    doc.element.body.remove(element)
            # Ensure required styles exist (some templates may lack them)
            try:
                setup_document_styles(doc)
            except Exception as style_err:
                logger.warning(f"Could not setup styles on template: {style_err}")
        except Exception as e:
            logger.warning(f"Failed to load template {template_path}: {e}, using blank document")
            doc = Document()
            setup_document_styles(doc)
    else:
        doc = Document()
        # ========================================
        # ENTERPRISE FORMATTING SETUP
        # ========================================
        # Apply professional styles and margins
        setup_document_styles(doc)
    
    # Get organization name for headers
    org_name = None
    if organization and hasattr(organization, 'name'):
        org_name = organization.name
    
    # Get version info
    current_date = datetime.now()
    version_number = getattr(project, 'version', 1) or 1
    version_text = f"Version {version_number}.0 – {current_date.strftime('%B %Y')}"
    
    # ========================================
    # TITLE PAGE
    # ========================================
    
    # Add some spacing at top
    for _ in range(3):
        doc.add_paragraph()
    
    # Draft label
    draft_label = doc.add_paragraph()
    draft_run = draft_label.add_run('DRAFT PROPOSAL')
    draft_run.font.size = Pt(14)
    draft_run.font.color.rgb = RGBColor(128, 128, 128)
    draft_run.bold = True
    draft_label.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    doc.add_paragraph()
    
    # Main Title
    title = safe_add_heading(doc, project.name, 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Subtitle
    subtitle = doc.add_paragraph()
    subtitle_run = subtitle.add_run('Proposal Response')
    subtitle_run.font.size = Pt(20)
    subtitle_run.font.color.rgb = RGBColor(75, 0, 130)
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    doc.add_paragraph()
    doc.add_paragraph()
    
    # Client info section
    if hasattr(project, 'client_name') and project.client_name:
        prepared_for = doc.add_paragraph()
        prepared_for_run = prepared_for.add_run('Prepared For:')
        prepared_for_run.font.size = Pt(12)
        prepared_for_run.bold = True
        prepared_for.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        client_para = doc.add_paragraph()
        client_run = client_para.add_run(project.client_name)
        client_run.font.size = Pt(14)
        client_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        doc.add_paragraph()
    
    # Version and Date
    version_para = doc.add_paragraph()
    version_run = version_para.add_run(version_text)
    version_run.font.size = Pt(12)
    version_run.font.color.rgb = RGBColor(100, 100, 100)
    version_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Generated date
    date_para = doc.add_paragraph()
    date_run = date_para.add_run(f'Generated: {current_date.strftime("%B %d, %Y at %I:%M %p")}')
    date_run.font.size = Pt(10)
    date_run.font.color.rgb = RGBColor(128, 128, 128)
    date_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Confidential notice at bottom
    for _ in range(5):
        doc.add_paragraph()
    
    confidential = doc.add_paragraph()
    conf_run = confidential.add_run('CONFIDENTIAL')
    conf_run.font.size = Pt(10)
    conf_run.font.color.rgb = RGBColor(192, 0, 0)
    conf_run.bold = True
    confidential.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    conf_note = doc.add_paragraph()
    conf_note_run = conf_note.add_run('This proposal contains confidential information intended only for the named recipient.')
    conf_note_run.font.size = Pt(9)
    conf_note_run.italic = True
    conf_note_run.font.color.rgb = RGBColor(128, 128, 128)
    conf_note.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Page break after title
    doc.add_page_break()
    
    # ========================================
    # TABLE OF CONTENTS (Real Word TOC)
    # ========================================
    
    # Add TOC with pre-populated section entries (no manual update needed)
    add_real_toc(doc, 'Table of Contents', sections=sections)
    
    # Count sections with content (used later for section numbering)
    sections_with_content = [(i, s) for i, s in enumerate(sections, 1) if s.content]
    
    doc.add_page_break()
    
    # ========================================
    # REVISION HISTORY TABLE
    # ========================================
    
    add_revision_history_table(doc, project, organization)
    
    doc.add_page_break()
    
    # ========================================
    # VENDOR VISIBILITY SECTION
    # ========================================
    
    add_vendor_visibility_section(doc, project, organization)

    
    # ========================================
    # PROPOSAL SECTIONS
    # ========================================
    
    for idx, (num, section) in enumerate(sections_with_content):
        # Section number and heading
        section_num = f'{idx + 1}.0'
        # Note: Section icons are omitted from Word export for professional formatting
        section_title = f'{section_num}  {section.title}'.strip()
        
        heading = doc.add_heading(section_title, level=1)
        
        # Section content - convert markdown to Word formatting
        add_markdown_to_doc(doc, section.content)
        
        # Section metadata footer
        if section.confidence_score:
            doc.add_paragraph()
            meta = doc.add_paragraph()
            meta_run = meta.add_run(f'AI Confidence: {int(section.confidence_score * 100)}%')
            meta_run.font.size = Pt(9)
            meta_run.italic = True
            meta_run.font.color.rgb = RGBColor(128, 128, 128)
        
        doc.add_page_break()
    
    # ========================================
    # COMPLIANCE MATRIX SECTION (If provided)
    # ========================================
    
    if compliance_items and len(compliance_items) > 0:
        doc.add_heading('Appendix A: Compliance Matrix', level=1)
        
        intro = doc.add_paragraph()
        intro_run = intro.add_run('This section provides a comprehensive compliance matrix tracking all RFP requirements and our response status.')
        intro_run.font.size = Pt(10)
        intro_run.italic = True
        intro_run.font.color.rgb = RGBColor(100, 100, 100)
        
        doc.add_paragraph()
        
        # Create compliance summary stats
        compliant_count = sum(1 for c in compliance_items if c.compliance_status == 'compliant')
        partial_count = sum(1 for c in compliance_items if c.compliance_status == 'partial')
        non_compliant_count = sum(1 for c in compliance_items if c.compliance_status == 'non_compliant')
        pending_count = sum(1 for c in compliance_items if c.compliance_status == 'pending')
        
        summary = doc.add_paragraph()
        summary_run = summary.add_run(f'Summary: {len(compliance_items)} Requirements | ')
        summary_run.font.size = Pt(10)
        summary_run.bold = True
        
        summary_run2 = summary.add_run(f'Compliant: {compliant_count} | Partial: {partial_count} | Non-Compliant: {non_compliant_count} | Pending: {pending_count}')
        summary_run2.font.size = Pt(10)
        
        doc.add_paragraph()
        
        # Create table for compliance items
        table = doc.add_table(rows=1, cols=4)
        table.style = 'Table Grid'
        
        # Header row
        header_cells = table.rows[0].cells
        headers = ['Requirement', 'Category', 'Status', 'Notes']
        for i, header in enumerate(headers):
            header_cells[i].paragraphs[0].add_run(header).bold = True
            header_cells[i].paragraphs[0].runs[0].font.size = Pt(10)
        
        # Data rows
        for item in compliance_items:
            row = table.add_row()
            row.cells[0].text = item.requirement_text or ''
            row.cells[1].text = item.category or ''
            status_text = {
                'compliant': 'Compliant',
                'partial': 'Partial',
                'non_compliant': 'Non-Compliant',
                'pending': 'Pending'
            }.get(item.compliance_status, item.compliance_status or '')
            row.cells[2].text = status_text
            row.cells[3].text = item.notes or ''
            
            for cell in row.cells:
                if cell.paragraphs[0].runs:
                    cell.paragraphs[0].runs[0].font.size = Pt(9)
        
        style_table(table)
        
        doc.add_page_break()
    
    # ========================================
    # STRATEGY SECTION (If provided)
    # ========================================
    
    if strategy:
        has_strategy_content = (
            strategy.win_themes or 
            strategy.competitive_analysis or  # Added competitive analysis check
            strategy.pricing or 
            strategy.legal_review or 
            strategy.diagrams or
            strategy.case_studies or  # Added case studies check
            strategy.sprint_timeline  # Added sprint timeline check
        )
        
        if has_strategy_content:
            doc.add_heading('Appendix B: Strategic Analysis', level=1)
            
            intro = doc.add_paragraph()
            intro_run = intro.add_run('This section contains AI-generated strategic insights for this proposal.')
            intro_run.font.size = Pt(10)
            intro_run.italic = True
            intro_run.font.color.rgb = RGBColor(100, 100, 100)
            
            doc.add_paragraph()
            
            # Win Themes
            if strategy.win_themes:
                doc.add_heading('Win Themes', level=2)
                
                win_themes_data = strategy.win_themes
                themes = win_themes_data.get('win_themes', [])
                
                for theme in themes:
                    theme_para = doc.add_paragraph()
                    theme_run = theme_para.add_run(theme.get('theme_title', 'Theme'))
                    theme_run.bold = True
                    theme_run.font.size = Pt(11)
                    
                    if theme.get('theme_statement'):
                        statement = doc.add_paragraph()
                        statement.add_run(theme['theme_statement']).font.size = Pt(10)
                    
                    if theme.get('customer_benefit'):
                        benefit = doc.add_paragraph()
                        benefit_run = benefit.add_run(f"Customer Benefit: {theme['customer_benefit']}")
                        benefit_run.font.size = Pt(10)
                        benefit_run.italic = True
                    
                    doc.add_paragraph()
                
                doc.add_paragraph()
            
            # Competitive Analysis
            if strategy.competitive_analysis:
                doc.add_heading('Competitive Analysis', level=2)
                
                comp_data = strategy.competitive_analysis
                
                # Market context
                competitive_landscape = comp_data.get('competitive_landscape', {})
                if competitive_landscape.get('market_context'):
                    context_para = doc.add_paragraph()
                    context_run = context_para.add_run(competitive_landscape['market_context'])
                    context_run.font.size = Pt(10)
                    doc.add_paragraph()
                
                # Competitive strategies
                strategies = comp_data.get('competitive_strategies', [])
                if strategies:
                    doc.add_heading('Recommended Strategies', level=3)
                    
                    for strat in strategies[:5]:  # Limit to 5 strategies
                        strat_para = doc.add_paragraph()
                        strat_name = strat_para.add_run(f"{strat.get('strategy_name', 'Strategy')}: ")
                        strat_name.bold = True
                        strat_name.font.size = Pt(10)
                        
                        strat_desc = strat_para.add_run(strat.get('description', ''))
                        strat_desc.font.size = Pt(10)
                    
                    doc.add_paragraph()
                
                # Key differentiators
                differentiators = comp_data.get('key_differentiators', [])
                if differentiators:
                    doc.add_heading('Key Differentiators', level=3)
                    
                    for diff in differentiators[:5]:  # Limit to 5
                        diff_para = safe_add_paragraph(doc, style='List Bullet')
                        diff_text = diff if isinstance(diff, str) else diff.get('title', str(diff))
                        diff_run = diff_para.add_run(diff_text)
                        diff_run.font.size = Pt(10)
                    
                    doc.add_paragraph()
                
                doc.add_paragraph()
            
            # Sprint Timeline (NEW)
            if strategy.sprint_timeline:
                doc.add_heading('Sprint Timeline & Milestones', level=2)
                
                timeline_data = strategy.sprint_timeline
                
                # Summary info
                summary = timeline_data.get('timeline_summary', {})
                if summary:
                    summary_para = doc.add_paragraph()
                    total_sprints = summary.get('total_sprints', 0)
                    total_weeks = summary.get('total_weeks', 0)
                    team_size = summary.get('team_size', 0)
                    summary_text = f"Project Duration: {total_sprints} sprints ({total_weeks} weeks) with a team of {team_size} resources"
                    summary_run = summary_para.add_run(summary_text)
                    summary_run.bold = True
                    summary_run.font.size = Pt(11)
                    doc.add_paragraph()
                
                # Sprint breakdown table
                sprints = timeline_data.get('sprints', [])
                if sprints:
                    doc.add_heading('Sprint Breakdown', level=3)
                    
                    table = doc.add_table(rows=1, cols=4)
                    table.style = 'Table Grid'
                    
                    headers = ['Sprint', 'Duration', 'Focus Area', 'Key Deliverables']
                    header_cells = table.rows[0].cells
                    for i, header in enumerate(headers):
                        header_cells[i].paragraphs[0].add_run(header).bold = True
                        header_cells[i].paragraphs[0].runs[0].font.size = Pt(9)
                    
                    for sprint in sprints[:10]:  # Limit to 10 sprints
                        row = table.add_row()
                        row.cells[0].text = str(sprint.get('sprint_number', ''))
                        row.cells[1].text = f"{sprint.get('duration_weeks', 2)} weeks"
                        row.cells[2].text = sprint.get('focus_area', sprint.get('phase', ''))
                        deliverables = sprint.get('deliverables', [])
                        row.cells[3].text = ', '.join(deliverables[:3]) if deliverables else ''
                        
                        for cell in row.cells:
                            if cell.paragraphs[0].runs:
                                cell.paragraphs[0].runs[0].font.size = Pt(9)
                    
                    style_table(table)
                    doc.add_paragraph()
                
                # Milestones
                milestones = timeline_data.get('milestones', [])
                if milestones:
                    doc.add_heading('Key Milestones', level=3)
                    
                    for milestone in milestones[:6]:  # Limit to 6 milestones
                        ms_para = safe_add_paragraph(doc, style='List Bullet')
                        ms_name = milestone.get('name', 'Milestone')
                        ms_date = milestone.get('target_date', '')
                        ms_run = ms_para.add_run(f"{ms_name}")
                        ms_run.bold = True
                        ms_run.font.size = Pt(10)
                        if ms_date:
                            date_run = ms_para.add_run(f" — {ms_date}")
                            date_run.font.size = Pt(10)
                            date_run.italic = True
                    
                    doc.add_paragraph()
                
                doc.add_paragraph()
            
            # Pricing Summary
            if strategy.pricing:
                doc.add_heading('Pricing Estimates', level=2)
                
                pricing_data = strategy.pricing
                pricing_summary = pricing_data.get('pricing_summary', {})
                
                if pricing_summary:
                    currency = pricing_summary.get('currency_symbol', '$')
                    total = pricing_summary.get('total_cost', 0)
                    
                    total_para = doc.add_paragraph()
                    total_run = total_para.add_run(f'Total Estimated Cost: {currency}{total:,.2f}')
                    total_run.bold = True
                    total_run.font.size = Pt(12)
                    
                    if pricing_summary.get('validity_period'):
                        validity = doc.add_paragraph()
                        validity_run = validity.add_run(f"Validity: {pricing_summary['validity_period']}")
                        validity_run.font.size = Pt(10)
                        validity_run.italic = True
                    
                    doc.add_paragraph()
                    
                    # Effort breakdown table
                    effort_breakdown = pricing_data.get('effort_breakdown', [])
                    if effort_breakdown:
                        doc.add_heading('Effort Breakdown', level=3)
                        
                        table = doc.add_table(rows=1, cols=3)
                        table.style = 'Table Grid'
                        
                        headers = ['Phase', 'Description', 'Cost']
                        header_cells = table.rows[0].cells
                        for i, header in enumerate(headers):
                            header_cells[i].paragraphs[0].add_run(header).bold = True
                        
                        for phase in effort_breakdown:
                            row = table.add_row()
                            row.cells[0].text = phase.get('phase', '')
                            row.cells[1].text = phase.get('description', '')
                            phase_total = phase.get('phase_total', 0)
                            row.cells[2].text = f"{currency}{phase_total:,.2f}"
                        
                        style_table(table)
                
                doc.add_paragraph()
            
            # Case Studies
            if strategy.case_studies:
                doc.add_heading('Relevant Case Studies', level=2)
                
                case_studies_data = strategy.case_studies
                case_studies = case_studies_data.get('case_studies', []) if isinstance(case_studies_data, dict) else case_studies_data
                
                for idx, study in enumerate(case_studies, 1):
                    # Case Study Title
                    title_para = doc.add_paragraph()
                    title_run = title_para.add_run(f"Case Study {idx}: {study.get('title', 'Untitled')}")
                    title_run.bold = True
                    title_run.font.size = Pt(12)
                    title_run.font.color.rgb = RGBColor(54, 95, 145)
                    
                    # Client/Industry info if available
                    if study.get('client') or study.get('industry'):
                        info_para = doc.add_paragraph()
                        info_text = []
                        if study.get('client'):
                            info_text.append(f"Client: {study['client']}")
                        if study.get('industry'):
                            info_text.append(f"Industry: {study['industry']}")
                        info_run = info_para.add_run(' | '.join(info_text))
                        info_run.font.size = Pt(10)
                        info_run.italic = True
                        info_run.font.color.rgb = RGBColor(100, 100, 100)
                    
                    # Challenge
                    if study.get('challenge'):
                        challenge_heading = doc.add_paragraph()
                        challenge_heading_run = challenge_heading.add_run('Challenge: ')
                        challenge_heading_run.bold = True
                        challenge_heading_run.font.size = Pt(10)
                        challenge_para = doc.add_paragraph()
                        challenge_para.add_run(study['challenge']).font.size = Pt(10)
                    
                    # Solution
                    if study.get('solution'):
                        solution_heading = doc.add_paragraph()
                        solution_heading_run = solution_heading.add_run('Solution: ')
                        solution_heading_run.bold = True
                        solution_heading_run.font.size = Pt(10)
                        solution_para = doc.add_paragraph()
                        solution_para.add_run(study['solution']).font.size = Pt(10)
                    
                    # Results
                    if study.get('results'):
                        results_heading = doc.add_paragraph()
                        results_heading_run = results_heading.add_run('Key Results: ')
                        results_heading_run.bold = True
                        results_heading_run.font.size = Pt(10)
                        
                        results = study['results']
                        if isinstance(results, list):
                            for result in results:
                                if isinstance(result, dict):
                                    result_para = safe_add_paragraph(doc, style='List Bullet')
                                    metric = result.get('metric', '')
                                    value = result.get('value', '')
                                    result_run = result_para.add_run(f"{metric}: {value}")
                                    result_run.font.size = Pt(10)
                                else:
                                    result_para = safe_add_paragraph(doc, style='List Bullet')
                                    result_run = result_para.add_run(str(result))
                                    result_run.font.size = Pt(10)
                    
                    # Technologies used
                    if study.get('technologies'):
                        tech_para = doc.add_paragraph()
                        tech_run = tech_para.add_run(f"Technologies: {', '.join(study['technologies'])}")
                        tech_run.font.size = Pt(9)
                        tech_run.italic = True
                        tech_run.font.color.rgb = RGBColor(100, 100, 100)
                    
                    doc.add_paragraph()  # Spacing between case studies
                
                doc.add_paragraph()
            
            # Legal Risk Assessment
            if strategy.legal_review:
                doc.add_heading('Legal Risk Assessment', level=2)
                
                legal_data = strategy.legal_review
                risk_level = legal_data.get('overall_risk_level', 'unknown')
                
                risk_para = doc.add_paragraph()
                risk_run = risk_para.add_run(f'Overall Risk Level: {risk_level.upper()}')
                risk_run.bold = True
                risk_run.font.size = Pt(11)
                
                if risk_level in ['high', 'critical']:
                    risk_run.font.color.rgb = RGBColor(192, 0, 0)
                elif risk_level == 'medium':
                    risk_run.font.color.rgb = RGBColor(192, 128, 0)
                else:
                    risk_run.font.color.rgb = RGBColor(0, 128, 0)
                
                if legal_data.get('review_summary'):
                    summary_para = doc.add_paragraph()
                    summary_para.add_run(legal_data['review_summary']).font.size = Pt(10)
                
                risk_items = legal_data.get('risk_items', [])
                if risk_items:
                    doc.add_heading('Risk Items', level=3)
                    
                    for risk in risk_items[:10]:  # Limit to 10 items
                        risk_para = safe_add_paragraph(doc, style='List Bullet')
                        severity = risk.get('severity', 'unknown')
                        risk_run = risk_para.add_run(f"[{severity.upper()}] {risk.get('description', '')}")
                        risk_run.font.size = Pt(10)
                
                doc.add_paragraph()
            
            # Diagrams
            if strategy.diagrams:
                doc.add_heading('Architecture Diagrams', level=2)
                
                diagrams = strategy.diagrams if isinstance(strategy.diagrams, list) else []
                
                for diagram in diagrams:
                    if diagram.get('mermaid_code'):
                        try:
                            from .mermaid_service import render_mermaid_to_bytes_io
                            diagram_buffer = render_mermaid_to_bytes_io(diagram['mermaid_code'])
                            if diagram_buffer:
                                doc.add_picture(diagram_buffer, width=Inches(5.5))
                                
                                caption_para = doc.add_paragraph()
                                caption_run = caption_para.add_run(f"Figure: {diagram.get('title', 'Architecture Diagram')}")
                                caption_run.italic = True
                                caption_run.font.size = Pt(10)
                                caption_run.font.color.rgb = RGBColor(100, 100, 100)
                                caption_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
                                
                                doc.add_paragraph()
                        except Exception:
                            # Fallback text if diagram rendering fails
                            para = doc.add_paragraph()
                            run = para.add_run(f"[Diagram: {diagram.get('title', 'Untitled')} - see web application]")
                            run.italic = True
                            run.font.size = Pt(10)
            
            doc.add_page_break()
    
    # ========================================
    # Q&A SECTION (Optional)
    # ========================================
    
    if include_qa and questions:
        qa_num = len(sections_with_content) + 1
        doc.add_heading(f'{qa_num}.0  Questions & Answers', level=1)
        
        # Group by section
        qa_sections = {}
        for q in questions:
            section_name = q.section or 'General'
            if section_name not in qa_sections:
                qa_sections[section_name] = []
            qa_sections[section_name].append(q)
        
        # Summary stats
        answered_count = sum(1 for q in questions if q.current_answer and q.current_answer.content)
        summary = doc.add_paragraph()
        summary_run = summary.add_run(f'Total Questions: {len(questions)} | Answered: {answered_count}')
        summary_run.font.size = Pt(10)
        summary_run.italic = True
        summary_run.font.color.rgb = RGBColor(100, 100, 100)
        
        doc.add_paragraph()
        
        for section_name, section_questions in qa_sections.items():
            if len(qa_sections) > 1:
                doc.add_heading(section_name, level=2)
            
            for i, question in enumerate(section_questions, 1):
                # Question
                q_para = doc.add_paragraph()
                q_run = q_para.add_run(f'Q{i}: {question.text}')
                q_run.bold = True
                
                # Answer
                answer = question.current_answer
                if answer and answer.content:
                    add_markdown_to_doc(doc, answer.content)
                else:
                    no_answer = doc.add_paragraph('No answer provided.')
                    no_answer.runs[0].italic = True
                    no_answer.runs[0].font.color.rgb = RGBColor(150, 150, 150)
                
                doc.add_paragraph()
    
    # ========================================
    # ADD PAGE HEADERS AND FOOTERS
    # ========================================
    
    # Add professional header with company name and project
    add_document_header(doc, project.name, org_name)
    
    # Add page footer with version and page numbers
    add_page_footer(doc, version_text)
    
    # Save to buffer
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    
    return buffer


def generate_proposal_xlsx(project, sections, questions=None):
    """
    Generate proposal XLSX with sections and Q&A.
    """
    import pandas as pd
    
    buffer = io.BytesIO()
    
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        # Sections sheet
        sections_data = []
        for i, section in enumerate(sections, 1):
            sections_data.append({
                'Order': i,
                'Section Type': section.section_type.name if section.section_type else 'Custom',
                'Title': section.title,
                'Content': section.content or '',
                'Status': section.status,
                'Confidence': f"{int(section.confidence_score * 100)}%" if section.confidence_score else '',
                'Version': section.version,
            })
        
        if sections_data:
            df_sections = pd.DataFrame(sections_data)
            df_sections.to_excel(writer, sheet_name='Proposal Sections', index=False)
        
        # Q&A sheet
        if questions:
            qa_data = []
            for i, q in enumerate(questions, 1):
                answer = q.current_answer
                qa_data.append({
                    'No.': i,
                    'Section': q.section or 'General',
                    'Question': q.text,
                    'Answer': answer.content if answer else '',
                    'Status': q.status,
                    'Confidence': f"{int(answer.confidence_score * 100)}%" if answer and answer.confidence_score else '',
                })
            
            if qa_data:
                df_qa = pd.DataFrame(qa_data)
                df_qa.to_excel(writer, sheet_name='Q&A Responses', index=False)
    
    buffer.seek(0)
    return buffer
