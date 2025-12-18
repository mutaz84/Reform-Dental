const sql = require('mssql');

async function addTaskColumns() {
    const config = {
        server: 'reform-dental-server.database.windows.net',
        database: 'reformdentaldb',
        user: 'reformadmin',
        password: 'DentalAdmin2024!',
        options: { encrypt: true, trustServerCertificate: false }
    };
    
    try {
        const pool = await sql.connect(config);
        
        // Add new columns if they don't exist
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'TaskType')
            BEGIN
                ALTER TABLE Tasks ADD TaskType NVARCHAR(20) DEFAULT 'Regular';
            END
            
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'IsPaid')
            BEGIN
                ALTER TABLE Tasks ADD IsPaid BIT DEFAULT 0;
            END
            
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'PayAmount')
            BEGIN
                ALTER TABLE Tasks ADD PayAmount DECIMAL(10,2) NULL;
            END
            
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'Location')
            BEGIN
                ALTER TABLE Tasks ADD Location NVARCHAR(100) NULL;
            END
            
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'TimeEstimate')
            BEGIN
                ALTER TABLE Tasks ADD TimeEstimate NVARCHAR(50) NULL;
            END
            
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'Assignee')
            BEGIN
                ALTER TABLE Tasks ADD Assignee NVARCHAR(100) NULL;
            END
            
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ClaimedBy')
            BEGIN
                ALTER TABLE Tasks ADD ClaimedBy NVARCHAR(100) NULL;
            END
            
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Tasks') AND name = 'ClaimedAt')
            BEGIN
                ALTER TABLE Tasks ADD ClaimedAt DATETIME NULL;
            END
        `);
        
        console.log('✅ Task columns added successfully');
        
        // Verify columns
        const result = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Tasks'`);
        console.log('Current columns:', result.recordset.map(r => r.COLUMN_NAME).join(', '));
        
        await pool.close();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

addTaskColumns();
