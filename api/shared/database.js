// Database connection module for Azure SQL
const sql = require('mssql');

const config = {
    server: process.env.SQL_SERVER || 'your-server.database.windows.net',
    database: process.env.SQL_DATABASE || 'ReformDentalDB',
    user: process.env.SQL_USER || 'your-username',
    password: process.env.SQL_PASSWORD || 'your-password',
    options: {
        encrypt: true,
        trustServerCertificate: false
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Connection string alternative (used by Azure)
const connectionString = process.env.SQL_CONNECTION_STRING;

let pool = null;

async function getConnection() {
    if (pool) {
        return pool;
    }
    
    try {
        if (connectionString) {
            pool = await sql.connect(connectionString);
        } else {
            pool = await sql.connect(config);
        }
        console.log('Connected to Azure SQL Database');
        return pool;
    } catch (err) {
        console.error('Database connection error:', err);
        throw err;
    }
}

async function query(queryString, params = []) {
    const pool = await getConnection();
    const request = pool.request();
    
    // Add parameters
    params.forEach((param, index) => {
        request.input(`param${index}`, param);
    });
    
    return await request.query(queryString);
}

async function execute(queryString, params = {}) {
    const pool = await getConnection();
    const request = pool.request();
    
    // Add named parameters
    for (const [key, value] of Object.entries(params)) {
        request.input(key, value);
    }
    
    return await request.query(queryString);
}

module.exports = {
    sql,
    getConnection,
    query,
    execute
};
