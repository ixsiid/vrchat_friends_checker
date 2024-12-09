import RestClientWithAuthByJSON from './RestClientWithAuthByJSON.mjs';

const username = process.env.vrchat_username;
const password = process.env.vrchat_password;

const readline = async () => {
	for await (const chunk of process.stdin) {
		const text = Buffer.from(chunk).toString().trim();
		return text;
	}
};

const base_url = 'https://api.vrchat.cloud/api/1';
const UserAgent = 'FriendsChecker/1.0.0 test@gmail.com';

const client = new RestClientWithAuthByJSON(base_url, { 'User-Agent': UserAgent });

const Authorization = 'Basic ' + Buffer.from([
	username, password].map(x => encodeURI(x)).join(':')).toString('base64');

client
	.initialize()
	.then(() => client.get('/auth/user', { Authorization }))
	.then(json => {
		console.log(json);

		// logged in 
		if (json.id) return;

		// need two factor authorization
		if (json.requiresTwoFactorAuth.includes('emailOtp')) {
			console.log('Confirm 2FA for email');
			return readline().then(code => client.post('/auth/twofactorauth/emailotp/verify', undefined, { code }));
		}
	})
	.then(() => client.get('/auth/user/friends?offline=false'))
	.then(json => console.log(json))
	.catch(err => {
		console.error(err);
		console.error(client.status());
	});
