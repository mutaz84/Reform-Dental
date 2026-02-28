const https = require('https');

function postJson(url, payload, apiKey) {
    return new Promise((resolve, reject) => {
        const requestBody = JSON.stringify(payload);
        const parsedUrl = new URL(url);

        const request = https.request({
            protocol: parsedUrl.protocol,
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + (parsedUrl.search || ''),
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody)
            }
        }, (response) => {
            let responseBody = '';
            response.on('data', (chunk) => {
                responseBody += chunk;
            });
            response.on('end', () => {
                resolve({
                    ok: response.statusCode >= 200 && response.statusCode < 300,
                    status: response.statusCode || 500,
                    text: responseBody
                });
            });
        });

        request.on('error', reject);
        request.write(requestBody);
        request.end();
    });
}

module.exports = async function (context, req) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    if (req.method !== 'POST') {
        context.res = { status: 405, headers, body: { error: 'Method not allowed' } };
        return;
    }

    try {
        const sendGridApiKey = process.env.SENDGRID_API_KEY;
        const fromEmail = process.env.MAIL_FROM_EMAIL;
        const fromName = process.env.MAIL_FROM_NAME || 'Reform Dental Scheduler';

        if (!sendGridApiKey || !fromEmail) {
            context.res = {
                status: 500,
                headers,
                body: {
                    error: 'Email service is not configured.',
                    missing: {
                        SENDGRID_API_KEY: !sendGridApiKey,
                        MAIL_FROM_EMAIL: !fromEmail
                    }
                }
            };
            return;
        }

        const body = (typeof req.body === 'string')
            ? JSON.parse(req.body || '{}')
            : (req.body || {});
        const recipients = Array.isArray(body.recipients) ? body.recipients : [];
        const subject = String(body.subject || '').trim();
        const text = String(body.text || '').trim();
        const html = String(body.html || '').trim();
        const fileName = String(body.fileName || 'schedule.pdf').trim();
        const fileBase64Raw = String(body.fileBase64 || '').trim();

        const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const uniqueRecipients = Array.from(new Set(recipients
            .map((value) => String(value || '').trim())
            .filter((value) => validEmailRegex.test(value))
        ));

        if (!uniqueRecipients.length) {
            context.res = { status: 400, headers, body: { error: 'No valid recipients provided.' } };
            return;
        }

        if (!subject) {
            context.res = { status: 400, headers, body: { error: 'Email subject is required.' } };
            return;
        }

        if (!text && !html) {
            context.res = { status: 400, headers, body: { error: 'Email content is required.' } };
            return;
        }

        const fileBase64 = fileBase64Raw.replace(/^data:application\/pdf;base64,/i, '');
        if (!fileBase64) {
            context.res = { status: 400, headers, body: { error: 'PDF attachment data is required.' } };
            return;
        }

        try {
            Buffer.from(fileBase64, 'base64');
        } catch (_) {
            context.res = { status: 400, headers, body: { error: 'Invalid PDF attachment encoding.' } };
            return;
        }

        const sendGridPayload = {
            personalizations: [
                {
                    to: uniqueRecipients.map((email) => ({ email }))
                }
            ],
            from: {
                email: fromEmail,
                name: fromName
            },
            subject,
            content: [],
            attachments: [
                {
                    content: fileBase64,
                    filename: fileName,
                    type: 'application/pdf',
                    disposition: 'attachment'
                }
            ]
        };

        if (text) {
            sendGridPayload.content.push({ type: 'text/plain', value: text });
        }
        if (html) {
            sendGridPayload.content.push({ type: 'text/html', value: html });
        }

        const response = await postJson('https://api.sendgrid.com/v3/mail/send', sendGridPayload, sendGridApiKey);

        if (!response.ok) {
            const errorText = String(response.text || '');
            context.log.error('Schedule share send failed:', response.status, errorText);
            context.res = {
                status: 502,
                headers,
                body: {
                    error: 'Failed to send schedule email.',
                    status: response.status,
                    details: errorText || 'No details returned by provider.'
                }
            };
            return;
        }

        context.res = {
            status: 200,
            headers,
            body: {
                message: 'Schedule email sent successfully.',
                recipientCount: uniqueRecipients.length
            }
        };
    } catch (error) {
        context.log.error('Schedule share API error:', error);
        const errorMessage = (error && error.message)
            ? error.message
            : 'Server error while sending schedule email.';
        context.res = {
            status: 500,
            headers,
            body: {
                error: errorMessage,
                code: 'SCHEDULE_SHARE_SERVER_ERROR'
            }
        };
    }
};
