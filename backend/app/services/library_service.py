"""Service for managing the Answer Library (Approvals, Versioning, Promotion)."""
from datetime import datetime, timedelta
from typing import List, Optional, Dict
from ..extensions import db
from ..models import AnswerLibraryItem, User

class LibraryService:
    """Handles business logic for the reusable Answer Library."""

    def promote_to_library(
        self,
        question_text: str,
        answer_text: str,
        organization_id: int,
        user_id: int,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        source_project_id: Optional[int] = None,
        source_question_id: Optional[int] = None,
        source_answer_id: Optional[int] = None,
        status: str = 'under_review'
    ) -> AnswerLibraryItem:
        """Promote a project answer to the reusable library."""
        item = AnswerLibraryItem(
            organization_id=organization_id,
            question_text=question_text,
            answer_text=answer_text,
            category=category,
            tags=tags or [],
            source_project_id=source_project_id,
            source_question_id=source_question_id,
            source_answer_id=source_answer_id,
            status=status,
            created_by=user_id,
            version_number=1,
            next_review_due=datetime.utcnow() + timedelta(days=180) # Default 6 months review cycle
        )
        db.session.add(item)
        db.session.commit()
        return item

    def update_item(
        self,
        item_id: int,
        updates: Dict,
        user_id: int
    ) -> Optional[AnswerLibraryItem]:
        """Update a library item and increment version if content changed."""
        item = AnswerLibraryItem.query.get(item_id)
        if not item:
            return None

        content_changed = False
        if 'question_text' in updates and updates['question_text'] != item.question_text:
            content_changed = True
        if 'answer_text' in updates and updates['answer_text'] != item.answer_text:
            content_changed = True

        for key, value in updates.items():
            if hasattr(item, key) and key != 'id':
                setattr(item, key, value)

        if content_changed:
            item.version_number += 1
            item.status = 'under_review' # Re-review if content changed

        item.updated_by = user_id
        item.updated_at = datetime.utcnow()
        db.session.commit()
        return item

    def approve_item(self, item_id: int, user_id: int) -> Optional[AnswerLibraryItem]:
        """Approve a library item."""
        item = AnswerLibraryItem.query.get(item_id)
        if not item:
            return None

        item.status = 'approved'
        item.reviewed_by = user_id
        item.last_reviewed_at = datetime.utcnow()
        item.next_review_due = datetime.utcnow() + timedelta(days=180)
        db.session.commit()
        return item

    def archive_item(self, item_id: int) -> bool:
        """Archive a library item."""
        item = AnswerLibraryItem.query.get(item_id)
        if not item:
            return False
        
        item.status = 'archived'
        item.is_active = False
        db.session.commit()
        return True

    def get_stale_items(self, organization_id: int) -> List[AnswerLibraryItem]:
        """Get items that are due for review."""
        return AnswerLibraryItem.query.filter(
            AnswerLibraryItem.organization_id == organization_id,
            AnswerLibraryItem.is_active == True,
            AnswerLibraryItem.next_review_due <= datetime.utcnow()
        ).all()

library_service = LibraryService()
