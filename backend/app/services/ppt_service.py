"""
PPT Service - PowerPoint file generation using python-pptx
Creates professional .pptx files from slide content
"""
import io
from typing import Dict, List, Any
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
import logging

logger = logging.getLogger(__name__)


class PPTService:
    """Service for generating PowerPoint presentations."""
    
    # Default branding
    DEFAULT_COLORS = {
        'primary': RGBColor(75, 0, 130),      # Indigo
        'secondary': RGBColor(99, 102, 241),   # Light indigo
        'accent': RGBColor(16, 185, 129),      # Green
        'text_dark': RGBColor(31, 41, 55),     # Dark gray
        'text_light': RGBColor(255, 255, 255), # White
        'background': RGBColor(249, 250, 251), # Light gray
    }
    
    SLIDE_WIDTH = Inches(13.333)  # 16:9 aspect ratio
    SLIDE_HEIGHT = Inches(7.5)
    
    def __init__(self, branding: Dict[str, str] = None, template_path: str = None):
        """
        Initialize PPT service with optional branding and template.
        
        Args:
            branding: Custom color scheme
            template_path: Path to PPTX template file to use as base
        """
        self.colors = self.DEFAULT_COLORS.copy()
        self.template_path = template_path
        
        if branding:
            if 'primary_color' in branding:
                self.colors['primary'] = self._hex_to_rgb(branding['primary_color'])
            if 'secondary_color' in branding:
                self.colors['secondary'] = self._hex_to_rgb(branding['secondary_color'])
    
    def _hex_to_rgb(self, hex_color: str) -> RGBColor:
        """Convert hex color to RGBColor."""
        hex_color = hex_color.lstrip('#')
        return RGBColor(
            int(hex_color[0:2], 16),
            int(hex_color[2:4], 16),
            int(hex_color[4:6], 16)
        )
    
    # ========================================
    # TEXT HANDLING UTILITIES
    # ========================================
    
    def _clear_slide_placeholders(self, slide):
        """
        Remove all placeholder shapes from a slide.
        This is essential when using custom layouts with templates,
        as template placeholders (Title, Body, Content) would otherwise
        appear alongside our custom shapes.
        """
        try:
            # Find and delete placeholder shapes
            shapes_to_remove = []
            for shape in slide.shapes:
                if shape.is_placeholder:
                    shapes_to_remove.append(shape)
            
            # Remove them from the slide's shape tree
            for shape in shapes_to_remove:
                sp = shape._element
                sp.getparent().remove(sp)
            
            if shapes_to_remove:
                logger.debug(f"Cleared {len(shapes_to_remove)} placeholder shapes from slide")
        except Exception as e:
            logger.debug(f"Could not clear placeholders: {e}")
    
    def _truncate_text(self, text: str, max_chars: int = 100) -> str:
        """
        Truncate text to max characters with ellipsis.
        Tries to break at word boundary for cleaner output.
        """
        if not text or len(text) <= max_chars:
            return text or ''
        # Try to break at word boundary
        truncated = text[:max_chars-3]
        last_space = truncated.rfind(' ')
        if last_space > max_chars * 0.6:  # Only break at word if reasonable
            truncated = truncated[:last_space]
        return truncated.rstrip() + '...'
    
    def _calculate_font_size(
        self, 
        content_length: int, 
        base_size: int = 20, 
        min_size: int = 12,
        bullet_count: int = 1
    ) -> int:
        """
        Calculate optimal font size based on content length and bullet count.
        
        Args:
            content_length: Total characters in all bullets
            base_size: Starting font size in points
            min_size: Minimum font size in points
            bullet_count: Number of bullets on the slide
        
        Returns:
            Optimal font size in points
        """
        # Reduce font based on content length
        if content_length < 200:
            size = base_size
        elif content_length < 400:
            size = base_size - 2
        elif content_length < 600:
            size = base_size - 4
        else:
            size = base_size - 6
        
        # Further reduce if many bullets
        if bullet_count >= 6:
            size -= 2
        elif bullet_count >= 4:
            size -= 1
        
        return max(size, min_size)
    
    def _sanitize_bullets(
        self, 
        bullets: List[str], 
        max_bullets: int = 6,
        max_chars_per_bullet: int = 80
    ) -> List[str]:
        """
        Sanitize and truncate bullet points for slide fitting.
        
        Args:
            bullets: List of bullet text strings
            max_bullets: Maximum number of bullets per slide
            max_chars_per_bullet: Maximum characters per bullet
        
        Returns:
            Cleaned and truncated bullet list
        """
        if not bullets:
            return []
        
        clean_bullets = []
        for bullet in bullets[:max_bullets]:
            if not bullet:
                continue
            # Remove any leading bullet markers
            clean = str(bullet).strip().lstrip('•-*→▪►◆').strip()
            # Remove any double spaces
            clean = ' '.join(clean.split())
            # Truncate if too long
            clean = self._truncate_text(clean, max_chars_per_bullet)
            if clean:
                clean_bullets.append(clean)
        
        return clean_bullets
    
    def _get_optimal_spacing(self, bullet_count: int) -> tuple:
        """
        Get optimal spacing before/after paragraphs based on bullet count.
        
        Returns:
            Tuple of (space_before, space_after) in points
        """
        if bullet_count <= 3:
            return (Pt(16), Pt(12))
        elif bullet_count <= 5:
            return (Pt(12), Pt(8))
        else:
            return (Pt(8), Pt(6))
    
    def _extract_template_colors(self, prs: Presentation):
        """Extract theme colors from template slide master and update self.colors."""

        try:
            if not prs.slide_masters or len(prs.slide_masters) == 0:
                return
            
            master = prs.slide_masters[0]
            logger.info(f"Template has {len(prs.slide_masters)} slide masters, {len(prs.slide_layouts)} layouts")
            
            # Try to get theme colors from slide master's theme
            # The theme part contains accent colors
            try:
                theme_part = master.part.related_parts.get('/ppt/theme/theme1.xml')
                if theme_part:
                    # Parse theme XML for color scheme
                    from lxml import etree
                    theme_xml = etree.fromstring(theme_part.blob)
                    
                    # Namespace for theme XML
                    nsmap = {
                        'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'
                    }
                    
                    # Find color scheme
                    clr_scheme = theme_xml.find('.//a:clrScheme', nsmap)
                    if clr_scheme is not None:
                        # Extract key colors
                        color_names = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3']
                        extracted_colors = {}
                        
                        for color_name in color_names:
                            color_elem = clr_scheme.find(f'a:{color_name}', nsmap)
                            if color_elem is not None:
                                # Check for srgbClr (RGB) or sysClr (system color)
                                srgb = color_elem.find('a:srgbClr', nsmap)
                                if srgb is not None:
                                    hex_val = srgb.get('val')
                                    if hex_val:
                                        extracted_colors[color_name] = RGBColor(
                                            int(hex_val[0:2], 16),
                                            int(hex_val[2:4], 16),
                                            int(hex_val[4:6], 16)
                                        )
                        
                        # Map theme colors to our color scheme
                        if 'accent1' in extracted_colors:
                            self.colors['primary'] = extracted_colors['accent1']
                        if 'accent2' in extracted_colors:
                            self.colors['secondary'] = extracted_colors['accent2']
                        if 'accent3' in extracted_colors:
                            self.colors['accent'] = extracted_colors['accent3']
                        if 'dk1' in extracted_colors:
                            self.colors['text_dark'] = extracted_colors['dk1']
                        if 'lt1' in extracted_colors:
                            self.colors['text_light'] = extracted_colors['lt1']
                        
                        logger.info(f"Extracted {len(extracted_colors)} theme colors from template")
                        return
                        
            except Exception as e:
                logger.debug(f"Could not parse theme XML: {e}")
            
            # Fallback: Try to get colors from first shape in slide master
            for shape in master.shapes:
                if hasattr(shape, 'fill') and shape.fill.type is not None:
                    try:
                        if shape.fill.fore_color and shape.fill.fore_color.type == 1:  # RGB
                            self.colors['primary'] = shape.fill.fore_color.rgb
                            logger.info(f"Extracted primary color from master shape: {shape.fill.fore_color.rgb}")
                            break
                    except:
                        pass
            
            logger.info("Template colors will be inherited from slide layouts")
            
        except Exception as e:
            logger.warning(f"Could not extract template colors: {e}")
    
    def _get_best_layout(self, prs: Presentation, slide_type: str):
        """
        Get the best matching layout from template for the slide type.
        Falls back to blank layout if no match found.
        
        Layout matching:
        - cover -> Title Slide (layout 0) or first layout
        - content -> Title and Content (layout 1) or blank
        - agenda -> Title and Content or Section Header
        - etc.
        """
        # Layout type hints mapping slide_type to typical layout indices
        layout_hints = {
            'cover': [0, 5],           # Title Slide, or Title Only
            'agenda': [1, 2],          # Title and Content, Section Header  
            'content': [1, 5, 6],      # Title and Content, Title Only, Blank
            'two_column': [3, 4],      # Two Content, Comparison
            'architecture': [5, 6, 1], # Title Only, Blank, Title and Content
            'timeline': [1, 5],        # Title and Content, Title Only
            'team': [1, 5],            # Title and Content, Title Only
            'pricing': [1, 5],         # Title and Content, Title Only
            'closing': [0, 5],         # Title Slide, Title Only
        }
        
        hints = layout_hints.get(slide_type, [6, 5, 1])  # Default to blank-ish
        
        # Try each hint in order
        for idx in hints:
            if idx < len(prs.slide_layouts):
                return prs.slide_layouts[idx]
        
        # Fallback to last layout (usually blank)
        return prs.slide_layouts[-1] if prs.slide_layouts else prs.slide_layouts[6]
    
    def generate_pptx(
        self,
        slides_data: List[Dict[str, Any]],
        title: str = "Proposal",
        client_name: str = "Client",
        company_name: str = "Company"
    ) -> io.BytesIO:
        """
        Generate a PowerPoint file from slide data.
        
        Args:
            slides_data: List of slide dictionaries with content
            title: Presentation title
            client_name: Client name for cover slide
            company_name: Company/vendor name
            
        Returns:
            BytesIO buffer containing the .pptx file
        """
        # Load from template if available, otherwise create new
        if self.template_path:
            try:
                prs = Presentation(self.template_path)
                logger.info(f"Loaded PPTX template from: {self.template_path}")
                
                # Get existing slide count
                template_slide_count = len(prs.slides)
                logger.info(f"Template has {template_slide_count} existing slides and {len(prs.slide_layouts)} layouts")
                
                # IMPORTANT: Remove all existing slides from template
                # We only want to use the template's layouts/styling, not its content
                # Delete slides in reverse order to avoid index issues
                for i in range(template_slide_count - 1, -1, -1):
                    rId = prs.slides._sldIdLst[i].rId
                    prs.part.drop_rel(rId)
                    del prs.slides._sldIdLst[i]
                
                logger.info(f"Cleared {template_slide_count} template slides, keeping layouts only")
                
                # Extract colors from template if possible
                self._extract_template_colors(prs)
                
            except Exception as e:
                logger.warning(f"Failed to load/clear template, creating new: {e}")
                import traceback
                traceback.print_exc()
                prs = Presentation()
                prs.slide_width = self.SLIDE_WIDTH
                prs.slide_height = self.SLIDE_HEIGHT
        else:
            prs = Presentation()
            prs.slide_width = self.SLIDE_WIDTH
            prs.slide_height = self.SLIDE_HEIGHT
        
        # Track if we're using a template
        self._using_template = self.template_path is not None
        
        for slide_data in slides_data:
            slide_type = slide_data.get('slide_type', 'content')
            
            if slide_type == 'cover':
                self._add_cover_slide(prs, slide_data, title, client_name, company_name)
            elif slide_type == 'agenda':
                self._add_agenda_slide(prs, slide_data)
            elif slide_type == 'problem':
                self._add_problem_slide(prs, slide_data)
            elif slide_type == 'solution':
                self._add_solution_slide(prs, slide_data)
            elif slide_type == 'two_column':
                self._add_two_column_slide(prs, slide_data)
            elif slide_type == 'architecture':
                self._add_architecture_slide(prs, slide_data)
            elif slide_type == 'timeline':
                self._add_timeline_slide(prs, slide_data)
            elif slide_type == 'team':
                self._add_team_slide(prs, slide_data)
            elif slide_type == 'risk':
                self._add_risk_slide(prs, slide_data)
            elif slide_type == 'roi':
                self._add_roi_slide(prs, slide_data)
            elif slide_type == 'pricing':
                self._add_pricing_slide(prs, slide_data)
            elif slide_type == 'closing':
                self._add_closing_slide(prs, slide_data, company_name)
            else:
                self._add_content_slide(prs, slide_data)
        
        # Save to buffer
        buffer = io.BytesIO()
        prs.save(buffer)
        buffer.seek(0)
        
        logger.info(f"Generated PPT with {len(slides_data)} slides")
        return buffer
    
    def _add_cover_slide(
        self,
        prs: Presentation,
        data: Dict[str, Any],
        title: str,
        client_name: str,
        company_name: str
    ):
        """Add a cover/title slide."""
        # Use template layout if available
        if self._using_template:
            slide_layout = self._get_best_layout(prs, 'cover')
        else:
            slide_layout = prs.slide_layouts[6]  # Blank layout
        
        slide = prs.slides.add_slide(slide_layout)
        
        # Try to use placeholder shapes from template layout
        if self._using_template:
            title_set = False
            subtitle_set = False
            
            # Find and populate title/subtitle placeholders
            for shape in slide.shapes:
                if shape.is_placeholder:
                    ph_type = shape.placeholder_format.type
                    # Title placeholder (usually type 1 or CENTER_TITLE)
                    if ph_type in [1, 3] and not title_set:  # TITLE or CENTER_TITLE
                        tf = shape.text_frame
                        tf.clear()
                        para = tf.paragraphs[0]
                        # Truncate title to prevent overlap
                        raw_title = data.get('title', title)
                        para.text = self._truncate_text(raw_title, max_chars=60)
                        para.font.size = Pt(36)  # Ensure consistent size
                        title_set = True
                    # Subtitle placeholder (usually type 2)
                    elif ph_type == 2 and not subtitle_set:  # SUBTITLE
                        tf = shape.text_frame
                        tf.clear()
                        para = tf.paragraphs[0]
                        # Truncate subtitle
                        raw_subtitle = data.get('subtitle', f"Proposal for {client_name}")
                        para.text = self._truncate_text(raw_subtitle, max_chars=80)
                        para.font.size = Pt(18)  # Smaller to avoid overlap
                        subtitle_set = True
            
            # DON'T add extra textbox - template has the company name already
            return
        else:
            # Original custom layout for non-template mode
            # Background shape
            bg_shape = slide.shapes.add_shape(
                MSO_SHAPE.RECTANGLE,
                Inches(0), Inches(0),
                self.SLIDE_WIDTH, self.SLIDE_HEIGHT
            )
            bg_shape.fill.solid()
            bg_shape.fill.fore_color.rgb = self.colors['primary']
            bg_shape.line.fill.background()
            
            # Title
            title_box = slide.shapes.add_textbox(
                Inches(0.75), Inches(2.5),
                Inches(11.5), Inches(1.5)
            )
            title_frame = title_box.text_frame
            title_para = title_frame.paragraphs[0]
            title_para.text = data.get('title', title)
            title_para.font.size = Pt(44)
            title_para.font.bold = True
            title_para.font.color.rgb = self.colors['text_light']
            title_para.alignment = PP_ALIGN.CENTER
            
            # Subtitle
            subtitle_box = slide.shapes.add_textbox(
                Inches(0.75), Inches(4.0),
                Inches(11.5), Inches(0.75)
            )
            subtitle_frame = subtitle_box.text_frame
            subtitle_para = subtitle_frame.paragraphs[0]
            subtitle_para.text = f"Proposal for {client_name}"
            subtitle_para.font.size = Pt(24)
            subtitle_para.font.color.rgb = self.colors['text_light']
            subtitle_para.alignment = PP_ALIGN.CENTER
            
            # Company name at bottom
            company_box = slide.shapes.add_textbox(
                Inches(0.75), Inches(6.5),
                Inches(11.5), Inches(0.5)
            )
            company_frame = company_box.text_frame
            company_para = company_frame.paragraphs[0]
            company_para.text = f"Prepared by: {company_name}"
            company_para.font.size = Pt(14)
            company_para.font.color.rgb = self.colors['text_light']
            company_para.alignment = PP_ALIGN.CENTER
    
    def _add_content_slide(self, prs: Presentation, data: Dict[str, Any]):
        """Add a standard content slide with bullets."""
        # Use template layout if available
        if self._using_template:
            slide_layout = self._get_best_layout(prs, 'content')
        else:
            slide_layout = prs.slide_layouts[6]  # Blank layout
        
        slide = prs.slides.add_slide(slide_layout)
        
        # Sanitize bullets using text utilities
        raw_bullets = data.get('bullets', [])
        bullets = self._sanitize_bullets(raw_bullets, max_bullets=6, max_chars_per_bullet=80)
        
        # Calculate dynamic font size based on content
        total_chars = sum(len(b) for b in bullets)
        font_size = self._calculate_font_size(total_chars, base_size=20, min_size=14, bullet_count=len(bullets))
        space_before, space_after = self._get_optimal_spacing(len(bullets))
        
        if self._using_template:
            # Try to populate placeholders from template
            for shape in slide.shapes:
                if shape.is_placeholder:
                    ph_type = shape.placeholder_format.type
                    # Title placeholder
                    if ph_type == 1:  # TITLE
                        tf = shape.text_frame
                        tf.clear()
                        para = tf.paragraphs[0]
                        # Truncate title if too long
                        para.text = self._truncate_text(data.get('title', 'Content'), max_chars=60)
                    # Body/content placeholder  
                    elif ph_type == 2 or ph_type == 7:  # BODY or OBJECT
                        if hasattr(shape, 'text_frame'):
                            tf = shape.text_frame
                            tf.clear()  # Clear existing placeholder text
                            tf.word_wrap = True
                            for i, bullet in enumerate(bullets):
                                if i == 0:
                                    para = tf.paragraphs[0]
                                else:
                                    para = tf.add_paragraph()
                                para.text = bullet
                                para.level = 0
                                para.font.size = Pt(font_size)
                                para.space_before = space_before
                                para.space_after = space_after
        else:
            # Original custom layout
            # Header bar
            header = slide.shapes.add_shape(
                MSO_SHAPE.RECTANGLE,
                Inches(0), Inches(0),
                self.SLIDE_WIDTH, Inches(1.2)
            )
            header.fill.solid()
            header.fill.fore_color.rgb = self.colors['primary']
            header.line.fill.background()
            
            # Title
            title_box = slide.shapes.add_textbox(
                Inches(0.5), Inches(0.3),
                Inches(12), Inches(0.7)
            )
            title_frame = title_box.text_frame
            title_para = title_frame.paragraphs[0]
            # Truncate title if too long
            title_para.text = self._truncate_text(data.get('title', 'Content'), max_chars=60)
            title_para.font.size = Pt(32)
            title_para.font.bold = True
            title_para.font.color.rgb = self.colors['text_light']
            
            # Bullets with dynamic sizing
            if bullets:
                content_box = slide.shapes.add_textbox(
                    Inches(0.75), Inches(1.6),
                    Inches(11.5), Inches(5.5)
                )
                content_frame = content_box.text_frame
                content_frame.word_wrap = True
                
                for i, bullet in enumerate(bullets):
                    if i == 0:
                        para = content_frame.paragraphs[0]
                    else:
                        para = content_frame.add_paragraph()
                    
                    para.text = f"• {bullet}"
                    para.font.size = Pt(font_size)
                    para.font.color.rgb = self.colors['text_dark']
                    para.space_before = space_before
                    para.space_after = space_after
        
        # ========================================
        # ADD SPEAKER NOTES
        # ========================================
        # Check for 'notes' (from AI agent) or 'speaker_notes' (legacy)
        speaker_notes = data.get('notes', '') or data.get('speaker_notes', '')
        if not speaker_notes:
            # Auto-generate speaker notes from content
            title = data.get('title', 'Content')
            bullet_text = '\n'.join([f"- {b}" for b in bullets[:4]])
            speaker_notes = f"Key points for {title}:\n{bullet_text}\n\nRemember to emphasize the business value and how this addresses the client's specific needs."
        
        # Add notes to slide
        notes_slide = slide.notes_slide
        notes_frame = notes_slide.notes_text_frame
        notes_frame.text = speaker_notes



    
    def _add_agenda_slide(self, prs: Presentation, data: Dict[str, Any]):
        """Add an agenda slide."""
        # Use template layout if available
        if self._using_template:
            slide_layout = self._get_best_layout(prs, 'agenda')
        else:
            slide_layout = prs.slide_layouts[6]
        
        slide = prs.slides.add_slide(slide_layout)
        
        # Sanitize agenda items
        raw_bullets = data.get('bullets', [])
        items = self._sanitize_bullets(raw_bullets, max_bullets=7, max_chars_per_bullet=60)
        
        if self._using_template:
            # Use template placeholders
            for shape in slide.shapes:
                if shape.is_placeholder:
                    ph_type = shape.placeholder_format.type
                    if ph_type == 1:  # TITLE
                        tf = shape.text_frame
                        tf.clear()
                        para = tf.paragraphs[0]
                        para.text = self._truncate_text(data.get('title', 'Agenda'), max_chars=40)
                    elif ph_type in [2, 7] and hasattr(shape, 'text_frame'):
                        tf = shape.text_frame
                        tf.clear()
                        tf.word_wrap = True
                        for i, item in enumerate(items, 1):
                            if i == 1:
                                para = tf.paragraphs[0]
                            else:
                                para = tf.add_paragraph()
                            para.text = f"{i}. {item}"
                            para.level = 0
                            para.font.size = Pt(18)
            return
        
        # Non-template mode: custom layout
        # Header
        header = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            Inches(0), Inches(0),
            self.SLIDE_WIDTH, Inches(1.2)
        )
        header.fill.solid()
        header.fill.fore_color.rgb = self.colors['primary']
        header.line.fill.background()
        
        # Title
        title_box = slide.shapes.add_textbox(
            Inches(0.5), Inches(0.3),
            Inches(12), Inches(0.7)
        )
        title_frame = title_box.text_frame
        title_para = title_frame.paragraphs[0]
        title_para.text = self._truncate_text(data.get('title', 'Agenda'), max_chars=40)
        title_para.font.size = Pt(32)
        title_para.font.bold = True
        title_para.font.color.rgb = self.colors['text_light']
        
        # Agenda items with numbers
        if items:
            content_box = slide.shapes.add_textbox(
                Inches(1), Inches(1.8),
                Inches(11), Inches(5)
            )
            content_frame = content_box.text_frame
            content_frame.word_wrap = True
            
            # Calculate font size based on item count
            font_size = 20 if len(items) <= 5 else 18
            
            for i, item in enumerate(items, 1):
                if i == 1:
                    para = content_frame.paragraphs[0]
                else:
                    para = content_frame.add_paragraph()
                
                para.text = f"{i}. {item}"
                para.font.size = Pt(font_size)
                para.font.color.rgb = self.colors['text_dark']
                para.space_before = Pt(12)
                para.space_after = Pt(6)
    
    def _add_two_column_slide(self, prs: Presentation, data: Dict[str, Any]):
        """Add a two-column comparison slide."""
        slide_layout = prs.slide_layouts[6]
        slide = prs.slides.add_slide(slide_layout)
        
        # Header
        header = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            Inches(0), Inches(0),
            self.SLIDE_WIDTH, Inches(1.2)
        )
        header.fill.solid()
        header.fill.fore_color.rgb = self.colors['primary']
        header.line.fill.background()
        
        # Title
        title_box = slide.shapes.add_textbox(
            Inches(0.5), Inches(0.3),
            Inches(12), Inches(0.7)
        )
        title_frame = title_box.text_frame
        title_para = title_frame.paragraphs[0]
        title_para.text = data.get('title', 'Comparison')
        title_para.font.size = Pt(32)
        title_para.font.bold = True
        title_para.font.color.rgb = self.colors['text_light']
        
        # Left column
        left_box = slide.shapes.add_textbox(
            Inches(0.5), Inches(1.6),
            Inches(5.8), Inches(5.5)
        )
        left_frame = left_box.text_frame
        left_frame.word_wrap = True
        
        left_items = data.get('left_column', data.get('bullets', [])[:3])
        for i, item in enumerate(left_items):
            if i == 0:
                para = left_frame.paragraphs[0]
            else:
                para = left_frame.add_paragraph()
            para.text = f"• {item}"
            para.font.size = Pt(18)
            para.font.color.rgb = self.colors['text_dark']
            para.space_before = Pt(8)
        
        # Right column
        right_box = slide.shapes.add_textbox(
            Inches(6.8), Inches(1.6),
            Inches(5.8), Inches(5.5)
        )
        right_frame = right_box.text_frame
        right_frame.word_wrap = True
        
        right_items = data.get('right_column', data.get('bullets', [])[3:6])
        for i, item in enumerate(right_items):
            if i == 0:
                para = right_frame.paragraphs[0]
            else:
                para = right_frame.add_paragraph()
            para.text = f"• {item}"
            para.font.size = Pt(18)
            para.font.color.rgb = self.colors['text_dark']
            para.space_before = Pt(8)
    
    def _add_architecture_slide(self, prs: Presentation, data: Dict[str, Any]):
        """Add an architecture diagram slide with actual rendered diagram or layered visual."""
        slide_layout = prs.slide_layouts[6]
        slide = prs.slides.add_slide(slide_layout)
        
        # CRITICAL: Clear any placeholder shapes inherited from template
        self._clear_slide_placeholders(slide)
        header = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            Inches(0), Inches(0),
            self.SLIDE_WIDTH, Inches(1.2)
        )
        header.fill.solid()
        header.fill.fore_color.rgb = self.colors['primary']
        header.line.fill.background()
        
        # Title
        title_box = slide.shapes.add_textbox(
            Inches(0.5), Inches(0.3),
            Inches(12), Inches(0.7)
        )
        title_frame = title_box.text_frame
        title_para = title_frame.paragraphs[0]
        title_para.text = self._truncate_text(data.get('title', 'Solution Architecture'), max_chars=50)
        title_para.font.size = Pt(32)
        title_para.font.bold = True
        title_para.font.color.rgb = self.colors['text_light']
        
        # Check if we have mermaid code to render
        mermaid_code = data.get('mermaid_code')
        diagram_rendered = False
        
        if mermaid_code:
            try:
                from .mermaid_service import render_mermaid_to_bytes_io
                diagram_buffer = render_mermaid_to_bytes_io(mermaid_code)
                if diagram_buffer:
                    # Add the actual diagram image
                    slide.shapes.add_picture(
                        diagram_buffer,
                        Inches(1), Inches(1.8),
                        width=Inches(11)
                    )
                    diagram_rendered = True
                    logger.info("Architecture diagram rendered successfully in slide")
            except Exception as e:
                logger.error(f"Failed to render diagram in slide: {e}")
        
        if not diagram_rendered:
            # FALLBACK: Create visual layered architecture from bullets
            bullets = data.get('bullets', [])
            sanitized = self._sanitize_bullets(bullets, max_bullets=4, max_chars_per_bullet=70)
            
            # Default architecture layers if none provided
            if not sanitized or len(sanitized) < 2:
                sanitized = [
                    "Presentation: Web interface, Admin dashboard, Mobile app",
                    "Application: Core services, Business logic, Workflow engine",
                    "Integration: REST APIs, External connectors, Authentication",
                    "Data: Database, Document storage, Analytics"
                ]
            
            # Define layer colors (gradient from top to bottom)
            layer_colors = [
                RGBColor(99, 102, 241),   # Indigo (Presentation)
                RGBColor(79, 70, 229),    # Darker Indigo (Application)
                RGBColor(67, 56, 202),    # Even Darker (Integration)
                RGBColor(55, 48, 163),    # Darkest (Data)
            ]
            
            # Draw 4 horizontal layer boxes
            num_layers = min(len(sanitized), 4)
            layer_height = 1.1
            start_y = 1.5
            gap = 0.15
            
            for i, layer_text in enumerate(sanitized[:4]):
                y_pos = start_y + i * (layer_height + gap)
                
                # Layer box
                layer_box = slide.shapes.add_shape(
                    MSO_SHAPE.ROUNDED_RECTANGLE,
                    Inches(0.75), Inches(y_pos),
                    Inches(11.5), Inches(layer_height)
                )
                layer_box.fill.solid()
                layer_box.fill.fore_color.rgb = layer_colors[i % len(layer_colors)]
                layer_box.line.fill.background()
                
                # Layer text
                text_box = slide.shapes.add_textbox(
                    Inches(1.0), Inches(y_pos + 0.3),
                    Inches(11), Inches(0.6)
                )
                text_frame = text_box.text_frame
                text_frame.word_wrap = True
                text_para = text_frame.paragraphs[0]
                text_para.text = layer_text
                text_para.font.size = Pt(16)
                text_para.font.bold = True
                text_para.font.color.rgb = RGBColor(255, 255, 255)
                text_para.alignment = PP_ALIGN.LEFT
            
            # Add connecting arrows on the right side
            arrow_x = 11.8
            for i in range(num_layers - 1):
                y_start = start_y + i * (layer_height + gap) + layer_height
                arrow = slide.shapes.add_shape(
                    MSO_SHAPE.DOWN_ARROW,
                    Inches(arrow_x), Inches(y_start),
                    Inches(0.4), Inches(gap - 0.02)
                )
                arrow.fill.solid()
                arrow.fill.fore_color.rgb = RGBColor(156, 163, 175)
                arrow.line.fill.background()
        
        # Add speaker notes
        notes_slide = slide.notes_slide
        notes_frame = notes_slide.notes_text_frame
        notes_text = data.get('notes', '') or "Walk through each layer of the architecture and explain how they interact."
        notes_frame.text = notes_text
    
    def _add_timeline_slide(self, prs: Presentation, data: Dict[str, Any]):
        """Add a visual timeline slide with connected phases."""
        slide_layout = prs.slide_layouts[6]  # Blank layout
        slide = prs.slides.add_slide(slide_layout)
        
        # CRITICAL: Clear any placeholder shapes inherited from template
        self._clear_slide_placeholders(slide)
        
        # Header bar
        header = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            Inches(0), Inches(0),
            self.SLIDE_WIDTH, Inches(1.2)
        )
        header.fill.solid()
        header.fill.fore_color.rgb = self.colors['primary']
        header.line.fill.background()
        
        # Title
        title_box = slide.shapes.add_textbox(
            Inches(0.5), Inches(0.3),
            Inches(12), Inches(0.7)
        )
        title_frame = title_box.text_frame
        title_para = title_frame.paragraphs[0]
        title_para.text = self._truncate_text(data.get('title', 'Project Timeline'), max_chars=50)
        title_para.font.size = Pt(32)
        title_para.font.bold = True
        title_para.font.color.rgb = self.colors['text_light']
        
        # Get timeline items from bullets - LIMIT to 4 phases for safe fit
        raw_bullets = data.get('bullets', [])
        phases = self._sanitize_bullets(raw_bullets, max_bullets=4, max_chars_per_bullet=25)
        
        if not phases:
            phases = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4']
        
        num_phases = min(len(phases), 4)  # Max 4 phases
        phases = phases[:num_phases]
        
        # SAFE BOUNDS: Calculate layout to fit within 12" (leaving 0.5" margins)
        max_usable_width = 11.0
        start_x = 1.0  # Safe left margin
        
        # Calculate safe phase width and gap
        total_phase_space = max_usable_width - 0.5  # Leave extra padding
        phase_width = min(2.0, total_phase_space / num_phases * 0.7)
        gap = (total_phase_space - (phase_width * num_phases)) / max(1, num_phases - 1)
        
        # Draw timeline connector line - SAFE WIDTH
        line_y = 3.3
        connector_width = min(max_usable_width, start_x - 0.5 + num_phases * (phase_width + gap))
        connector = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            Inches(start_x), Inches(line_y - 0.05),
            Inches(connector_width), Inches(0.1)
        )
        connector.fill.solid()
        connector.fill.fore_color.rgb = RGBColor(209, 213, 219)
        connector.line.fill.background()
        
        # Draw phase boxes
        colors_cycle = [
            self.colors['primary'],
            self.colors['secondary'],
            self.colors['accent'],
            RGBColor(139, 92, 246),  # Purple
        ]
        
        for i, phase in enumerate(phases):
            x_pos = start_x + i * (phase_width + gap)
            
            # BOUNDS CHECK: Skip if would overflow
            if x_pos + phase_width > 12.5:
                break
            
            # Phase circle/badge - smaller
            circle_size = 0.5
            circle = slide.shapes.add_shape(
                MSO_SHAPE.OVAL,
                Inches(x_pos + phase_width/2 - circle_size/2), Inches(line_y - circle_size/2),
                Inches(circle_size), Inches(circle_size)
            )
            circle.fill.solid()
            circle.fill.fore_color.rgb = colors_cycle[i % len(colors_cycle)]
            circle.line.color.rgb = RGBColor(255, 255, 255)
            circle.line.width = Pt(2)
            
            # Phase number in circle
            num_box = slide.shapes.add_textbox(
                Inches(x_pos + phase_width/2 - circle_size/2), Inches(line_y - circle_size/2 + 0.08),
                Inches(circle_size), Inches(circle_size - 0.1)
            )
            num_frame = num_box.text_frame
            num_para = num_frame.paragraphs[0]
            num_para.text = str(i + 1)
            num_para.font.size = Pt(14)
            num_para.font.bold = True
            num_para.font.color.rgb = RGBColor(255, 255, 255)
            num_para.alignment = PP_ALIGN.CENTER
            
            # Phase label below - truncated
            label_box = slide.shapes.add_textbox(
                Inches(x_pos), Inches(line_y + 0.4),
                Inches(phase_width), Inches(1.0)
            )
            label_frame = label_box.text_frame
            label_frame.word_wrap = True
            label_para = label_frame.paragraphs[0]
            label_para.text = self._truncate_text(phase, max_chars=22)
            label_para.font.size = Pt(12)
            label_para.font.bold = True
            label_para.font.color.rgb = self.colors['text_dark']
            label_para.alignment = PP_ALIGN.CENTER
        
        # Add speaker notes
        notes_slide = slide.notes_slide
        notes_frame = notes_slide.notes_text_frame
        notes_text = data.get('notes', '') or f"Timeline overview with {len(phases)} phases."
        notes_frame.text = notes_text
    
    def _add_team_slide(self, prs: Presentation, data: Dict[str, Any]):
        """Add a team structure slide with grid layout."""
        slide_layout = prs.slide_layouts[6]  # Blank layout
        slide = prs.slides.add_slide(slide_layout)
        
        # CRITICAL: Clear any placeholder shapes inherited from template
        self._clear_slide_placeholders(slide)
        header = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            Inches(0), Inches(0),
            self.SLIDE_WIDTH, Inches(1.2)
        )
        header.fill.solid()
        header.fill.fore_color.rgb = self.colors['primary']
        header.line.fill.background()
        
        # Title
        title_box = slide.shapes.add_textbox(
            Inches(0.5), Inches(0.3),
            Inches(12), Inches(0.7)
        )
        title_frame = title_box.text_frame
        title_para = title_frame.paragraphs[0]
        title_para.text = self._truncate_text(data.get('title', 'Team Structure'), max_chars=50)
        title_para.font.size = Pt(32)
        title_para.font.bold = True
        title_para.font.color.rgb = self.colors['text_light']
        
        # Get team members from bullets
        raw_bullets = data.get('bullets', [])
        members = self._sanitize_bullets(raw_bullets, max_bullets=6, max_chars_per_bullet=50)
        
        if not members:
            members = ['Project Manager', 'Technical Lead', 'Developer', 'QA Engineer']
        
        num_members = len(members)
        
        # Calculate grid layout (2-3 columns based on count)
        if num_members <= 3:
            cols = num_members
            rows = 1
        elif num_members <= 6:
            cols = 3
            rows = 2
        else:
            cols = 3
            rows = 2
            members = members[:6]  # Limit to 6
        # SAFE GRID: Calculate to fit within 11\" usable width
        # Max safe width = 11.0\" (leaving margins)
        # With 3 columns: each card = (11.0 - 2*gap - 2*margin) / 3 = ~3.0\"
        start_x = 1.5
        start_y = 1.5
        card_width = 2.8
        card_height = 1.8
        gap_x = 0.4
        gap_y = 0.35
        
        # Role icons (using shapes for visual interest)
        for i, member in enumerate(members):
            col = i % cols
            row = i // cols
            
            x_pos = start_x + col * (card_width + gap_x)
            y_pos = start_y + row * (card_height + gap_y)
            
            # BOUNDS CHECK: Skip if would overflow
            if x_pos + card_width > 12.0:
                continue
            
            # Card background
            card = slide.shapes.add_shape(
                MSO_SHAPE.ROUNDED_RECTANGLE,
                Inches(x_pos), Inches(y_pos),
                Inches(card_width), Inches(card_height)
            )
            card.fill.solid()
            card.fill.fore_color.rgb = RGBColor(249, 250, 251)
            card.line.color.rgb = RGBColor(209, 213, 219)
            card.line.width = Pt(1)
            
            # Role icon circle (top of card) - smaller for compact card
            icon_circle = slide.shapes.add_shape(
                MSO_SHAPE.OVAL,
                Inches(x_pos + card_width/2 - 0.25), Inches(y_pos + 0.15),
                Inches(0.5), Inches(0.5)
            )
            icon_circle.fill.solid()
            icon_circle.fill.fore_color.rgb = self.colors['secondary']
            icon_circle.line.fill.background()
            
            # Number in icon
            icon_box = slide.shapes.add_textbox(
                Inches(x_pos + card_width/2 - 0.25), Inches(y_pos + 0.2),
                Inches(0.5), Inches(0.45)
            )
            icon_frame = icon_box.text_frame
            icon_para = icon_frame.paragraphs[0]
            icon_para.text = str(i + 1)  # Number as placeholder
            icon_para.font.size = Pt(16)
            icon_para.font.bold = True
            icon_para.font.color.rgb = RGBColor(255, 255, 255)
            icon_para.alignment = PP_ALIGN.CENTER
            
            # Role name - compact positioning for 1.8" card
            role_box = slide.shapes.add_textbox(
                Inches(x_pos + 0.1), Inches(y_pos + 0.75),
                Inches(card_width - 0.2), Inches(0.9)
            )
            role_frame = role_box.text_frame
            role_frame.word_wrap = True
            role_para = role_frame.paragraphs[0]
            # Truncate member name for compact card
            role_para.text = self._truncate_text(member, max_chars=28)
            role_para.font.size = Pt(10)
            role_para.font.bold = True
            role_para.font.color.rgb = self.colors['text_dark']
            role_para.alignment = PP_ALIGN.CENTER
        
        # Add speaker notes
        notes_slide = slide.notes_slide
        notes_frame = notes_slide.notes_text_frame
        notes_text = data.get('notes', '') or f"Team structure with {len(members)} key roles."
        notes_frame.text = notes_text

    
    def _add_pricing_slide(self, prs: Presentation, data: Dict[str, Any]):
        """Add a pricing summary slide."""
        slide_layout = prs.slide_layouts[6]
        slide = prs.slides.add_slide(slide_layout)
        
        # Header with accent color
        header = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            Inches(0), Inches(0),
            self.SLIDE_WIDTH, Inches(1.2)
        )
        header.fill.solid()
        header.fill.fore_color.rgb = self.colors['accent']
        header.line.fill.background()
        
        # Title
        title_box = slide.shapes.add_textbox(
            Inches(0.5), Inches(0.3),
            Inches(12), Inches(0.7)
        )
        title_frame = title_box.text_frame
        title_para = title_frame.paragraphs[0]
        title_para.text = data.get('title', 'Pricing Summary')
        title_para.font.size = Pt(32)
        title_para.font.bold = True
        title_para.font.color.rgb = self.colors['text_light']
        
        # Content
        bullets = data.get('bullets', [])
        if bullets:
            content_box = slide.shapes.add_textbox(
                Inches(0.75), Inches(1.6),
                Inches(11.5), Inches(5.5)
            )
            content_frame = content_box.text_frame
            content_frame.word_wrap = True
            
            for i, bullet in enumerate(bullets[:6]):
                if i == 0:
                    para = content_frame.paragraphs[0]
                else:
                    para = content_frame.add_paragraph()
                
                para.text = f"• {bullet}"
                para.font.size = Pt(20)
                para.font.color.rgb = self.colors['text_dark']
                para.space_before = Pt(12)
    
    def _add_closing_slide(self, prs: Presentation, data: Dict[str, Any], company_name: str):
        """Add a closing/thank you slide."""
        slide_layout = prs.slide_layouts[6]
        slide = prs.slides.add_slide(slide_layout)
        
        # Background
        bg_shape = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            Inches(0), Inches(0),
            self.SLIDE_WIDTH, self.SLIDE_HEIGHT
        )
        bg_shape.fill.solid()
        bg_shape.fill.fore_color.rgb = self.colors['primary']
        bg_shape.line.fill.background()
        
        # Thank you text
        title_box = slide.shapes.add_textbox(
            Inches(0.75), Inches(2.5),
            Inches(11.5), Inches(1.5)
        )
        title_frame = title_box.text_frame
        title_para = title_frame.paragraphs[0]
        title_para.text = data.get('title', 'Thank You')
        title_para.font.size = Pt(48)
        title_para.font.bold = True
        title_para.font.color.rgb = self.colors['text_light']
        title_para.alignment = PP_ALIGN.CENTER
        
        # Q&A text
        qa_box = slide.shapes.add_textbox(
            Inches(0.75), Inches(4.0),
            Inches(11.5), Inches(0.75)
        )
        qa_frame = qa_box.text_frame
        qa_para = qa_frame.paragraphs[0]
        qa_para.text = "Questions & Discussion"
        qa_para.font.size = Pt(24)
        qa_para.font.color.rgb = self.colors['text_light']
        qa_para.alignment = PP_ALIGN.CENTER
        
        # Company name
        company_box = slide.shapes.add_textbox(
            Inches(0.75), Inches(6.0),
            Inches(11.5), Inches(0.5)
        )
        company_frame = company_box.text_frame
        company_para = company_frame.paragraphs[0]
        company_para.text = company_name
        company_para.font.size = Pt(16)
        company_para.font.color.rgb = self.colors['text_light']
        company_para.alignment = PP_ALIGN.CENTER
    
    # ========================================
    # NEW SLIDE TYPES FOR ENTERPRISE PPT
    # ========================================
    
    def _add_problem_slide(self, prs: Presentation, data: Dict[str, Any]):
        """Add a client challenges/problem slide with red accent."""
        slide_layout = prs.slide_layouts[6]
        slide = prs.slides.add_slide(slide_layout)
        
        # CRITICAL: Clear any placeholder shapes inherited from template
        self._clear_slide_placeholders(slide)
        
        # Red accent header for problem/challenges
        header = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            Inches(0), Inches(0),
            self.SLIDE_WIDTH, Inches(1.2)
        )
        header.fill.solid()
        header.fill.fore_color.rgb = RGBColor(220, 38, 38)  # Red for challenges
        header.line.fill.background()
        
        # Title
        title_box = slide.shapes.add_textbox(
            Inches(0.5), Inches(0.3),
            Inches(12), Inches(0.7)
        )
        title_frame = title_box.text_frame
        title_para = title_frame.paragraphs[0]
        title_para.text = self._truncate_text(data.get('title', 'Client Challenges'), max_chars=50)
        title_para.font.size = Pt(32)
        title_para.font.bold = True
        title_para.font.color.rgb = RGBColor(255, 255, 255)
        
        # Problem bullets - allow longer for detailed challenges
        raw_bullets = data.get('bullets', [])
        bullets = self._sanitize_bullets(raw_bullets, max_bullets=5, max_chars_per_bullet=100)
        
        if bullets:
            content_box = slide.shapes.add_textbox(
                Inches(0.75), Inches(1.6),
                Inches(11.5), Inches(5.5)
            )
            content_frame = content_box.text_frame
            content_frame.word_wrap = True
            
            total_chars = sum(len(b) for b in bullets)
            font_size = self._calculate_font_size(total_chars, base_size=20, min_size=16, bullet_count=len(bullets))
            
            for i, bullet in enumerate(bullets):
                if i == 0:
                    para = content_frame.paragraphs[0]
                else:
                    para = content_frame.add_paragraph()
                
                para.text = f"→ {bullet}"  # Arrow indicates challenge
                para.font.size = Pt(font_size)
                para.font.color.rgb = self.colors['text_dark']
                para.space_before = Pt(14)
                para.space_after = Pt(8)
        
        # Speaker notes
        notes_slide = slide.notes_slide
        notes_frame = notes_slide.notes_text_frame
        notes_frame.text = data.get('notes', '') or "Discuss each challenge and its business impact."
    
    def _add_solution_slide(self, prs: Presentation, data: Dict[str, Any]):
        """Add a solution overview slide with green accent."""
        slide_layout = prs.slide_layouts[6]
        slide = prs.slides.add_slide(slide_layout)
        
        # CRITICAL: Clear any placeholder shapes inherited from template
        self._clear_slide_placeholders(slide)
        
        # Green accent header for solution
        header = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            Inches(0), Inches(0),
            self.SLIDE_WIDTH, Inches(1.2)
        )
        header.fill.solid()
        header.fill.fore_color.rgb = RGBColor(16, 185, 129)  # Green for solution
        header.line.fill.background()
        
        # Title
        title_box = slide.shapes.add_textbox(
            Inches(0.5), Inches(0.3),
            Inches(12), Inches(0.7)
        )
        title_frame = title_box.text_frame
        title_para = title_frame.paragraphs[0]
        title_para.text = self._truncate_text(data.get('title', 'Proposed Solution'), max_chars=50)
        title_para.font.size = Pt(32)
        title_para.font.bold = True
        title_para.font.color.rgb = RGBColor(255, 255, 255)
        
        # Solution bullets - allow longer for detailed outcomes
        raw_bullets = data.get('bullets', [])
        bullets = self._sanitize_bullets(raw_bullets, max_bullets=5, max_chars_per_bullet=100)
        
        if bullets:
            content_box = slide.shapes.add_textbox(
                Inches(0.75), Inches(1.6),
                Inches(11.5), Inches(5.5)
            )
            content_frame = content_box.text_frame
            content_frame.word_wrap = True
            
            total_chars = sum(len(b) for b in bullets)
            font_size = self._calculate_font_size(total_chars, base_size=20, min_size=16, bullet_count=len(bullets))
            
            for i, bullet in enumerate(bullets):
                if i == 0:
                    para = content_frame.paragraphs[0]
                else:
                    para = content_frame.add_paragraph()
                
                para.text = f"✓ {bullet}"  # Checkmark for solution
                para.font.size = Pt(font_size)
                para.font.color.rgb = self.colors['text_dark']
                para.space_before = Pt(14)
                para.space_after = Pt(8)
        
        # Speaker notes
        notes_slide = slide.notes_slide
        notes_frame = notes_slide.notes_text_frame
        notes_frame.text = data.get('notes', '') or "Explain how each solution element addresses client needs."
    
    def _add_risk_slide(self, prs: Presentation, data: Dict[str, Any]):
        """Add a risk and mitigation slide with amber accent."""
        slide_layout = prs.slide_layouts[6]
        slide = prs.slides.add_slide(slide_layout)
        
        # CRITICAL: Clear any placeholder shapes inherited from template
        self._clear_slide_placeholders(slide)
        
        # Amber header for risks
        header = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            Inches(0), Inches(0),
            self.SLIDE_WIDTH, Inches(1.2)
        )
        header.fill.solid()
        header.fill.fore_color.rgb = RGBColor(245, 158, 11)  # Amber for risks
        header.line.fill.background()
        
        # Title
        title_box = slide.shapes.add_textbox(
            Inches(0.5), Inches(0.3),
            Inches(12), Inches(0.7)
        )
        title_frame = title_box.text_frame
        title_para = title_frame.paragraphs[0]
        title_para.text = self._truncate_text(data.get('title', 'Risks & Mitigation'), max_chars=50)
        title_para.font.size = Pt(32)
        title_para.font.bold = True
        title_para.font.color.rgb = RGBColor(255, 255, 255)
        
        # Risk items - allow longer for risk + mitigation
        raw_bullets = data.get('bullets', [])
        bullets = self._sanitize_bullets(raw_bullets, max_bullets=4, max_chars_per_bullet=110)
        
        if bullets:
            content_box = slide.shapes.add_textbox(
                Inches(0.75), Inches(1.6),
                Inches(11.5), Inches(5.5)
            )
            content_frame = content_box.text_frame
            content_frame.word_wrap = True
            
            for i, bullet in enumerate(bullets):
                if i == 0:
                    para = content_frame.paragraphs[0]
                else:
                    para = content_frame.add_paragraph()
                
                para.text = f"⚠ {bullet}"  # Warning icon for risks
                para.font.size = Pt(18)
                para.font.color.rgb = self.colors['text_dark']
                para.space_before = Pt(16)
                para.space_after = Pt(10)
        
        # Speaker notes
        notes_slide = slide.notes_slide
        notes_frame = notes_slide.notes_text_frame
        notes_frame.text = data.get('notes', '') or "Discuss each risk and how we will mitigate it."
    
    def _add_roi_slide(self, prs: Presentation, data: Dict[str, Any]):
        """Add a value/ROI slide with metrics focus."""
        slide_layout = prs.slide_layouts[6]
        slide = prs.slides.add_slide(slide_layout)
        
        # CRITICAL: Clear any placeholder shapes inherited from template
        self._clear_slide_placeholders(slide)
        
        # Purple header for value/ROI
        header = slide.shapes.add_shape(
            MSO_SHAPE.RECTANGLE,
            Inches(0), Inches(0),
            self.SLIDE_WIDTH, Inches(1.2)
        )
        header.fill.solid()
        header.fill.fore_color.rgb = RGBColor(139, 92, 246)  # Purple for value
        header.line.fill.background()
        
        # Title
        title_box = slide.shapes.add_textbox(
            Inches(0.5), Inches(0.3),
            Inches(12), Inches(0.7)
        )
        title_frame = title_box.text_frame
        title_para = title_frame.paragraphs[0]
        title_para.text = self._truncate_text(data.get('title', 'Value & ROI'), max_chars=50)
        title_para.font.size = Pt(32)
        title_para.font.bold = True
        title_para.font.color.rgb = RGBColor(255, 255, 255)
        
        # ROI metrics - allow longer bullets for detailed value statements
        raw_bullets = data.get('bullets', [])
        bullets = self._sanitize_bullets(raw_bullets, max_bullets=5, max_chars_per_bullet=120)
        
        if bullets:
            content_box = slide.shapes.add_textbox(
                Inches(0.75), Inches(1.6),
                Inches(11.5), Inches(5.5)
            )
            content_frame = content_box.text_frame
            content_frame.word_wrap = True
            
            for i, bullet in enumerate(bullets):
                if i == 0:
                    para = content_frame.paragraphs[0]
                else:
                    para = content_frame.add_paragraph()
                
                para.text = f"◆ {bullet}"  # Diamond for value points
                para.font.size = Pt(17)  # Smaller font for longer content
                para.font.bold = False  # Remove bold for readability
                para.font.color.rgb = self.colors['text_dark']
                para.space_before = Pt(14)
                para.space_after = Pt(8)
        
        # Speaker notes
        notes_slide = slide.notes_slide
        notes_frame = notes_slide.notes_text_frame
        notes_frame.text = data.get('notes', '') or "Emphasize quantifiable benefits and success metrics."
