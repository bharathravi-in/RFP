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
