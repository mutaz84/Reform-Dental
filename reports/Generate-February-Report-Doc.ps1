$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$start = '2026-02-01'
$end = '2026-02-29 23:59:59'

$commitLines = git log --since="$start" --until="$end" --date=short --reverse --pretty=format:"%ad|%h|%s"
if (-not $commitLines) {
    throw 'No February 2026 commits found.'
}

$commitObjects = foreach ($line in $commitLines) {
    $parts = $line -split '\|', 3
    [PSCustomObject]@{
        Date = $parts[0]
        Hash = $parts[1]
        Subject = $parts[2]
    }
}

$totalCommits = ($commitObjects | Measure-Object).Count
$firstCommit = $commitObjects | Select-Object -First 1
$lastCommit = $commitObjects | Select-Object -Last 1

$topFiles = git log --since="$start" --until="$end" --name-only --pretty=format: |
    Where-Object { $_ -and $_.Trim() -ne '' } |
    Group-Object |
    Sort-Object Count -Descending |
    Select-Object -First 15

$groupedByDate = $commitObjects | Group-Object Date | Sort-Object Name

$reportLines = New-Object System.Collections.Generic.List[string]
$reportLines.Add('Reform Dental - Complete February 2026 Development Report')
$reportLines.Add('Generated: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
$reportLines.Add('')
$reportLines.Add('Summary')
$reportLines.Add('Total commits: ' + $totalCommits)
$reportLines.Add('Commit range: ' + $firstCommit.Date + ' (' + $firstCommit.Hash + ') to ' + $lastCommit.Date + ' (' + $lastCommit.Hash + ')')
$reportLines.Add('')
$reportLines.Add('Most changed files (Top 15)')
foreach ($f in $topFiles) {
    $reportLines.Add('- ' + $f.Name + ' (' + $f.Count + ' commits)')
}
$reportLines.Add('')
$reportLines.Add('All February Commits (Grouped by Date)')

foreach ($group in $groupedByDate) {
    $reportLines.Add('')
    $reportLines.Add('Date: ' + $group.Name + ' | Commits: ' + $group.Count)
    foreach ($c in $group.Group) {
        $reportLines.Add('  - ' + $c.Hash + ' | ' + $c.Subject)
    }
}

$txtPath = Join-Path $PSScriptRoot 'february-2026-complete-report.txt'
$docxPath = Join-Path $PSScriptRoot 'february-2026-complete-report.docx'

$reportLines | Set-Content -Path $txtPath -Encoding UTF8

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $doc = $word.Documents.Add()
    $selection = $word.Selection

    foreach ($line in $reportLines) {
        $selection.TypeText($line)
        $selection.TypeParagraph()
    }

    $wdFormatXMLDocument = 12
    $doc.SaveAs2($docxPath, $wdFormatXMLDocument)
    $doc.Close()
    $word.Quit()

    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($selection) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($doc) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null

    Write-Output ('DOCX_CREATED=' + $docxPath)
    Write-Output ('TXT_CREATED=' + $txtPath)
}
catch {
    Write-Output 'DOCX_CREATION_FAILED'
    Write-Output $_.Exception.Message
    Write-Output ('TXT_CREATED=' + $txtPath)
    exit 1
}
