# Create DynamoDB Assignments Table
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Creating Assignments Table" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$TABLE_NAME = "codenvia-exam-platform-assignments"
$REGION = "ap-southeast-1"

Write-Host "Creating table: $TABLE_NAME" -ForegroundColor Yellow
Write-Host ""

# Check if table exists
$tableExists = aws dynamodb describe-table --table-name $TABLE_NAME --region $REGION 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "Table already exists!" -ForegroundColor Green
} else {
    Write-Host "Creating new table..." -ForegroundColor Cyan
    
    aws dynamodb create-table `
        --table-name $TABLE_NAME `
        --attribute-definitions AttributeName=id,AttributeType=S `
        --key-schema AttributeName=id,KeyType=HASH `
        --billing-mode PAY_PER_REQUEST `
        --region $REGION
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Table created successfully!" -ForegroundColor Green
        Write-Host "Waiting for table to be active..." -ForegroundColor Yellow
        aws dynamodb wait table-exists --table-name $TABLE_NAME --region $REGION
        Write-Host "Table is now active!" -ForegroundColor Green
    } else {
        Write-Host "Failed to create table. Check IAM permissions." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Table Ready!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan