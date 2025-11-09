# Deploy React App to S3 - Codenvia Exam Platform
# This script builds and deploys your React application to S3

Write-Host "🚀 Starting React App Deployment to S3" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green

# Read environment variables
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^VITE_S3_BUCKET=(.+)$") {
            $bucketName = $matches[1]
        }
        if ($_ -match "^VITE_AWS_REGION=(.+)$") {
            $region = $matches[1]
        }
    }
} else {
    Write-Host "❌ .env file not found. Please run deploy-aws-services.ps1 first." -ForegroundColor Red
    exit 1
}

if (-not $bucketName) {
    Write-Host "❌ S3 bucket name not found in .env file" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Building React application..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed successfully" -ForegroundColor Green

Write-Host "`n☁️ Uploading to S3 bucket: $bucketName" -ForegroundColor Cyan

# Upload build files to S3
aws s3 sync .\dist\ s3://$bucketName --delete --region $region

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host "`n🌐 Your application is now live at:" -ForegroundColor Green
    Write-Host "http://$bucketName.s3-website-$region.amazonaws.com" -ForegroundColor Yellow
    
    Write-Host "`n📋 Application Details:" -ForegroundColor Cyan
    Write-Host "• Admin Email: admin@codenvia.com" -ForegroundColor White
    Write-Host "• Admin Password: Admin123!" -ForegroundColor White
    Write-Host "• Students can register with any email" -ForegroundColor White
    Write-Host "• All AWS services are configured and ready" -ForegroundColor White
    
} else {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 Deployment completed successfully!" -ForegroundColor Green