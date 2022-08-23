const authorization = "Basic " + btoa(
	new TextEncoder()
	.encode(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)
	.reduce((a, v) => a + String.fromCharCode(v), '')
);

export async function onRequestPost(_context) {
	const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Tokens.json`, {
		method: 'POST',
		headers: {
			"Authorization": authorization
		}
	});
	const data = await response.json();
	return new Response(JSON.stringify(data));
}
