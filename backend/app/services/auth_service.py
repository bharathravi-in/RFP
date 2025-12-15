"""Authentication service for user management."""


class AuthService:
    """Handle authentication and authorization logic."""
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format."""
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))
    
    @staticmethod
    def validate_password_strength(password: str) -> tuple[bool, str]:
        """Check if password meets requirements."""
        if len(password) < 8:
            return False, "Password must be at least 8 characters"
        return True, ""
