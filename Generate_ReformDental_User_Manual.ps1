param(
  [Parameter(Mandatory=$true)]
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

function Add-Paragraph {
  param(
    [Parameter(Mandatory=$true)] $Doc,
    [Parameter(Mandatory=$true)] [string] $Text,
    [string] $Style = 'Normal'
  )
  $p = $Doc.Paragraphs.Add()
  $p.Range.Text = $Text
  try { $p.Range.Style = $Style } catch { }
  $p.Range.InsertParagraphAfter() | Out-Null
}

function Add-Heading {
  param(
    [Parameter(Mandatory=$true)] $Doc,
    [Parameter(Mandatory=$true)] [string] $Text,
    [ValidateSet(1,2,3)] [int] $Level = 1
  )
  Add-Paragraph -Doc $Doc -Text $Text -Style ("Heading $Level")
}

function Add-Bullets {
  param(
    [Parameter(Mandatory=$true)] $Doc,
    [Parameter(Mandatory=$true)] [string[]] $Items
  )
  foreach ($item in $Items) {
    Add-Paragraph -Doc $Doc -Text $item -Style 'List Bullet'
  }
}

$word = $null
$doc = $null

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  $doc = $word.Documents.Add()

  # Title page
  Add-Paragraph -Doc $doc -Text 'ReformDental' -Style 'Title'
  Add-Paragraph -Doc $doc -Text 'Management System User Manual' -Style 'Subtitle'
  Add-Paragraph -Doc $doc -Text ('Build/Update: 12/15/2025 (Manage Roles, Equipment, Tasks, Instruments, Supplies, Scheduling System)')
  Add-Paragraph -Doc $doc -Text ('Generated: ' + (Get-Date -Format 'MMMM d, yyyy'))

  $doc.Paragraphs.Add().Range.InsertBreak(7) | Out-Null  # wdPageBreak

  # Table of contents
  Add-Heading -Doc $doc -Text 'Table of Contents' -Level 1
  $tocRange = $doc.Paragraphs.Add().Range
  $doc.TablesOfContents.Add($tocRange, $true, 1, 3) | Out-Null
  $doc.Paragraphs.Add().Range.InsertParagraphAfter() | Out-Null
  $doc.Paragraphs.Add().Range.InsertBreak(7) | Out-Null

  # 1. Getting started
  Add-Heading -Doc $doc -Text '1. Getting Started' -Level 1
  Add-Heading -Doc $doc -Text '1.1 Sign In' -Level 2
  Add-Bullets -Doc $doc -Items @(
    'Open the ReformDental Management Dashboard in your browser.',
    'Enter your Username and Password.',
    'Select Sign In.',
    'If the login fails, check for typos and contact an Administrator for access.'
  )

  Add-Heading -Doc $doc -Text '1.2 Log Out' -Level 2
  Add-Bullets -Doc $doc -Items @(
    'In the top header, open the Settings menu (hamburger icon).',
    'Select Logout.'
  )

  # 2. Screen layout
  Add-Heading -Doc $doc -Text '2. Screen Layout Overview' -Level 1
  Add-Heading -Doc $doc -Text '2.1 Header Bar' -Level 2
  Add-Paragraph -Doc $doc -Text 'The header bar appears across the top of the app and contains global controls.'
  Add-Bullets -Doc $doc -Items @(
    'Logo / Company Name: Click to return to Calendar.',
    'Clinic filter: Select a clinic or choose All Clinics.',
    'Theme preset: Select a theme (Ocean, Sunset, Forest, Professional, Soft, Vibrant, High Contrast).',
    'Accent color: Select Cyan, Blue, Purple, or Green.',
    'Dark/Light toggle: Switch the overall theme mode.',
    'User profile: Shows the current user name and role.',
    'Settings menu: Opens administrative tools (visibility depends on your permissions).'
  )

  Add-Heading -Doc $doc -Text '2.2 Left Sidebar (Primary Navigation)' -Level 2
  Add-Paragraph -Doc $doc -Text 'Use the left sidebar to move between your day-to-day work views.'
  Add-Bullets -Doc $doc -Items @(
    'Calendar',
    'MY WORK: My Schedule, My Duties, Task Hub, Requests, Projects, Sticky Notes',
    'HR & PERSONAL: My Profile, Pay Stubs, Time Off, My Documents, Benefits, Compliances, Evaluations, Onboarding'
  )

  Add-Heading -Doc $doc -Text '2.3 Right Sidebar (Operations Panels)' -Level 2
  Add-Paragraph -Doc $doc -Text 'The right sidebar contains Dental Office tools, Employee Operations, and Resources.'
  Add-Bullets -Doc $doc -Items @(
    'DENTAL OFFICE: Office Plan, Vendors, Equipment, Instruments, Supplies, Procedures',
    'EMPLOYEE OPERATIONS: Manage Schedule, Manage Tasks, Manage Duties',
    'RESOURCES: Training, Guidelines, Video Library, Support, Rolodex, Chat'
  )

  # 3. My Schedule
  Add-Heading -Doc $doc -Text '3. My Schedule (Working Hours)' -Level 1
  Add-Paragraph -Doc $doc -Text 'My Schedule shows working hours in a weekly grid and supports filtering and export.'
  Add-Heading -Doc $doc -Text '3.1 Navigate Weeks' -Level 2
  Add-Bullets -Doc $doc -Items @(
    'Use the left/right arrow buttons to move between weeks.',
    'Select Today to jump back to the current week.'
  )
  Add-Heading -Doc $doc -Text '3.2 Filters and Actions' -Level 2
  Add-Bullets -Doc $doc -Items @(
    'Filters: Type (Clinical/Non-Clinical), Role, Employee, Clinic, Room.',
    'Clear: Reset all filters.',
    'Refresh: Reload schedule data.',
    'Conflicts: Check for scheduling conflicts.',
    'Print: Print the schedule.',
    'PDF: Export the schedule to PDF.'
  )

  # 4. Manage Schedule (Schedule Builder)
  Add-Heading -Doc $doc -Text '4. Manage Schedule (Schedule Builder)' -Level 1
  Add-Paragraph -Doc $doc -Text 'Open Manage Schedule from the right sidebar (Employee Operations). The Schedule Builder offers two ways to create schedules.'

  Add-Heading -Doc $doc -Text '4.1 Table Builder (Excel Mode)' -Level 2
  Add-Bullets -Doc $doc -Items @(
    'Use Add Row or Add 5 Rows for quick bulk entry.',
    'Use the filters (Type, Role, Employee, Provider, Clinic, Room, Status) to narrow what you see while working.',
    'Use Back to return to the Schedule Builder chooser, or Close to exit.'
  )

  Add-Heading -Doc $doc -Text '4.2 Relational Builder (Guided Mode)' -Level 2
  Add-Bullets -Doc $doc -Items @(
    'Choose Provider First or Employee First depending on your workflow.',
    'Follow the on-screen workflow (Provider  Clinic  Room  Assistant(s)  Dates  Time).',
    'Select Start Building to launch the guided builder.'
  )

  # 5. Manage Tasks
  Add-Heading -Doc $doc -Text '5. Manage Tasks' -Level 1
  Add-Paragraph -Doc $doc -Text 'Open Manage Tasks from the right sidebar (Employee Operations). This view is used to create and manage tasks across the organization.'
  Add-Bullets -Doc $doc -Items @(
    'Create tasks: New Task, New Floating Task, New Bonus Task.',
    'Templates: Use Manage Templates to maintain reusable task templates.',
    'Search: Use the search box to find tasks by keyword.',
    'Filter: All Tasks, Regular Only, Floating Only, Bonus Only, Active Only, Completed.'
  )

  # 6. Manage Duties
  Add-Heading -Doc $doc -Text '6. Duties' -Level 1
  Add-Heading -Doc $doc -Text '6.1 My Duties' -Level 2
  Add-Paragraph -Doc $doc -Text 'Open My Duties from the left sidebar (MY WORK) to review assigned duties.'

  Add-Heading -Doc $doc -Text '6.2 Manage Duties' -Level 2
  Add-Paragraph -Doc $doc -Text 'Open Manage Duties from the right sidebar (Employee Operations) to create and maintain duties used throughout the app.'

  # 7. Dental Office Inventory Tools
  Add-Heading -Doc $doc -Text '7. Dental Office Inventory' -Level 1

  Add-Heading -Doc $doc -Text '7.1 Equipment Management' -Level 2
  Add-Paragraph -Doc $doc -Text 'Open Equipment from the right sidebar (DENTAL OFFICE).'
  Add-Bullets -Doc $doc -Items @(
    'Equipment Inventory table includes: Equipment Name, Category, Location, Status, Next Service, Actions.',
    'Select Add New Equipment to open the add/edit form.',
    'Key fields include: Equipment Name, Equipment Type, Manufacturer, Model, Serial Number, Purchase Date, Warranty Expiry, Last Service Date, Next Service Due, Office, Room, Vendor, Price, Status, Condition, Notes, and Active toggle.',
    'Uploads: Equipment Image (max 5MB) and PDF documents (manuals, warranties, service records).'
  )

  Add-Heading -Doc $doc -Text '7.2 Instruments Management' -Level 2
  Add-Paragraph -Doc $doc -Text 'Open Instruments from the right sidebar (DENTAL OFFICE).'
  Add-Bullets -Doc $doc -Items @(
    'Instruments Inventory table includes: Instrument Name, Category, Quantity, Condition, Location, Actions.',
    'Select Add New Instrument to add or edit instrument records.',
    'Key fields include: Instrument Name, Category (including custom category), Type, Manufacturer, Office, Room, Vendor, Notes.',
    'Uploads: Instrument Image (max 5MB) and PDF documents (care instructions, specifications).'
  )

  Add-Heading -Doc $doc -Text '7.3 Supplies Management' -Level 2
  Add-Paragraph -Doc $doc -Text 'Open Supplies from the right sidebar (DENTAL OFFICE).'
  Add-Bullets -Doc $doc -Items @(
    'Supplies Inventory table includes: Supply Name, Category, Stock, Reorder Level, Expiration, Actions.',
    'Select Add New Supply to create or edit supply records.',
    'Key fields include: Supply Name, Category, SKU/Item Number, Manufacturer/Brand, Qty in Stock, Unit, Reorder Level, and Expiration (when applicable).'
  )

  # 8. Administration
  Add-Heading -Doc $doc -Text '8. Administration and Settings' -Level 1
  Add-Paragraph -Doc $doc -Text 'Administrative options appear under the Settings menu in the top header. Menu items may be hidden if your account does not have permission.'

  Add-Heading -Doc $doc -Text '8.1 Common Settings Menu Items' -Level 2
  Add-Bullets -Doc $doc -Items @(
    'Master Settings',
    'Manage Clinics',
    'Manage Rooms',
    'Manage Users',
    'Manage Roles',
    'Manage Permissions',
    'Password Manager',
    'Reset Data',
    'Logout'
  )

  Add-Heading -Doc $doc -Text '8.2 Roles Management' -Level 2
  Add-Paragraph -Doc $doc -Text 'Open Manage Roles from the Settings menu.'
  Add-Bullets -Doc $doc -Items @(
    'Existing Roles table includes: Role Name, Description, Duties, File, Actions.',
    'Select Add New Role to create a role.',
    'Role form fields include: Role Name (required), Description, Duties, Responsibilities, and optional file upload (PDF, DOC, DOCX, TXT).'
  )

  Add-Heading -Doc $doc -Text '8.3 Password Manager (Vendor Credentials)' -Level 2
  Add-Paragraph -Doc $doc -Text 'Open Password Manager from the Settings menu (requires permission).'
  Add-Bullets -Doc $doc -Items @(
    'Search vendors using the search box.',
    'Export credentials list using Export.',
    'The table includes: Vendor, Type, Website, Username, Password, Actions.'
  )

  # 9. Troubleshooting
  Add-Heading -Doc $doc -Text '9. Troubleshooting' -Level 1
  Add-Bullets -Doc $doc -Items @(
    'Missing menu items: Your role may not have permission for that feature.',
    'Schedule not updating: Use Refresh in My Schedule or reopen the Schedule Builder.',
    'Unable to edit tasks: Use Manage Tasks for the full editor.',
    'Upload issues: Confirm file types (images for pictures; PDF for equipment/instrument documents; multiple formats for role documents) and size limits where shown.'
  )

  # Update TOC and save
  if ($doc.TablesOfContents.Count -gt 0) { $doc.TablesOfContents.Item(1).Update() | Out-Null }

  $null = New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath)
  $doc.SaveAs2($OutputPath, 16) | Out-Null
}
finally {
  if ($doc) { try { $doc.Close($true) | Out-Null } catch {} }
  if ($word) { try { $word.Quit() | Out-Null } catch {} }
  if ($doc) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($doc) }
  if ($word) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
