"""
Storage Providers Module

Provides storage adapters for different cloud providers:
- Local filesystem
- Google Cloud Storage (in main storage_service.py)
- AWS S3
- Azure Blob Storage (future)
"""
from .s3_provider import S3StorageProvider, get_s3_provider

__all__ = [
    'S3StorageProvider',
    'get_s3_provider',
]
