from flask import request
from flask_socketio import emit, join_room, leave_room
from .extensions import socketio, db
from .models import User, Project
import json
from datetime import datetime

# Presence storage (in-memory for simple hackathon implementation, should use Redis in production)
# Structure: { project_id: { user_id: { name: str, cursor: { section_id: int, position: int }, last_active: timestamp } } }
active_users = {}

# Section locks storage
# Structure: { project_id: { section_id: { user_id, user_name, locked_at } } }
section_locks = {}

# Typing indicators storage
# Structure: { project_id: { section_id: [{ user_id, user_name, timestamp }] } }
typing_users = {}

@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")
    # Remove user from all projects they were active in
    for project_id in list(active_users.keys()):
        if request.sid in active_users[project_id]:
            user_info = active_users[project_id][request.sid]
            del active_users[project_id][request.sid]
            emit('presence_update', active_users[project_id], room=f"project_{project_id}")
            
            # Release any locks held by this user
            if project_id in section_locks:
                for section_id in list(section_locks[project_id].keys()):
                    if section_locks[project_id][section_id].get('sid') == request.sid:
                        del section_locks[project_id][section_id]
                        emit('section_unlocked', {
                            'section_id': section_id
                        }, room=f"project_{project_id}")

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
        'cursor': None,
        'joined_at': datetime.utcnow().isoformat()
    }
    
    print(f"User {user_name} joined project {project_id}")
    emit('presence_update', active_users[project_id], room=f"project_{project_id}")
    
    # Send current section locks to the new user
    if project_id in section_locks:
        emit('all_locks', section_locks[project_id])

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
    version = data.get('version', 0)  # For conflict detection
    
    # Check for conflicts
    if project_id in section_locks:
        lock = section_locks[project_id].get(section_id)
        if lock and lock.get('sid') != request.sid:
            # Conflict detected - another user has the lock
            emit('conflict_detected', {
                'section_id': section_id,
                'locked_by': lock.get('user_name'),
                'your_content': content
            })
            return
    
    emit('remote_content_change', {
        'section_id': section_id,
        'content': content,
        'version': version,
        'user_id': data.get('user_id'),
        'user_name': data.get('user_name'),
        'timestamp': datetime.utcnow().isoformat()
    }, room=f"project_{project_id}", include_self=False)


# ========================
# NEW: Typing Indicators
# ========================

@socketio.on('typing_start')
def on_typing_start(data):
    """User started typing in a section."""
    project_id = data.get('project_id')
    section_id = data.get('section_id')
    user_id = data.get('user_id')
    user_name = data.get('user_name')
    
    if not all([project_id, section_id, user_id]):
        return
    
    if project_id not in typing_users:
        typing_users[project_id] = {}
    if section_id not in typing_users[project_id]:
        typing_users[project_id][section_id] = []
    
    # Add user to typing list if not already there
    existing = next((u for u in typing_users[project_id][section_id] if u['user_id'] == user_id), None)
    if not existing:
        typing_users[project_id][section_id].append({
            'user_id': user_id,
            'user_name': user_name,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    emit('typing_indicator', {
        'section_id': section_id,
        'typing_users': typing_users[project_id][section_id]
    }, room=f"project_{project_id}", include_self=False)

@socketio.on('typing_stop')
def on_typing_stop(data):
    """User stopped typing in a section."""
    project_id = data.get('project_id')
    section_id = data.get('section_id')
    user_id = data.get('user_id')
    
    if project_id in typing_users and section_id in typing_users[project_id]:
        typing_users[project_id][section_id] = [
            u for u in typing_users[project_id][section_id] if u['user_id'] != user_id
        ]
        
        emit('typing_indicator', {
            'section_id': section_id,
            'typing_users': typing_users[project_id][section_id]
        }, room=f"project_{project_id}", include_self=False)


# ========================
# NEW: Section Locking
# ========================

@socketio.on('lock_section')
def on_lock_section(data):
    """Lock a section for exclusive editing."""
    project_id = data.get('project_id')
    section_id = data.get('section_id')
    user_id = data.get('user_id')
    user_name = data.get('user_name')
    
    if not all([project_id, section_id, user_id]):
        return
    
    if project_id not in section_locks:
        section_locks[project_id] = {}
    
    # Check if already locked by someone else
    existing_lock = section_locks[project_id].get(section_id)
    if existing_lock and existing_lock['user_id'] != user_id:
        emit('lock_denied', {
            'section_id': section_id,
            'locked_by': existing_lock['user_name'],
            'locked_at': existing_lock['locked_at']
        })
        return
    
    # Grant lock
    section_locks[project_id][section_id] = {
        'user_id': user_id,
        'user_name': user_name,
        'sid': request.sid,
        'locked_at': datetime.utcnow().isoformat()
    }
    
    emit('section_locked', {
        'section_id': section_id,
        'user_id': user_id,
        'user_name': user_name
    }, room=f"project_{project_id}")

@socketio.on('unlock_section')
def on_unlock_section(data):
    """Release a section lock."""
    project_id = data.get('project_id')
    section_id = data.get('section_id')
    user_id = data.get('user_id')
    
    if project_id in section_locks and section_id in section_locks[project_id]:
        lock = section_locks[project_id][section_id]
        # Only the lock holder can unlock
        if lock['user_id'] == user_id:
            del section_locks[project_id][section_id]
            emit('section_unlocked', {
                'section_id': section_id
            }, room=f"project_{project_id}")


# ========================
# NEW: Conflict Resolution
# ========================

@socketio.on('request_latest')
def on_request_latest(data):
    """Request the latest version of a section from the server."""
    project_id = data.get('project_id')
    section_id = data.get('section_id')
    
    # Broadcast request - whoever has the latest can respond
    emit('latest_requested', {
        'section_id': section_id,
        'requester_sid': request.sid
    }, room=f"project_{project_id}", include_self=False)

@socketio.on('provide_latest')
def on_provide_latest(data):
    """Provide the latest version to a requester."""
    target_sid = data.get('target_sid')
    section_id = data.get('section_id')
    content = data.get('content')
    version = data.get('version')
    
    emit('latest_content', {
        'section_id': section_id,
        'content': content,
        'version': version
    }, room=target_sid)

