# Test Progress Table Data
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Testing Progress Table Data" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$TABLE_NAME = "codenvia-exam-progress"
$REGION = "ap-southeast-1"

Write-Host "🔍 Scanning progress table for in-progress exams..." -ForegroundColor Yellow

try {
    # Scan table for in-progress exams
    $result = aws dynamodb scan `
        --table-name $TABLE_NAME `
        --filter-expression "#status = :status" `
        --expression-attribute-names '{\"#status\":\"status\"}' `
        --expression-attribute-values '{\":status\":{\"S\":\"in-progress\"}}' `
        --region $REGION

    if ($LASTEXITCODE -eq 0) {
        $data = $result | ConvertFrom-Json
        $count = $data.Items.Count
        
        Write-Host "📊 Found $count in-progress exams" -ForegroundColor Green
        
        if ($count -gt 0) {
            for ($i = 0; $i -lt $count; $i++) {
                $item = $data.Items[$i]
                Write-Host ""
                Write-Host "📝 Record $($i + 1):" -ForegroundColor Cyan
                Write-Host "   Student: $($item.studentName.S) ($($item.studentEmail.S))" -ForegroundColor White
                Write-Host "   Test: $($item.testTitle.S)" -ForegroundColor White
                
                if ($item.currentQuestion -and $item.currentQuestion.M) {
                    Write-Host "   Current Module: $($item.currentQuestion.M.moduleKey.S)" -ForegroundColor Yellow
                    Write-Host "   Current Question: $($item.currentQuestion.M.questionIndex.N)" -ForegroundColor Yellow
                } else {
                    Write-Host "   Current Module: unknown" -ForegroundColor Red
                    Write-Host "   Current Question: unknown" -ForegroundColor Red
                }
                
                if ($item.overallProgress -and $item.overallProgress.N) {
                    Write-Host "   Progress: $($item.overallProgress.N)%" -ForegroundColor Green
                } else {
                    Write-Host "   Progress: 0%" -ForegroundColor Yellow
                }
                
                Write-Host "   Last Updated: $($item.lastUpdated.S)" -ForegroundColor Gray
            }
        } else {
            Write-Host "❌ No in-progress exams found" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ Error scanning table" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan