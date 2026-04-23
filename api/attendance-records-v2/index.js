const sql = require('mssql');

let sharedPoolPromise = null;

function resetSharedPool() {
    if (!sharedPoolPromise) return;
    sharedPoolPromise
        .then(async (pool) => {
            try {
                if (pool && typeof pool.close === 'function') {
                    await pool.close();
                }
            } catch (_) {}
        })
        .catch(() => {});
    sharedPoolPromise = null;
}

function isConnectionError(error) {
    const message = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    return [
        code.includes('econn'),
        code.includes('socket'),
        code.includes('timeout'),
        code.includes('enotopen'),
        message.includes('connection'),
        message.includes('socket'),
        message.includes('timeout'),
        message.includes('closed')
    ].some(Boolean);
}

function getConfig() {
    const connStr = process.env.SQL_CONNECTION_STRING;
    if (connStr) {
        const serverMatch = connStr.match(/Server=(?:tcp:)?([^,;]+)/i);
        const portMatch = connStr.match(/Server=(?:tcp:)?[^,;]+,(\d+)/i);
        const dbMatch = connStr.match(/Initial Catalog=([^;]+)/i) || connStr.match(/Database=([^;]+)/i);
        const userMatch = connStr.match(/User ID=([^;]+)/i);
        const passMatch = connStr.match(/Password=([^;]+)/i);
        const encryptMatch = connStr.match(/Encrypt=([^;]+)/i);
        const trustMatch = connStr.match(/TrustServerCertificate=([^;]+)/i);

        const parseBool = (value, fallback) => {
            if (value == null) return fallback;
            return /^(true|yes|1)$/i.test(String(value).trim());
        };

        return {
            server: serverMatch ? serverMatch[1] : '',
            port: portMatch ? Number(portMatch[1]) : undefined,
            database: dbMatch ? dbMatch[1] : '',
            user: userMatch ? userMatch[1] : '',
            password: passMatch ? passMatch[1] : '',
            options: {
                encrypt: parseBool(encryptMatch?.[1], true),
                trustServerCertificate: parseBool(trustMatch?.[1], false),
                enableArithAbort: true
            },
            pool: {
                max: 10,
                min: 0,
                idleTimeoutMillis: 30000
            },
            requestTimeout: 30000,
            connectionTimeout: 30000
        };
    }

    return {
        server: process.env.SQL_SERVER || '',
        port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
        database: process.env.SQL_DATABASE || '',
        user: process.env.SQL_USER || '',
        password: process.env.SQL_PASSWORD || '',
        options: {
            encrypt: true,
            trustServerCertificate: false,
            enableArithAbort: true
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        },
        requestTimeout: 30000,
        connectionTimeout: 30000
    };
}

async function getPool() {
    if (sharedPoolPromise) {
        try {
            const existing = await sharedPoolPromise;
            if (existing && (existing.connected || existing.connecting)) {
                return existing;
            }
            resetSharedPool();
        } catch (_) {
            resetSharedPool();
        }
    }

    sharedPoolPromise = sql.connect(getConfig()).catch((error) => {
        sharedPoolPromise = null;
        throw error;
    });
    return sharedPoolPromise;
}

function toIntOrNull(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) ? parsed : null;
}

function toDateOnly(value) {
    if (!value) return null;
    const str = String(value).trim();
    const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
}

