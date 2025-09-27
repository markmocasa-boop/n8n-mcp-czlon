#!/usr/bin/env python3
"""
Import SCAN v2.0.3 Enhanced Workflow via N8N MCP
Uses the local N8N MCP server to import the workflow
"""

import json
import requests
import time
from pathlib import Path

def import_scan_workflow():
    """Import SCAN workflow using N8N MCP"""
    print("🚀 Importing SCAN v2.0.3 Enhanced via N8N MCP")
    print("=" * 50)

    # Load workflow JSON
    workflow_file = Path("enhanced_scan_workflow_v2_3.json")
    variables_file = Path("n8n_variables.json")

    if not workflow_file.exists():
        print(f"❌ Workflow file not found: {workflow_file}")
        return False

    if not variables_file.exists():
        print(f"❌ Variables file not found: {variables_file}")
        return False

    try:
        # Load workflow data
        with open(workflow_file, 'r', encoding='utf-8') as f:
            workflow_data = json.load(f)

        with open(variables_file, 'r', encoding='utf-8') as f:
            variables_data = json.load(f)

        print(f"✅ Loaded workflow with {len(workflow_data.get('nodes', []))} nodes")
        print(f"✅ Loaded {len(variables_data.get('variables', []))} variables")

        # Check if N8N MCP server is running (usually on port 3001)
        mcp_url = "http://localhost:3001"

        try:
            response = requests.get(f"{mcp_url}/health", timeout=5)
            print(f"✅ N8N MCP server is running at {mcp_url}")
        except:
            print(f"⚠️ N8N MCP server not found at {mcp_url}")
            # Try alternative approach - check if we can find the MCP process
            print("Checking for N8N process...")
            import subprocess
            try:
                result = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
                if 'n8n' in result.stdout.lower():
                    print("✅ N8N process found running")
                else:
                    print("❌ No N8N process found")
                    return False
            except:
                pass

        # Prepare workflow for import
        import_data = {
            "name": "SCAN v2.0.3 Enhanced",
            "nodes": workflow_data.get("nodes", []),
            "connections": workflow_data.get("connections", {}),
            "settings": workflow_data.get("settings", {}),
            "tags": [{"name": "SCAN Enhanced"}]
        }

        print("📤 Importing workflow to N8N...")

        # Try different N8N API endpoints
        api_endpoints = [
            "http://localhost:5678",  # Default N8N
            "http://localhost:3001",  # N8N MCP
            "http://localhost:8080"   # Alternative
        ]

        for endpoint in api_endpoints:
            try:
                # Test endpoint
                test_response = requests.get(f"{endpoint}/healthz", timeout=5)
                if test_response.status_code == 200:
                    print(f"✅ Found N8N API at {endpoint}")

                    # Import workflow
                    response = requests.post(
                        f"{endpoint}/rest/workflows",
                        json=import_data,
                        headers={"Content-Type": "application/json"}
                    )

                    if response.status_code in [200, 201]:
                        result = response.json()
                        workflow_id = result.get("data", {}).get("id")
                        print(f"✅ Workflow imported successfully!")
                        print(f"📋 Workflow ID: {workflow_id}")
                        print(f"🔗 Access at: {endpoint}/workflow/{workflow_id}")
                        return True
                    else:
                        print(f"⚠️ Import failed at {endpoint}: {response.status_code}")

            except requests.RequestException:
                continue

        print("❌ Could not connect to any N8N instance")
        print("💡 Please ensure N8N is running and accessible")
        return False

    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False

def create_manual_import_instructions():
    """Create instructions for manual import"""
    instructions = """
# 📋 Manual SCAN v2.0.3 Enhanced Import Instructions

If automatic import failed, follow these steps:

## 1. Open N8N Dashboard
- Navigate to your N8N instance (e.g., http://localhost:5678)
- Log in to your N8N dashboard

## 2. Import Workflow
- Click "+" to create new workflow
- Click "Import from file" or use Ctrl+I
- Select: enhanced_scan_workflow_v2_3.json
- Click "Import"

## 3. Configure Variables
- Go to Settings → Variables
- Import from n8n_variables.json or add manually:
  - ADOBE_CLIENT_ID: 20d5d9e976c94738998950425f1bb743
  - ADOBE_CLIENT_SECRET: p8e-MwBTUYlpJ0B0K-Nd7FwCrqU8ekKQtVWu
  - ADOBE_ACCESS_TOKEN: [Your actual token]
  - OPENAI_API_KEY: [Your OpenAI key]
  - SUPABASE_URL: [Your Supabase URL]
  - SCAN_INPUT_DIRECTORY: /Users/Stefan/Documents/SCAN/input
  - SCAN_OUTPUT_DIRECTORY: /Users/Stefan/Documents/SCAN/output

## 4. Set Up Credentials
- Go to Credentials → Add Credential
- Create these credentials:
  a) Adobe PDF Services (HTTP Header Auth)
     - Name: Authorization
     - Value: Bearer [ADOBE_ACCESS_TOKEN]

  b) OpenAI API (HTTP Header Auth)
     - Name: Authorization
     - Value: Bearer [OPENAI_API_KEY]

  c) Supabase API (HTTP Header Auth)
     - Name: Authorization
     - Value: Bearer [SUPABASE_SERVICE_KEY]

## 5. Assign Credentials to Nodes
- Edit each HTTP Request node
- Assign appropriate credential
- Save workflow

## 6. Activate Workflow
- Click "Active" toggle in workflow
- Workflow will start monitoring input directory

## 7. Test
- Place a PDF file in SCAN_INPUT_DIRECTORY
- Monitor execution in N8N dashboard
"""

    with open("MANUAL_IMPORT_INSTRUCTIONS.md", "w") as f:
        f.write(instructions)

    print("📄 Manual import instructions saved to: MANUAL_IMPORT_INSTRUCTIONS.md")

if __name__ == "__main__":
    success = import_scan_workflow()

    if not success:
        print("\n📋 Creating manual import instructions...")
        create_manual_import_instructions()
        print("\n💡 Please follow the manual import instructions")
    else:
        print("\n🎉 SCAN v2.0.3 Enhanced successfully imported to N8N!")
        print("📁 Place PDF files in input directory to start processing")