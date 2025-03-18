# Subdomain Folder Server with Cloudflared Integration

This is a Bun TypeScript server that serves different content based on subdomains, where each subdomain maps to a folder in the filesystem. It also integrates with Cloudflare's Tunnel service via the `cloudflared` package.

## Features

- Serves content from folders based on subdomain
- Automatically creates a tunnel using Cloudflared
- Handles directory listing and file serving
- Supports graceful shutdown

## Setup

1. Make sure you have Bun installed
2. Clone this repository
3. Run `bun install` to install dependencies
4. Start the server with `bun run index.ts`

## Docker Deployment

### Building the Docker image

```bash
docker build -t subdomain-server .
```

### Running with volume mount

To run the container and mount your local content directory:

```bash
docker run -p 4545:4545 -d -v $(pwd)/content:/app/content subdomain-server
```

## How it works

The server maps subdomains to folders. For example:
- `www.yourdomain.com` will serve content from `./content/www/`
- `blog.yourdomain.com` will serve content from `./content/blog/`
- `api.yourdomain.com` will serve content from `./content/api/`

### Directory Structure

```
content/
├── www/            # Default subdomain
│   ├── index.html  # Default file 
│   └── ...         # Other files
├── blog/
│   ├── index.html
│   └── ...
└── api/
    ├── index.html
    └── ...
```

### Cloudflared Integration

The server automatically creates a Cloudflare Tunnel using the `cloudflared` package. This allows your server to be accessible from the internet without port forwarding or dynamic DNS. When you start the server, it will display a tunnel URL that you can use to access your server.

## Configuration

You can modify the following variables in `index.ts`:

- `PORT`: The local port to run the server on (default: 3000)
- `CONTENT_ROOT`: The root directory for content folders (default: './content')  
- `DEFAULT_SUBDOMAIN`: The subdomain to use when none is specified (default: 'www')

## License

MIT
