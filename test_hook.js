const fetch = require('node-fetch');
async function testWebhook() {
  const webhookUrl = 'https://script.google.com/macros/s/AKfycbx-s2O95hQsTvH4MXWLR-koJVKTHkB8JnsMOHDao5cXc99f1TUIfxsz687OQT9DVjtA3w/exec';
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: 'divyanshikulshrestha193@gmail.com',
      name: 'Proctara System Test',
      subject: 'Proctara Webhook Integration Success!',
      html: '<h1>Success!</h1><p>The Google Apps Script webhook successfully sent this email from your account!</p>'
    })
  });
  const text = await res.text();
  console.log('Webhook Response:', text);
}
testWebhook();
