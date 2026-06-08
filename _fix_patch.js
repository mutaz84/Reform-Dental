// FIX: Export loadUtilities + saveUtilities + setUtilityServiceDashFilter to window
// so cross-IIFE callers (block 7 retire-log, block 23 docs subsystem,
// global dashboard buttons) can see them. Also revert all DIAG popups and
// the global error listener. Bump buildVersion.
const fs = require('fs');
const path = 'Update12152025_Manage Roles-Equimpent-Task-Insturments-Supplies-Scheduling System Updated.html';
let h = fs.readFileSync(path, 'utf8');

// 1. Revert DIAG docs tracer back to original
const diagDocs = "        function handleUtilityDocumentAction(utilityID, event) {\r\n            try { alert('[DIAG-DOCS-1] click reached.\\nutilityID=' + utilityID + '\\nopenUtilityDocumentsModal type: ' + (typeof openUtilityDocumentsModal) + '\\nloadUtilities type: ' + (typeof loadUtilities)); } catch(_) {}\r\n            if (event) { event.stopPropagation(); }\r\n            if (typeof openUtilityDocumentsModal === 'function') {\r\n                try { openUtilityDocumentsModal(utilityID); try { alert('[DIAG-DOCS-2] modal call returned. Modal in DOM? ' + (!!document.getElementById('utilityDocumentsModal'))); } catch(_) {} }\r\n                catch (eOpenDocs) { try { alert('[DIAG-DOCS-THROW] ' + (eOpenDocs && eOpenDocs.stack ? eOpenDocs.stack : (eOpenDocs && eOpenDocs.message || eOpenDocs))); } catch(_) {} }\r\n                return;\r\n            }\r\n            try { alert('[DIAG-DOCS-MISSING] openUtilityDocumentsModal not a function'); } catch(_) {}";
const origDocs = "        function handleUtilityDocumentAction(utilityID, event) {\r\n            if (event) { event.stopPropagation(); }\r\n            if (typeof openUtilityDocumentsModal === 'function') { openUtilityDocumentsModal(utilityID); return; }";
if (!h.includes(diagDocs)) { console.error('diag docs pattern NOT found'); process.exit(1); }
h = h.replace(diagDocs, origDocs);

// 2. Revert DIAG retire tracer back to original
const diagRet = "        function openEquipmentRetirementLog(entityKind, entityId, event) {\r\n            try { alert('[DIAG-RETIRE-1] click reached.\\nkind=' + entityKind + ' id=' + entityId + '\\nloadUtilities type: ' + (typeof loadUtilities) + '\\nloadEquipmentRetirementLog type: ' + (typeof loadEquipmentRetirementLog)); } catch(_) {}\r\n            if (event) event.stopPropagation();\r\n            let entityName = '', currentStatus = '', defaultStatus = 'Out of Service';";
const origRet = "        function openEquipmentRetirementLog(entityKind, entityId, event) {\r\n            if (event) event.stopPropagation();\r\n            let entityName = '', currentStatus = '', defaultStatus = 'Out of Service';";
if (!h.includes(diagRet)) { console.error('diag retire pattern NOT found'); process.exit(1); }
h = h.replace(diagRet, origRet);

// 3. Remove global error listener script
const diagBlock = "\r\n    <!-- __DIAG_GLOBAL_ERR__ -->\r\n    <script>\r\n    (function(){\r\n        var seen = 0;\r\n        window.addEventListener('error', function(e){\r\n            if (seen++ > 3) return;\r\n            try { alert('[DIAG-GLOBAL-ERR] ' + (e.message || '?') + '\\n' + (e.filename || '') + ':' + (e.lineno || '') + ':' + (e.colno || '') + (e.error && e.error.stack ? '\\n' + e.error.stack : '')); } catch(_) {}\r\n        });\r\n        window.addEventListener('unhandledrejection', function(e){\r\n            if (seen++ > 3) return;\r\n            var r = e && e.reason;\r\n            var msg = (r && (r.stack || r.message)) || String(r);\r\n            if (/api|fetch|network|500|timeout|aborted/i.test(msg)) return;\r\n            try { alert('[DIAG-GLOBAL-REJECT] ' + msg); } catch(_) {}\r\n        });\r\n    })();\r\n    </script>\r\n";
if (!h.includes(diagBlock)) { console.error('diag block pattern NOT found'); process.exit(1); }
h = h.replace(diagBlock, '');

// 4. Add the missing window exports inside the utilities IIFE export block
const exportAnchor = "        window.removeUtilityCardImage          = removeUtilityCardImage;\r\n\r\n    })();";
const exportFixed = "        window.removeUtilityCardImage          = removeUtilityCardImage;\r\n        // --- Cross-IIFE accessors required by retirement log (block 7),\r\n        //     document subsystem (block 23), and dashboard buttons ---\r\n        window.loadUtilities                  = loadUtilities;\r\n        window.saveUtilities                  = saveUtilities;\r\n        if (typeof setUtilityServiceDashFilter === 'function') {\r\n            window.setUtilityServiceDashFilter = setUtilityServiceDashFilter;\r\n        }\r\n\r\n    })();";
if (!h.includes(exportAnchor)) { console.error('export anchor NOT found'); process.exit(1); }
h = h.replace(exportAnchor, exportFixed);

// 5. Bump buildVersion
const oldBV = "const buildVersion = '20260608-utility-parity-diag2';";
const newBV = "const buildVersion = '20260608-utility-parity-fix';";
if (!h.includes(oldBV)) { console.error('buildVersion NOT found'); process.exit(1); }
h = h.replace(oldBV, newBV);

fs.writeFileSync(path, h);
console.log('Fix applied. New size:', h.length);
