"""Bulk upload service for vendor profile data."""
import csv
import io
from typing import List, Dict, Any, Set
from werkzeug.datastructures import FileStorage
import pandas as pd
import logging

logger = logging.getLogger(__name__)

# Expected columns for each type
EXPECTED_COLUMNS = {
    'clients': {
        'required': {'client_name'},
        'optional': {
            'client_industry', 'client_size', 'client_location', 'client_type',
            'relationship_status', 'project_count', 'services_provided',
            'technologies_used', 'is_reference_available', 'is_public'
        }
    },
    'stories': {
        'required': {'title'},
        'optional': {'client_name', 'industry', 'challenge', 'solution', 'impact'}
    },
    'capabilities': {
        'required': {'capability_name'},
        'optional': {'description', 'technologies_used', 'use_cases', 'time_saved', 'demo_link'}
    },
    'testimonials': {
        'required': {'testimonial_text'},
        'optional': {'client_name', 'client_designation', 'client_company', 'rating'}
    }
}


class BulkUploadService:
    """Service for handling bulk uploads of vendor profile data."""

    @staticmethod
    def validate_columns(rows: List[Dict[str, Any]], upload_type: str) -> Dict[str, Any]:
        """Validate that the CSV columns match the expected template.
        
        Returns dict with 'valid' boolean and 'errors' list.
        """
        if not rows:
            return {'valid': False, 'errors': ['File is empty']}
        
        # Get actual columns from first row
        actual_columns = set(rows[0].keys())
        
        # Get expected columns
        expected = EXPECTED_COLUMNS.get(upload_type)
        if not expected:
            return {'valid': False, 'errors': [f'Unknown upload type: {upload_type}']}
        
        required_columns = expected['required']
        optional_columns = expected['optional']
        all_expected_columns = required_columns | optional_columns
        
        errors = []
        
        # Check for missing required columns
        missing_required = required_columns - actual_columns
        if missing_required:
            errors.append(f"Missing required columns: {', '.join(sorted(missing_required))}")
        
        # Check for unexpected columns (potential typos or wrong template)
        unexpected_columns = actual_columns - all_expected_columns
        if unexpected_columns:
            # Filter out empty column names
            unexpected_columns = {col for col in unexpected_columns if col and str(col).strip()}
            if unexpected_columns:
                errors.append(f"Unexpected columns (possible typo): {', '.join(sorted(unexpected_columns))}")
        
        # Check if required columns have at least one non-empty value
        for col in required_columns:
            if col in actual_columns:
                has_value = any(row.get(col) and str(row.get(col)).strip() for row in rows)
                if not has_value:
                    errors.append(f"Required column '{col}' has no valid data in any row")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': []
        }

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
