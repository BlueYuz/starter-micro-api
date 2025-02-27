var http = require('http');
var p_url = require('url');
var qs = require('querystring');


/**
 * Helper functions to check if the request uses
 * corresponding method.
 *
 */
const Method = (method) => (req) => req.method.toLowerCase() === method.toLowerCase();
const Get = Method('get');
const Post = Method('post');

const Path = (regExp) => (req) => {
	const url = p_url.parse(req.url, true);
	const path = url.pathname;	
	return path.match(regExp) && path.match(regExp)[0] === path;
};

/*
 * The regex to get the bot_token and api_method from request URL
 * as the first and second backreference respectively.
 */
const URL_PATH_REGEX = /^\/bot(?<bot_token>[^/]+)\/(?<api_method>[a-z]+)/i;

/**
 * Router handles the logic of what handler is matched given conditions
 * for each request
 */
class Router {
	constructor() {
		this.routes = [];
	}

	handle(conditions, handler) {
		this.routes.push({
			conditions,
			handler,
		});
		return this;
	}

	get(url, handler) {
		return this.handle([Get, Path(url)], handler);
	}

	post(url, handler) {
		return this.handle([Post, Path(url)], handler);
	}

	all(handler) {
		return this.handler([], handler);
	}

	route(req) {
		const route = this.resolve(req);

		if (route) {
			return route.handler(req);
		}

		const description = 'No matching route found';
		const error_code = 404;

		return new Response(
			JSON.stringify({
				ok: false,
				error_code,
				description,
			}),
			{
				status: error_code,
				statusText: description,
				headers: {
					'content-type': 'application/json',
				},
			}
		);
	}

	/**
	 * It returns the matching route that returns true
	 * for all the conditions if any.
	 */
	resolve(req) {
		return this.routes.find((r) => {
			if (!r.conditions || (Array.isArray(r) && !r.conditions.length)) {
				return true;
			}

			if (typeof r.conditions === 'function') {
				return r.conditions(req);
			}

			return r.conditions.every((c) => c(req));
		});
	}
}

/**
 * Sends a POST request with JSON data to Telegram Bot API
 * and reads in the response body.
 * @param {Request} request the incoming request
 */
async function handler(request) {
	// Extract the URl method from the request.
	const { url, ..._request } = request;

	const { pathname: path, search } = p_url.parse(url, true);

	// Leave the first match as we are interested only in backreferences.
	const { bot_token, api_method } = path.match(URL_PATH_REGEX).groups;
	
	var query = "";
	if(search){
		query = search;
	}

	// Build the URL
	const api_url = 'https://api.telegram.org/bot' + bot_token + '/' + api_method;

	// Get the response from API.
	//const response = await fetch(api_url);
	const response = await fetch(api_url, {
	    method: 'POST',
	    headers: {
	      'Accept': 'application/json',
	      'Content-Type': 'application/json'
	    },
	    body: JSON.stringify( qs.parse(request['body_param']))
	  });
	const result = await response.text();
	return result;
}

/**
 * Handles the incoming request.
 * @param {Request} request the incoming request.
 */
async function handleRequest(request) {
	const r = new Router();
	r.get(URL_PATH_REGEX, (req) => handler(req));
	r.post(URL_PATH_REGEX, (req) => handler(req));

	const resp = await r.route(request);
	return resp;
}

/**
 * Hook into the fetch event.
 */
/*addEventListener('fetch', (event) => {
	event.respondWith(handleRequest(event.request));
});*/


http.createServer(async function (req, res) {
    //console.log(`Just got a request at ${req.url}!`)
	
	if (req.method == 'POST') {
        var body = '';

        req.on('data', function (data) {
            body += data;

            // Too much POST data, kill the connection!
            // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
            if (body.length > 1e6)
                req.connection.destroy();
        });

        req.on('end', async function () {
			req['body_param'] = body;
            var r = await handleRequest(req);
			console.log(r.toString());
			res.write(r.toString());
		 res.end();
        });
    } else {
		console.log("getttttttttttttttt");
	     res.end();
	}

   
}).listen(process.env.PORT || 3000);
