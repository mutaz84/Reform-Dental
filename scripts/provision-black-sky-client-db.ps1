param(
    [string]$StaticWebAppName = '',
    [string]$StaticWebAppResourceGroup = '',
    [string]$SqlResourceGroupName = '',
    [string]$Location = 'eastus',
    [string]$SqlServerName = '',
    [string]$DatabaseName = 'ReformDental_BlackSky',
    [string]$SqlAdminUser = 'reformadmin',
    [Parameter(Mandatory = $true)]
    [securestring]$SqlAdminPassword,
    [string]$SkuName = 'Basic'
)

$ErrorActionPreference = 'Stop'

function Convert-ToPlainText([securestring]$Value) {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try {
        [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function Invoke-AzJson($Arguments) {
    $output = az @Arguments -o json 2>$null
    if (-not $output) { return $null }
    $output | ConvertFrom-Json
}

$account = Invoke-AzJson @('account', 'show')
if (-not $account) {
    throw 'Azure CLI is not logged in. Run az login, then rerun this script.'
}

if (-not $StaticWebAppName -or -not $StaticWebAppResourceGroup) {
    $apps = Invoke-AzJson @('staticwebapp', 'list')
    $blackSky = $apps | Where-Object { $_.defaultHostname -like 'black-sky-06e87aa10*' } | Select-Object -First 1
    if (-not $blackSky) {
        throw 'Could not find the black-sky Static Web App. Pass -StaticWebAppName and -StaticWebAppResourceGroup explicitly.'
    }
    if (-not $StaticWebAppName) { $StaticWebAppName = $blackSky.name }
    if (-not $StaticWebAppResourceGroup) { $StaticWebAppResourceGroup = $blackSky.resourceGroup }
}

if (-not $SqlResourceGroupName) { $SqlResourceGroupName = $StaticWebAppResourceGroup }
if (-not $SqlServerName) {
    $suffix = -join ((48..57) + (97..122) | Get-Random -Count 6 | ForEach-Object { [char]$_ })
    $SqlServerName = "rd-black-sky-sql-$suffix"
}

$passwordText = Convert-ToPlainText $SqlAdminPassword
$serverFqdn = "$SqlServerName.database.windows.net"
$connectionString = "Server=tcp:$serverFqdn,1433;Initial Catalog=$DatabaseName;Persist Security Info=False;User ID=$SqlAdminUser;Password=$passwordText;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

Write-Host "Using subscription: $($account.name)"
Write-Host "Static Web App: $StaticWebAppName ($StaticWebAppResourceGroup)"
Write-Host "SQL Server: $SqlServerName"
Write-Host "SQL Database: $DatabaseName"

az group create --name $SqlResourceGroupName --location $Location -o none
az sql server create --resource-group $SqlResourceGroupName --name $SqlServerName --location $Location --admin-user $SqlAdminUser --admin-password $passwordText -o none
az sql db create --resource-group $SqlResourceGroupName --server $SqlServerName --name $DatabaseName --service-objective $SkuName -o none
az sql server firewall-rule create --resource-group $SqlResourceGroupName --server $SqlServerName --name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 -o none

az staticwebapp appsettings set --name $StaticWebAppName --resource-group $StaticWebAppResourceGroup --setting-names SQL_CONNECTION_STRING="$connectionString" -o none

Write-Host 'Black-sky SQL database created and mapped to the Static Web App API.'
Write-Host 'Next: run database/schema.sql against the new database before using the app.'