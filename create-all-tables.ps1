# Create All Required DynamoDB Tables
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Creating All Required DynamoDB Tables" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$REGION = "ap-southeast-1"
$TABLES = @(
    "codenvia-exam-platform-schedules",
    "codenvia-exam-platform-reassignments", 
    "codenvia-exam-platform-assignments",
    "codenvia-exam-platform-exams",
    "codenvia-exam-platform-results"
)

foreach ($TABLE_NAME in $TABLES) {
    Write-Host "Processing table: $TABLE_NAME" -ForegroundColor Yellow
    
    # Check if table exists
    $tableExists = aws dynamodb describe-table --table-name $TABLE_NAME --region $REGION 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Table '$TABLE_NAME' already exists" -ForegroundColor Green
    } else {
        Write-Host "Creating new table '$TABLE_NAME'..." -ForegroundColor Cyan
        
        aws dynamodb create-table `
            --table-name $TABLE_NAME `
            --attribute-definitions AttributeName=id,AttributeType=S `
            --key-schema AttributeName=id,KeyType=HASH `
            --billing-mode PAY_PER_REQUEST `
            --region $REGION
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Table '$TABLE_NAME' created successfully!" -ForegroundColor Green
            Write-Host "Waiting for table to be active..." -ForegroundColor Yellow
            aws dynamodb wait table-exists --table-name $TABLE_NAME --region $REGION
            Write-Host "Table '$TABLE_NAME' is now active!" -ForegroundColor Green
        } else {
            Write-Host "Failed to create table '$TABLE_NAME'" -ForegroundColor Red
            Write-Host "Check IAM permissions first!" -ForegroundColor Red
        }
    }
    Write-Host ""
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Table Creation Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary of Tables:" -ForegroundColor White
foreach ($TABLE_NAME in $TABLES) {
    Write-Host "- $TABLE_NAME" -ForegroundColor Gray
}
Write-Host ""
Write-Host "Next: Update your IAM policy with policy-all-tables-permissions.json" -ForegroundColor Yellow