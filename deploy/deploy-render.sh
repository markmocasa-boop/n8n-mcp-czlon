#!/bin/bash
# Deploy n8n-mcp to Render.com
# Usage: ./deploy/deploy-render.sh

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/adedara1/render-n8n-mcp"
RENDER_SERVICE_NAME="n8n-mcp-server"
DOCKERFILE_PATH="./Dockerfile.render"

echo -e "${BLUE}🚀 n8n-MCP Render.com Deployment Script${NC}"
echo "=================================================="

# Check if render CLI is installed
if ! command -v render &> /dev/null; then
    echo -e "${YELLOW}⚠️  Render CLI not found. Installing...${NC}"
    npm install -g @render-cli/render
fi

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the correct directory
if [ ! -f "package.json" ] || [ ! -f "render.yaml" ]; then
    print_error "Must be run from the project root directory"
    exit 1
fi

print_status "Found project files"

# Check if Dockerfile.render exists
if [ ! -f "$DOCKERFILE_PATH" ]; then
    print_error "Dockerfile.render not found at $DOCKERFILE_PATH"
    exit 1
fi

print_status "Found Render.com Dockerfile"

# Check if render.yaml exists
if [ ! -f "render.yaml" ]; then
    print_error "render.yaml not found. Please create it first."
    exit 1
fi

print_status "Found render.yaml configuration"

echo ""
echo -e "${BLUE}📋 Pre-deployment Checklist:${NC}"
echo "1. ✅ Project files verified"
echo "2. ✅ Dockerfile.render exists"
echo "3. ✅ render.yaml configuration exists"

# Validate render.yaml
echo ""
echo -e "${BLUE}🔍 Validating render.yaml...${NC}"
if grep -q "name: n8n-mcp-server" render.yaml; then
    print_status "Service name configured"
else
    print_warning "Service name might need adjustment"
fi

if grep -q "dockerfilePath: ./Dockerfile.render" render.yaml; then
    print_status "Dockerfile path configured"
else
    print_warning "Dockerfile path might need adjustment"
fi

# Build and test Docker image locally (optional)
echo ""
read -p "🐳 Do you want to test the Docker build locally first? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Building Docker image locally...${NC}"
    docker build -f Dockerfile.render -t n8n-mcp-test .
    
    if [ $? -eq 0 ]; then
        print_status "Docker build successful"
        
        # Test the container
        echo -e "${BLUE}Testing container startup...${NC}"
        container_id=$(docker run -d -p 10000:10000 -e AUTH_TOKEN="test123456789012345678901234567890" n8n-mcp-test)
        sleep 10
        
        # Check health
        if curl -f http://localhost:10000/health > /dev/null 2>&1; then
            print_status "Container health check passed"
        else
            print_warning "Container health check failed (this might be normal)"
        fi
        
        # Cleanup
        docker stop $container_id
        docker rm $container_id
        print_status "Local test completed"
    else
        print_error "Docker build failed"
        exit 1
    fi
fi

# Deploy to Render.com
echo ""
echo -e "${BLUE}🚀 Deploying to Render.com...${NC}"

# Check if user is logged in to Render
if ! render auth whoami &> /dev/null; then
    print_warning "Not logged in to Render CLI"
    echo "Please run: render auth login"
    read -p "Press Enter after logging in..."
fi

# Deploy using render.yaml
echo -e "${BLUE}Starting deployment with render.yaml...${NC}"

if render services create --config render.yaml; then
    print_status "Service creation initiated successfully"
else
    print_warning "Service might already exist, trying to update..."
    if render services update --config render.yaml; then
        print_status "Service updated successfully"
    else
        print_error "Deployment failed"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "=================================================="
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. 🌐 Check your service at: https://dashboard.render.com"
echo "2. 🔧 Configure your AUTH_TOKEN environment variable"
echo "3. 📊 Monitor logs and health status"
echo "4. 🧪 Test the MCP endpoints"
echo ""
echo -e "${YELLOW}Important URLs:${NC}"
echo "• Dashboard: https://dashboard.render.com"
echo "• Service Logs: Check Render dashboard for log access"
echo "• Health Check: https://your-service-url.onrender.com/health"
echo ""
echo -e "${BLUE}Environment Variables to Configure:${NC}"
echo "• AUTH_TOKEN: Set a secure 32+ character token"
echo "• N8N_API_URL: (if using n8n integration)"
echo "• N8N_API_KEY: (if using n8n integration)"
echo ""
echo -e "${GREEN}✨ Happy automating with n8n-MCP on Render.com!${NC}"