function toTimeOrNull(value) {
    if (!value) return null;
    const str = String(value).trim();
    const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!match) return null;

    let hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    const seconds = Number.parseInt(match[3] || '0', 10);
    const meridiem = (match[4] || '').toLowerCase();

    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || !Number.isInteger(seconds)) {
        return null;
    }

    if (meridiem) {
        if (hours < 1 || hours > 12) return null;
        if (meridiem === 'pm' && hours < 12) hours += 12;
        if (meridiem === 'am' && hours === 12) hours = 0;
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
        return null;
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function toDateTimeOrNull(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function toTimeTextOrNull(value) {
    if (!value) return null;
    const str = String(value).trim();
    return str ? str.slice(0, 20) : null;
}

function safeString(value, maxLen = null) {
    if (value === null || value === undefined) return null;
    const str = String(value).trim();
    if (!str) return null;
    if (Number.isInteger(maxLen) && maxLen > 0) {
        return str.slice(0, maxLen);
    }
    return str;
}

function isSqlDuplicateKeyError(err) {
    const num = Number(err?.number || 0);
    const message = String(err?.message || '').toLowerCase();
    return num === 2601
        || num === 2627
        || message.includes('duplicate key')
        || message.includes('unique index')
        || message.includes('unique constraint');
}

function buildUniqueConstraintError(details = '') {
    const error = new Error('Attendance insert blocked by a unique index. Likely legacy Username+WorkDate unique index still active in live DB.');
    error.code = 'ATTENDANCE_UNIQUE_CONSTRAINT';
    error.details = String(details || '').slice(0, 240);
    return error;
}

function parseRecordMeta(value) {
    if (!value) {
        return { flags: [], clockOutReason: null, employeeClinic: null };
    }

    try {
        const parsed = JSON.parse(String(value));
        if (Array.isArray(parsed)) {
            return { flags: parsed, clockOutReason: null, employeeClinic: null };
        }

        return {
            flags: Array.isArray(parsed?.flags) ? parsed.flags : [],
            clockOutReason: safeString(parsed?.clockOutReason, 40),
            employeeClinic: safeString(parsed?.employeeClinic, 255)
        };
    } catch (_) {
        return { flags: [], clockOutReason: null, employeeClinic: null };
    }
}

function serializeRecordMeta(flags, clockOutReason, employeeClinic, rawBody = null) {
    const normalizedFlags = Array.isArray(flags) ? flags : [];
    const payload = {
        flags: normalizedFlags.map((item) => safeString(item, 80)).filter(Boolean).slice(0, 20),
        clockOutReason: safeString(clockOutReason, 40),
        employeeClinic: safeString(employeeClinic, 255)
    };

    if (rawBody && typeof rawBody === 'object') {
        payload.client = {
            source: safeString(rawBody.source, 40),
            appVersion: safeString(rawBody.appVersion, 40)
        };
    }

    return JSON.stringify(payload);
}

function mapRecord(row) {
    const meta = parseRecordMeta(row.FlagsJson);
    return {
        id: row.Id,
        localId: row.LocalRecordId,
        userId: row.UserId,
        username: row.Username,
        displayName: row.DisplayName,
        date: row.WorkDate,
        scheduledStart: row.ScheduledStart,
        scheduledEnd: row.ScheduledEnd,
        clockIn: row.ClockIn,
        clockOut: row.ClockOut,
        clockOutReason: meta.clockOutReason,
        employeeClinic: meta.employeeClinic,
        minutesWorked: row.MinutesWorked || 0,
        flags: meta.flags,
        createdAt: row.CreatedDate,
        modifiedAt: row.ModifiedDate
    };
}

async function findExistingRecord(pool, localId, username, workDate) {
    if (localId) {
        const byLocalId = await pool.request()
            .input('localId', sql.NVarChar(120), localId)
            .query('SELECT TOP 1 Id FROM AttendanceRecords WHERE LocalRecordId = @localId ORDER BY Id DESC');
        if (byLocalId.recordset[0]?.Id) {
            return byLocalId.recordset[0].Id;
        }

        // Important: when localId is provided but not found, treat it as a new segment.
        // Do not fallback to username+workDate because that would overwrite same-day records
        // (e.g., break + re-clock-in activity on the same date).
        return null;
    }

    const byIdentity = await pool.request()
        .input('username', sql.NVarChar(150), username)
        .input('workDate', sql.Date, workDate)
        .query('SELECT TOP 1 Id FROM AttendanceRecords WHERE Username = @username AND WorkDate = @workDate ORDER BY Id DESC');

    return byIdentity.recordset[0]?.Id || null;
}

async function findRecordIdByLocalId(pool, localId) {
    const normalized = safeString(localId, 120);
    if (!normalized) return null;
    const byLocalId = await pool.request()
        .input('localId', sql.NVarChar(120), normalized)
        .query('SELECT TOP 1 Id FROM AttendanceRecords WHERE LocalRecordId = @localId ORDER BY Id DESC');
    return byLocalId.recordset[0]?.Id || null;
}

async function findRecordIdByIdentity(pool, username, workDate) {
    const normalizedUsername = safeString(username, 150);
    const normalizedDate = toDateOnly(workDate);
    if (!normalizedUsername || !normalizedDate) return null;
    const byIdentity = await pool.request()
        .input('username', sql.NVarChar(150), normalizedUsername)
        .input('workDate', sql.Date, normalizedDate)
        .query('SELECT TOP 1 Id FROM AttendanceRecords WHERE Username = @username AND WorkDate = @workDate ORDER BY Id DESC');
    return byIdentity.recordset[0]?.Id || null;
}

async function updateRecord(pool, targetId, payload, flagsJson) {
    await pool.request()
        .input('id', sql.Int, targetId)
        .input('localId', sql.NVarChar(120), payload.localId)
        .input('userId', sql.Int, payload.userId)
        .input('displayName', sql.NVarChar(255), payload.displayName)
        .input('scheduledStart', sql.NVarChar(20), toTimeTextOrNull(payload.scheduledStart))
        .input('scheduledEnd', sql.NVarChar(20), toTimeTextOrNull(payload.scheduledEnd))
        .input('clockIn', sql.DateTime2, payload.clockIn)
        .input('clockOut', sql.DateTime2, payload.clockOut)
        .input('minutesWorked', sql.Int, payload.minutesWorked)
        .input('flagsJson', sql.NVarChar(sql.MAX), flagsJson)
        .query(`UPDATE AttendanceRecords
                SET LocalRecordId = COALESCE(@localId, LocalRecordId),
                    UserId = COALESCE(@userId, UserId),
                    DisplayName = COALESCE(@displayName, DisplayName),
                    ScheduledStart = TRY_CONVERT(time, @scheduledStart),
                    ScheduledEnd = TRY_CONVERT(time, @scheduledEnd),
                    ClockIn = @clockIn,
                    ClockOut = @clockOut,
                    MinutesWorked = @minutesWorked,
                    FlagsJson = @flagsJson,
                    ModifiedDate = SYSDATETIME()
                WHERE Id = @id`);
}

async function insertRecord(pool, payload, flagsJson) {
    const insert = await pool.request()
        .input('localId', sql.NVarChar(120), payload.localId)
        .input('userId', sql.Int, payload.userId)
        .input('username', sql.NVarChar(150), payload.username)
        .input('displayName', sql.NVarChar(255), payload.displayName)
        .input('workDate', sql.Date, payload.workDate)
        .input('scheduledStart', sql.NVarChar(20), toTimeTextOrNull(payload.scheduledStart))
        .input('scheduledEnd', sql.NVarChar(20), toTimeTextOrNull(payload.scheduledEnd))
        .input('clockIn', sql.DateTime2, payload.clockIn)
        .input('clockOut', sql.DateTime2, payload.clockOut)
        .input('minutesWorked', sql.Int, payload.minutesWorked)
        .input('flagsJson', sql.NVarChar(sql.MAX), flagsJson)
        .query(`INSERT INTO AttendanceRecords
                (LocalRecordId, UserId, Username, DisplayName, WorkDate, ScheduledStart, ScheduledEnd, ClockIn, ClockOut, MinutesWorked, FlagsJson)
                OUTPUT INSERTED.Id
                VALUES
                (@localId, @userId, @username, @displayName, @workDate, TRY_CONVERT(time, @scheduledStart), TRY_CONVERT(time, @scheduledEnd), @clockIn, @clockOut, @minutesWorked, @flagsJson)`);

    return insert.recordset[0]?.Id || null;
}

async function upsertRecord(pool, payload) {
    const targetId = await findExistingRecord(pool, payload.localId, payload.username, payload.workDate);
    const fullMeta = payload.flagsJson;
    const fallbackMeta = serializeRecordMeta([], null, null, null);

    if (targetId) {
        try {
            await updateRecord(pool, targetId, payload, fullMeta);
            return { id: targetId, upserted: true, mode: 'full' };
        } catch (err) {
            await updateRecord(pool, targetId, payload, fallbackMeta);
            return {
                id: targetId,
                upserted: true,
                mode: 'minimal-meta',
                warning: String(err?.message || err || '').slice(0, 160)
            };
        }
    }

    try {
        const insertedId = await insertRecord(pool, payload, fullMeta);
        return { id: insertedId, upserted: false, mode: 'full' };
    } catch (insertErr) {
        if (isSqlDuplicateKeyError(insertErr) && payload.localId) {
            const existingId = await findRecordIdByLocalId(pool, payload.localId);
            if (existingId) {
                try {
                    await updateRecord(pool, existingId, payload, fullMeta);
                    return {
                        id: existingId,
                        upserted: true,
                        mode: 'duplicate-recovered-full',
                        warning: String(insertErr?.message || insertErr || '').slice(0, 160)
                    };
                } catch (updateErr) {
                    await updateRecord(pool, existingId, payload, fallbackMeta);
                    return {
                        id: existingId,
                        upserted: true,
                        mode: 'duplicate-recovered-minimal-meta',
                        warning: String(updateErr?.message || updateErr || '').slice(0, 160)
                    };
                }
            }

            const identityId = await findRecordIdByIdentity(pool, payload.username, payload.workDate);
            if (identityId) {
                try {
                    await updateRecord(pool, identityId, payload, fullMeta);
                    return {
                        id: identityId,
                        upserted: true,
                        mode: 'duplicate-recovered-identity-full',
                        warning: String(insertErr?.message || insertErr || '').slice(0, 160)
                    };
                } catch (identityErr) {
                    await updateRecord(pool, identityId, payload, fallbackMeta);
                    return {
                        id: identityId,
                        upserted: true,
                        mode: 'duplicate-recovered-identity-minimal-meta',
                        warning: String(identityErr?.message || identityErr || '').slice(0, 160)
                    };
                }
            }

            throw buildUniqueConstraintError(insertErr?.message || insertErr);
        }

        try {
            const insertedId = await insertRecord(pool, payload, fallbackMeta);
            return {
                id: insertedId,
                upserted: false,
                mode: 'minimal-meta',
                warning: String(insertErr?.message || insertErr || '').slice(0, 160)
            };
        } catch (fallbackErr) {
            if (isSqlDuplicateKeyError(fallbackErr) && payload.localId) {
                const existingId = await findRecordIdByLocalId(pool, payload.localId);
                if (existingId) {
                    await updateRecord(pool, existingId, payload, fallbackMeta);
                    return {
                        id: existingId,
                        upserted: true,
                        mode: 'duplicate-recovered-fallback',
                        warning: String(fallbackErr?.message || fallbackErr || '').slice(0, 160)
                    };
                }

                const identityId = await findRecordIdByIdentity(pool, payload.username, payload.workDate);
                if (identityId) {
                    await updateRecord(pool, identityId, payload, fallbackMeta);
                    return {
                        id: identityId,
                        upserted: true,
                        mode: 'duplicate-recovered-identity-fallback',
                        warning: String(fallbackErr?.message || fallbackErr || '').slice(0, 160)
                    };
                }

                throw buildUniqueConstraintError(fallbackErr?.message || fallbackErr);
            }
            throw fallbackErr;
        }
    }
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    try {
        const pool = await getPool();
        const method = req.method;
        const id = toIntOrNull(req.params?.id);

        if (method === 'GET') {
            if (id) {
                const one = await pool.request()
                    .input('id', sql.Int, id)
                    .query('SELECT * FROM AttendanceRecords WHERE Id = @id');
                context.res = { status: 200, headers, body: one.recordset[0] ? mapRecord(one.recordset[0]) : null };
                return;
            }

            const username = safeString(req.query?.username, 150);
            const localId = safeString(req.query?.localId, 120);
            const date = toDateOnly(req.query?.date);
            const fromDate = toDateOnly(req.query?.fromDate);
            const toDate = toDateOnly(req.query?.toDate);

            const request = pool.request();
            const where = [];
            if (username) {
                request.input('username', sql.NVarChar(150), username);
                where.push('Username = @username');
            }
            if (localId) {
                request.input('localId', sql.NVarChar(120), localId);
                where.push('LocalRecordId = @localId');
            }
            if (date) {
                request.input('date', sql.Date, date);
                where.push('WorkDate = @date');
            }
            if (fromDate) {
                request.input('fromDate', sql.Date, fromDate);
                where.push('WorkDate >= @fromDate');
            }
            if (toDate) {
                request.input('toDate', sql.Date, toDate);
                where.push('WorkDate <= @toDate');
            }

            const all = await request.query(`SELECT * FROM AttendanceRecords ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY WorkDate DESC, Id DESC`);
            context.res = { status: 200, headers, body: (all.recordset || []).map(mapRecord) };
            return;
        }

        if (method === 'POST') {
            const body = req.body || {};
            const username = safeString(body.username, 150);
            const workDate = toDateOnly(body.date || body.workDate);
            const localId = safeString(body.localId || body.id, 120);

            if (!username || !workDate) {
                context.res = { status: 400, headers, body: { error: 'username and date are required' } };
                return;
            }

            const payload = {
                localId,
                userId: toIntOrNull(body.userId),
                username,
                displayName: safeString(body.displayName, 255),
                workDate,
                scheduledStart: toTimeOrNull(body.scheduledStart),
                scheduledEnd: toTimeOrNull(body.scheduledEnd),
                clockIn: toDateTimeOrNull(body.clockIn),
                clockOut: toDateTimeOrNull(body.clockOut),
                minutesWorked: Math.max(0, Number.parseInt(String(body.minutesWorked || 0), 10) || 0),
                flagsJson: serializeRecordMeta(body.flags, body.clockOutReason, body.employeeClinic, body)
            };

            const result = await upsertRecord(pool, payload);
            context.res = { status: result.upserted ? 200 : 201, headers, body: result };
            return;
        }

        if (method === 'PUT' && id) {
            const body = req.body || {};
            const payload = {
                localId: safeString(body.localId || body.id, 120),
                userId: toIntOrNull(body.userId),
                username: safeString(body.username, 150),
                displayName: safeString(body.displayName, 255),
                workDate: toDateOnly(body.date || body.workDate),
                scheduledStart: toTimeTextOrNull(toTimeOrNull(body.scheduledStart) || body.scheduledStart),
                scheduledEnd: toTimeTextOrNull(toTimeOrNull(body.scheduledEnd) || body.scheduledEnd),
                clockIn: toDateTimeOrNull(body.clockIn),
                clockOut: toDateTimeOrNull(body.clockOut),
                minutesWorked: Math.max(0, Number.parseInt(String(body.minutesWorked || 0), 10) || 0),
                flagsJson: serializeRecordMeta(body.flags, body.clockOutReason, body.employeeClinic, body)
            };

            await updateRecord(pool, id, payload, payload.flagsJson);
            context.res = { status: 200, headers, body: { id, updated: true } };
            return;
        }

        if (method === 'DELETE' && id) {
            await pool.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM AttendanceRecords WHERE Id = @id');
            context.res = { status: 200, headers, body: { message: 'Attendance record deleted' } };
            return;
        }

        context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
    } catch (err) {
        if (isConnectionError(err)) {
            resetSharedPool();
            if (!req?.__poolRetried) {
                const retriedReq = { ...(req || {}), __poolRetried: true };
                context.log.warn('Attendance Records v2 API transient connection failure, retrying once.');
                return module.exports(context, retriedReq);
            }
        }

        context.log.error('Attendance Records v2 API error:', err);
        context.res = {
            status: 500,
            headers,
            body: {
                error: err.message || 'Server error',
                code: err.code || null,
                number: Number.isFinite(Number(err.number)) ? Number(err.number) : null,
                details: err.details || null
            }
        };
    }
};
