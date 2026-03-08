const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function buildResponse(status, body = null, headers = {}) {
    return {
        status,
        headers: {
            ...DEFAULT_HEADERS,
            ...headers
        },
        // Use `body` for broad Azure Functions runtime compatibility.
        body,
        // Keep `jsonBody` for any callers/runtimes that expect it.
        jsonBody: body
    };
}

function successResponse(data, status = 200, headers = {}) {
    return buildResponse(status, data, headers);
}

function errorResponse(message = 'Internal server error', status = 500, details = null, headers = {}) {
    const payload = {
        error: message
    };

    if (details) {
        payload.details = details;
    }

    return buildResponse(status, payload, headers);
}

function handleOptions(headers = {}) {
    return {
        status: 204,
        headers: {
            ...DEFAULT_HEADERS,
            ...headers
        }
    };
}

module.exports = {
    DEFAULT_HEADERS,
    successResponse,
    errorResponse,
    handleOptions
};
