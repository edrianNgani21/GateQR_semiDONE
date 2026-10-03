# Department Management & Dean Account Fix - Implementation Summary

## Root Cause Analysis

**The Dean account problem was caused by** the `/api/departments` POST endpoint only creating a department record with an email field, but NOT creating a corresponding user record with `user_type = 'dean'` and establishing the proper foreign key relationship between `department.user_id` and the dean's `user_id`. 

When a dean tried to log in, the system treated them as a new applicant because there's no user record with `user_type = 'dean'` for their email. The email was stored as plain text in the department table, but there was no actual user account created for the dean.

## Changes Implemented

### 1. Database Schema Changes
**File: `add-department-status.sql`**
- Added `is_active` column to `department` table for soft deletion
- Default value: `TRUE` (new departments are active by default)
- Created index for performance

**Run this in Supabase SQL Editor:**
```sql
ALTER TABLE department 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN 
NOT NULL 
DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_department_is_active 
ON department(is_active);

UPDATE department 
SET is_active = TRUE 
WHERE is_active IS NULL;
```

### 2. Department API Updates
**File: `src/routes/api/departments/+server.ts`**

#### POST (Create Department)
- Now creates a user account with `user_type = 'dean'` when a department is added
- Establishes proper foreign key relationship between `department.user_id` and `user.user_id`
- Updates user's `department_id` to link back to the department
- Handles edge cases:
  - If user already exists, updates them to dean role
  - Prevents assigning same email as dean for multiple departments
  - Sets proper identification type (Faculty)

#### PUT (Update Department)
- Handles dean email changes properly
- Updates user accounts when dean email is changed
- Reverts old dean to applicant role if they're no longer a dean
- Creates new user account if new dean email doesn't exist
- Maintains data integrity between department and user tables

#### DELETE (Soft Delete)
- Changed from permanent deletion to soft delete
- Sets `is_active = false` instead of deleting the record
- Preserves all historical data (applications, users, records)

#### PATCH (New Endpoint - Reactivate)
- New endpoint to reactivate deactivated departments
- Sets `is_active = true`
- Allows departments to be brought back online

#### GET (List Departments)
- Added optional status filter (`?status=active|inactive|all`)
- Returns all departments by default
- Returns only active or inactive departments when filtered
- Includes `is_active` status in response

### 3. Frontend Updates
**File: `src/routes/osa/departments/+page.svelte`**

#### Status Filter
- Added tab-based filter: All | Active | Inactive
- Real-time filtering of department cards

#### Department Cards
- Added status badge (🟢 Active / ⚪ Inactive)
- Changed "Delete" button to "Hide" for active departments
- Added "Activate" button for inactive departments
- Improved card layout with status information

#### Actions
- **Edit**: Opens form to edit department name and dean email
- **Hide**: Deactivates department (soft delete) with confirmation
- **Activate**: Reactivates department without confirmation

### 4. Application Form Updates
**File: `src/routes/+page.server.ts`**
- Only shows active departments in the application form dropdown
- Prevents applicants from selecting inactive departments

**File: `src/routes/api/apply/+server.ts`**
- Validates that selected department is active
- Returns error if inactive department is selected
- Prevents new applications for inactive departments

## Expected Workflow

### Creating a Department
1. Admin goes to Departments page
2. Clicks "New Department"
3. Fills in:
   - Department Name (from dropdown)
   - Dean Email
4. System:
   - Creates department record
   - Creates/updates user account with `user_type = 'dean'`
   - Links department and user via foreign keys
   - Sets department as active

### Dean Login Process
1. Dean enters their email on login page
2. System finds user with `user_type = 'dean'`
3. Dean receives OTP via email
4. Dean verifies OTP
5. System generates JWT with `role = 'dean'` and `department_id`
6. Dean is redirected to `/dean` portal
7. Dean sees only applications for their assigned department

### Managing Department Status
1. Admin can view all, active, or inactive departments
2. "Hide" deactivates department (preserves data)
3. "Activate" reactivates department
4. Inactive departments don't appear in application forms
5. Existing applications for inactive departments still show historical data

## Testing Checklist

- [ ] Run SQL migration in Supabase
- [ ] Create a new department with dean email
- [ ] Verify dean user account is created in database
- [ ] Verify department.user_id is linked to user.user_id
- [ ] Try to log in as dean
- [ ] Verify dean sees only their department's applications
- [ ] Edit department and change dean email
- [ ] Verify old dean is reverted to applicant
- [ ] Verify new dean is created/updated
- [ ] Hide a department
- [ ] Verify it doesn't appear in application form
- [ ] Reactivate the department
- [ ] Verify it appears in application form again

## Files Modified

1. `add-department-status.sql` - New migration file
2. `src/routes/api/departments/+server.ts` - Department API
3. `src/routes/osa/departments/+page.svelte` - Department management UI
4. `src/routes/osa/departments/+page.server.ts` - Department data loading
5. `src/routes/+page.server.ts` - Application form department filter
6. `src/routes/api/apply/+server.ts` - Application department validation

## Important Notes

- **No data is lost** when hiding departments - it's a soft delete
- **Existing dean accounts** will need to be manually updated if they were created before this fix
- **Email validation** prevents one email from being dean for multiple departments
- **Historical records** are preserved even when departments are inactive
- **Authentication system** remains unchanged - we're using the existing JWT-based auth

## Next Steps

1. Run the SQL migration in Supabase SQL Editor
2. Test the complete workflow
3. Update any existing dean accounts manually if needed
4. Monitor logs for any issues with the new user creation logic