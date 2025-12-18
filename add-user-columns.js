// Script to add missing columns to Users table
const sql = require('mssql');

const config = {
    server: 'reform-dental-server.database.windows.net',
    database: 'reformdentaldb',
    user: 'sqladmin',
    password: 'ReformDental2024!',
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

const alterQueries = `
-- Add missing columns to Users table if they don't exist
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'MiddleName')
    ALTER TABLE Users ADD MiddleName NVARCHAR(50) NULL;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'Gender')
    ALTER TABLE Users ADD Gender NVARCHAR(20) NULL;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'DateOfBirth')
    ALTER TABLE Users ADD DateOfBirth DATE NULL;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'PersonalEmail')
    ALTER TABLE Users ADD PersonalEmail NVARCHAR(100) NULL;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'WorkEmail')
    ALTER TABLE Users ADD WorkEmail NVARCHAR(100) NULL;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'HomePhone')
    ALTER TABLE Users ADD HomePhone NVARCHAR(20) NULL;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'CellPhone')
    ALTER TABLE Users ADD CellPhone NVARCHAR(20) NULL;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'Address')
    ALTER TABLE Users ADD Address NVARCHAR(200) NULL;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'City')
    ALTER TABLE Users ADD City NVARCHAR(100) NULL;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'State')
    ALTER TABLE Users ADD State NVARCHAR(50) NULL;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'ZipCode')
    ALTER TABLE Users ADD ZipCode NVARCHAR(10) NULL;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'JobTitle')
    ALTER TABLE Users ADD JobTitle NVARCHAR(100) NULL;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'EmployeeType')
    ALTER TABLE Users ADD EmployeeType NVARCHAR(50) NULL;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'Department')
    ALTER TABLE Users ADD Department NVARCHAR(100) NULL;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'HireDate')
    ALTER TABLE Users ADD HireDate DATE NULL;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'HourlyRate')
    ALTER TABLE Users ADD HourlyRate DECIMAL(10,2) NULL;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'Salary')
    ALTER TABLE Users ADD Salary DECIMAL(12,2) NULL;

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'Color')
    ALTER TABLE Users ADD Color NVARCHAR(20) NULL;
`;

async function run() {
    try {
        console.log('Connecting to Azure SQL Database...');
        const pool = await sql.connect(config);
        
        console.log('Adding missing columns to Users table...');
        
        // Execute each ALTER statement separately
        const statements = alterQueries.split(';').filter(s => s.trim().length > 0);
        for (const stmt of statements) {
            if (stmt.trim()) {
                try {
                    await pool.request().query(stmt);
                    console.log('✅ Executed: ' + stmt.substring(0, 60).replace(/\n/g, ' ') + '...');
                } catch (err) {
                    console.log('⚠️  ' + err.message);
                }
            }
        }
        
        // Verify columns now exist
        const result = await pool.request().query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Users' 
            ORDER BY ORDINAL_POSITION
        `);
        
        console.log('\n📋 Users table columns:');
        result.recordset.forEach(row => console.log('  - ' + row.COLUMN_NAME));
        
        await pool.close();
        console.log('\n✅ Done!');
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

run();
