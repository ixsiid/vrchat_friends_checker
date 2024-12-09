import fs from 'node:fs/promises';

class RestClientWithAuthByJSON {
	/** @typedef {string} */
	#base_url;

	/** @typedef {object} */
	#default_headers = {};

	/** @typedef {object<string, string>} */
	#cookies = {};

	/** @typedef {string} */
	#cookie_filename;

	/**
	 * @param {string} base_url 
	 * @param {object} default_headers 
	 */
	constructor(base_url, default_headers, cookie_filename = 'cookies.json') {
		this.#base_url = base_url;

		this.#default_headers = JSON.parse(JSON.stringify(default_headers));
		this.#default_headers.Accept = 'application/json, */*';

		this.#cookie_filename = cookie_filename;
	}

	/**
	 * クライアントを初期化します。
	 * 以前のセッションのクッキー復元が含まれます。
	 * @returns {Promise<object>}
	 */
	initialize() {
		// recovery stored cookies
		return fs.readFile(this.#cookie_filename, { encoding: 'utf8' })
			.then(text => {
				this.#cookies = JSON.parse(text);
			})
			.catch(() => { });
	}

	#generate_headers(additional_headers) {
		const headers = JSON.parse(JSON.stringify(this.#default_headers));
		if (additional_headers) Object.keys(additional_headers).forEach(k => headers[k] = JSON.parse(JSON.stringify(additional_headers[k])));

		const now = new Date().getTime();
		headers.Cookie = Object.entries(this.#cookies)
			.filter(([_, { expires }]) => expires > now)
			.map(([key, { value }]) => `${key}=${value}`)
			.join(';');

		return headers;
	}

	/**
	 * 
	 * @param {Response} res 
	 */
	#store_cookie(res) {
		const cookies = res.headers.getSetCookie();
		cookies.forEach(cookie => {
			const t = cookie.split(';').map(x => x.trim());
			const kv = t[0];
			const [key, value] = kv.split('=');
			const expires = new Date(t.find(x => x.startsWith('Expires=')).split('=')[1]).getTime();
			this.#cookies[key] = {
				value,
				expires,
			};
		});

		return fs.writeFile(this.#cookie_filename, JSON.stringify(this.#cookies))
			.then(() => res);
	}

	/**
	 * 
	 * @param {string} url 
	 * @param {object} additional_headers 
	 * @returns {Promise<object>}
	 */
	get(url, additional_headers) {
		const headers = this.#generate_headers(additional_headers);

		return fetch(this.#base_url + url, { headers })
			.then(res => this.#store_cookie(res))
			.then(res => {
				if (res.status < 200 || res.status >= 300) throw res;
				return res.json();
			});
	}

	/**
	 * 
	 * @param {string} url 
	 * @param {object} additional_headers 
	 * @param {object} body 
	 * @returns {Promise<object>}
	 */
	post(url, additional_headers, body) {
		const headers = this.#generate_headers(additional_headers);
		headers['Content-Type'] = 'application/json';

		return fetch(this.#base_url + url, { headers, method: 'post', body: JSON.stringify(body) })
			.then(res => this.#store_cookie(res))
			.then(res => {
				if (res.status < 200 || res.status >= 300) throw res;
				return res.json();
			});

	}

	status() {
		return {
			base_url: this.#base_url,
			default_headers: this.#default_headers,
			cookies: this.#cookies,
		};
	}
};

export default RestClientWithAuthByJSON;