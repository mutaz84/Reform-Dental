// CORS and response helpers
function addCorsHeaders(response) {
    return {
        ...response,
        headers: {
            ...response.headers,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Content-Type': 'application/json'
        }
    };
}

function successResponse(data, statusCode = 200) {
    return addCorsHeaders({
        status: statusCode,
        body: JSON.stringify({
            success: true,
            data: data
        })
    });
}

function errorResponse(message, statusCode = 400) {
    return addCorsHeaders({
        status: statusCode,
        body: JSON.stringify({
            success: false,
            error: message
        })
    });
}

function handleOptions() {
    return addCorsHeaders({
        status: 204,
        body: ''
    });
}

module.exports = {
    addCorsHeaders,
    successResponse,
    errorResponse,
    handleOptions
};
