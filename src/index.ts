export interface Env {}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === "GET") {
			const url = new URL(request.url);
			
			if (url.pathname === "/api/hello" || url.pathname === "/") {
				return new Response(
					JSON.stringify({ 
						status: "success",
						message: "Hello World von Cloudflare Workers API für Astronomie Explorer!" 
					}),
					{
						status: 200,
						headers: { 
							"Content-Type": "application/json",
							"Access-Control-Allow-Origin": "*" 
						},
					}
				);
			}
		}

		return new Response(
			JSON.stringify({ error: "Not Found" }), 
			{ 
				status: 404, 
				headers: { "Content-Type": "application/json" } 
			}
		);
	},
};
