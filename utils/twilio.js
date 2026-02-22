const twilio = require('twilio');

const sendWhatsAppNotification = async (to, productName, orderId) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromWhatsApp = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Twilio Sandbox number

    if (!accountSid || !authToken) {
        console.warn('Twilio credentials missing. Skipping WhatsApp notification.');
        return;
    }

    const client = twilio(accountSid, authToken);

    try {
        const message = await client.messages.create({
            body: `¡Hola! Tienes un nuevo mensaje sobre tu producto '${productName}' en Einstore. Responde aquí: ${process.env.FRONTEND_URL}/dashboard?order=${orderId}`,
            from: fromWhatsApp,
            to: `whatsapp:${to}`,
        });
        console.log('WhatsApp notification sent:', message.sid);
    } catch (error) {
        console.error('Error sending WhatsApp notification:', error);
    }
};

const sendOrderNotification = async (to, role, orderId, total) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromWhatsApp = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

    if (!accountSid || !authToken) return;

    const client = twilio(accountSid, authToken);
    const body = role === 'admin'
        ? `🏦 [Admin] ¡Nueva venta completada! Orden: #${orderId.slice(-6).toUpperCase()}. Total: $${total}. Revisa el dashboard.`
        : `💰 ¡Venta realizada! Tienes una nueva orden #${orderId.slice(-6).toUpperCase()} por $${total}. Prepárala para envío.`;

    try {
        await client.messages.create({
            body,
            from: fromWhatsApp,
            to: `whatsapp:${to}`,
        });
    } catch (error) {
        console.error('Twilio Order Notification Error:', error);
    }
};

module.exports = { sendWhatsAppNotification, sendOrderNotification };
