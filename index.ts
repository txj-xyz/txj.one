import { join } from 'path';
import { stat, readdir, mkdir } from 'fs/promises';
import { Tunnel, bin, install, type Connection } from 'cloudflared';
import { existsSync } from 'fs';
const cloudflaredToken: string = Bun.env.CLOUDFLARED_TOKEN ?? "";
const PORT: number = Bun.env.PORT ? parseInt(Bun.env.PORT) : 4545;

if (cloudflaredToken.length === 0) { 
	throw new Error("CLOUDFLARED_TOKEN is not set");
}

// Ensure that cloudflared is installed
if (!existsSync(bin)) {
	console.log("Installing cloudflared");
	await install(bin);
}

// Configuration
const CONTENT_ROOT = './content'; // Root directory for content folders
const DEFAULT_SUBDOMAIN = 'www'; // Subdomain to use when none specified

async function startCloudflared() {
	console.log('Starting cloudflared tunnel...');
	const tunnelNamed = Tunnel.withToken(cloudflaredToken);
	// Get the public URL when it's available
	const url = await new Promise<Connection>(resolve => tunnelNamed.once('connected', resolve));
	console.log(`Cloudflared tunnel running at: ${JSON.stringify(url)}`);
	
	return tunnelNamed;
}

// Check if a directory exists
async function directoryExists(path: string): Promise<boolean> {
	try {
		const stats = await stat(path);
		return stats.isDirectory();
	} catch (error) {
		return false;
	}
}

// Create the content directory if it doesn't exist
async function ensureContentDirectories() {
	if (!(await directoryExists(CONTENT_ROOT))) {
		console.log(`Creating content root directory: ${CONTENT_ROOT}`);
		await mkdir(CONTENT_ROOT, { recursive: true });
		await Bun.write(Bun.file(`${CONTENT_ROOT}/.gitkeep`), '');
		
		// Create example subdomain folder
		const wwwPath = join(CONTENT_ROOT, DEFAULT_SUBDOMAIN);
		await mkdir(wwwPath, { recursive: true });
		await Bun.write(Bun.file(join(wwwPath, 'index.html')), '<h1>Welcome to the default subdomain!</h1>');
	}
}

// Serve content based on subdomain
async function serveContent(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const hostname = url.hostname;
	
	// Extract subdomain from hostname (assuming format: subdomain.domain.tld)
	let subdomain = DEFAULT_SUBDOMAIN;
	if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
		const parts = hostname.split('.');
		if (parts.length > 2) {
			subdomain = parts[0] || DEFAULT_SUBDOMAIN;
		}
	}
	
	const pathSegments = url.pathname.split('/').filter(Boolean);
	const contentPath = join(CONTENT_ROOT, subdomain);
	
	// Check if the subdomain folder exists
	if (!(await directoryExists(contentPath))) {
		return new Response(`Subdomain '${subdomain}' not found`, {
			status: 404,
			headers: { 'Content-Type': 'text/plain' }
		});
	}
	
	// Determine the file path
	let filePath = contentPath;
	if (pathSegments.length > 0) {
		filePath = join(contentPath, ...pathSegments);
	}
	
	try {
		// Check if the path exists
		const stats = await stat(filePath);
		
		if (stats.isDirectory()) {
			// Try to serve index.html from the directory
			const indexPath = join(filePath, 'index.html');
			try {
				const indexStats = await stat(indexPath);
				if (indexStats.isFile()) {
					const file = Bun.file(indexPath);
					return new Response(file);
				}
			} catch (error) {
				// No index.html, list directory contents instead
				const files = await readdir(filePath);
				const pathname = typeof url.pathname === 'string' ? url.pathname : '/';
				const listing = `
					<html>
						<head><title>Directory: ${pathname}</title></head>
						<body>
							<h1>Directory: ${pathname}</h1>
							<ul>
								${files.map(file => `<li><a href="${pathname === '/' ? '' : pathname}/${file}">${file}</a></li>`).join('')}
							</ul>
						</body>
					</html>
				`;
				return new Response(listing, {
					headers: { 'Content-Type': 'text/html' }
				});
			}
		} else if (stats.isFile()) {
			// Serve the file with appropriate content type
			const file = Bun.file(filePath);
			return new Response(file);
		}
	} catch (error) {
		// File or directory not found
		const pathname = typeof url.pathname === 'string' ? url.pathname : '/';
		return new Response(`Not found: ${pathname}`, {
			status: 404,
			headers: { 'Content-Type': 'text/plain' }
		});
	}
	
	// Fallback response
	return new Response('Not found', {
		status: 404,
		headers: { 'Content-Type': 'text/plain' }
	});
}

// Main function
async function main() {
	await ensureContentDirectories();
	
	// Start the Bun server
	const server = Bun.serve({
		port: PORT,
		fetch: serveContent,
		hostname: '0.0.0.0',
	});
	
	console.log(`Bun server listening on http://localhost:${PORT}`);
	
	// Start cloudflared tunnel
	const tunnel = await startCloudflared();
	
	// Handle graceful shutdown
	const shutdown = async () => {
		console.log('Shutting down...');
		if (tunnel && tunnel.stop) {
			tunnel.stop();
		}
		process.exit(0);
	};
	
	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);
}

// Start the server
main().catch(error => {
	console.error('Failed to start server:', error);
	process.exit(1);
});