# Deploy script to run after IAM policy is updated
Write-Host "Deploying to S3..." -ForegroundColor Yellow

# Build the app
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build successful, syncing to S3..." -ForegroundColor Green
    
    # Sync to S3
    aws s3 sync ./dist/ s3://codenvia-exam-frontend-singapore --delete --region ap-southeast-1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Successfully deployed to S3!" -ForegroundColor Green
        Write-Host "Your app is live at: http://codenvia-exam-frontend-singapore.s3-website-ap-southeast-1.amazonaws.com" -ForegroundColor Cyan
    } else {
        Write-Host "S3 sync failed - check your IAM permissions" -ForegroundColor Red
    }
} else {
    Write-Host "Build failed" -ForegroundColor Red
}