# Recorta regiones candidatas de branding/tito.png para revisarlas a ojo.
# Uso: powershell -File scripts/crop-tito.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'apps\game\public\assets\branding\tito.png'
$out = Join-Path $root '.tito-crops'
New-Item -ItemType Directory -Force -Path $out | Out-Null

# Bounding box del personaje (calculado por scripts/analyze-tito.mjs)
$bx = 200; $by = 39; $bw = 743; $bh = 1148

# nombre, x, y, w, h  (fracciones del bounding box)
$parts = @(
  @('head',      0.20, 0.00, 0.66, 0.42),
  @('torso',     0.28, 0.34, 0.50, 0.34),
  @('cape',      0.00, 0.34, 0.34, 0.34),
  @('armBack',   0.26, 0.38, 0.28, 0.32),
  @('armFront',  0.68, 0.26, 0.34, 0.38),
  @('legBack',   0.12, 0.60, 0.40, 0.42),
  @('legFront',  0.48, 0.60, 0.54, 0.42)
)

$img = [System.Drawing.Image]::FromFile($src)
foreach ($p in $parts) {
  $name = $p[0]
  $x = $bx + [int]($p[1] * $bw)
  $y = $by + [int]($p[2] * $bh)
  $w = [int]($p[3] * $bw)
  $h = [int]($p[4] * $bh)
  $rect = New-Object System.Drawing.Rectangle $x, $y, $w, $h
  $crop = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($crop)
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), $rect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $crop.Save((Join-Path $out "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose()
  Write-Host "$name -> $x,$y ${w}x${h}"
}
$img.Dispose()
