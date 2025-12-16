"""
Document Chunking Service

Chunks documents into meaningful sections for vector storage.
Enables semantic search over large documents by breaking them
into searchable, context-preserving segments.
"""
import re
import logging
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)


class ChunkingService:
    """Service for intelligently chunking documents."""
    
    DEFAULT_CHUNK_SIZE = 500  # words
    OVERLAP = 50  # words overlap between chunks
    MIN_CHUNK_SIZE = 50  # minimum words for a chunk
    
    # Patterns to identify section headers
    SECTION_PATTERNS = [
        r'^#{1,6}\s+(.+)$',  # Markdown headers
        r'^(\d+\.)+\s+(.+)$',  # Numbered sections (1., 1.1., etc.)
        r'^[A-Z][A-Z\s]{3,}$',  # ALL CAPS headers
        r'^Section\s+(\d+|[IVX]+)[\.:]\s*(.+)$',  # Section X: Title
        r'^(Part|Chapter)\s+(\d+|[IVX]+)[\.:]\s*(.+)$',  # Part/Chapter X: Title
        r'^([A-Z])\.\s+(.+)$',  # A. Title format
        r'^\[(.+)\]$',  # [Section Name] format
    ]
    
    # Category keywords for auto-tagging
    CATEGORY_KEYWORDS = {
        'security': [
            'encryption', 'security', 'authentication', 'authorization',
            'access control', 'password', 'mfa', 'two-factor', 'firewall',
            'vulnerability', 'penetration', 'intrusion', 'threat', 'malware'
        ],
        'compliance': [
            'soc 2', 'soc2', 'iso 27001', 'iso27001', 'gdpr', 'hipaa',
            'pci', 'fedramp', 'compliance', 'audit', 'certification',
            'regulation', 'regulatory', 'privacy'
        ],
        'technical': [
            'api', 'integration', 'architecture', 'infrastructure',
            'database', 'performance', 'scalability', 'uptime', 'sla',
            'deployment', 'backup', 'disaster recovery', 'redundancy'
        ],
        'legal': [
            'contract', 'liability', 'indemnification', 'warranty',
            'termination', 'intellectual property', 'confidential',
            'nda', 'agreement', 'terms', 'conditions'
        ],
        'product': [
            'feature', 'functionality', 'roadmap', 'release', 'version',
            'support', 'training', 'implementation', 'onboarding',
            'customization', 'configuration'
        ]
    }

    def chunk_document(
        self,
        content: str,
        chunk_size: int = None,
        preserve_sections: bool = True,
        source_file: str = None
    ) -> List[Dict]:
        """
        Chunk document into searchable sections.
        
        Args:
            content: The document text to chunk
            chunk_size: Maximum words per chunk (default: 500)
            preserve_sections: Whether to respect document structure
            source_file: Original filename for metadata
        
        Returns:
            List of dicts with:
            - content: The chunk text
            - index: Chunk position
            - section: Detected section name
            - word_count: Number of words
            - categories: Auto-detected categories
            - metadata: Additional info
        """
        if not content or not content.strip():
            return []
        
        size = chunk_size or self.DEFAULT_CHUNK_SIZE
        
        if preserve_sections:
            chunks = self._section_based_chunking(content, size)
        else:
            chunks = self._fixed_size_chunking(content, size)
        
        # Post-process: add categories and metadata
        for chunk in chunks:
            chunk['categories'] = self._detect_categories(chunk['content'])
            chunk['metadata'] = {
                'source_file': source_file,
                'chunking_method': 'section' if preserve_sections else 'fixed'
            }
        
        logger.info(f"Created {len(chunks)} chunks from document")
        return chunks

    def _section_based_chunking(self, content: str, max_size: int) -> List[Dict]:
        """Chunk based on document structure, preserving sections."""
        chunks = []
        current_section = "General"
        current_chunk_lines = []
        current_words = 0
        
        lines = content.split('\n')
        
        for line in lines:
            stripped = line.strip()
            
            # Check if line is a section header
            is_header, section_name = self._is_section_header(stripped)
            
            if is_header and section_name:
                # Save current chunk if it has content
                if current_chunk_lines and current_words >= self.MIN_CHUNK_SIZE:
                    chunks.append(self._create_chunk(
                        '\n'.join(current_chunk_lines),
                        current_section,
                        current_words,
                        len(chunks)
                    ))
                
                current_section = section_name
                current_chunk_lines = [line]  # Include header in new chunk
                current_words = len(stripped.split())
            else:
                line_words = len(stripped.split())
                
                # Check if adding this line would exceed max size
                if current_words + line_words > max_size and current_chunk_lines:
                    # Save current chunk and start new one
                    chunks.append(self._create_chunk(
                        '\n'.join(current_chunk_lines),
                        current_section,
                        current_words,
                        len(chunks)
                    ))
                    
                    # Start new chunk with overlap
                    overlap_lines = self._get_overlap_lines(current_chunk_lines)
                    current_chunk_lines = overlap_lines + [line]
                    current_words = sum(len(l.split()) for l in current_chunk_lines)
                else:
                    current_chunk_lines.append(line)
                    current_words += line_words
        
        # Add final chunk
        if current_chunk_lines and current_words >= self.MIN_CHUNK_SIZE:
            chunks.append(self._create_chunk(
                '\n'.join(current_chunk_lines),
                current_section,
                current_words,
                len(chunks)
            ))
        
        return chunks

    def _fixed_size_chunking(self, content: str, chunk_size: int) -> List[Dict]:
        """Simple fixed-size chunking with overlap."""
        words = content.split()
        chunks = []
        
        i = 0
        while i < len(words):
            end = min(i + chunk_size, len(words))
            chunk_words = words[i:end]
            
            if len(chunk_words) >= self.MIN_CHUNK_SIZE:
                chunks.append(self._create_chunk(
                    ' '.join(chunk_words),
                    None,
                    len(chunk_words),
                    len(chunks)
                ))
            
            # Move forward with overlap
            i += chunk_size - self.OVERLAP
        
        return chunks

    def _is_section_header(self, line: str) -> tuple[bool, Optional[str]]:
        """Check if a line is a section header and extract the name."""
        if not line or len(line) > 200:  # Headers shouldn't be too long
            return False, None
        
        for pattern in self.SECTION_PATTERNS:
            match = re.match(pattern, line, re.IGNORECASE)
            if match:
                # Extract section name from match groups
                groups = match.groups()
                if groups:
                    # Get the last non-None group as section name
                    name = next((g for g in reversed(groups) if g), line)
                    return True, name.strip()
                return True, line.strip()
        
        return False, None

    def _create_chunk(
        self,
        content: str,
        section: str,
        word_count: int,
        index: int
    ) -> Dict:
        """Create a chunk dictionary."""
        return {
            'content': content.strip(),
            'section': section,
            'word_count': word_count,
            'index': index
        }

    def _get_overlap_lines(self, lines: List[str], target_words: int = None) -> List[str]:
        """Get the last few lines for overlap."""
        target = target_words or self.OVERLAP
        overlap_lines = []
        word_count = 0
        
        for line in reversed(lines):
            words = len(line.split())
            if word_count + words > target:
                break
            overlap_lines.insert(0, line)
            word_count += words
        
        return overlap_lines

    def _detect_categories(self, text: str) -> List[str]:
        """Auto-detect categories based on content keywords."""
        text_lower = text.lower()
        categories = []
        
        for category, keywords in self.CATEGORY_KEYWORDS.items():
            matches = sum(1 for kw in keywords if kw in text_lower)
            if matches >= 2:  # Need at least 2 keyword matches
                categories.append(category)
        
        return categories if categories else ['general']

    def chunk_for_knowledge_base(
        self,
        title: str,
        content: str,
        existing_tags: List[str] = None,
        source_file: str = None
    ) -> List[Dict]:
        """
        Chunk content specifically for knowledge base storage.
        
        Creates chunks suitable for vector storage with proper metadata.
        """
        chunks = self.chunk_document(
            content,
            preserve_sections=True,
            source_file=source_file
        )
        
        # Enhance with knowledge base specific metadata
        for chunk in chunks:
            chunk['title'] = f"{title} - {chunk['section']}" if chunk['section'] else title
            chunk['tags'] = list(set(
                (existing_tags or []) + chunk.get('categories', [])
            ))
        
        return chunks

    def estimate_chunks(self, content: str, chunk_size: int = None) -> int:
        """Estimate number of chunks without actually chunking."""
        size = chunk_size or self.DEFAULT_CHUNK_SIZE
        word_count = len(content.split())
        return max(1, (word_count + size - 1) // (size - self.OVERLAP))


# Singleton instance
chunking_service = ChunkingService()
