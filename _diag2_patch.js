// Diagnostic v2 (simpler): alert at entry of both handlers + global error listener
const fs = require('fs');
const path = 'Update12152025_Manage Roles-Equimpent-Task-Insturments-Supplies-Scheduling System Updated.html';
let h = fs.readFileSync(path, 'utf8');

const oldDocs = "        function handleUtilityDocumentAction(utilityID, event) {\r\n            try { console.log('[UTIL-DOCS] handleUtilityDocumentAction entered, utilityID=', utilityID); } catch(_) {}\r\n            try { if (typeof showNotification === 'function') showNotification('Docs button clicked (id=' + utilityID + ')', 'info', 1500); } catch(_) {}\r\n            if (event) { event.stopPropagation(); }\r\n            if (typeof openUtilityDocumentsModal === 'function') {\r\n                try { console.log('[UTIL-DOCS] openUtilityDocumentsModal exists, calling...'); } catch(_) {}\r\n                try { openUtilityDocumentsModal(utilityID); }\r\n                catch (eOpenDocs) { try { console.error('[UTIL-DOCS] openUtilityDocumentsModal THREW:', eOpenDocs); } catch(_) {} try { if (typeof showNotification === 'function') showNotification('Docs error: ' + (eOpenDocs && eOpenDocs.message || eOpenDocs), 'error', 5000); } catch(_) {} }\r\n                return;\r\n            }\r\n            try { console.log('[UTIL-DOCS] openUtilityDocumentsModal MISSING, falling through to legacy path'); } catch(_) {}";
const newDocs = "        function handleUtilityDocumentAction(utilityID, event) {\r\n            try { alert('[DIAG-DOCS-1] click reached.\\nutilityID=' + utilityID + '\\nopenUtilityDocumentsModal type: ' + (typeof openUtilityDocumentsModal) + '\\nloadUtilities type: ' + (typeof loadUtilities)); } catch(_) {}\r\n            if (event) { event.stopPropagation(); }\r\n            if (typeof openUtilityDocumentsModal === 'function') {\r\n                try { openUtilityDocumentsModal(utilityID); try { alert('[DIAG-DOCS-2] modal call returned. Modal in DOM? ' + (!!document.getElementById('utilityDocumentsModal'))); } catch(_) {} }\r\n                catch (eOpenDocs) { try { alert('[DIAG-DOCS-THROW] ' + (eOpenDocs && eOpenDocs.stack ? eOpenDocs.stack : (eOpenDocs && eOpenDocs.message || eOpenDocs))); } catch(_) {} }\r\n                return;\r\n            }\r\n            try { alert('[DIAG-DOCS-MISSING] openUtilityDocumentsModal not a function'); } catch(_) {}";
if (!h.includes(oldDocs)) { console.error('docs v1 pattern NOT found'); process.exit(1); }
h = h.replace(oldDocs, newDocs);

const oldRet = "        function openEquipmentRetirementLog(entityKind, entityId, event) {\r\n            try { console.log('[RETIRE-LOG] openEquipmentRetirementLog entered, kind=', entityKind, ', id=', entityId); } catch(_) {}\r\n            try { if (typeof showNotification === 'function') showNotification('Retire button clicked (kind=' + entityKind + ', id=' + entityId + ')', 'info', 1500); } catch(_) {}\r\n            if (event) event.stopPropagation();\r\n            let entityName = '', currentStatus = '', defaultStatus = 'Out of Service';";
const newRet = "        function openEquipmentRetirementLog(entityKind, entityId, event) {\r\n            try { alert('[DIAG-RETIRE-1] click reached.\\nkind=' + entityKind + ' id=' + entityId + '\\nloadUtilities type: ' + (typeof loadUtilities) + '\\nloadEquipmentRetirementLog type: ' + (typeof loadEquipmentRetirementLog)); } catch(_) {}\r\n            if (event) event.stopPropagation();\r\n            let entityName = '', currentStatus = '', defaultStatus = 'Out of Service';";
if (!h.includes(oldRet)) { console.error('retire v1 pattern NOT found'); process.exit(1); }
h = h.replace(oldRet, newRet);

const errScriptMarker = '<!-- __DIAG_GLOBAL_ERR__ -->';
if (!h.includes(errScriptMarker)) {
    const headOpen = '<head>';
    const headIdx = h.indexOf(headOpen);
    if (headIdx === -1) { console.error('head tag not found'); process.exit(1); }
    const inject = "\r\n    <!-- __DIAG_GLOBAL_ERR__ -->\r\n    <script>\r\n    (function(){\r\n        var seen = 0;\r\n        window.addEventListener('error', function(e){\r\n            if (seen++ > 3) return;\r\n            try { alert('[DIAG-GLOBAL-ERR] ' + (e.message || '?') + '\\n' + (e.filename || '') + ':' + (e.lineno || '') + ':' + (e.colno || '') + (e.error && e.error.stack ? '\\n' + e.error.stack : '')); } catch(_) {}\r\n        });\r\n        window.addEventListener('unhandledrejection', function(e){\r\n            if (seen++ > 3) return;\r\n            var r = e && e.reason;\r\n            var msg = (r && (r.stack || r.message)) || String(r);\r\n            if (/api|fetch|network|500|timeout|aborted/i.test(msg)) return;\r\n            try { alert('[DIAG-GLOBAL-REJECT] ' + msg); } catch(_) {}\r\n        });\r\n    })();\r\n    </script>\r\n";
    h = h.slice(0, headIdx + headOpen.length) + inject + h.slice(headIdx + headOpen.length);
}

const oldBV = "const buildVersion = '20260608-utility-parity-diag1';";
const newBV = "const buildVersion = '20260608-utility-parity-diag2';";
if (!h.includes(oldBV)) { console.error('buildVersion NOT found'); process.exit(1); }
h = h.replace(oldBV, newBV);

fs.writeFileSync(path, h);
console.log('Patched v2. New size:', h.length);
