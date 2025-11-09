Write-Host "Getting AWS Resource Information..." -ForegroundColor Green

$env:AWS_PAGER = ""

Write-Host "Account Info:" -ForegroundColor Cyan
Write-Host "Run: aws sts get-caller-identity" -ForegroundColor White

Write-Host "`nDynamoDB Tables (Already Created):" -ForegroundColor Cyan
Write-Host "codenvia-exam-users" -ForegroundColor Green
Write-Host "codenvia-exam-tests" -ForegroundColor Green  
Write-Host "codenvia-exam-test-results" -ForegroundColor Green
Write-Host "codenvia-exam-exam-progress" -ForegroundColor Green

Write-Host "`nS3 Bucket (Already Created):" -ForegroundColor Cyan
Write-Host "codenvia-exam-frontend-7309" -ForegroundColor Green

Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "1. Get User Pool ID: aws cognito-idp list-user-pools --max-results 10" -ForegroundColor White
Write-Host "2. Create App Client with the User Pool ID" -ForegroundColor White
Write-Host "3. Create IAM user and access keys" -ForegroundColor White
Write-Host "4. Update .env file with the values" -ForegroundColor White
Write-Host "5. Build and deploy: npm run build" -ForegroundColor White