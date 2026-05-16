"""
Script: add-utilities-nav.py
Inserts the 'Utilities' nav link into all sidebar nav sections in the HTML file.
Handles 3 indentation patterns (32, 28, 36 spaces).
"""

import re, sys, os

FILE = r"c:\Users\MaxRa\OneDrive\Desktop\Application Development\Deployment\Reform-Dental\Update12152025_Manage Roles-Equimpent-Task-Insturments-Supplies-Scheduling System Updated.html"

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

original_length = len(content)
total_replacements = 0

# --- Pattern A: 32-space indent (main left sidebar + duties right rail) ---
old_A = (
    '                                <a href="#" class="nav-item" data-equipment-ns="office" onclick="switchToEquipmentNs(\'office\', event); return false;">\n'
    '                                    <i class="fas fa-desktop"></i>\n'
    '                                    <span>Office Equipment</span>\n'
    '                                </a>\n'
    '                                <a href="#" class="nav-item" onclick="switchContentView(\'instruments\', event); return false;">'
)
new_A = (
    '                                <a href="#" class="nav-item" data-equipment-ns="office" onclick="switchToEquipmentNs(\'office\', event); return false;">\n'
    '                                    <i class="fas fa-desktop"></i>\n'
    '                                    <span>Office Equipment</span>\n'
    '                                </a>\n'
    '                                <a href="#" class="nav-item" onclick="switchContentView(\'utilities\', event); return false;">\n'
    '                                    <i class="fas fa-bolt"></i>\n'
    '                                    <span>Utilities</span>\n'
    '                                </a>\n'
    '                                <a href="#" class="nav-item" onclick="switchContentView(\'instruments\', event); return false;">'
)
count_A = content.count(old_A)
content = content.replace(old_A, new_A)
print(f"Pattern A (32-space): {count_A} replacements")
total_replacements += count_A

# --- Pattern B: 28-space indent (view-equipment right rail) ---
old_B = (
    '                            <a href="#" class="nav-item" data-equipment-ns="office" onclick="switchToEquipmentNs(\'office\', event); return false;">\n'
    '                                <i class="fas fa-desktop"></i>\n'
    '                                <span>Office Equipment</span>\n'
    '                            </a>\n'
    '                            <a href="#" class="nav-item" onclick="switchContentView(\'instruments\', event); return false;">'
)
new_B = (
    '                            <a href="#" class="nav-item" data-equipment-ns="office" onclick="switchToEquipmentNs(\'office\', event); return false;">\n'
    '                                <i class="fas fa-desktop"></i>\n'
    '                                <span>Office Equipment</span>\n'
    '                            </a>\n'
    '                            <a href="#" class="nav-item" onclick="switchContentView(\'utilities\', event); return false;">\n'
    '                                <i class="fas fa-bolt"></i>\n'
    '                                <span>Utilities</span>\n'
    '                            </a>\n'
    '                            <a href="#" class="nav-item" onclick="switchContentView(\'instruments\', event); return false;">'
)
count_B = content.count(old_B)
content = content.replace(old_B, new_B)
print(f"Pattern B (28-space): {count_B} replacements")
total_replacements += count_B

# --- Pattern C: 36-space indent (vendors/instruments/supplies right rails) ---
old_C = (
    '                                    <a href="#" class="nav-item" data-equipment-ns="office" onclick="switchToEquipmentNs(\'office\', event); return false;">\n'
    '                                        <i class="fas fa-desktop"></i>\n'
    '                                        <span>Office Equipment</span>\n'
    '                                    </a>\n'
    '                                    <a href="#" class="nav-item" onclick="switchContentView(\'instruments\', event); return false;">'
)
new_C = (
    '                                    <a href="#" class="nav-item" data-equipment-ns="office" onclick="switchToEquipmentNs(\'office\', event); return false;">\n'
    '                                        <i class="fas fa-desktop"></i>\n'
    '                                        <span>Office Equipment</span>\n'
    '                                    </a>\n'
    '                                    <a href="#" class="nav-item" onclick="switchContentView(\'utilities\', event); return false;">\n'
    '                                        <i class="fas fa-bolt"></i>\n'
    '                                        <span>Utilities</span>\n'
    '                                    </a>\n'
    '                                    <a href="#" class="nav-item" onclick="switchContentView(\'instruments\', event); return false;">'
)
count_C = content.count(old_C)
content = content.replace(old_C, new_C)
print(f"Pattern C (36-space): {count_C} replacements")
total_replacements += count_C

print(f"\nTotal nav insertions: {total_replacements}")
print(f"File size before: {original_length}, after: {len(content)}")

if total_replacements == 0:
    print("WARNING: No replacements made! Check the patterns.")
    sys.exit(1)

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)
print("File saved successfully.")
