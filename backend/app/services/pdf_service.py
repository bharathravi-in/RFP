"""
PDF Export Service using ReportLab.
"""
import io
from datetime import datetime
from typing import List, Dict, Optional
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, HRFlowable
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY


class PDFExportService:
    """Service for generating PDF exports of RFP responses."""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Create custom paragraph styles."""
        self.styles.add(ParagraphStyle(
            name='QuestionTitle',
            parent=self.styles['Heading2'],
            fontSize=12,
            spaceAfter=8,
            textColor=colors.HexColor('#1a1a2e'),
        ))
        
        self.styles.add(ParagraphStyle(
            name='AnswerBody',
            parent=self.styles['Normal'],
            fontSize=10,
            leading=14,
            alignment=TA_JUSTIFY,
            spaceAfter=12,
        ))
        
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading1'],
            fontSize=14,
            spaceAfter=12,
            textColor=colors.HexColor('#6366f1'),
        ))
        
        self.styles.add(ParagraphStyle(
            name='MetaInfo',
            parent=self.styles['Normal'],
            fontSize=8,
            textColor=colors.gray,
        ))
    
    def generate_project_export(
        self,
        project: Dict,
        questions: List[Dict],
        include_unanswered: bool = False,
        include_sources: bool = True,
        include_confidence: bool = True,
    ) -> bytes:
        """
        Generate a PDF export of project Q&A.
        
        Args:
            project: Project data dict
            questions: List of question dicts with answers
            include_unanswered: Include questions without answers
            include_sources: Include source references
            include_confidence: Include confidence scores
            
        Returns:
            PDF file as bytes
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=0.75*inch,
            leftMargin=0.75*inch,
            topMargin=0.75*inch,
            bottomMargin=0.75*inch,
        )
        
        elements = []
        
        # Title page
        elements.extend(self._create_title_page(project))
        elements.append(PageBreak())
        
        # Table of contents / summary
        elements.extend(self._create_summary(project, questions))
        elements.append(PageBreak())
        
        # Questions and answers by section
        sections = self._group_by_section(questions)
        
        for section_name, section_questions in sections.items():
            elements.append(Paragraph(section_name, self.styles['SectionHeader']))
            elements.append(HRFlowable(
                width="100%", thickness=1, color=colors.HexColor('#e5e7eb')
            ))
            elements.append(Spacer(1, 12))
            
            for q in section_questions:
                if not include_unanswered and q.get('status') == 'pending':
                    continue
                    
                elements.extend(self._create_qa_block(
                    q, include_sources, include_confidence
                ))
        
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
    
    def _create_title_page(self, project: Dict) -> List:
        """Create the title page elements."""
        elements = []
        
        elements.append(Spacer(1, 2*inch))
        elements.append(Paragraph(
            project.get('name', 'RFP Response'),
            self.styles['Title']
        ))
        elements.append(Spacer(1, 0.5*inch))
        elements.append(Paragraph(
            project.get('description', ''),
            self.styles['Normal']
        ))
        elements.append(Spacer(1, 1*inch))
        
        # Meta information
        meta_data = [
            ['Generated:', datetime.now().strftime('%B %d, %Y')],
            ['Status:', project.get('status', 'Draft').title()],
        ]
        if project.get('due_date'):
            meta_data.append(['Due Date:', project['due_date']])
        
        meta_table = Table(meta_data, colWidths=[1.5*inch, 3*inch])
        meta_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.gray),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('RIGHTPADDING', (0, 0), (0, -1), 12),
        ]))
        elements.append(meta_table)
        
        return elements
    
    def _create_summary(self, project: Dict, questions: List[Dict]) -> List:
        """Create summary section."""
        elements = []
        
        elements.append(Paragraph('Summary', self.styles['Heading1']))
        elements.append(Spacer(1, 12))
        
        # Stats
        total = len(questions)
        answered = sum(1 for q in questions if q.get('answer'))
        approved = sum(1 for q in questions if q.get('status') == 'approved')
        
        stats_data = [
            ['Total Questions', str(total)],
            ['Answered', str(answered)],
            ['Approved', str(approved)],
            ['Completion', f'{round(answered/max(total,1)*100)}%'],
        ]
        
        stats_table = Table(stats_data, colWidths=[2*inch, 1.5*inch])
        stats_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f3f4f6')),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.white),
        ]))
        elements.append(stats_table)
        
        return elements
    
    def _create_qa_block(
        self,
        question: Dict,
        include_sources: bool,
        include_confidence: bool
    ) -> List:
        """Create a question/answer block."""
        elements = []
        
        # Question
        q_text = f"Q: {question.get('text', '')}"
        elements.append(Paragraph(q_text, self.styles['QuestionTitle']))
        
        # Answer
        answer = question.get('answer', {})
        if answer:
            a_text = answer.get('content', 'No answer provided.')
            elements.append(Paragraph(a_text, self.styles['AnswerBody']))
            
            # Confidence badge
            if include_confidence and answer.get('confidence_score'):
                conf = int(answer['confidence_score'] * 100)
                conf_text = f"Confidence: {conf}%"
                elements.append(Paragraph(conf_text, self.styles['MetaInfo']))
            
            # Sources
            if include_sources and answer.get('sources'):
                sources_text = "Sources: " + ", ".join(
                    s.get('title', 'Unknown') for s in answer['sources'][:3]
                )
                elements.append(Paragraph(sources_text, self.styles['MetaInfo']))
        else:
            elements.append(Paragraph(
                "<i>Awaiting response</i>",
                self.styles['AnswerBody']
            ))
        
        elements.append(Spacer(1, 16))
        return elements
    
    def _group_by_section(self, questions: List[Dict]) -> Dict[str, List[Dict]]:
        """Group questions by section."""
        sections = {}
        for q in questions:
            section = q.get('section', 'General')
            if section not in sections:
                sections[section] = []
            sections[section].append(q)
        return sections


def get_pdf_service() -> PDFExportService:
    """Get PDF export service instance."""
    return PDFExportService()
