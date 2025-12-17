"""
Test AI Config Endpoints

Simple script to test if the AI config endpoints are working.
"""
from app import create_app
from app.models import User
from flask_jwt_extended import create_access_token

app = create_app()

with app.app_context():
    # Get a test user
    user = User.query.first()
    if not user:
        print("No users found in database!")
        exit(1)
    
    print(f"Testing with user: {user.email} (org_id: {user.organization_id})")
    
    # Create a JWT token
    token = create_access_token(identity=str(user.id))
    print(f"\nGenerated token: {token[:50]}...")
    
    # Test the endpoint
    with app.test_client() as client:
        # Test GET /ai-config
        print("\n1. Testing GET /ai-config...")
        response = client.get(
            f'/api/organizations/{user.organization_id}/ai-config',
            headers={'Authorization': f'Bearer {token}'}
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.get_json()}")
        
        # Test GET /ai-config/providers
        print("\n2. Testing GET /ai-config/providers...")
        response = client.get(
            f'/api/organizations/{user.organization_id}/ai-config/providers',
            headers={'Authorization': f'Bearer {token}'}
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.get_json()
            print(f"   Providers: {list(data.get('providers', {}).keys())}")
        else:
            print(f"   Response: {response.get_json()}")
        
        print("\n✅ All tests completed!")
