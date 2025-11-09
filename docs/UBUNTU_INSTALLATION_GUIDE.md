# Ubuntu Installation Guide: n8n + n8n-mcp + Claude Code

Complete guide for setting up n8n workflow automation with n8n-mcp and Claude Code on Ubuntu, including secure remote access via Tailscale or Cloudflare Tunnel.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Part 1: Install Docker on Ubuntu](#part-1-install-docker-on-ubuntu)
- [Part 2: Install n8n](#part-2-install-n8n)
- [Part 3: Get Your n8n API Key](#part-3-get-your-n8n-api-key)
- [Part 4: Set Up n8n-mcp](#part-4-set-up-n8n-mcp)
- [Part 5: Configure Claude Code](#part-5-configure-claude-code)
- [Part 6: Test the Setup](#part-6-test-the-setup)
- [Remote Access Options](#remote-access-options)
  - [Option A: Tailscale (Recommended)](#option-a-tailscale-recommended)
  - [Option B: Cloudflare Tunnel](#option-b-cloudflare-tunnel)
- [Management Commands](#management-commands)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Ubuntu Server (20.04 LTS or newer)
- Sudo/root access
- Internet connection
- Development machine with Node.js installed (for Claude Code)

## Part 1: Install Docker on Ubuntu

```bash
# 1. Update package index
sudo apt update

# 2. Install prerequisites
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# 3. Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 4. Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 5. Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 6. Add your user to docker group (so you don't need sudo)
sudo usermod -aG docker $USER

# 7. IMPORTANT: Log out and log back in for group changes to take effect
# Or run: newgrp docker

# 8. Verify installation
docker --version
docker compose version
```

## Part 2: Install n8n

### Create n8n Setup

```bash
# 1. Create directory structure
mkdir -p ~/n8n-setup
cd ~/n8n-setup

# 2. Get your server's IP address (save this for later)
ip addr show | grep "inet " | grep -v 127.0.0.1
# Example output: 192.168.1.100

# 3. Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://YOUR_SERVER_IP:5678/
      - GENERIC_TIMEZONE=America/New_York
      - N8N_METRICS=true
      - N8N_LOG_LEVEL=info
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - n8n-network

volumes:
  n8n_data:
    driver: local

networks:
  n8n-network:
    driver: bridge
EOF

# 4. Edit configuration
nano docker-compose.yml
# Replace YOUR_SERVER_IP with your actual IP (e.g., 192.168.1.100)
# Update GENERIC_TIMEZONE to your timezone if needed

# 5. Start n8n
docker compose up -d

# 6. Check if it's running
docker compose ps
docker compose logs -f n8n
# Press Ctrl+C to exit logs
```

### Configure Firewall (if UFW is enabled)

```bash
# Check if UFW is active
sudo ufw status

# If active, allow n8n port
sudo ufw allow 5678/tcp

# Reload firewall
sudo ufw reload
```

### Enable Auto-start on Boot

```bash
# 1. Create systemd service
sudo nano /etc/systemd/system/n8n-docker.service
```

Add this content:

```ini
[Unit]
Description=n8n Workflow Automation
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/YOUR_USERNAME/n8n-setup
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=YOUR_USERNAME
Group=docker

[Install]
WantedBy=multi-user.target
```

```bash
# 2. Replace YOUR_USERNAME with your actual username
# Then enable the service
sudo systemctl enable n8n-docker.service
sudo systemctl start n8n-docker.service

# 3. Check status
sudo systemctl status n8n-docker.service
```

## Part 3: Get Your n8n API Key

```bash
# 1. Find your server's IP
hostname -I | awk '{print $1}'

# 2. Open browser and navigate to:
# http://YOUR_SERVER_IP:5678
```

**In the n8n web interface:**

1. Create your account (first-time setup)
2. Click your avatar (top right) → **Settings**
3. Click **API** in the left sidebar
4. Click **Create an API key**
5. Name it: `MCP Server`
6. **Copy the API key** - you'll need it for the next steps!

## Part 4: Set Up n8n-mcp

**On your development machine** (where you'll run Claude Code):

```bash
# 1. Verify Node.js is installed
node --version
npm --version

# If not installed, install Node.js:
# curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
# sudo apt install -y nodejs

# 2. Test n8n-mcp installation
npx n8n-mcp --version

# 3. Test connection to n8n (replace YOUR_SERVER_IP and YOUR_API_KEY)
curl -H "X-N8N-API-KEY: YOUR_API_KEY" \
  http://YOUR_SERVER_IP:5678/api/v1/workflows

# Should return JSON (empty array [] if no workflows yet)
```

## Part 5: Configure Claude Code

```bash
# On your development machine

# 1. Create MCP config directory
mkdir -p ~/.config/claude-code

# 2. Create MCP configuration file
nano ~/.config/claude-code/mcp_config.json
```

Add this configuration:

```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "npx",
      "args": ["n8n-mcp"],
      "env": {
        "MCP_MODE": "stdio",
        "LOG_LEVEL": "error",
        "DISABLE_CONSOLE_OUTPUT": "true",
        "N8N_API_URL": "http://YOUR_SERVER_IP:5678",
        "N8N_API_KEY": "YOUR_API_KEY",
        "WEBHOOK_SECURITY_MODE": "moderate"
      }
    }
  }
}
```

**Replace:**
- `YOUR_SERVER_IP` with your Ubuntu server IP (e.g., 192.168.1.100)
- `YOUR_API_KEY` with the API key from n8n

Save and close the file.

## Part 6: Test the Setup

```bash
# 1. Start Claude Code
claude-code

# 2. Test MCP connection
# Ask Claude: "Use the n8n_health_check tool to verify my n8n connection"

# 3. List available nodes
# Ask Claude: "List all available n8n nodes"

# 4. Create a test workflow
# Ask Claude: "Create a simple webhook workflow that returns 'Hello World'"

# 5. Test the webhook (Claude will give you the URL)
curl http://YOUR_SERVER_IP:5678/webhook/YOUR_PATH
```

---

## Remote Access Options

When working from outside your home network, you have two excellent options for secure access without port forwarding.

## Option A: Tailscale (Recommended)

Tailscale creates a secure mesh VPN network, making your devices appear as if they're on the same local network.

### Benefits
- ✅ Zero configuration firewalls/NAT traversal
- ✅ End-to-end encrypted
- ✅ Free for personal use (up to 100 devices)
- ✅ Works from anywhere
- ✅ No port forwarding needed
- ✅ Simple device-to-device connection

### Install Tailscale on Ubuntu Server

```bash
# 1. Add Tailscale repository
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/$(lsb_release -cs).noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/$(lsb_release -cs).tailscale-keyring.list | sudo tee /etc/apt/sources.list.d/tailscale.list

# 2. Install Tailscale
sudo apt update
sudo apt install -y tailscale

# 3. Connect to Tailscale network
sudo tailscale up

# 4. Get your Tailscale IP
tailscale ip -4
# Example output: 100.100.100.100
```

### Install Tailscale on Your Development Machine

**Ubuntu/Debian:**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

**macOS:**
```bash
# Download from https://tailscale.com/download/mac
# Or use Homebrew:
brew install tailscale
```

**Windows:**
```bash
# Download from https://tailscale.com/download/windows
```

### Update n8n Configuration for Tailscale

```bash
# On Ubuntu server
cd ~/n8n-setup
nano docker-compose.yml
```

Update the `WEBHOOK_URL` to use your Tailscale IP:

```yaml
    environment:
      - WEBHOOK_URL=http://100.100.100.100:5678/
```

```bash
# Restart n8n
docker compose down
docker compose up -d
```

### Update Claude Code MCP Config for Tailscale

```bash
# On your development machine
nano ~/.config/claude-code/mcp_config.json
```

Update the `N8N_API_URL` to use Tailscale IP:

```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "npx",
      "args": ["n8n-mcp"],
      "env": {
        "MCP_MODE": "stdio",
        "LOG_LEVEL": "error",
        "DISABLE_CONSOLE_OUTPUT": "true",
        "N8N_API_URL": "http://100.100.100.100:5678",
        "N8N_API_KEY": "YOUR_API_KEY",
        "WEBHOOK_SECURITY_MODE": "moderate"
      }
    }
  }
}
```

### Test Tailscale Connection

```bash
# From your development machine
ping 100.100.100.100

# Test n8n access
curl http://100.100.100.100:5678

# Access n8n UI from browser
# http://100.100.100.100:5678
```

### Tailscale Management

```bash
# Check status
tailscale status

# Check IP addresses
tailscale ip

# Disconnect
sudo tailscale down

# Reconnect
sudo tailscale up

# Exit network (remove from admin console)
sudo tailscale logout
```

---

## Option B: Cloudflare Tunnel

Cloudflare Tunnel creates a secure connection from your server to Cloudflare's network, allowing access via a custom domain without exposing your home IP.

### Benefits
- ✅ Custom domain access (e.g., n8n.yourdomain.com)
- ✅ Free tier available
- ✅ Built-in DDoS protection
- ✅ No port forwarding needed
- ✅ HTTPS by default
- ✅ Access control with Cloudflare Access (optional)

### Prerequisites

1. A domain name (can buy from Cloudflare or use existing)
2. Domain DNS managed by Cloudflare (free tier works)
3. Cloudflare account (free)

### Install cloudflared on Ubuntu Server

```bash
# 1. Download cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb

# 2. Install the package
sudo dpkg -i cloudflared-linux-amd64.deb

# 3. Verify installation
cloudflared --version

# 4. Authenticate with Cloudflare
cloudflared tunnel login
# This will open a browser - select your domain
```

### Create and Configure Tunnel

```bash
# 1. Create a tunnel
cloudflared tunnel create n8n-tunnel

# 2. Note the Tunnel ID from output
# Example: Created tunnel n8n-tunnel with id: abc123-def456-ghi789

# 3. Create tunnel configuration
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/config.yml
```

Add this configuration:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/YOUR_USERNAME/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  # Route n8n subdomain to local n8n
  - hostname: n8n.yourdomain.com
    service: http://localhost:5678

  # Catch-all rule (required)
  - service: http_status:404
```

**Replace:**
- `YOUR_TUNNEL_ID` with your actual tunnel ID
- `YOUR_USERNAME` with your Ubuntu username
- `yourdomain.com` with your actual domain

```bash
# 4. Create DNS record
cloudflared tunnel route dns n8n-tunnel n8n.yourdomain.com

# 5. Test configuration
cloudflared tunnel --config /etc/cloudflared/config.yml run n8n-tunnel

# If successful, press Ctrl+C and proceed to install as service
```

### Install as System Service

```bash
# 1. Install cloudflared as a service
sudo cloudflared service install

# 2. Copy config to system directory
sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml
sudo cp /home/$USER/.cloudflared/*.json /etc/cloudflared/

# 3. Update config permissions
sudo chown root:root /etc/cloudflared/config.yml
sudo chown root:root /etc/cloudflared/*.json

# 4. Start the service
sudo systemctl start cloudflared

# 5. Enable on boot
sudo systemctl enable cloudflared

# 6. Check status
sudo systemctl status cloudflared
```

### Update n8n Configuration for Cloudflare Tunnel

```bash
# On Ubuntu server
cd ~/n8n-setup
nano docker-compose.yml
```

Update environment variables:

```yaml
    environment:
      - N8N_HOST=n8n.yourdomain.com
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://n8n.yourdomain.com/
```

```bash
# Restart n8n
docker compose down
docker compose up -d
```

### Update Claude Code MCP Config for Cloudflare Tunnel

```bash
# On your development machine
nano ~/.config/claude-code/mcp_config.json
```

Update to use your domain:

```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "npx",
      "args": ["n8n-mcp"],
      "env": {
        "MCP_MODE": "stdio",
        "LOG_LEVEL": "error",
        "DISABLE_CONSOLE_OUTPUT": "true",
        "N8N_API_URL": "https://n8n.yourdomain.com",
        "N8N_API_KEY": "YOUR_API_KEY",
        "WEBHOOK_SECURITY_MODE": "strict"
      }
    }
  }
}
```

**Note:** Changed `WEBHOOK_SECURITY_MODE` to `strict` since you're using a public domain.

### Test Cloudflare Tunnel

```bash
# From anywhere with internet
curl https://n8n.yourdomain.com

# Access n8n UI from browser
# https://n8n.yourdomain.com
```

### Cloudflare Tunnel Management

```bash
# View tunnel status
sudo systemctl status cloudflared

# View logs
sudo journalctl -u cloudflared -f

# Restart tunnel
sudo systemctl restart cloudflared

# Stop tunnel
sudo systemctl stop cloudflared

# List all tunnels
cloudflared tunnel list

# Delete a tunnel
cloudflared tunnel delete n8n-tunnel
```

### Optional: Add Cloudflare Access (Authentication Layer)

For additional security, you can add Cloudflare Access to require authentication:

1. Go to Cloudflare Dashboard → Zero Trust → Access → Applications
2. Click "Add an application"
3. Select "Self-hosted"
4. Configure:
   - Application name: n8n
   - Session duration: 24 hours
   - Application domain: n8n.yourdomain.com
5. Add a policy (e.g., allow only your email)
6. Save

Now visitors must authenticate before accessing n8n.

---

## Comparison: Tailscale vs Cloudflare Tunnel

| Feature | Tailscale | Cloudflare Tunnel |
|---------|-----------|-------------------|
| Setup Complexity | ⭐⭐ Easy | ⭐⭐⭐ Moderate |
| Custom Domain | ❌ No | ✅ Yes |
| Public Access | ❌ No (VPN only) | ✅ Yes (optional) |
| HTTPS | Manual | ✅ Automatic |
| Speed | ⚡ Fast (direct) | ⚡ Fast (via CDN) |
| Free Tier | 100 devices | Unlimited |
| Best For | Personal/team use | Public-facing services |
| Authentication | Device-based | Optional (Cloudflare Access) |

**Recommendation:**
- Use **Tailscale** if you want simple device-to-device access for personal use
- Use **Cloudflare Tunnel** if you want a public URL with a custom domain

---

## Management Commands

### n8n Management

```bash
# Start n8n
cd ~/n8n-setup
docker compose up -d

# Stop n8n
docker compose down

# View logs
docker compose logs -f n8n

# Restart n8n
docker compose restart

# Update n8n to latest version
docker compose pull
docker compose up -d

# Check status
docker compose ps
```

### Backup and Restore

```bash
# Backup n8n data
docker run --rm \
  -v n8n-setup_n8n_data:/data \
  -v $(pwd):/backup \
  ubuntu tar czf /backup/n8n-backup-$(date +%Y%m%d).tar.gz /data

# List backups
ls -lh n8n-backup-*.tar.gz

# Restore from backup
docker run --rm \
  -v n8n-setup_n8n_data:/data \
  -v $(pwd):/backup \
  ubuntu tar xzf /backup/n8n-backup-YYYYMMDD.tar.gz -C /
```

### System Service Management

```bash
# Check n8n service status
sudo systemctl status n8n-docker.service

# Start service
sudo systemctl start n8n-docker.service

# Stop service
sudo systemctl stop n8n-docker.service

# Restart service
sudo systemctl restart n8n-docker.service

# View service logs
sudo journalctl -u n8n-docker.service -f
```

---

## Troubleshooting

### n8n Won't Start

```bash
# Check if Docker is running
sudo systemctl status docker

# Check n8n container logs
docker compose logs n8n

# Check if port is already in use
sudo ss -tlnp | grep 5678

# Check disk space
df -h
```

### Can't Access n8n from Browser

```bash
# Verify n8n is running
docker ps | grep n8n

# Check firewall
sudo ufw status

# Test locally on server
curl http://localhost:5678

# Check your IP address
ip addr show
```

### MCP Can't Connect to n8n

```bash
# From development machine, test connectivity
ping YOUR_SERVER_IP

# Test n8n API
curl http://YOUR_SERVER_IP:5678/api/v1/workflows

# Test with API key
curl -H "X-N8N-API-KEY: YOUR_API_KEY" \
  http://YOUR_SERVER_IP:5678/api/v1/workflows

# Verify MCP config
cat ~/.config/claude-code/mcp_config.json
```

### Tailscale Issues

```bash
# Check Tailscale status
tailscale status

# Check IP assignment
tailscale ip

# View logs
sudo journalctl -u tailscaled -f

# Restart Tailscale
sudo systemctl restart tailscaled
sudo tailscale up

# Test connectivity
ping 100.100.100.100
```

### Cloudflare Tunnel Issues

```bash
# Check tunnel status
sudo systemctl status cloudflared

# View detailed logs
sudo journalctl -u cloudflared -f

# Test tunnel configuration
sudo cloudflared tunnel --config /etc/cloudflared/config.yml run n8n-tunnel

# Verify DNS record
dig n8n.yourdomain.com

# List tunnels
cloudflared tunnel list
```

### Docker Permission Denied

```bash
# Check if you're in docker group
groups | grep docker

# If not, add yourself
sudo usermod -aG docker $USER

# Log out and log back in, or run:
newgrp docker

# Test Docker access
docker ps
```

### n8n API Returns 401 Unauthorized

```bash
# Verify API key in n8n UI
# Settings > API > Check your key

# Test API key
curl -v -H "X-N8N-API-KEY: YOUR_KEY" \
  http://YOUR_SERVER_IP:5678/api/v1/workflows

# Recreate API key if needed
```

---

## Security Recommendations

### For Local/Tailscale Setup
- Keep your Tailscale network private (don't share subnet routes publicly)
- Use strong passwords for n8n accounts
- Regularly update Docker and n8n
- Enable n8n's built-in authentication

### For Cloudflare Tunnel Setup
- Enable Cloudflare Access for authentication
- Use strong API keys
- Enable Cloudflare WAF (Web Application Firewall)
- Set up rate limiting in Cloudflare
- Monitor access logs regularly
- Consider IP allowlisting in Cloudflare

### General Best Practices
```bash
# Enable automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades

# Keep system updated
sudo apt update && sudo apt upgrade -y

# Regular backups
# Set up a cron job for automated backups
crontab -e
# Add: 0 2 * * * cd ~/n8n-setup && docker run --rm -v n8n-setup_n8n_data:/data -v ~/backups:/backup ubuntu tar czf /backup/n8n-backup-$(date +\%Y\%m\%d).tar.gz /data
```

---

## Next Steps

1. ✅ **Create Your First Workflow**
   - Open n8n UI
   - Use Claude Code to help build workflows
   - Test webhook triggers

2. 📚 **Learn n8n Basics**
   - [n8n Documentation](https://docs.n8n.io)
   - [n8n Workflow Templates](https://n8n.io/workflows)

3. 🚀 **Explore n8n-mcp Tools**
   - Ask Claude: "What n8n-mcp tools are available?"
   - Try creating workflows with Claude's help
   - Use templates: "Show me templates for Slack integration"

4. 🔐 **Set Up Monitoring** (Optional)
   - Install Uptime Kuma or similar
   - Monitor n8n availability
   - Set up alerts for failures

---

## Additional Resources

- [n8n Documentation](https://docs.n8n.io)
- [n8n-mcp GitHub](https://github.com/czlonkowski/n8n-mcp)
- [Tailscale Documentation](https://tailscale.com/kb/)
- [Cloudflare Tunnel Documentation](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Docker Documentation](https://docs.docker.com)

---

**Conceived by Romuald Członkowski - [www.aiadvisors.pl/en](https://www.aiadvisors.pl/en)**
