from flask import request
from flask_socketio import emit, join_room, leave_room
from .extensions import socketio, db
from .models import User, Project
import json

# Presence storage (in-memory for simple hackathon implementation, should use Redis in production)
# Structure: { project_id: { user_id: { name: str, cursor: { section_id: int, position: int }, last_active: timestamp } } }
active_users = {}

@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")
    # Remove user from all projects they were active in
    for project_id in active_users:
        if request.sid in active_users[project_id]:
            del active_users[project_id][request.sid]
            emit('presence_update', active_users[project_id], room=f"project_{project_id}")

@socketio.on('join_project')
def on_join(data):
    project_id = data.get('project_id')
    user_id = data.get('user_id')
    user_name = data.get('user_name')
    
    if not project_id or not user_id:
        return
        
    join_room(f"project_{project_id}")
    
    if project_id not in active_users:
        active_users[project_id] = {}
        
    active_users[project_id][request.sid] = {
        'user_id': user_id,
        'name': user_name,
        'status': 'online',
        'cursor': None
    }
    
    print(f"User {user_name} joined project {project_id}")
    emit('presence_update', active_users[project_id], room=f"project_{project_id}")

@socketio.on('leave_project')
def on_leave(data):
    project_id = data.get('project_id')
    if project_id:
        leave_room(f"project_{project_id}")
        if project_id in active_users and request.sid in active_users[project_id]:
            del active_users[project_id][request.sid]
            emit('presence_update', active_users[project_id], room=f"project_{project_id}")

@socketio.on('cursor_move')
def on_cursor_move(data):
    project_id = data.get('project_id')
    cursor_data = data.get('cursor') # { section_id: int, field: str }
    
    if project_id in active_users and request.sid in active_users[project_id]:
        active_users[project_id][request.sid]['cursor'] = cursor_data
        emit('cursor_update', {
            'sid': request.sid,
            'user_id': active_users[project_id][request.sid]['user_id'],
            'name': active_users[project_id][request.sid]['name'],
            'cursor': cursor_data
        }, room=f"project_{project_id}", include_self=False)

@socketio.on('content_change')
def on_content_change(data):
    """Notify others when content is being edited."""
    project_id = data.get('project_id')
    section_id = data.get('section_id')
    content = data.get('content')
    
    emit('remote_content_change', {
        'section_id': section_id,
        'content': content,
        'user_id': data.get('user_id'),
        'user_name': data.get('user_name')
    }, room=f"project_{project_id}", include_self=False)
