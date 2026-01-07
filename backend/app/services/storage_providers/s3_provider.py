"""
AWS S3 Storage Provider

Cloud-agnostic storage adapter for Amazon S3.
"""
import os
import logging
import uuid
from datetime import datetime
from typing import Tuple, Optional, BinaryIO

logger = logging.getLogger(__name__)

# Configuration
S3_BUCKET = os.environ.get('AWS_S3_BUCKET', '')
S3_REGION = os.environ.get('AWS_REGION', 'us-east-1')
S3_ACCESS_KEY = os.environ.get('AWS_ACCESS_KEY_ID', '')
S3_SECRET_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
S3_ENDPOINT_URL = os.environ.get('AWS_ENDPOINT_URL', None)  # For S3-compatible services


class S3StorageProvider:
    """
    AWS S3 storage provider implementing the StorageProvider interface.
    
    Supports:
    - AWS S3
    - S3-compatible services (MinIO, DigitalOcean Spaces, etc.)
    """
    
    def __init__(
        self,
        bucket: str = None,
        region: str = None,
        access_key: str = None,
        secret_key: str = None,
        endpoint_url: str = None
    ):
        self.bucket = bucket or S3_BUCKET
        self.region = region or S3_REGION
        self.access_key = access_key or S3_ACCESS_KEY
        self.secret_key = secret_key or S3_SECRET_KEY
        self.endpoint_url = endpoint_url or S3_ENDPOINT_URL
        self._client = None
        
        if not self.bucket:
            raise ValueError("S3 bucket name is required (AWS_S3_BUCKET)")
    
    @property
    def client(self):
        """Lazy initialization of S3 client."""
        if self._client is None:
            try:
                import boto3
                
                session_kwargs = {
                    'region_name': self.region
                }
                if self.access_key and self.secret_key:
                    session_kwargs['aws_access_key_id'] = self.access_key
                    session_kwargs['aws_secret_access_key'] = self.secret_key
                
                session = boto3.Session(**session_kwargs)
                
                client_kwargs = {}
                if self.endpoint_url:
                    client_kwargs['endpoint_url'] = self.endpoint_url
                
                self._client = session.client('s3', **client_kwargs)
                logger.info(f"S3 client initialized for bucket: {self.bucket}")
                
            except ImportError:
                raise ImportError("boto3 required for S3 storage: pip install boto3")
        
        return self._client
    
    def upload(
        self,
        file: BinaryIO,
        original_filename: str,
        content_type: str = 'application/octet-stream',
        metadata: dict = None
    ) -> dict:
        """
        Upload a file to S3.
        
        Args:
            file: File-like object to upload
            original_filename: Original filename
            content_type: MIME type
            metadata: Additional metadata
            
        Returns:
            Dict with file_id, url, and metadata
        """
        # Generate unique file ID
        file_id = str(uuid.uuid4())
        ext = os.path.splitext(original_filename)[1] if original_filename else ''
        s3_key = f"uploads/{datetime.utcnow().strftime('%Y/%m/%d')}/{file_id}{ext}"
        
        try:
            # Upload to S3
            extra_args = {
                'ContentType': content_type,
                'Metadata': {
                    'original_filename': original_filename,
                    **(metadata or {})
                }
            }
            
            self.client.upload_fileobj(file, self.bucket, s3_key, ExtraArgs=extra_args)
            
            logger.info(f"Uploaded {original_filename} to S3: {s3_key}")
            
            return {
                'file_id': file_id,
                's3_key': s3_key,
                'bucket': self.bucket,
                'original_filename': original_filename,
                'content_type': content_type,
                'uploaded_at': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"S3 upload failed: {e}")
            raise
    
    def download(self, file_id: str, s3_key: str = None) -> Tuple[bytes, dict]:
        """
        Download a file from S3.
        
        Args:
            file_id: The file ID (used to construct key if s3_key not provided)
            s3_key: Full S3 key (optional)
            
        Returns:
            Tuple of (file_bytes, metadata)
        """
        try:
            import io
            
            key = s3_key or f"uploads/{file_id}"
            
            # Get object
            response = self.client.get_object(Bucket=self.bucket, Key=key)
            
            # Read content
            content = response['Body'].read()
            
            metadata = {
                'content_type': response.get('ContentType', 'application/octet-stream'),
                'content_length': response.get('ContentLength'),
                'last_modified': response.get('LastModified'),
                **response.get('Metadata', {})
            }
            
            return content, metadata
            
        except Exception as e:
            logger.error(f"S3 download failed: {e}")
            raise
    
    def delete(self, file_id: str, s3_key: str = None) -> bool:
        """
        Delete a file from S3.
        
        Args:
            file_id: The file ID
            s3_key: Full S3 key (optional)
            
        Returns:
            True if deleted successfully
        """
        try:
            key = s3_key or f"uploads/{file_id}"
            self.client.delete_object(Bucket=self.bucket, Key=key)
            logger.info(f"Deleted from S3: {key}")
            return True
        except Exception as e:
            logger.error(f"S3 delete failed: {e}")
            return False
    
    def get_url(self, file_id: str, s3_key: str = None, expiry_minutes: int = 60) -> str:
        """
        Generate a presigned URL for file access.
        
        Args:
            file_id: The file ID
            s3_key: Full S3 key (optional)
            expiry_minutes: URL expiry time in minutes
            
        Returns:
            Presigned URL string
        """
        try:
            key = s3_key or f"uploads/{file_id}"
            
            url = self.client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket,
                    'Key': key
                },
                ExpiresIn=expiry_minutes * 60
            )
            return url
            
        except Exception as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            raise
    
    def list_files(self, prefix: str = 'uploads/', max_keys: int = 1000) -> list:
        """
        List files in the bucket with given prefix.
        
        Args:
            prefix: S3 key prefix
            max_keys: Maximum number of keys to return
            
        Returns:
            List of file info dicts
        """
        try:
            response = self.client.list_objects_v2(
                Bucket=self.bucket,
                Prefix=prefix,
                MaxKeys=max_keys
            )
            
            files = []
            for obj in response.get('Contents', []):
                files.append({
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat(),
                    'etag': obj['ETag']
                })
            
            return files
            
        except Exception as e:
            logger.error(f"S3 list failed: {e}")
            return []
    
    def health(self) -> dict:
        """Check S3 connectivity."""
        try:
            self.client.head_bucket(Bucket=self.bucket)
            return {
                'healthy': True,
                'provider': 's3',
                'bucket': self.bucket,
                'region': self.region
            }
        except Exception as e:
            return {
                'healthy': False,
                'provider': 's3',
                'message': str(e)
            }


# Factory function
def get_s3_provider(**kwargs) -> S3StorageProvider:
    """Get S3 storage provider instance."""
    return S3StorageProvider(**kwargs)
