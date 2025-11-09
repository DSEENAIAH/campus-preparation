# Script to update IAM policy with S3 permissions for deployment

Write-Host "Updating IAM Policy for S3 Access..." -ForegroundColor Cyan

# Check if policy exists
$policyArn = "arn:aws:iam::292085144687:policy/codenvia-exam-policy"

try {
    # Create new policy version with S3 permissions
    aws iam create-policy-version --policy-arn $policyArn --policy-document file://updated-iam-policy.json --set-as-default --region ap-southeast-1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "IAM Policy updated successfully!" -ForegroundColor Green
        Write-Host "Now trying to deploy to S3..." -ForegroundColor Yellow
        
        # Wait a moment for policy to propagate
        Start-Sleep -Seconds 5
        
        # Try S3 sync again
        aws s3 sync ./dist/ s3://codenvia-exam-frontend-singapore --delete --region ap-southeast-1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Successfully deployed to S3!" -ForegroundColor Green
            Write-Host "Your app should be updated at: http://codenvia-exam-frontend-singapore.s3-website-ap-southeast-1.amazonaws.com" -ForegroundColor Cyan
        } else {
            Write-Host "S3 deployment failed. Check your credentials." -ForegroundColor Red
        }
    } else {
        Write-Host "Failed to update IAM policy" -ForegroundColor Red
    }
} catch {
    Write-Host "Error updating policy" -ForegroundColor Red
}