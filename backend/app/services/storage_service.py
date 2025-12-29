"""
Cloud-Agnostic Storage Service.

Supports Local filesystem and Google Cloud Storage with a unified interface.
Configure via environment variables:
- DOCUMENT_STORAGE_TYPE: 'local' or 'gcp'
- DOCUMENT_STORAGE_ROOT: Local path for storage (default: ./data/uploads)
- GCP_STORAGE_BUCKET: GCP bucket name
- GCP_STORAGE_PREFIX: Prefix path in bucket (default: documents)
- GCP_STORAGE_CREDENTIALS: Path to GCP credentials JSON
"""

import os
import uuid
import logging
import mimetypes
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Optional, Dict, BinaryIO, Tuple
from flask import current_app

logger = logging.getLogger(__name__)


class StorageMetadata:
    """Document storage metadata."""
    
    def __init__(
        self,
        file_id: str,
        file_name: str,
        original_filename: str,
        file_type: str,
        file_size: int,
        file_url: str,
        storage_type: str,
        uploaded_at: datetime,
        content_type: str = None,
        checksum: str = None,
        extra: Dict = None
    ):
        self.file_id = file_id
        self.file_name = file_name
        self.original_filename = original_filename
        self.file_type = file_type
        self.file_size = file_size
        self.file_url = file_url
        self.storage_type = storage_type
        self.uploaded_at = uploaded_at
        self.content_type = content_type or mimetypes.guess_type(file_name)[0] or 'application/octet-stream'
        self.checksum = checksum
        self.extra = extra or {}
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for database storage."""
        return {
            'file_id': self.file_id,
            'file_name': self.file_name,
            'original_filename': self.original_filename,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'file_url': self.file_url,
            'storage_type': self.storage_type,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
            'content_type': self.content_type,
            'checksum': self.checksum,
            **self.extra
        }


class StorageProvider(ABC):
    """Abstract base class for storage providers."""
    
    @abstractmethod
    def upload(
        self,
        file: BinaryIO,
        original_filename: str,
        content_type: str = None,
        metadata: Dict = None
    ) -> StorageMetadata:
        """
        Upload a file to storage.
        
        Args:
            file: File-like object to upload
            original_filename: Original name of the file
            content_type: MIME type of the file
            metadata: Additional metadata to store
            
        Returns:
            StorageMetadata with file info and URL
        """
        pass
    
    @abstractmethod
    def download(self, file_id: str) -> Tuple[bytes, StorageMetadata]:
        """
        Download a file from storage.
        
        Args:
            file_id: Unique identifier of the file
            
        Returns:
            Tuple of (file_bytes, metadata)
        """
        pass
    
    @abstractmethod
    def delete(self, file_id: str) -> bool:
        """
        Delete a file from storage.
        
        Args:
            file_id: Unique identifier of the file
            
        Returns:
            True if deleted successfully
        """
        pass
    
    @abstractmethod
    def get_url(self, file_id: str, expiry_minutes: int = 60) -> str:
        """
        Get a URL to access the file.
        
        Args:
            file_id: Unique identifier of the file
            expiry_minutes: URL expiry time (for signed URLs)
            
        Returns:
            URL to access the file
        """
        pass
    
    @abstractmethod
    def exists(self, file_id: str) -> bool:
        """Check if a file exists in storage."""
        pass
    
    def _generate_file_id(self) -> str:
        """Generate a unique file ID."""
        return str(uuid.uuid4())
    
    def _get_file_extension(self, filename: str) -> str:
        """Extract file extension from filename."""
        if '.' in filename:
            return filename.rsplit('.', 1)[1].lower()
        return ''


class LocalStorageProvider(StorageProvider):
    """Local filesystem storage provider."""
    
    def __init__(self, storage_root: str = None):
        self.storage_root = storage_root or os.environ.get(
            'DOCUMENT_STORAGE_ROOT',
            './data/uploads'
        )
        # Ensure storage directory exists
        os.makedirs(self.storage_root, exist_ok=True)
        logger.info(f"LocalStorageProvider initialized at {self.storage_root}")
    
    def _get_file_path(self, file_id: str, extension: str = None) -> str:
        """Get the full path for a file."""
        # Organize files by date subdirectories
        date_prefix = datetime.utcnow().strftime('%Y/%m/%d')
        subdir = os.path.join(self.storage_root, date_prefix)
        os.makedirs(subdir, exist_ok=True)
        
        filename = file_id
        if extension:
            filename = f"{file_id}.{extension}"
        return os.path.join(subdir, filename)
    
    def _find_file(self, file_id: str) -> Optional[str]:
        """Find a file by ID (searches recursively)."""
        for root, dirs, files in os.walk(self.storage_root):
            for f in files:
                if f.startswith(file_id):
                    return os.path.join(root, f)
        return None
    
    def upload(
        self,
        file: BinaryIO,
        original_filename: str,
        content_type: str = None,
        metadata: Dict = None
    ) -> StorageMetadata:
        """Upload file to local filesystem."""
        import hashlib
        
        file_id = self._generate_file_id()
        extension = self._get_file_extension(original_filename)
        file_path = self._get_file_path(file_id, extension)
        
        # Read file content and calculate checksum
        file_content = file.read()
        checksum = hashlib.sha256(file_content).hexdigest()
        file_size = len(file_content)
        
        # Write to disk
        with open(file_path, 'wb') as f:
            f.write(file_content)
        
        stored_filename = os.path.basename(file_path)
        file_url = f"file://{os.path.abspath(file_path)}"
        
        logger.info(f"Uploaded file {file_id} to {file_path} ({file_size} bytes)")
        
        return StorageMetadata(
            file_id=file_id,
            file_name=stored_filename,
            original_filename=original_filename,
            file_type=extension,
            file_size=file_size,
            file_url=file_url,
            storage_type='local',
            uploaded_at=datetime.utcnow(),
            content_type=content_type,
            checksum=checksum,
            extra={
                'local_path': file_path,
                **(metadata or {})
            }
        )
    
    def download(self, file_id: str) -> Tuple[bytes, StorageMetadata]:
        """Download file from local filesystem."""
        file_path = self._find_file(file_id)
        if not file_path or not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_id}")
        
        with open(file_path, 'rb') as f:
            content = f.read()
        
        filename = os.path.basename(file_path)
        extension = self._get_file_extension(filename)
        stat = os.stat(file_path)
        
        metadata = StorageMetadata(
            file_id=file_id,
            file_name=filename,
            original_filename=filename,
            file_type=extension,
            file_size=stat.st_size,
            file_url=f"file://{os.path.abspath(file_path)}",
            storage_type='local',
            uploaded_at=datetime.fromtimestamp(stat.st_ctime),
            extra={'local_path': file_path}
        )
        
        return content, metadata
    
    def delete(self, file_id: str) -> bool:
        """Delete file from local filesystem."""
        file_path = self._find_file(file_id)
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Deleted file {file_id} from {file_path}")
            return True
        return False
    
    def get_url(self, file_id: str, expiry_minutes: int = 60) -> str:
        """Get URL for local file (returns file:// path)."""
        file_path = self._find_file(file_id)
        if file_path:
            return f"file://{os.path.abspath(file_path)}"
        raise FileNotFoundError(f"File not found: {file_id}")
    
    def exists(self, file_id: str) -> bool:
        """Check if file exists locally."""
        return self._find_file(file_id) is not None
    
    def get_local_path(self, file_id: str) -> Optional[str]:
        """Get the local filesystem path for a file."""
        return self._find_file(file_id)


class GCPStorageProvider(StorageProvider):
    """Google Cloud Storage provider."""
    
    def __init__(
        self,
        bucket_name: str = None,
        prefix: str = None,
        credentials_path: str = None
    ):
        # Support multiple env var naming conventions
        self.bucket_name = (
            bucket_name or 
            os.environ.get('GCP_STORAGE_BUCKET') or
            os.environ.get('GOOGLE_CLOUD_BUCKET_NAME')
        )
        self.prefix = prefix or os.environ.get('GCP_STORAGE_PREFIX', 'documents')
        credentials_path = (
            credentials_path or 
            os.environ.get('GCP_STORAGE_CREDENTIALS') or
            os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
        )
        
        if not self.bucket_name:
            raise ValueError("GCP_STORAGE_BUCKET or GOOGLE_CLOUD_BUCKET_NAME environment variable is required")
        
        try:
            from google.cloud import storage
            
            if credentials_path and os.path.exists(credentials_path):
                self.client = storage.Client.from_service_account_json(credentials_path)
            else:
                # Use default credentials (e.g., from environment)
                self.client = storage.Client()
            
            self.bucket = self.client.bucket(self.bucket_name)
            logger.info(f"GCPStorageProvider initialized for bucket {self.bucket_name}")
            
        except ImportError:
            raise ImportError("google-cloud-storage is required for GCP storage. Install with: pip install google-cloud-storage")
        except Exception as e:
            logger.error(f"Failed to initialize GCP Storage: {e}")
            raise
    
    def _get_blob_name(self, file_id: str, extension: str = None) -> str:
        """Get the blob name (path) in the bucket."""
        date_prefix = datetime.utcnow().strftime('%Y/%m/%d')
        filename = file_id
        if extension:
            filename = f"{file_id}.{extension}"
        return f"{self.prefix}/{date_prefix}/{filename}"
    
    def _find_blob(self, file_id: str):
        """Find a blob by file_id, searching across all known prefixes."""
        # List of prefixes to search (in order of likelihood)
        prefixes_to_search = [
            self.prefix,  # Default prefix
            os.environ.get('GCP_RFP_REQ_PREFIX', 'rfp_requirement'),
            os.environ.get('GCP_KNOWLEDGE_PREFIX', 'knowledge'),
            os.environ.get('GCP_RFP_PROPOSAL_PREFIX', 'rfp_proposal'),
            'documents',
        ]
        
        # Remove duplicates while preserving order
        seen = set()
        unique_prefixes = []
        for p in prefixes_to_search:
            if p and p not in seen:
                seen.add(p)
                unique_prefixes.append(p)
        
        # Search each prefix
        for prefix in unique_prefixes:
            blobs = list(self.bucket.list_blobs(prefix=f"{prefix}/"))
            for blob in blobs:
                if file_id in blob.name:
                    logger.info(f"Found blob for file_id {file_id} at {blob.name}")
                    return blob
        
        # Last resort: search entire bucket (slower but comprehensive)
        logger.warning(f"File {file_id} not found in known prefixes, searching entire bucket...")
        all_blobs = list(self.bucket.list_blobs())
        for blob in all_blobs:
            if file_id in blob.name:
                logger.info(f"Found blob for file_id {file_id} at {blob.name} (full bucket search)")
                return blob
        
        return None
    
    def upload(
        self,
        file: BinaryIO,
        original_filename: str,
        content_type: str = None,
        metadata: Dict = None
    ) -> StorageMetadata:
        """Upload file to GCP Storage."""
        import hashlib
        
        file_id = self._generate_file_id()
        extension = self._get_file_extension(original_filename)
        blob_name = self._get_blob_name(file_id, extension)
        
        # Read file content and calculate checksum
        file_content = file.read()
        checksum = hashlib.sha256(file_content).hexdigest()
        file_size = len(file_content)
        
        # Upload to GCS
        blob = self.bucket.blob(blob_name)
        content_type = content_type or mimetypes.guess_type(original_filename)[0] or 'application/octet-stream'
        
        blob.metadata = {
            'original_filename': original_filename,
            'file_id': file_id,
            'checksum': checksum,
            **(metadata or {})
        }
        
        blob.upload_from_string(file_content, content_type=content_type)
        
        # Get public URL (or signed URL for private buckets)
        file_url = f"gs://{self.bucket_name}/{blob_name}"
        
        logger.info(f"Uploaded file {file_id} to {file_url} ({file_size} bytes)")
        
        return StorageMetadata(
            file_id=file_id,
            file_name=os.path.basename(blob_name),
            original_filename=original_filename,
            file_type=extension,
            file_size=file_size,
            file_url=file_url,
            storage_type='gcp',
            uploaded_at=datetime.utcnow(),
            content_type=content_type,
            checksum=checksum,
            extra={
                'bucket': self.bucket_name,
                'blob_name': blob_name,
                **(metadata or {})
            }
        )
    
    def upload_with_path(
        self,
        file: BinaryIO,
        original_filename: str,
        prefix: str,
        subfolder: str = None,
        content_type: str = None,
        metadata: Dict = None
    ) -> StorageMetadata:
        """
        Upload file to GCP Storage with custom path structure.
        
        Args:
            file: File to upload
            original_filename: Original name of the file
            prefix: Base prefix (e.g., 'knowledge', 'rfp_requirement', 'rfp_proposal')
            subfolder: Optional subfolder (e.g., folder name or project ID)
            content_type: MIME type
            metadata: Additional metadata
        
        Returns:
            StorageMetadata with file info
        """
        import hashlib
        
        file_id = self._generate_file_id()
        extension = self._get_file_extension(original_filename)
        
        # Build path: {prefix}/{subfolder}/{date}/{file_id}.{ext}
        date_prefix = datetime.utcnow().strftime('%Y/%m/%d')
        filename = f"{file_id}.{extension}" if extension else file_id
        
        if subfolder:
            blob_name = f"{prefix}/{subfolder}/{date_prefix}/{filename}"
        else:
            blob_name = f"{prefix}/{date_prefix}/{filename}"
        
        # Read file content and calculate checksum
        file_content = file.read()
        checksum = hashlib.sha256(file_content).hexdigest()
        file_size = len(file_content)
        
        # Upload to GCS
        blob = self.bucket.blob(blob_name)
        content_type = content_type or mimetypes.guess_type(original_filename)[0] or 'application/octet-stream'
        
        blob.metadata = {
            'original_filename': original_filename,
            'file_id': file_id,
            'checksum': checksum,
            'prefix': prefix,
            'subfolder': subfolder,
            **(metadata or {})
        }
        
        blob.upload_from_string(file_content, content_type=content_type)
        
        file_url = f"gs://{self.bucket_name}/{blob_name}"
        
        logger.info(f"Uploaded file {file_id} to {file_url} ({file_size} bytes)")
        
        return StorageMetadata(
            file_id=file_id,
            file_name=os.path.basename(blob_name),
            original_filename=original_filename,
            file_type=extension,
            file_size=file_size,
            file_url=file_url,
            storage_type='gcp',
            uploaded_at=datetime.utcnow(),
            content_type=content_type,
            checksum=checksum,
            extra={
                'bucket': self.bucket_name,
                'blob_name': blob_name,
                'prefix': prefix,
                'subfolder': subfolder,
                **(metadata or {})
            }
        )
    
    def download(self, file_id: str) -> Tuple[bytes, StorageMetadata]:
        """Download file from GCP Storage."""
        blob = self._find_blob(file_id)
        if not blob:
            raise FileNotFoundError(f"File not found in GCS: {file_id}")
        
        content = blob.download_as_bytes()
        blob.reload()
        
        extension = self._get_file_extension(blob.name)
        original_filename = blob.metadata.get('original_filename', os.path.basename(blob.name)) if blob.metadata else os.path.basename(blob.name)
        
        metadata = StorageMetadata(
            file_id=file_id,
            file_name=os.path.basename(blob.name),
            original_filename=original_filename,
            file_type=extension,
            file_size=blob.size,
            file_url=f"gs://{self.bucket_name}/{blob.name}",
            storage_type='gcp',
            uploaded_at=blob.time_created,
            content_type=blob.content_type,
            checksum=blob.metadata.get('checksum') if blob.metadata else None,
            extra={
                'bucket': self.bucket_name,
                'blob_name': blob.name
            }
        )
        
        return content, metadata
    
    def delete(self, file_id: str) -> bool:
        """Delete file from GCP Storage."""
        blob = self._find_blob(file_id)
        if blob:
            blob.delete()
            logger.info(f"Deleted file {file_id} from GCS")
            return True
        return False
    
    def get_url(self, file_id: str, expiry_minutes: int = 60) -> str:
        """Get a signed URL for the file."""
        blob = self._find_blob(file_id)
        if not blob:
            raise FileNotFoundError(f"File not found in GCS: {file_id}")
        
        # Generate signed URL
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expiry_minutes),
            method="GET"
        )
        return url
    
    def exists(self, file_id: str) -> bool:
        """Check if file exists in GCS."""
        return self._find_blob(file_id) is not None


