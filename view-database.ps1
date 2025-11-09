# DynamoDB Database Viewer Script
Write-Host "Codenvia Exam Platform - Database Viewer" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green

$env:AWS_PAGER = ""

Write-Host "`n1. Users Table (Enterprise):" -ForegroundColor Cyan
aws dynamodb scan --table-name codenvia-exam-platform-users --region ap-southeast-1 --no-cli-pager

Write-Host "`n2. Tests Table (Enterprise):" -ForegroundColor Cyan  
aws dynamodb scan --table-name codenvia-exam-platform-tests --region ap-southeast-1 --no-cli-pager

Write-Host "`n3. Test Results Table (Enterprise):" -ForegroundColor Cyan
aws dynamodb scan --table-name codenvia-exam-platform-test-results --region ap-southeast-1 --no-cli-pager

Write-Host "`n4. Exam Progress Table (Enterprise):" -ForegroundColor Cyan
aws dynamodb scan --table-name codenvia-exam-platform-exam-progress --region ap-southeast-1 --no-cli-pager

Write-Host "`nDatabase scan complete!" -ForegroundColor Green