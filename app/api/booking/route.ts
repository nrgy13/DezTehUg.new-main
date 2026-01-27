import { NextRequest, NextResponse } from 'next/server';

interface BookingRequest {
  service: string;
  objectType: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  preferredTime?: string;
  message?: string;
}

async function sendToTelegram(data: BookingRequest): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('Telegram credentials not configured');
    return false;
  }

  try {
    const message = `
🆕 *Новая заявка с сайта*

*Услуга:* ${data.service}
*Тип объекта:* ${data.objectType}

*Контактные данные:*
👤 Имя: ${data.name}
📞 Телефон: ${data.phone}
${data.email ? `📧 Email: ${data.email}` : ''}
${data.address ? `📍 Адрес: ${data.address}` : ''}
${data.preferredTime ? `⏰ Удобное время: ${data.preferredTime}` : ''}

${data.message ? `💬 Сообщение:\n${data.message}` : ''}
    `.trim();

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending to Telegram:', error);
    return false;
  }
}

async function sendToWhatsApp(data: BookingRequest): Promise<boolean> {
  // Placeholder for WhatsApp Business API integration
  // This would require WhatsApp Business API setup
  console.log('WhatsApp integration not yet implemented', data);
  return false;
}

async function sendToN8n(data: BookingRequest): Promise<boolean> {
  const webhookUrl = 'https://n8n.lex1case.ru/webhook/DTU_zayavki';
  // Using the token from the screenshot (without Bearer prefix in variable, added in header)
  const token = 'R3sFtTCpEPywoYYy1ph4MYhQYv4oWXfg8tuFmrttOdewcH7vCkUlIbUoZ11lj1uQ';

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Using 'Authorization' as per updated n8n configuration
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`N8n webhook returned status ${response.status}. Body: ${errorText}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error sending to N8n:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const data: BookingRequest = await request.json();

    // Validate required fields
    if (!data.service || !data.objectType || !data.name || !data.phone) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Try to send to messengers and webhook
    const telegramSent = await sendToTelegram(data);
    const whatsappSent = await sendToWhatsApp(data);
    const n8nSent = await sendToN8n(data);

    if (telegramSent || whatsappSent || n8nSent) {
      return NextResponse.json(
        { success: true, message: 'Booking request sent successfully' },
        { status: 200 }
      );
    } else {
      // If neither is configured, still return success but log warning
      console.warn('No messaging service configured. Booking data:', data);
      return NextResponse.json(
        { 
          success: true, 
          message: 'Booking request received (no messaging service configured)' 
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error processing booking request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

