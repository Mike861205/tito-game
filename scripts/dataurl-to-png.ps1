# Convierte un archivo con un data URL (base64) en PNG.
# Uso: powershell -File scripts/dataurl-to-png.ps1 <entrada.txt> <salida.png>
param([Parameter(Mandatory)][string]$In, [Parameter(Mandatory)][string]$Out)
$text = Get-Content -Raw -LiteralPath $In
$m = [regex]::Match($text, 'base64,([A-Za-z0-9+/=]+)')
if (-not $m.Success) { throw "No se encontro un data URL base64 en $In" }
[IO.File]::WriteAllBytes($Out, [Convert]::FromBase64String($m.Groups[1].Value))
Write-Host "$Out  ($((Get-Item $Out).Length) bytes)"
