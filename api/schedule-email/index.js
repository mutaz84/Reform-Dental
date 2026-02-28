const https = require('https');

function sendToSendGrid(apiKey, payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const request = https.request({
            hostname: 'api.sendgrid.com',
            path: '/v3/mail/send',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + apiKey,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (response) => {
            let body = '';
            response.on('data', (chunk) => {
                body += chunk;
            });
            response.on('end', () => {
                resolve({
                    status: response.statusCode || 500,
                    ok: (response.statusCode || 500) >= 200 && (response.statusCode || 500) < 300,
                    body: body
                });
            });
        });

        request.on('error', (error) => reject(error));
        request.write(data);
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
        context.res = { status: 204, headers: headers };
        return;
    }

    if (req.method !== 'POST') {
        context.res = { status: 405, headers: headers, body: { error: 'Method not allowed' } };
        return;
    }

    try {
        const sendGridApiKey = process.env.SENDGRID_API_KEY;
        const fromEmail = process.env.MAIL_FROM_EMAIL;
        const fromName = process.env.MAIL_FROM_NAME || 'Reform Dental Scheduler';

        if (!sendGridApiKey || !fromEmail) {
            context.res = {
                status: 500,
                headers: headers,
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

        let payloadBody = req.body;
        if (typeof payloadBody === 'string') {
            payloadBody = JSON.parse(payloadBody || '{}');
        }
        if (!payloadBody || typeof payloadBody !== 'object') {
            payloadBody = {};
        }

        const recipients = Array.isArray(payloadBody.recipients) ? payloadBody.recipients : [];
        const subject = String(payloadBody.subject || '').trim();
        const text = String(payloadBody.text || '').trim();
        const html = String(payloadBody.html || '').trim();
        const fileName = String(payloadBody.fileName || 'schedule.pdf').trim();
        const fileBase64Raw = String(payloadBody.fileBase64 || '').trim();

        const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const uniqueRecipients = [];
        recipients.forEach((item) => {
            const email = String(item || '').trim();
            if (validEmailRegex.test(email) && uniqueRecipients.indexOf(email) === -1) {
                uniqueRecipients.push(email);
            }
        });

        if (!uniqueRecipients.length) {
            context.res = { status: 400, headers: headers, body: { error: 'No valid recipients provided.' } };
            return;
        }

        if (!subject) {
            context.res = { status: 400, headers: headers, body: { error: 'Email subject is required.' } };
            return;
        }

        if (!text && !html) {
            context.res = { status: 400, headers: headers, body: { error: 'Email content is required.' } };
            return;
        }

        const fileBase64 = fileBase64Raw.replace(/^data:application\/pdf;base64,/i, '');
        if (!fileBase64) {
            context.res = { status: 400, headers: headers, body: { error: 'PDF attachment data is required.' } };
            return;
        }

        const sendGridPayload = {
            personalizations: [
                {
                    to: uniqueRecipients.map((email) => ({ email: email }))
                }
            ],
            from: {
                email: fromEmail,
                name: fromName
            },
            subject: subject,
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

        const sendGridResponse = await sendToSendGrid(sendGridApiKey, sendGridPayload);

        if (!sendGridResponse.ok) {
            context.log.error('schedule-email send failed', sendGridResponse.status, sendGridResponse.body);
            context.res = {
                status: 502,
                headers: headers,
                body: {
                    error: 'Failed to send schedule email.',
                    status: sendGridResponse.status,
                    details: sendGridResponse.body || 'No details returned by provider.'
                }
            };
            return;
        }

        context.res = {
            status: 200,
            headers: headers,
            body: {
                message: 'Schedule email sent successfully.',
                recipientCount: uniqueRecipients.length
            }
        };
    } catch (error) {
        context.log.error('schedule-email server error', error);
        context.res = {
            status: 500,
            headers: headers,
            body: {
                error: (error && error.message) ? error.message : 'Server error while sending schedule email.',
                code: 'SCHEDULE_EMAIL_SERVER_ERROR'
            }
        };
    }
};
