const text_encoder = new TextEncoder();

export async function onRequestPost({ env }) {
	const authorization = "Basic " + btoa(
		text_encoder
		.encode(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)
		.reduce((a, v) => a + String.fromCharCode(v), '')
	);
	const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Tokens.json`, {
		method: 'POST',
		headers: {
			"Authorization": authorization
		}
	});
	const data = await response.json();
	return new Response(JSON.stringify(data));
}
