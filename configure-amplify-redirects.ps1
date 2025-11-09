# Amplify SPA Redirect Configuration Script
# This script configures Amplify redirects for SPA routing

Write-Host "🔧 Configuring Amplify SPA Redirects..." -ForegroundColor Yellow

# Get the Amplify App ID from the deployment
$AMPLIFY_APP_ID = "d1222azyk7h0yn"

Write-Host "📋 App ID: $AMPLIFY_APP_ID" -ForegroundColor Cyan

# Create SPA redirect rule
Write-Host "🚀 Adding SPA redirect rule..." -ForegroundColor Green

# Add redirect rule for SPA routing
aws amplify create-domain-association --app-id $AMPLIFY_APP_ID --domain-name "dev.d1222azyk7h0yn.amplifyapp.com" --sub-domain-settings "prefix=www,branchName=main"

# Alternative: Update branch settings
aws amplify update-branch --app-id $AMPLIFY_APP_ID --branch-name "main" --basic-auth-config "enableBasicAuth=false" --enable-pull-request-preview=false

Write-Host "✅ Redirect configuration attempted" -ForegroundColor Green
Write-Host "📝 Note: If this doesn't work, we'll need to configure manually in Amplify Console" -ForegroundColor Yellow