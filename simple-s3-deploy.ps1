Write-Host "Building React app..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build successful! Deploying to S3..." -ForegroundColor Green
    
    # Read bucket name from .env
    $bucketName = "codenvia-exam-frontend-singapore"
    $region = "ap-southeast-1"
    
    if (Test-Path ".env") {
        $envContent = Get-Content ".env"
        foreach ($line in $envContent) {
            if ($line -match "^VITE_S3_BUCKET=(.+)$") {
                $bucketName = $matches[1]
            }
            if ($line -match "^VITE_AWS_REGION=(.+)$") {
                $region = $matches[1]
            }
        }
    }
    
    Write-Host "Uploading to bucket: $bucketName in region: $region" -ForegroundColor Yellow
    
    # Deploy to S3
    aws s3 sync .\dist\ s3://$bucketName --delete --region $region
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Deployment successful!" -ForegroundColor Green
        Write-Host "Live URL: http://$bucketName.s3-website-$region.amazonaws.com" -ForegroundColor Cyan
    } else {
        Write-Host "Deployment failed - check your AWS permissions" -ForegroundColor Red
    }
} else {
    Write-Host "Build failed!" -ForegroundColor Red
}