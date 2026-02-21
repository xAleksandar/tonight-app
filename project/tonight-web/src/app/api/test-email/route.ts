import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY;

  console.log('🔍 Testing Resend configuration...');
  console.log('API Key present:', !!apiKey);
  console.log('API Key value:', apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING');

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'RESEND_API_KEY not found in environment',
      env: Object.keys(process.env).filter(k => k.includes('RESEND'))
    });
  }

  try {
    const resend = new Resend(apiKey);

    // Get from email from env
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const fromFormatted = fromEmail.includes('@') && !fromEmail.includes('<')
      ? `Tonight <${fromEmail}>`
      : fromEmail;

    console.log('📧 Sending test email from:', fromFormatted);

    // Test sending an email
    const result = await resend.emails.send({
      from: fromFormatted,
      to: 'delivered@resend.dev', // Resend test email
      subject: 'Test email from Tonight',
      text: 'This is a test email to verify Resend is working.',
      html: '<p>This is a test email to verify Resend is working.</p>',
    });

    console.log('✅ Test email sent:', result);

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      result
    });
  } catch (error) {
    console.error('❌ Failed to send test email:', error);

    return NextResponse.json({
      success: false,
      error: (error as Error).message,
      details: error
    });
  }
}
