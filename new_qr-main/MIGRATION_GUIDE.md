# Supabase Migration Guide

This guide will help you migrate your GateQR vehicle access control system to Supabase.

## Prerequisites

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Sign up and create a new project
   - Wait for the project to be fully provisioned (2-3 minutes)

2. **Get Your Supabase Credentials**
   - Navigate to Project Settings → API
   - Copy the following:
     - Project URL
     - anon/public key
     - service_role key (keep this secret!)

## Step 1: Set Up Database Schema

1. Open your Supabase project dashboard
2. Navigate to the **SQL Editor** (icon looks like a terminal)
3. Copy the entire contents of `supabase-schema-complete.sql`
4. Paste it into the SQL Editor
5. Click **Run** to execute the schema
6. Verify that all tables were created successfully

## Step 2: Configure Environment Variables

Update your `.env` file with your Supabase credentials:

```env
# Keep your existing variables
OSA_EMAIL="osa@liceo.edu.ph"
SECURITY_EMAIL="security@liceo.edu.ph"
JWT_SECRET="super-secret-jwt-key-replace-in-prod"
REFRESH_JWT_SECRET="super-secret-refresh-key-replace-in-prod"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
QR_EXPIRY_MONTHS="6"
GATE_API_KEY="replace-with-a-secure-random-gate-key"

# Add Supabase credentials
PRIVATE_SUPABASE_URL="https://your-project-id.supabase.co"
PRIVATE_SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
# Fallback aliases (for compatibility)
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
```

**Important Security Notes:**
- Never commit `.env` files to version control
- The `service_role_key` has full database access - keep it secret
- The `anon_key` is safe for client-side use (limited by RLS policies)

## Step 3: Update Application Code

Your existing code should work with minimal changes since we designed the schema to be compatible with your custom JWT authentication system.

### Key Integration Points:

1. **Database Connection** (`src/lib/server/supabase.ts`)
   - Already configured to use environment variables
   - No changes needed

2. **Authentication** (`src/hooks.server.ts`)
   - Your custom JWT system continues to work
   - Supabase is used only for data storage
   - No changes needed to auth logic

3. **API Routes**
   - Update database queries to use the new schema
   - The schema matches your existing table structure
   - Most queries should work without modification

## Step 4: Test the Connection

Create a test script to verify your Supabase connection:

```javascript
// test-supabase-connection.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        // Test basic connection
        const { data, error } = await supabase
            .from('user')
            .select('*')
            .limit(1);
        
        if (error) throw error;
        
        console.log('✅ Supabase connection successful!');
        console.log('Sample user data:', data);
        
        // Test the default OSA admin user
        const { data: osaUser, error: osaError } = await supabase
            .from('user')
            .select('*')
            .eq('email', 'aluban98304@liceo.edu.ph')
            .single();
        
        if (osaError) throw osaError;
        
        console.log('✅ Default OSA admin found:', osaUser);
        
    } catch (error) {
        console.error('❌ Supabase connection failed:', error.message);
        process.exit(1);
    }
}

testConnection();
```

Run the test:
```bash
node test-supabase-connection.js
```

## Step 5: Update API Routes

Update your API routes to use the new schema. Here are the key changes:

### User Table Changes:
- `auto_id` → `user_id`
- `name` → `department_name` (in department table)

### Registration Table Changes:
- The structure remains largely the same
- Ensure all foreign key references are updated

### Example Route Update:

```typescript
// Before (old schema)
const { data } = await supabase
    .from('user')
    .select('*')
    .eq('auto_id', userId);

// After (new schema)
const { data } = await supabase
    .from('user')
    .select('*')
    .eq('user_id', userId);
```

## Step 6: Data Migration (If Needed)

If you have existing data in MySQL/local database, you'll need to migrate it:

1. **Export existing data** from your current database
2. **Transform the data** to match the new schema
3. **Import into Supabase** using the SQL Editor or API

Here's a sample migration script structure:

```sql
-- Example: Migrate users
INSERT INTO "user" (email, user_type, identification, admin_type, department_id)
SELECT 
    email,
    user_type,
    identification,
    admin_type,
    department_id
FROM your_old_users_table;
```

## Step 7: Deploy and Test

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Test core functionality:**
   - User login/registration
   - Vehicle registration
   - OSA dashboard
   - Security dashboard
   - Gate operations

3. **Monitor Supabase logs:**
   - Check Supabase dashboard for any errors
   - Monitor API usage and performance

## Troubleshooting

### Connection Issues
- Verify your `.env` variables are correct
- Check that your Supabase project is active
- Ensure network connectivity to Supabase

### RLS Policy Issues
- If you get permission errors, the RLS policies might be too restrictive
- You can temporarily disable RLS for testing:
  ```sql
  ALTER TABLE "user" DISABLE ROW LEVEL SECURITY;
  ```

### Schema Mismatches
- Compare your existing queries with the new schema
- Update column names and foreign key references
- Check that all required tables exist

### Performance Issues
- Add indexes for frequently queried columns
- Use Supabase's database monitoring tools
- Consider using Supabase Edge Functions for complex operations

## Next Steps

1. **Set up Backups:** Configure automated backups in Supabase
2. **Monitor Usage:** Set up alerts for database usage and performance
3. **Security Review:** Review RLS policies and adjust as needed
4. **Scale Planning:** Consider Supabase Pro tier for production use

## Support

- Supabase Documentation: [https://supabase.com/docs](https://supabase.com/docs)
- Supabase Discord: [https://supabase.com/discord](https://supabase.com/discord)
- Project Issues: Check existing GitHub issues or create new ones

## Summary

Your GateQR system is now connected to Supabase! The key benefits include:

- ✅ Managed PostgreSQL database
- ✅ Automatic backups and scaling
- ✅ Real-time subscriptions (if needed)
- ✅ Built-in authentication (optional for future use)
- ✅ Excellent performance and reliability

The migration maintains your existing custom JWT authentication while providing a robust, scalable database backend.