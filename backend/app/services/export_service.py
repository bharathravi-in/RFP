"""
Export service for generating RFP response documents.
"""
import io
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from datetime import datetime


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
                doc.add_paragraph(answer.content)
                
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


def generate_proposal_docx(project, sections, include_qa=True, questions=None):
    """
    Generate a full proposal DOCX with all sections.
    
    Args:
        project: Project model instance
        sections: List of RFPSection model instances
        include_qa: Whether to include Q&A section
        questions: List of Question model instances (if include_qa is True)
    
    Returns:
        BytesIO buffer containing the DOCX file
    """
    doc = Document()
    
    # Title Page
    title = doc.add_heading(project.name, 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    subtitle = doc.add_paragraph()
    subtitle_run = subtitle.add_run('Proposal Response')
    subtitle_run.font.size = Pt(18)
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    doc.add_paragraph()
    
    # Generated date
    date_para = doc.add_paragraph()
    date_para.add_run(f'Generated: {datetime.now().strftime("%B %d, %Y")}')
    date_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Page break after title
    doc.add_page_break()
    
    # Table of Contents placeholder
    toc_heading = doc.add_heading('Table of Contents', level=1)
    for i, section in enumerate(sections, 1):
        if section.content:
            toc_item = doc.add_paragraph()
            toc_item.add_run(f'{i}. {section.title}')
    
    if include_qa and questions:
        toc_item = doc.add_paragraph()
        toc_item.add_run(f'{len(sections) + 1}. Questions & Answers')
    
    doc.add_page_break()
    
    # Add each section
    for i, section in enumerate(sections, 1):
        if not section.content:
            continue
            
        # Section heading with icon
        section_title = f'{section.section_type.icon if section.section_type else ""} {section.title}'
        doc.add_heading(section_title.strip(), level=1)
        
        # Section content
        # Split content by paragraphs for better formatting
        content_paragraphs = section.content.split('\n\n')
        for para_text in content_paragraphs:
            if para_text.strip():
                doc.add_paragraph(para_text.strip())
        
        # Section metadata footer
        if section.confidence_score:
            meta = doc.add_paragraph()
            meta_run = meta.add_run(f'Confidence: {int(section.confidence_score * 100)}%')
            meta_run.font.size = Pt(9)
            meta_run.italic = True
        
        doc.add_page_break()
    
    # Optionally include Q&A section
    if include_qa and questions:
        doc.add_heading('Questions & Answers', level=1)
        
        # Group by section
        qa_sections = {}
        for q in questions:
            section_name = q.section or 'General'
            if section_name not in qa_sections:
                qa_sections[section_name] = []
            qa_sections[section_name].append(q)
        
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
                    doc.add_paragraph(answer.content)
                else:
                    no_answer = doc.add_paragraph('No answer provided.')
                    no_answer.runs[0].italic = True
                
                doc.add_paragraph()
    
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
