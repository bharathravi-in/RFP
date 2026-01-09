"""Bulk upload service for vendor profile data."""
import csv
import io
from typing import List, Dict, Any
from werkzeug.datastructures import FileStorage
import pandas as pd
import logging

logger = logging.getLogger(__name__)


class BulkUploadService:
    """Service for handling bulk uploads of vendor profile data."""

    @staticmethod
    def parse_csv_file(file: FileStorage) -> List[Dict[str, Any]]:
        """Parse CSV file and return list of dictionaries."""
        try:
            # Read file content
            content = file.read().decode('utf-8')
            file.seek(0)  # Reset file pointer
            
            # Parse CSV
            csv_reader = csv.DictReader(io.StringIO(content))
            rows = list(csv_reader)
            
            return rows
        except Exception as e:
            logger.error(f"Error parsing CSV: {str(e)}")
            raise ValueError(f"Invalid CSV format: {str(e)}")

    @staticmethod
    def parse_excel_file(file: FileStorage) -> List[Dict[str, Any]]:
        """Parse Excel file and return list of dictionaries."""
        try:
            # Read Excel file
            df = pd.read_excel(file, engine='openpyxl')
            
            # Convert to list of dictionaries
            rows = df.to_dict('records')
            
            # Convert NaN to None
            for row in rows:
                for key, value in row.items():
                    if pd.isna(value):
                        row[key] = None
            
            return rows
        except Exception as e:
            logger.error(f"Error parsing Excel: {str(e)}")
            raise ValueError(f"Invalid Excel format: {str(e)}")

    @staticmethod
    def parse_file(file: FileStorage) -> List[Dict[str, Any]]:
        """Parse file based on extension."""
        filename = file.filename.lower()
        
        if filename.endswith('.csv'):
            return BulkUploadService.parse_csv_file(file)
        elif filename.endswith(('.xlsx', '.xls')):
            return BulkUploadService.parse_excel_file(file)
        else:
            raise ValueError("Unsupported file format. Please upload CSV or Excel file.")

    @staticmethod
    def parse_list_field(value: Any) -> List[str]:
        """Parse comma-separated string into list."""
        if value is None or value == '':
            return []
        if isinstance(value, list):
            return value
        return [item.strip() for item in str(value).split(',') if item.strip()]

    @staticmethod
    def parse_bool_field(value: Any) -> bool:
        """Parse boolean field."""
        if value is None or value == '':
            return False
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ('true', 'yes', '1', 't', 'y')
        return bool(value)

    @staticmethod
    def parse_int_field(value: Any, default: int = 0) -> int:
        """Parse integer field."""
        if value is None or value == '':
            return default
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return default

    @staticmethod
    def parse_float_field(value: Any, default: float = 0.0) -> float:
        """Parse float field."""
        if value is None or value == '':
            return default
        try:
            return float(value)
        except (ValueError, TypeError):
            return default

    @staticmethod
    def process_client_row(row: Dict[str, Any]) -> Dict[str, Any]:
        """Process a client row from CSV/Excel."""
        return {
            'client_name': row.get('client_name', '').strip(),
            'client_industry': row.get('client_industry', ''),
            'client_size': row.get('client_size', 'medium'),
            'client_location': row.get('client_location', ''),
            'client_type': row.get('client_type', 'private'),
            'relationship_status': row.get('relationship_status', 'ongoing'),
            'project_count': BulkUploadService.parse_int_field(row.get('project_count'), 1),
            'services_provided': BulkUploadService.parse_list_field(row.get('services_provided')),
            'technologies_used': BulkUploadService.parse_list_field(row.get('technologies_used')),
            'is_reference_available': BulkUploadService.parse_bool_field(row.get('is_reference_available')),
            'is_public': BulkUploadService.parse_bool_field(row.get('is_public', True)),
        }

    @staticmethod
    def process_story_row(row: Dict[str, Any]) -> Dict[str, Any]:
        """Process a success story row from CSV/Excel."""
        return {
            'title': row.get('title', '').strip(),
            'client_name': row.get('client_name', ''),
            'industry': row.get('industry', ''),
            'challenge': row.get('challenge', ''),
            'solution': row.get('solution', ''),
            'impact': row.get('impact', ''),
        }

    @staticmethod
    def process_capability_row(row: Dict[str, Any]) -> Dict[str, Any]:
        """Process an accelerator row from CSV/Excel."""
        return {
            'capability_name': row.get('capability_name', '').strip(),
            'description': row.get('description', ''),
            'technologies_used': BulkUploadService.parse_list_field(row.get('technologies_used')),
            'use_cases': row.get('use_cases', ''),
            'time_saved': row.get('time_saved', ''),
            'demo_link': row.get('demo_link', ''),
        }

    @staticmethod
    def process_testimonial_row(row: Dict[str, Any]) -> Dict[str, Any]:
        """Process a testimonial row from CSV/Excel."""
        return {
            'testimonial_text': row.get('testimonial_text', '').strip(),
            'client_name': row.get('client_name', ''),
            'client_designation': row.get('client_designation', ''),
            'client_company': row.get('client_company', ''),
            'rating': BulkUploadService.parse_int_field(row.get('rating'), 5),
        }
