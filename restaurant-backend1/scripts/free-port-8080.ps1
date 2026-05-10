# Giai phong tcp 8080 (truong hop Stop IntelliJ de lai tien trinh Java cu).
# Chay trong PowerShell (tu thuc muc backend): .\scripts\free-port-8080.ps1

$listeners = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
if (-not $listeners) {
    Write-Host "Port 8080 dang trong."
    exit 0
}
foreach ($conn in $listeners) {
    $pid = [int]$conn.OwningProcess
    if ($pid -lt 1) { continue }
    try {
        $p = Get-Process -Id $pid -ErrorAction Stop
        Write-Host "Stopping PID $pid ($($p.ProcessName)) tren port 8080..."
        Stop-Process -Id $pid -Force -ErrorAction Stop
    } catch {
        Write-Warning "Khong ket thuc PID $pid : $($_.Exception.Message)"
    }
}
