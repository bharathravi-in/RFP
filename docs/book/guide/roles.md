# Roles & Permissions

RFP Pro uses Role-Based Access Control (RBAC) with four user roles.

## Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| **Admin** | 4 | Full system control |
| **Editor** | 3 | Content creation & editing |
| **Reviewer** | 2 | Review and approve content |
| **Viewer** | 1 | Read-only access |

---

## Admin

Full control over the organization and system settings.

**Can do:**
- ✅ Invite/remove team members
- ✅ Change user roles
- ✅ Delete projects
- ✅ Configure AI Settings
- ✅ Edit Vendor Profile
- ✅ Update organization settings
- ✅ All Editor, Reviewer, Viewer permissions

---

## Editor

Can create and edit content but cannot manage users or delete projects.

**Can do:**
- ✅ Create/edit projects
- ✅ Edit proposal sections
- ✅ Generate AI answers
- ✅ Add to Answer Library
- ✅ Export documents
- ✅ View analytics

**Cannot do:**
- ❌ Invite members
- ❌ Delete projects
- ❌ Access AI Settings
- ❌ Edit Vendor Profile

---

## Reviewer

Can review and approve content, limited editing.

**Can do:**
- ✅ Approve/reject answers
- ✅ Add comments
- ✅ View proposals
- ✅ Export documents

**Cannot do:**
- ❌ Edit sections
- ❌ Create projects
- ❌ Manage organization

---

## Viewer

Read-only access to view content.

**Can do:**
- ✅ View projects
- ✅ View proposals
- ✅ View Answer Library

**Cannot do:**
- ❌ Edit anything
- ❌ Approve anything
- ❌ Delete anything

---

## Permission Matrix

| Permission | Admin | Editor | Reviewer | Viewer |
|------------|:-----:|:------:|:--------:|:------:|
| Manage Organization | ✅ | ❌ | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ❌ | ❌ |
| Invite Users | ✅ | ❌ | ❌ | ❌ |
| Delete Projects | ✅ | ❌ | ❌ | ❌ |
| AI Settings | ✅ | ❌ | ❌ | ❌ |
| Edit Sections | ✅ | ✅ | ❌ | ❌ |
| Create Projects | ✅ | ✅ | ❌ | ❌ |
| Approve Answers | ✅ | ❌ | ✅ | ❌ |
| Export Documents | ✅ | ✅ | ✅ | ❌ |
| View Analytics | ✅ | ✅ | ❌ | ❌ |
| View Projects | ✅ | ✅ | ✅ | ✅ |