class StorageService:
    """
    Unified storage service that delegates to the appropriate provider.
    
    Usage:
        storage = StorageService()
        metadata = storage.upload(file, 'document.pdf')
        content, meta = storage.download(metadata.file_id)
        storage.delete(metadata.file_id)
    """
    
    _instance = None
    
    def __init__(self, storage_type: str = None):
        storage_type = storage_type or os.environ.get('DOCUMENT_STORAGE_TYPE', 'local')
        
        if storage_type == 'gcp':
            self.provider = GCPStorageProvider()
        else:
            self.provider = LocalStorageProvider()
        
        self.storage_type = storage_type
        logger.info(f"StorageService initialized with {storage_type} provider")
    
    @classmethod
    def get_instance(cls) -> 'StorageService':
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def upload(
        self,
        file: BinaryIO,
        original_filename: str,
        content_type: str = None,
        metadata: Dict = None
    ) -> StorageMetadata:
        """Upload a file."""
        return self.provider.upload(file, original_filename, content_type, metadata)
    
    def download(self, file_id: str) -> Tuple[bytes, StorageMetadata]:
        """Download a file."""
        return self.provider.download(file_id)
    
    def delete(self, file_id: str) -> bool:
        """Delete a file."""
        return self.provider.delete(file_id)
    
    def get_url(self, file_id: str, expiry_minutes: int = 60) -> str:
        """Get URL to access a file."""
        return self.provider.get_url(file_id, expiry_minutes)
    
    def exists(self, file_id: str) -> bool:
        """Check if a file exists."""
        return self.provider.exists(file_id)
    
    def get_local_path(self, file_id: str) -> Optional[str]:
        """Get local file path (only for local storage)."""
        if isinstance(self.provider, LocalStorageProvider):
            return self.provider.get_local_path(file_id)
        
        # For cloud storage, download to temp file
        import tempfile
        content, metadata = self.download(file_id)
        
        temp_dir = tempfile.mkdtemp()
        temp_path = os.path.join(temp_dir, metadata.file_name)
        with open(temp_path, 'wb') as f:
            f.write(content)
        
        return temp_path


def get_storage_service() -> StorageService:
    """Get the storage service instance."""
    return StorageService.get_instance()
