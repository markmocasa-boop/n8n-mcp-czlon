
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
