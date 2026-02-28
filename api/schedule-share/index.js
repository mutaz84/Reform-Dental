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

        const body = req.body || {};
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

        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sendGridApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sendGridPayload)
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
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
        context.res = {
            status: 500,
            headers,
            body: {
                error: error?.message || 'Server error while sending schedule email.'
            }
        };
    }
};
