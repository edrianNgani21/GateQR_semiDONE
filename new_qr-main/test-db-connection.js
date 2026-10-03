const mysql = require('mysql2/promise');

async function testConnection() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: 'gateqr',
            database: 'gateqr'
        });

        console.log('✅ Successfully connected to MySQL database!');
        
        // Test a simple query
        const [rows] = await connection.execute('SELECT 1 as test');
        console.log('✅ Database query successful:', rows[0]);
        
        // Check if user table exists
        const [tables] = await connection.execute("SHOW TABLES LIKE 'user'");
        if (tables.length > 0) {
            console.log('✅ User table exists');
            
            // Check user count
            const [users] = await connection.execute('SELECT COUNT(*) as count FROM user');
            console.log(`✅ Total users in database: ${users[0].count}`);
        } else {
            console.log('⚠️ User table does not exist - needs to be created');
        }

        await connection.end();
        console.log('✅ Connection test completed successfully');
        
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

testConnection();