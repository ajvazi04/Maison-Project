$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$apiProject = Join-Path $projectRoot "Maison.Api\Maison.Api.csproj"

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw ".NET SDK nuk u gjet. Instalo .NET 10 SDK dhe provo përsëri."
}

if (-not (Test-Path $apiProject)) {
    throw "Nuk u gjet projekti API: $apiProject"
}

$frontendListener = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
if (-not $frontendListener) {
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm nuk u gjet. Instalo Node.js dhe provo përsëri."
    }

    Write-Host "Po niset frontend-i në një dritare të veçantë..."
    $frontendProcess = Start-Process -FilePath $env:ComSpec `
        -ArgumentList @("/c", "npm run dev:frontend") `
        -WorkingDirectory $projectRoot `
        -PassThru
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 250
        $frontendListener = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($frontendListener) { break }
        if ($frontendProcess.HasExited) {
            throw "Frontend-i nuk u nis. Kontrollo dritaren e tij; nëse mungojnë paketat, ekzekuto npm install në dosjen e projektit."
        }
    }
    if (-not $frontendListener) {
        throw "Frontend-i nuk u përgjigj në portin 4173. Kontrollo dritaren e tij dhe provo përsëri."
    }
}
else {
    Write-Host "Frontend-i është tashmë aktiv në portin 4173."
}

$apiDirectory = Join-Path $projectRoot "Maison.Api"
$listener = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
if ($listener) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
    $expectedApiPrefix = [System.IO.Path]::GetFullPath((Join-Path $apiDirectory "bin")) +
        [System.IO.Path]::DirectorySeparatorChar
    $actualProcessPath = $process.ExecutablePath
    if ($process.Name -ne "Maison.Api.exe" -or
        -not $actualProcessPath.StartsWith($expectedApiPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Porti 5000 është zënë nga një program tjetër (PID $($listener.OwningProcess)). Mbylle atë dhe provo sërish."
    }

    Write-Host "Po rinis API-n ekzistuese për të përdorur kredencialet e reja..."
    Stop-Process -Id $listener.OwningProcess -ErrorAction Stop
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 250
        $listener = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if (-not $listener) { break }
    }
    if ($listener) {
        throw "API-ja e vjetër nuk u ndal. Mbylle procesin Maison.Api.exe dhe provo përsëri."
    }
}

$username = Read-Host "Admin username (press Enter for admin)"
if ([string]::IsNullOrWhiteSpace($username)) {
    $username = "admin"
}

$securePassword = $null
while ($null -eq $securePassword -or $securePassword.Length -lt 12) {
    if ($null -ne $securePassword) {
        $securePassword.Dispose()
        Write-Host "Password must be at least 12 characters. Try again."
    }
    $securePassword = Read-Host "Create admin password (12+ characters; input is hidden)" -AsSecureString
}

$passwordPointer = [IntPtr]::Zero
try {
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $env:ADMIN_USERNAME = $username
    $env:ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $env:ASPNETCORE_ENVIRONMENT = "Development"

    Push-Location $projectRoot
    try {
        $defaultRoute = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
            Sort-Object RouteMetric |
            Select-Object -First 1
        $lanAddress = $null
        if ($defaultRoute) {
            $lanAddress = Get-NetIPAddress -InterfaceIndex $defaultRoute.InterfaceIndex `
                -AddressFamily IPv4 -ErrorAction SilentlyContinue |
                Where-Object { $_.IPAddress -ne "127.0.0.1" } |
                Select-Object -First 1 -ExpandProperty IPAddress
        }
        if (-not $lanAddress) {
            $lanAddress = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
                Where-Object {
                    $_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)' -and
                    $_.InterfaceAlias -notmatch 'Virtual|vEthernet|WSL|Loopback|VMware|VirtualBox|Docker'
                } |
                Select-Object -First 1 -ExpandProperty IPAddress
        }
        Write-Host "API: http://localhost:5000/health"
        Write-Host "Shop: http://localhost:4173"
        $env:Payments__FrontendBaseUrl = "http://localhost:4173"
        if ($lanAddress) {
            $env:AllowedHosts = "localhost;127.0.0.1;$lanAddress"
            $env:Payments__FrontendBaseUrl = "http://$($lanAddress):4173"
            Write-Host "Phone on the same Wi-Fi: http://$($lanAddress):4173"
        }
        else {
            $env:AllowedHosts = "localhost;127.0.0.1"
            Write-Host "No private Wi-Fi address found. Phone access may require checking the active network adapter."
        }
        Write-Host "Keep this window open. Stop the API with Ctrl+C."
        dotnet run --project $apiProject --no-launch-profile --urls "http://0.0.0.0:5000"
        if ($LASTEXITCODE -ne 0) {
            throw "The API stopped with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
    Remove-Item Env:ADMIN_USERNAME -ErrorAction SilentlyContinue
    Remove-Item Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:ASPNETCORE_ENVIRONMENT -ErrorAction SilentlyContinue
    Remove-Item Env:AllowedHosts -ErrorAction SilentlyContinue
    Remove-Item Env:Payments__FrontendBaseUrl -ErrorAction SilentlyContinue
    $securePassword.Dispose()
}
