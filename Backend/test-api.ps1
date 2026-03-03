# PowerShell API Testing Script for NLP Service
Write-Host "Testing NLP Chatbot Service API" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3002"

# Test 1: Health Check
Write-Host "1. Testing Health Endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health" -Method GET
    Write-Host "SUCCESS: Health endpoint responding" -ForegroundColor Green
} catch {
    Write-Host "FAILED: Health check failed" -ForegroundColor Red
}

# Test 2: NLP Analysis (will fail without token)
Write-Host "2. Testing NLP Analysis..." -ForegroundColor Yellow
$testData = '{"text": "This is a test message", "community_id": 1}'
$headers = @{
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/nlp/analyze" -Method POST -Headers $headers -Body $testData
    Write-Host "UNEXPECTED: NLP analysis worked without auth" -ForegroundColor Yellow
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "EXPECTED: Authentication required (401)" -ForegroundColor Green
    } else {
        Write-Host "FAILED: Unexpected error" -ForegroundColor Red
    }
}

Write-Host "API Testing Complete!" -ForegroundColor Cyan