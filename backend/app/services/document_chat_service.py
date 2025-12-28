"""
Document Chat Service

Provides AI-powered document analysis:
- Summary generation
- Suggested questions
- Question answering with document context
"""
import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime

from app import db
from app.models.document import Document
from app.models.document_chat import DocumentChatSession, DocumentChatMessage

logger = logging.getLogger(__name__)


class DocumentChatService:
    """Service for document-specific chat functionality."""
    
    SUMMARY_PROMPT = """Analyze this document and provide:

1. **Overview**: A 2-3 sentence summary of what this document is about.

2. **Key Points**: List 5-8 key points from the document in bullet format.

Document Content:
{content}

Format your response as:
- Overview: [summary]
- Key Points:
  • [point 1]
  • [point 2]
  ...
"""
    
    SUGGESTIONS_PROMPT = """Based on this document, generate 3-4 relevant questions that a user might want to ask.
Make them specific to the document content.

Document Content:
{content}

Return only the questions, one per line.
"""
    
    CHAT_PROMPT = """You are a helpful assistant answering questions about a document.
Use the document content to provide accurate, specific answers.
If the answer is not in the document, say so.

Document Content:
{content}

User Question: {question}

Provide a helpful, detailed answer based on the document content.
"""
    
    def __init__(self, org_id: int = None):
        self.org_id = org_id
        self._llm_provider = None
    
    @property
    def llm_provider(self):
        """Lazy load LLM provider."""
        if self._llm_provider is None and self.org_id:
            try:
                from app.services.llm_service_helper import get_llm_provider
                self._llm_provider = get_llm_provider(self.org_id, 'document_chat')
            except Exception as e:
                logger.warning(f"Could not get LLM provider: {e}")
        return self._llm_provider
    
    def get_or_create_session(
        self, 
        document_id: int, 
        user_id: int
    ) -> Tuple[DocumentChatSession, bool]:
        """
        Get existing session or create new one for document/user.
        
        Returns:
            Tuple of (session, is_new)
        """
        # Check for existing session
        session = DocumentChatSession.query.filter_by(
            document_id=document_id,
            user_id=user_id
        ).first()
        
        if session:
            return session, False
        
        # Create new session
        session = DocumentChatSession(
            document_id=document_id,
            user_id=user_id
        )
        db.session.add(session)
        db.session.commit()
        
        return session, True
    
    def get_document_content(self, document_id: int) -> str:
        """Extract text content from document."""
        document = Document.query.get(document_id)
        if not document:
            return ""
        
        # Try to get extracted text
        if document.extracted_text:
            return document.extracted_text[:50000]  # Limit for LLM context
        
        # Fallback to file content if available
        if document.file_data:
            try:
                # Try to decode as text
                return document.file_data.decode('utf-8', errors='ignore')[:50000]
            except:
                pass
        
        return f"Document: {document.filename}\nNo text content available."
    
    def generate_summary(self, session: DocumentChatSession) -> Dict:
        """
        Generate document summary and key points.
        
        Args:
            session: The chat session
            
        Returns:
            Dict with summary, key_points, suggestions
        """
        if not self.llm_provider:
            return self._fallback_summary(session.document_id)
        
        content = self.get_document_content(session.document_id)
        
        try:
            # Generate summary
            summary_response = self.llm_provider.generate_content(
                self.SUMMARY_PROMPT.format(content=content[:30000])
            )
            
            # Parse summary and key points
            summary, key_points = self._parse_summary_response(summary_response)
            
            # Generate suggestions
            suggestions_response = self.llm_provider.generate_content(
                self.SUGGESTIONS_PROMPT.format(content=content[:20000])
            )
            suggestions = self._parse_suggestions(suggestions_response)
            
            # Update session
            session.summary = summary
            session.key_points = key_points
            session.suggestions = suggestions
            db.session.commit()
            
            return {
                'summary': summary,
                'keyPoints': key_points,
                'suggestions': suggestions
            }
            
        except Exception as e:
            logger.error(f"Failed to generate summary: {e}")
            return self._fallback_summary(session.document_id)
    
    def _parse_summary_response(self, response: str) -> Tuple[str, List[str]]:
        """Parse the summary response into overview and key points."""
        lines = response.strip().split('\n')
        
        summary = ""
        key_points = []
        in_key_points = False
        
        for line in lines:
            line = line.strip()
            if line.lower().startswith('- overview:') or line.lower().startswith('overview:'):
                summary = line.split(':', 1)[1].strip() if ':' in line else line
            elif 'key points' in line.lower():
                in_key_points = True
            elif in_key_points and (line.startswith('•') or line.startswith('-') or line.startswith('*')):
                point = line.lstrip('•-* ').strip()
                if point:
                    key_points.append(point)
            elif not summary and line and not in_key_points:
                summary = line
        
        return summary, key_points[:8]  # Limit to 8 key points
    
    def _parse_suggestions(self, response: str) -> List[str]:
        """Parse suggestions response into list of questions."""
        lines = response.strip().split('\n')
        suggestions = []
        
        for line in lines:
            line = line.strip()
            if line and not line.lower().startswith('question') and len(line) > 10:
                # Clean up numbering
                cleaned = line.lstrip('0123456789.-) ').strip()
                if cleaned and '?' in cleaned or len(cleaned) > 20:
                    suggestions.append(cleaned)
        
        return suggestions[:4]  # Limit to 4 suggestions
    
    def _fallback_summary(self, document_id: int) -> Dict:
        """Fallback when LLM is not available."""
        document = Document.query.get(document_id)
        return {
            'summary': f"Document: {document.filename if document else 'Unknown'}",
            'keyPoints': ['AI summary not available - no LLM provider configured'],
            'suggestions': ['What is this document about?', 'Summarize the key points']
        }
    
    def chat(
        self, 
        session: DocumentChatSession, 
        user_message: str
    ) -> DocumentChatMessage:
        """
        Process a chat message and generate AI response.
        
        Args:
            session: The chat session
            user_message: User's question
            
        Returns:
            The assistant's response message
        """
        # Save user message
        user_msg = DocumentChatMessage(
            session_id=session.id,
            role='user',
            content=user_message
        )
        db.session.add(user_msg)
        
        # Generate AI response
        if self.llm_provider:
            content = self.get_document_content(session.document_id)
            
            try:
                response = self.llm_provider.generate_content(
                    self.CHAT_PROMPT.format(
                        content=content[:30000],
                        question=user_message
                    )
                )
            except Exception as e:
                logger.error(f"Chat generation failed: {e}")
                response = f"I apologize, but I encountered an error processing your question: {str(e)}"
        else:
            response = "AI chat is not available. Please configure an LLM provider for your organization."
        
        # Save assistant message
        assistant_msg = DocumentChatMessage(
            session_id=session.id,
            role='assistant',
            content=response
        )
        db.session.add(assistant_msg)
        
        # Update session timestamp
        session.updated_at = datetime.utcnow()
        db.session.commit()
        
        return assistant_msg
    
    def get_chat_history(self, session: DocumentChatSession) -> List[Dict]:
        """Get all messages for a session."""
        messages = session.messages.order_by(DocumentChatMessage.created_at).all()
        return [m.to_dict() for m in messages]


def get_document_chat_service(org_id: int = None) -> DocumentChatService:
    """Factory function to get document chat service."""
    return DocumentChatService(org_id=org_id)
