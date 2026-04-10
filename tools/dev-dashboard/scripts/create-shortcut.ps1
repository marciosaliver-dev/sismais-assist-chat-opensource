$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\GMS DevOps.lnk")
$Shortcut.TargetPath = "http://localhost:5173"
$Shortcut.IconLocation = "shell32.dll,14"
$Shortcut.Description = "GMS Dev Dashboard - Realtime Operations"
$Shortcut.Save()
Write-Host "Atalho criado no Desktop: GMS DevOps.lnk"
