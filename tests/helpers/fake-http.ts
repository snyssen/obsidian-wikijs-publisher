import { HttpFn, HttpRequest, HttpResponse } from '../../src/wiki/http';

type Route = (request: HttpRequest) => HttpResponse | undefined;

/** An HttpFn answering from a list of routes (first match wins); unmatched requests get a 404. Records requests. */
export function fakeHttp(...routes: Route[]): HttpFn & { requests: HttpRequest[] } {
	const requests: HttpRequest[] = [];
	const http = async (request: HttpRequest): Promise<HttpResponse> => {
		requests.push(request);
		for (const route of routes) {
			const response = route(request);
			if (response) return response;
		}
		return { status: 404, text: 'Not Found' };
	};
	return Object.assign(http, { requests });
}

export function json(status: number, body: unknown): HttpResponse {
	return { status, text: JSON.stringify(body) };
}

export function on(method: HttpRequest['method'], urlPart: string, response: HttpResponse): Route {
	return (request) => (request.method === method && request.url.includes(urlPart) ? response : undefined);
}
