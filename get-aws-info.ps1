# Quick AWS Info Retrieval Script
# Run this to get the IDs you need for your .env file

Write-Host "Getting AWS Resource Information..." -ForegroundColor Green

# Disable AWS pager
$env:AWS_PAGER = ""

Write-Host "`n1. Getting AWS Account Info..." -ForegroundColor Cyan
try {
    $accountInfo = aws sts get-caller-identity --output json --no-cli-pager | ConvertFrom-Json
    Write-Host "Account ID: $($accountInfo.Account)" -ForegroundColor Yellow
} catch {
    Write-Host "Run manually: aws sts get-caller-identity" -ForegroundColor Red
}

Write-Host "`n2. Listing User Pools..." -ForegroundColor Cyan
Write-Host "Run this command to get User Pool ID:" -ForegroundColor Yellow
Write-Host "aws cognito-idp list-user-pools --max-results 10 --no-cli-pager" -ForegroundColor White

Write-Host "`n3. DynamoDB Tables (Already Created):" -ForegroundColor Cyan
Write-Host "✅ codenvia-exam-users" -ForegroundColor Green
Write-Host "✅ codenvia-exam-tests" -ForegroundColor Green  
Write-Host "✅ codenvia-exam-test-results" -ForegroundColor Green
Write-Host "✅ codenvia-exam-exam-progress" -ForegroundColor Green

Write-Host "`n4. S3 Bucket (Already Created):" -ForegroundColor Cyan
Write-Host "✅ codenvia-exam-frontend-7309" -ForegroundColor Green

Write-Host "`n5. Commands to Run:" -ForegroundColor Cyan
Write-Host "After getting User Pool ID, create app client:" -ForegroundColor Yellow
Write-Host "aws cognito-idp create-user-pool-client --user-pool-id YOUR_POOL_ID --client-name codenvia-web-client --explicit-auth-flows ADMIN_NO_SRP_AUTH ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH --generate-secret false --no-cli-pager" -ForegroundColor White

Write-Host "`nCreate IAM user and access keys:" -ForegroundColor Yellow
Write-Host "aws iam create-user --user-name codenvia-exam-user --no-cli-pager" -ForegroundColor White
Write-Host "aws iam create-access-key --user-name codenvia-exam-user --no-cli-pager" -ForegroundColor White

Write-Host "`nSetup S3 bucket for hosting:" -ForegroundColor Yellow
Write-Host "aws s3 website s3://codenvia-exam-frontend-7309 --index-document index.html --error-document index.html" -ForegroundColor White

Write-Host "`n📋 Summary of What You Have:" -ForegroundColor Green
Write-Host "✅ DynamoDB tables created" -ForegroundColor Green
Write-Host "✅ S3 bucket created" -ForegroundColor Green
Write-Host "🔄 Need: User Pool ID, App Client ID, IAM Access Keys" -ForegroundColor Yellow

Write-Host "`nNext: Follow MANUAL_DEPLOYMENT_GUIDE.md for step-by-step instructions" -ForegroundColor Cyan