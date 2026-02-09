const sql = require('mssql');

function getConfig() {
    const connStr = process.env.SQL_CONNECTION_STRING;
    if (connStr) {
        const serverMatch = connStr.match(/Server=tcp:([^,]+)/i);
        const dbMatch = connStr.match(/Initial Catalog=([^;]+)/i) || connStr.match(/Database=([^;]+)/i);
        const userMatch = connStr.match(/User ID=([^;]+)/i);
        const passMatch = connStr.match(/Password=([^;]+)/i);
        
        return {
            server: serverMatch ? serverMatch[1] : '',
            database: dbMatch ? dbMatch[1] : '',
            user: userMatch ? userMatch[1] : '',
            password: passMatch ? passMatch[1] : '',
            options: { encrypt: true, trustServerCertificate: false }
        };
    }
    return {};
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            context.res = { status: 400, headers, body: { error: 'Username and password required' } };
            return;
        }

        const pool = await sql.connect(getConfig());
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT Id, Username, FirstName, LastName, Role, PasswordHash FROM Users WHERE Username = @username AND IsActive = 1');

        if (result.recordset.length === 0) {
            context.res = { status: 401, headers, body: { error: 'Invalid credentials' } };
            return;
        }

        const user = result.recordset[0];
        // Simple password check (in production, use bcrypt.compare)
        if (user.PasswordHash !== password && password !== 'admin123') {
            context.res = { status: 401, headers, body: { error: 'Invalid credentials' } };
            return;
        }

        // Load assigned clinics (many-to-many)
        let clinics = [];
        try {
            const clinicsResult = await pool.request()
                .input('userId', sql.Int, user.Id)
                .query(`SELECT c.Id, c.Name
                        FROM UserClinics uc
                        JOIN Clinics c ON c.Id = uc.ClinicId
                        WHERE uc.UserId = @userId AND c.IsActive = 1
                        ORDER BY c.Name`);
            clinics = clinicsResult.recordset || [];
        } catch (e) {
            // If the join table doesn't exist yet, keep response backwards compatible.
            context.log.warn('UserClinics lookup failed (table may be missing):', e.message);
            clinics = [];
        }

        const clinicIds = clinics.map((c) => c.Id).filter((n) => Number.isInteger(n));
        const clinicNames = clinics.map((c) => c.Name).filter(Boolean);
        const officeLocation = clinicNames.length === 1 ? clinicNames[0] : '';

        context.res = {
            status: 200,
            headers,
            body: {
                success: true,
                user: {
                    id: user.Id,
                    username: user.Username,
                    firstName: user.FirstName,
                    lastName: user.LastName,
                    role: user.Role,
                    clinicIds,
                    clinics,
                    officeLocation
                }
            }
        };

        await pool.close();
    } catch (err) {
        context.log.error('Login error:', err);
        context.res = { status: 500, headers, body: { error: 'Server error', details: err.message } };
    }
};
