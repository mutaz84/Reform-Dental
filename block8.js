
/* ==== ADDED: Theme/Font color + Fullscreen wiring ==== */
(function() {
  const root = document.documentElement;
  // restore saved prefs
  const savedAccent    = localStorage.getItem('accent');
  const savedFontColor = localStorage.getItem('fontColor');
  if (savedAccent)    root.setAttribute('data-accent', savedAccent);
  if (savedFontColor) root.setAttribute('data-fontcolor', savedFontColor);

  // dropdown wiring
  const accentSelect = document.getElementById('accentSelect');
  const fontColorSelect = document.getElementById('fontColorSelect');
  if (accentSelect) {
    accentSelect.value = root.getAttribute('data-accent') || 'cyan';
    accentSelect.addEventListener('change', (e)=>{
      const val = e.target.value;
      root.setAttribute('data-accent', val);
      localStorage.setItem('accent', val);
      if (window.calendar && typeof calendar.updateSize === 'function') setTimeout(()=>calendar.updateSize(), 50);
    });
  }
  if (fontColorSelect) {
    fontColorSelect.value = root.getAttribute('data-fontcolor') || 'default';
    fontColorSelect.addEventListener('change', (e)=>{
      const val = e.target.value;
      root.setAttribute('data-fontcolor', val);
      localStorage.setItem('fontColor', val);
    });
  }

  // fullscreen functionality removed
})();

// Floating Tasks Database - Loaded from API
const floatingTasksDatabase = [];

// Current Event ID for modal
let currentEventId = null;

// Floating Tasks Functions
function toggleFloatingTasksPanel() {
    const panel = document.getElementById('floatingTasksPanel');
    if (!panel) {
        console.error('Floating tasks panel not found');
        return;
    }
    panel.classList.toggle('active');
    
    if (panel.classList.contains('active')) {
        renderFloatingTasks();
    }
}

function closeFloatingTasksPanel() {
    const panel = document.getElementById('floatingTasksPanel');
    if (!panel) return;
    panel.classList.remove('active');
}

function minimizeFloatingTasksPanel() {
    const panel = document.getElementById('floatingTasksPanel');
    panel.classList.toggle('minimized');
}

function getClaimedByDisplay(claimedBy) {
    if (!claimedBy) return '';
    try {
        const usersData = (typeof getUsersDataSafe === 'function') ? getUsersDataSafe() : {};
        const direct = usersData[claimedBy];
        const user = direct || Object.values(usersData).find(u => u && (u.email === claimedBy || u.id === claimedBy || u.name === claimedBy || u.username === claimedBy));
        if (user) {
            const first = user.firstName || '';
            const last = user.lastName || '';
            const full = `${first} ${last}`.trim();
            return full || user.name || user.username || user.email || claimedBy;
        }
    } catch (e) {
        console.warn('Could not resolve claimedBy name:', e);
    }
    return claimedBy;
}

function getCurrentUserKeys() {
    const currentUser = safeParseLocalStorageJSON('currentUser', null, { expect: 'objectOrNull' });
    const keys = [
        localStorage.getItem('loggedInUser'),
        currentUser?.username,
        currentUser?.email,
        currentUser?.dbId,
        currentUser?.id,
        currentUser?.name
    ].filter(Boolean);
    return Array.from(new Set(keys));
}

function getCurrentUserKey() {
    const keys = getCurrentUserKeys();
    return keys.length ? keys[0] : null;
}

function canEditTask(task) {
    if (!task) return false;
    const keys = getCurrentUserKeys();
    if (!keys.length) return false;
    const creator = getTaskCreator(task);
    const assignedById = task.assignedById || task.AssignedById || null;
    if (creator && keys.includes(creator)) return true;
    if (assignedById !== null && assignedById !== undefined) {
        return keys.includes(assignedById) || keys.includes(String(assignedById));
    }
    return false;
}

function loadTaskCreatorCache() {
    try {
        if (typeof safeParseLocalStorageJSON === 'function') {
            const cache = safeParseLocalStorageJSON('taskCreatorCache', {}, { expect: 'object' });
            window.__taskCreatorCache = (cache && typeof cache === 'object' && !Array.isArray(cache)) ? cache : {};
            return;
        }
        const raw = localStorage.getItem('taskCreatorCache');
        const parsed = raw ? JSON.parse(raw) : {};
        window.__taskCreatorCache = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
        window.__taskCreatorCache = {};
    }
}

function saveTaskCreatorCache() {
    try {
        localStorage.setItem('taskCreatorCache', JSON.stringify(window.__taskCreatorCache || {}));
    } catch (e) {
        // ignore storage failures
    }
}

function getTaskCacheKeys(taskId) {
    if (!taskId) return [];
    const keys = [String(taskId)];
    if (String(taskId).startsWith('task-')) {
        keys.push(String(taskId).replace('task-', ''));
    }
    return Array.from(new Set(keys));
}

function recordTaskCreator(taskId, creator) {
    if (!taskId || !creator) return;
    if (!window.__taskCreatorCache) loadTaskCreatorCache();
    const keys = getTaskCacheKeys(taskId);
    keys.forEach(k => { window.__taskCreatorCache[k] = creator; });
    saveTaskCreatorCache();
}

function normalizeTaskCreatorFields(task) {
    if (!task) return null;
    const creator = task.createdBy || task.CreatedBy || task.created_by || task.createdByUser || task.createdByUserId || task.createdByUsername;
    if (creator) task.createdBy = creator;
    return task.createdBy || null;
}

function getTaskCreator(task) {
    if (!task) return null;
    const normalized = normalizeTaskCreatorFields(task);
    if (normalized) return normalized;
    const cache = window.__taskCreatorCache || {};
    const keys = getTaskCacheKeys(task.id);
    for (const key of keys) {
        if (cache[key]) return cache[key];
    }
    return null;
}

function applyCreatorCacheToTasks() {
    if (!Array.isArray(window.tasksData)) return;
    if (!window.__taskCreatorCache) loadTaskCreatorCache();
    window.tasksData.forEach(t => {
        if (!t) return;
        normalizeTaskCreatorFields(t);
        if (t.createdBy) return;
        const keys = getTaskCacheKeys(t.id);
        for (const key of keys) {
            const cached = window.__taskCreatorCache[key];
            if (cached) {
                t.createdBy = cached;
                break;
            }
        }
    });
}

function loadTaskClaimCache() {
    try {
        if (typeof safeParseLocalStorageJSON === 'function') {
            const cache = safeParseLocalStorageJSON('taskClaimCache', {}, { expect: 'object' });
            window.__taskClaimCache = (cache && typeof cache === 'object' && !Array.isArray(cache)) ? cache : {};
            return;
        }
        const raw = localStorage.getItem('taskClaimCache');
        const parsed = raw ? JSON.parse(raw) : {};
        window.__taskClaimCache = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
        window.__taskClaimCache = {};
    }
}

function saveTaskClaimCache() {
    try {
        localStorage.setItem('taskClaimCache', JSON.stringify(window.__taskClaimCache || {}));
    } catch (e) {
        // ignore storage failures
    }
}

function getTaskClaimInfo(task) {
    if (!task) return { claimedBy: null, claimedAt: null };
    // If task is database-backed, treat DB as source of truth (do not override with local cache)
    if (task.dbId || task.Id) {
        return { claimedBy: task.claimedBy || null, claimedAt: task.claimedAt || null };
    }
    if (task.claimedBy) return { claimedBy: task.claimedBy, claimedAt: task.claimedAt || null };
    const cache = window.__taskClaimCache || {};
    const cached = cache[task.id];
    if (cached && cached.claimedBy) {
        return { claimedBy: cached.claimedBy, claimedAt: cached.claimedAt || null };
    }
    return { claimedBy: null, claimedAt: null };
}

function recordTaskClaim(taskId, claimedBy, claimedAt) {
    if (!taskId || !claimedBy) return;
    if (!window.__taskClaimCache) loadTaskClaimCache();
    window.__taskClaimCache[taskId] = { claimedBy, claimedAt: claimedAt || new Date().toISOString() };
    saveTaskClaimCache();
}

function clearTaskClaim(taskId) {
    if (!taskId) return;
    if (!window.__taskClaimCache) loadTaskClaimCache();
    if (window.__taskClaimCache && Object.prototype.hasOwnProperty.call(window.__taskClaimCache, taskId)) {
        delete window.__taskClaimCache[taskId];
        saveTaskClaimCache();
    }
}

function getCurrentUserClaimKey() {
    const currentUser = safeParseLocalStorageJSON('currentUser', null, { expect: 'objectOrNull' });
    return currentUser?.email || currentUser?.id || currentUser?.name || null;
}

function canCurrentUserUnclaim(claimedBy) {
    if (!claimedBy) return false;
    const currentKey = getCurrentUserClaimKey();
    return !!currentKey && String(claimedBy) === String(currentKey);
}

function getApiTaskIdFromTask(task) {
    const candidate = task?.dbId ?? task?.Id ?? task?.id;
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && Number.isInteger(numeric)) return numeric;
    const idStr = String(task?.id ?? '').trim();
    const m = idStr.match(/(\d+)\s*$/);
    return m ? Number(m[1]) : null;
}

function removeClaimedCalendarEvent(taskId) {
    try {
        const claimEventId = 'claimed-' + taskId;
        if (Array.isArray(window.eventDatabase)) {
            const idx = window.eventDatabase.findIndex(e => e && String(e.id) === String(claimEventId));
            if (idx !== -1) window.eventDatabase.splice(idx, 1);
        }
    } catch (e) {
        // ignore
    }
}

async function refreshTasksAfterMutation() {
    try {
        if (typeof loadTasksFromAPI === 'function') {
            await loadTasksFromAPI();
        }
    } catch (e) {
        // ignore; UI will still update from local state
    }

    try {
        if (typeof renderFloatingTasks === 'function') renderFloatingTasks();
        if (typeof updateFloatingTasksCount === 'function') updateFloatingTasksCount();
        if (typeof renderBonusTasks === 'function') renderBonusTasks();
        if (typeof updateBonusTasksCount === 'function') updateBonusTasksCount();
        if (typeof initTaskHub === 'function') initTaskHub();
    } catch (e) {
        // ignore
    }
}

function isTaskHubViewActive() {
    try {
        const view = document.getElementById('view-task-hub');
        return !!(view && view.classList && view.classList.contains('active'));
    } catch (e) {
        return false;
    }
}

async function refreshTasksFromServer(options = {}) {
    const { silent = true } = options;

    if (typeof loadTasksFromAPI !== 'function') return false;

    try {
        await loadTasksFromAPI();
    } catch (e) {
        if (!silent) console.warn('Task refresh failed:', e);
        return false;
    }

    try {
        if (typeof renderFloatingTasks === 'function') renderFloatingTasks();
        if (typeof updateFloatingTasksCount === 'function') updateFloatingTasksCount();
        if (typeof renderBonusTasks === 'function') renderBonusTasks();
        if (typeof updateBonusTasksCount === 'function') updateBonusTasksCount();

        // Only refresh the Task Hub UI if it's currently open/active,
        // so we don't disrupt the user's current tab/view.
        if (isTaskHubViewActive()) {
            const tab = window.taskHubState?.currentTab || 'my-tasks';
            if (tab === 'my-tasks' && typeof renderTaskHubMyTasks === 'function') renderTaskHubMyTasks();
            if (tab === 'floating' && typeof renderTaskHubFloating === 'function') renderTaskHubFloating();
            if (tab === 'bonus' && typeof renderTaskHubBonus === 'function') renderTaskHubBonus();
            if (tab === 'completed' && typeof renderTaskHubCompleted === 'function') renderTaskHubCompleted();
            if (tab === 'assignment-board' && typeof renderAssignmentBoard === 'function') renderAssignmentBoard();

            if (typeof updateTaskHubStats === 'function') updateTaskHubStats();
            if (typeof updateTaskHubBadges === 'function') updateTaskHubBadges();
        }
    } catch (e) {
        // ignore UI refresh failures
    }

    return true;
}

function startTaskClaimSync() {
    try {
        if (window.__taskClaimSyncStarted) return;
        window.__taskClaimSyncStarted = true;

        const getNextIntervalMs = () => {
            try {
                // Faster sync when users are actively looking at claimable tasks.
                const isFloatingPanelOpen = !!document.getElementById('floatingTasksPanel')?.classList?.contains('open');
                const isBonusPanelOpen = !!document.getElementById('bonusTasksPanel')?.classList?.contains('open');
                if (isTaskHubViewActive() || isFloatingPanelOpen || isBonusPanelOpen) return 2000;
            } catch (e) {
                // ignore
            }
            return 15000;
        };

        const tick = async () => {
            if (document.hidden) return;
            if (window.__taskClaimSyncInFlight) return;
            window.__taskClaimSyncInFlight = true;
            try {
                await refreshTasksFromServer({ silent: true });
            } finally {
                window.__taskClaimSyncInFlight = false;
            }
        };

        const scheduleNext = async () => {
            await tick();
            window.__taskClaimSyncTimer = setTimeout(scheduleNext, getNextIntervalMs());
        };

        // Start the adaptive polling loop.
        window.__taskClaimSyncTimer = setTimeout(scheduleNext, 1500);

        // Also refresh when the user returns to the tab/window.
        window.addEventListener('focus', () => { tick(); });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) tick();
        });

        // Also do an immediate refresh on startup.
        setTimeout(tick, 0);
    } catch (e) {
        // ignore
    }
}

function applyClaimCacheToTasks() {
    if (!Array.isArray(window.tasksData)) return;
    if (!window.__taskClaimCache) loadTaskClaimCache();
    window.tasksData.forEach(t => {
        if (!t || t.claimedBy) return;
        // Do not apply local claim cache to DB-backed tasks
        if (t.dbId || t.Id) return;
        const cached = window.__taskClaimCache[t.id];
        if (cached && cached.claimedBy) {
            t.claimedBy = cached.claimedBy;
            t.claimedAt = cached.claimedAt || t.claimedAt || null;
        }
    });
}

function renderFloatingTasks() {
    const body = document.getElementById('floatingTasksBody');
    
    // Get floating tasks from tasksData (database-backed)
    const floatingTasks = window.tasksData.filter(t => t.taskType === 'Floating' && t.status !== 'Completed');
    
    if (floatingTasks.length === 0) {
        body.innerHTML = `
            <div class="no-floating-tasks">
                <i class="fas fa-clipboard-check"></i>
                <p>No floating tasks available</p>
                <p style="font-size: 0.85rem; margin-top: 0.5rem;">Check back later for new tasks</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    floatingTasks.forEach(task => {
        const claimInfo = getTaskClaimInfo(task);
        const isClaimed = !!claimInfo.claimedBy;
        const canUnclaim = isClaimed && canCurrentUserUnclaim(claimInfo.claimedBy);
        const claimedByLabel = isClaimed ? getClaimedByDisplay(claimInfo.claimedBy) : '';
        html += `
            <div class="floating-task-item" ${isClaimed ? `title="Claimed by ${claimedByLabel}"` : ''}>
                <div class="floating-task-header">
                    <div class="floating-task-title">${task.title}</div>
                    <div class="floating-task-badges">
                        <span class="floating-task-badge priority"><i class="fas fa-flag"></i></span>
                        ${task.isPaid ? `<span class="floating-task-badge" style="background: #10b981;"><i class="fas fa-dollar-sign"></i></span>` : ''}
                        ${isClaimed ? `<span class="floating-task-badge" style="background: #e5e7eb; color: #374151;" title="Claimed by ${claimedByLabel}"><i class="fas fa-user-check"></i> Claimed</span>` : ''}
                    </div>
                </div>
                <div class="floating-task-desc">${task.description}</div>
                <div class="floating-task-meta">
                    <span><i class="fas fa-clock"></i>${task.timeEstimate || task.estimatedTime + ' mins'}</span>
                    <span><i class="fas fa-map-marker-alt"></i>${task.location || 'Any Location'}</span>
                    <span><i class="fas fa-calendar"></i>Due: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Flexible'}</span>
                    ${task.isPaid && task.payAmount ? `<span style="color: #10b981; font-weight: 600;"><i class="fas fa-dollar-sign"></i>$${task.payAmount}</span>` : ''}
                </div>
                <div class="floating-task-actions">
                    ${isClaimed ? (canUnclaim ? `
                        <button class="unclaim-task-btn" onclick="unclaimFloatingTask('${task.id}')" title="Unclaim this task">
                            <i class="fas fa-undo"></i>
                            Unclaim
                        </button>
                    ` : `
                        <button class="claim-task-btn" disabled title="Claimed by ${claimedByLabel}" style="opacity: 0.6; cursor: not-allowed;">
                            <i class="fas fa-user-check"></i>
                            Claimed
                        </button>
                    `) : `
                        <button class="claim-task-btn" onclick="claimFloatingTask('${task.id}')">
                            <i class="fas fa-hand-pointer"></i>
                            Claim This Task
                        </button>
                    `}
                    <button class="dismiss-task-btn" onclick="dismissFloatingTask('${task.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    body.innerHTML = html;
    if (typeof updateFloatingTasksCount === 'function') {
        updateFloatingTasksCount();
    }
}

async function claimFloatingTask(taskId) {
    // Refresh first so the UI doesn't offer stale "Claim" actions.
    await refreshTasksFromServer({ silent: true });

    let taskIndex = window.tasksData.findIndex(t => t.id == taskId);
    if (taskIndex === -1) return;
    
    const task = window.tasksData[taskIndex];
    const apiTaskId = getApiTaskIdFromTask(task);
    if (!apiTaskId) {
        showNotification('Cannot claim this task (missing database id).', 'error');
        return;
    }
    const currentUser = safeParseLocalStorageJSON('currentUser', null, { expect: 'objectOrNull' });
    const currentUserKey = currentUser?.email || currentUser?.id || currentUser?.name;
    const claimKey = currentUser?.email || currentUserKey || 'Unknown';
    const existingClaim = getTaskClaimInfo(task).claimedBy;
    if (existingClaim && String(existingClaim) !== String(claimKey)) {
        // Prefer updating the UI over a "you wasted time" prompt.
        renderFloatingTasks();
        showNotification(`Claimed by ${getClaimedByDisplay(existingClaim)}`, 'info');
        return;
    }
    
    try {
        // Update task in database
        const response = await fetch(`/api/tasks/${apiTaskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                claimAction: 'claim',
                actorKey: claimKey,
                claimedAt: new Date().toISOString(),
                status: 'In Progress'
            })
        });

        if (response.status === 409) {
            const data = await response.json().catch(() => null);
            if (data?.claimedBy) {
                window.tasksData[taskIndex].claimedBy = data.claimedBy;
                window.tasksData[taskIndex].claimedAt = window.tasksData[taskIndex].claimedAt || new Date().toISOString();
            }
            const who = data?.claimedBy ? getClaimedByDisplay(data.claimedBy) : null;
            showNotification(who ? `Task already claimed by ${who}` : (data?.error || 'Task already claimed'), 'warning');
            if (typeof renderFloatingTasks === 'function') renderFloatingTasks();
            refreshTasksAfterMutation();
            return;
        }
        
        if (response.ok) {
            // Update local data
            const claimedByValue = claimKey;
            const claimedAtValue = new Date().toISOString();
            window.tasksData[taskIndex].claimedBy = claimedByValue;
            window.tasksData[taskIndex].claimedAt = claimedAtValue;
            window.tasksData[taskIndex].status = 'In Progress';
            recordTaskClaim(taskId, claimedByValue, claimedAtValue);
            
            // Add to event database for calendar display
            try {
                const dueDateStr = (task.dueDate || '').toString().trim();
                const startCandidate = dueDateStr ? new Date(`${dueDateStr}T09:00:00`) : null;
                const hasValidStart = startCandidate && !isNaN(startCandidate.getTime());

                if (hasValidStart && Array.isArray(window.eventDatabase)) {
                    let durationMinutes = 60;
                    const estimatedMinutes = Number(task.estimatedTime);
                    if (Number.isFinite(estimatedMinutes) && estimatedMinutes > 0) {
                        durationMinutes = estimatedMinutes;
                    } else {
                        const raw = (task.timeEstimate ?? '').toString().toLowerCase();
                        const n = parseInt(raw, 10);
                        if (Number.isFinite(n) && n > 0) {
                            if (raw.includes('min')) durationMinutes = n;
                            else if (raw.includes('hour') || raw.includes('hr')) durationMinutes = n * 60;
                            else durationMinutes = (n <= 8) ? (n * 60) : n;
                        }
                    }

                    const endCandidate = new Date(startCandidate.getTime() + durationMinutes * 60 * 1000);
                    const newEvent = {
                        id: 'claimed-' + taskId,
                        title: task.title,
                        start: startCandidate.toISOString(),
                        end: endCandidate.toISOString(),
                        resourceId: currentUser ? currentUser.id : 'john-smith',
                        employee: currentUser ? currentUser.id : 'john-smith',
                        location: task.location || 'Any Location',
                        priority: task.priority,
                        description: task.description,
                        notes: task.isPaid ? `Paid task: $${task.payAmount}` : '',
                        paid: task.isPaid,
                        overdue: false,
                        completed: false,
                        type: 'floating'
                    };

                    window.eventDatabase.push(newEvent);
                }
            } catch (e) {
                // If calendar event creation fails, don't block claiming.
            }
            
            // Update UI
            renderFloatingTasks();
            updateFloatingTasksCount();
            if (calendar) calendar.refetchEvents();
            showNotification(`Task "${task.title}" claimed successfully!`, 'success');

            // Re-sync from DB so other clients converge
            refreshTasksAfterMutation();
            
            const remainingFloating = window.tasksData.filter(t => t.taskType === 'Floating' && t.status !== 'Completed' && !t.claimedBy).length;
            if (remainingFloating === 0) {
                setTimeout(closeFloatingTasksPanel, 1500);
            }
        } else {
            throw new Error('Failed to claim task');
        }
    } catch (error) {
        console.error('Error claiming floating task:', error);
        showNotification('Failed to claim task', 'error');
    }
}

async function unclaimFloatingTask(taskId) {
    const taskIndex = window.tasksData.findIndex(t => t.id == taskId);
    if (taskIndex === -1) return;

    const task = window.tasksData[taskIndex];
    const apiTaskId = getApiTaskIdFromTask(task);
    if (!apiTaskId) {
        showNotification('Cannot unclaim this task (missing database id).', 'error');
        return;
    }
    const claimInfo = getTaskClaimInfo(task);
    if (!claimInfo.claimedBy) return;
    if (!canCurrentUserUnclaim(claimInfo.claimedBy)) {
        showNotification('You can only unclaim tasks you claimed.', 'warning');
        return;
    }

    try {
        const response = await fetch(`/api/tasks/${apiTaskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                claimAction: 'unclaim',
                actorKey: getCurrentUserClaimKey(),
                status: 'Pending'
            })
        });

        if (response.status === 403) {
            const data = await response.json().catch(() => null);
            const who = data?.claimedBy ? getClaimedByDisplay(data.claimedBy) : null;
            showNotification(who ? `Only ${who} can unclaim this task` : (data?.error || 'You cannot unclaim this task'), 'warning');
            refreshTasksAfterMutation();
            return;
        }
        if (response.status === 409) {
            const data = await response.json().catch(() => null);
            showNotification(data?.error || 'Task is not claimed', 'info');
            refreshTasksAfterMutation();
            return;
        }

        if (!response.ok) throw new Error('Failed to unclaim task');

        window.tasksData[taskIndex].claimedBy = null;
        window.tasksData[taskIndex].claimedAt = null;
        window.tasksData[taskIndex].status = 'Pending';

        clearTaskClaim(taskId);
        removeClaimedCalendarEvent(taskId);

        renderFloatingTasks();
        updateFloatingTasksCount();
        if (typeof initTaskHub === 'function') initTaskHub();
        if (typeof calendar !== 'undefined' && calendar) calendar.refetchEvents();

        showNotification(`Task "${task.title}" unclaimed.`, 'info');

        // Re-sync from DB so other clients converge
        refreshTasksAfterMutation();
    } catch (error) {
        console.error('Error unclaiming floating task:', error);
        showNotification('Failed to unclaim task', 'error');
    }
}

async function dismissFloatingTask(taskId) {
    const taskIndex = window.tasksData.findIndex(t => t.id == taskId);
    if (taskIndex !== -1) {
        try {
            const task = window.tasksData[taskIndex];
            const apiTaskId = getApiTaskIdFromTask(task);
            if (!apiTaskId) {
                showNotification('Cannot update this task (missing database id).', 'error');
                return;
            }
            const response = await fetch(`/api/tasks/${apiTaskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...task,
                    status: 'Dismissed'
                })
            });
            
            if (response.ok) {
                window.tasksData[taskIndex].status = 'Dismissed';
                renderFloatingTasks();
                updateFloatingTasksCount();
                showNotification('Task dismissed', 'info');

                refreshTasksAfterMutation();
                
                const remainingFloating = window.tasksData.filter(t => t.taskType === 'Floating' && t.status !== 'Completed' && !t.claimedBy).length;
                if (remainingFloating === 0) {
                    setTimeout(closeFloatingTasksPanel, 1500);
                }
            }
        } catch (error) {
            console.error('Error dismissing floating task:', error);
            showNotification('Failed to dismiss task', 'error');
        }
    }
}

function updateFloatingTasksCount() {
    try {
        // Count floating tasks from database-backed tasksData
        const count = window.tasksData.filter(t => t.taskType === 'Floating' && t.status !== 'Completed' && !t.claimedBy).length;
        const badge = document.getElementById('floatingTasksBadge');
        if (badge) {
            badge.textContent = count;
        }
        
        const navBadge = document.getElementById('floatingTasksNavBadge');
        if (navBadge) {
            navBadge.textContent = count;
        }
        
        const notification = document.getElementById('floatingTasksNotification');
        if (notification) {
            if (count > 0) {
                notification.style.display = 'block';
            } else {
                notification.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error updating floating tasks count:', error);
    }
}

// Bonus Tasks Functions
async function claimBonusTask(taskId) {
    // Refresh first so the UI doesn't offer stale "Claim" actions.
    await refreshTasksFromServer({ silent: true });

    let taskIndex = window.tasksData.findIndex(t => t.id == taskId);
    if (taskIndex === -1) return;
    
    const task = window.tasksData[taskIndex];
    const apiTaskId = getApiTaskIdFromTask(task);
    if (!apiTaskId) {
        showNotification('Cannot claim this task (missing database id).', 'error');
        return;
    }
    const currentUser = safeParseLocalStorageJSON('currentUser', null, { expect: 'objectOrNull' });
    const currentUserKey = currentUser?.email || currentUser?.id || currentUser?.name;
    const claimKey = currentUser?.email || currentUserKey || 'Unknown';
    const existingClaim = getTaskClaimInfo(task).claimedBy;
    if (existingClaim && String(existingClaim) !== String(claimKey)) {
        renderBonusTasks();
        showNotification(`Claimed by ${getClaimedByDisplay(existingClaim)}`, 'info');
        return;
    }
    
    try {
        // Update task in database
        const response = await fetch(`/api/tasks/${apiTaskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                claimAction: 'claim',
                actorKey: claimKey,
                claimedAt: new Date().toISOString(),
                status: 'In Progress'
            })
        });

        if (response.status === 409) {
            const data = await response.json().catch(() => null);
            if (data?.claimedBy) {
                window.tasksData[taskIndex].claimedBy = data.claimedBy;
                window.tasksData[taskIndex].claimedAt = window.tasksData[taskIndex].claimedAt || new Date().toISOString();
            }
            const who = data?.claimedBy ? getClaimedByDisplay(data.claimedBy) : null;
            showNotification(who ? `Task already claimed by ${who}` : (data?.error || 'Task already claimed'), 'warning');
            if (typeof renderBonusTasks === 'function') renderBonusTasks();
            refreshTasksAfterMutation();
            return;
        }
        
        if (response.ok) {
            // Update local data
            const claimedByValue = claimKey;
            const claimedAtValue = new Date().toISOString();
            window.tasksData[taskIndex].claimedBy = claimedByValue;
            window.tasksData[taskIndex].claimedAt = claimedAtValue;
            window.tasksData[taskIndex].status = 'In Progress';
            recordTaskClaim(taskId, claimedByValue, claimedAtValue);
            
            renderBonusTasks();
            updateBonusTasksCount();
            showNotification(`Bonus task "${task.title}" claimed! Earned $${task.payAmount || '0'}`, 'success');

            refreshTasksAfterMutation();
            
            const remainingBonus = window.tasksData.filter(t => t.taskType === 'Bonus' && t.status !== 'Completed' && !t.claimedBy).length;
            if (remainingBonus === 0) {
                setTimeout(closeBonusTasksPanel, 1500);
            }
        } else {
            throw new Error('Failed to claim task');
        }
    } catch (error) {
        console.error('Error claiming bonus task:', error);
        showNotification('Failed to claim bonus task', 'error');
    }
}

async function unclaimBonusTask(taskId) {
    const taskIndex = window.tasksData.findIndex(t => t.id == taskId);
    if (taskIndex === -1) return;

    const task = window.tasksData[taskIndex];
    const apiTaskId = getApiTaskIdFromTask(task);
    if (!apiTaskId) {
        showNotification('Cannot unclaim this task (missing database id).', 'error');
        return;
    }
    const claimInfo = getTaskClaimInfo(task);
    if (!claimInfo.claimedBy) return;
    if (!canCurrentUserUnclaim(claimInfo.claimedBy)) {
        showNotification('You can only unclaim tasks you claimed.', 'warning');
        return;
    }

    try {
        const response = await fetch(`/api/tasks/${apiTaskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                claimAction: 'unclaim',
                actorKey: getCurrentUserClaimKey(),
                status: 'Pending'
            })
        });

        if (response.status === 403) {
            const data = await response.json().catch(() => null);
            const who = data?.claimedBy ? getClaimedByDisplay(data.claimedBy) : null;
            showNotification(who ? `Only ${who} can unclaim this task` : (data?.error || 'You cannot unclaim this task'), 'warning');
            refreshTasksAfterMutation();
            return;
        }
        if (response.status === 409) {
            const data = await response.json().catch(() => null);
            showNotification(data?.error || 'Task is not claimed', 'info');
            refreshTasksAfterMutation();
            return;
        }

        if (!response.ok) throw new Error('Failed to unclaim task');

        window.tasksData[taskIndex].claimedBy = null;
        window.tasksData[taskIndex].claimedAt = null;
        window.tasksData[taskIndex].status = 'Pending';

        clearTaskClaim(taskId);

        renderBonusTasks();
        updateBonusTasksCount();
        if (typeof initTaskHub === 'function') initTaskHub();

        showNotification(`Bonus task "${task.title}" unclaimed.`, 'info');

        refreshTasksAfterMutation();
    } catch (error) {
        console.error('Error unclaiming bonus task:', error);
        showNotification('Failed to unclaim bonus task', 'error');
    }
}

async function dismissBonusTask(taskId) {
    const taskIndex = window.tasksData.findIndex(t => t.id == taskId);
    if (taskIndex !== -1) {
        try {
            // Update task status to dismissed in database
            const task = window.tasksData[taskIndex];
            const apiTaskId = getApiTaskIdFromTask(task);
            if (!apiTaskId) {
                showNotification('Cannot update this task (missing database id).', 'error');
                return;
            }
            const response = await fetch(`/api/tasks/${apiTaskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...task,
                    status: 'Dismissed'
                })
            });
            
            if (response.ok) {
                window.tasksData[taskIndex].status = 'Dismissed';
                renderBonusTasks();
                updateBonusTasksCount();
                showNotification('Bonus task dismissed', 'info');

                refreshTasksAfterMutation();
                
                const remainingBonus = window.tasksData.filter(t => t.taskType === 'Bonus' && t.status !== 'Completed' && !t.claimedBy).length;
                if (remainingBonus === 0) {
                    setTimeout(closeBonusTasksPanel, 1500);
                }
            }
        } catch (error) {
            console.error('Error dismissing bonus task:', error);
            showNotification('Failed to dismiss task', 'error');
        }
    }
}

function updateBonusTasksCount() {
    try {
        // Count bonus tasks from database-backed tasksData
        const count = window.tasksData.filter(t => t.taskType === 'Bonus' && t.status !== 'Completed' && !t.claimedBy).length;
        const badge = document.getElementById('bonusTasksBadge');
        if (badge) {
            badge.textContent = count;
        }
        
        const navBadge = document.getElementById('bonusTasksNavBadge');
        if (navBadge) {
            navBadge.textContent = count;
        }
    } catch (error) {
        console.error('Error updating bonus tasks count:', error);
    }
}


// Mark as Completed Function
function markAsCompleted() {
    if (!currentEventId) return;
    
    const eventIndex = eventDatabase.findIndex(e => e.id === currentEventId);
    if (eventIndex !== -1) {
        eventDatabase[eventIndex].completed = !eventDatabase[eventIndex].completed;
        
        if (eventDatabase[eventIndex].completed) {
            showNotification('Task marked as completed!', 'success');
        } else {
            showNotification('Task marked as incomplete', 'info');
        }
        
        // Refresh calendar
        if (calendar) calendar.refetchEvents();
        
        // Close modal
        closeEventModal();
    }
}

// Update your openEventModal function to set currentEventId and handle completed status
// Add this at the start of your existing openEventModal function:
// currentEventId = eventData.id;

// And update the mark completed button based on status:
// const markBtn = document.getElementById('markCompletedBtn');
// if (eventData.completed) {
//     markBtn.innerHTML = '<i class="fas fa-undo"></i> Mark as Incomplete';
//     markBtn.style.background = '#6c757d';
// } else {
//     markBtn.innerHTML = '<i class="fas fa-check-circle"></i> Mark as Completed';
//     markBtn.style.background = '#10b981';
// }

// Add 'completed' badge to modal badges if event is completed

// ========== PROCEDURES MODULE ==========

// Get dynamic instrument database from localStorage
function getInstrumentDatabase() {
    const savedInstruments = typeof loadInstruments === 'function' ? loadInstruments() : [];
    const dynamicDatabase = {};
    
    // All available categories (always show these)
    const allCategories = ['Diagnostic', 'Surgical', 'Restorative', 'Endodontic', 'Periodontal', 'Orthodontic', 'Prosthodontic', 'Hygiene', 'Other'];
    
    // Initialize all categories as empty arrays
    allCategories.forEach(cat => {
        dynamicDatabase[cat] = [];
    });
    
    // If we have saved instruments, organize them by category
    if (savedInstruments && savedInstruments.length > 0) {
        // Instrument type to icon mapping
        const typeIcons = {
            'mirror': 'fa-microscope',
            'explorer': 'fa-compass',
            'probe': 'fa-ruler',
            'scaler': 'fa-grip-lines',
            'curette': 'fa-screwdriver',
            'forceps': 'fa-grip',
            'elevator': 'fa-arrow-up',
            'scalpel': 'fa-cut',
            'handpiece': 'fa-cog',
            'bur': 'fa-circle',
            'file': 'fa-file',
            'plugger': 'fa-hammer',
            'spatula': 'fa-spoon',
            'syringe': 'fa-syringe',
            'clamp': 'fa-compress-alt',
            'tweezers': 'fa-grip',
            'gauze': 'fa-scroll',
            'cotton': 'fa-circle-notch',
            'suction': 'fa-wind',
            'ejector': 'fa-wind'
        };
        
        savedInstruments.filter(i => i.isActive !== false).forEach(instrument => {
            const category = instrument.category || 'Other';
            if (!dynamicDatabase[category]) {
                dynamicDatabase[category] = [];
            }
            
            // Determine icon based on instrument name/type
            let icon = 'fa-tools';
            const nameLower = (instrument.instrumentName + ' ' + (instrument.instrumentType || '')).toLowerCase();
            for (const [key, iconClass] of Object.entries(typeIcons)) {
                if (nameLower.includes(key)) {
                    icon = iconClass;
                    break;
                }
            }
            
            dynamicDatabase[category].push({
                id: 'inst-' + instrument.instrumentID,
                name: instrument.instrumentName,
                icon: icon,
                category: category,
                quantity: instrument.quantity || 1,
                manufacturer: instrument.manufacturer,
                condition: instrument.condition
            });
        });
    }
    
    return dynamicDatabase;
}

// Legacy static database (kept for backward compatibility with existing procedures)
const instrumentDatabase = {
    diagnostic: [
        { id: 'mirror-1', name: 'Mouth Mirror', icon: 'fa-microscope', category: 'diagnostic' },
        { id: 'explorer-1', name: 'Explorer', icon: 'fa-compass', category: 'diagnostic' },
        { id: 'probe-1', name: 'Periodontal Probe', icon: 'fa-ruler', category: 'diagnostic' },
        { id: 'tweezers-1', name: 'Tweezers', icon: 'fa-hand-holding-tweezers', category: 'diagnostic' }
    ],
    surgical: [
        { id: 'scalpel-1', name: 'Scalpel Handle', icon: 'fa-cut', category: 'surgical' },
        { id: 'forceps-1', name: 'Extraction Forceps', icon: 'fa-grip', category: 'surgical' },
        { id: 'elevator-1', name: 'Periosteal Elevator', icon: 'fa-arrow-up', category: 'surgical' },
        { id: 'bone-file-1', name: 'Bone File', icon: 'fa-file', category: 'surgical' },
        { id: 'retractor-1', name: 'Retractor', icon: 'fa-arrow-left', category: 'surgical' }
    ],
    cutting: [
        { id: 'highspeed-1', name: 'High Speed Handpiece', icon: 'fa-bolt', category: 'cutting' },
        { id: 'lowspeed-1', name: 'Low Speed Handpiece', icon: 'fa-cog', category: 'cutting' },
        { id: 'bur-round-1', name: 'Round Bur', icon: 'fa-circle', category: 'cutting' },
        { id: 'bur-tapered-1', name: 'Tapered Bur', icon: 'fa-cone', category: 'cutting' },
        { id: 'bur-fissure-1', name: 'Fissure Bur', icon: 'fa-equals', category: 'cutting' }
    ],
    filling: [
        { id: 'condenser-1', name: 'Plugger', icon: 'fa-hammer', category: 'filling' },
        { id: 'spatula-1', name: 'Mixing Spatula', icon: 'fa-spoon', category: 'filling' },
        { id: 'matrix-1', name: 'Matrix Band', icon: 'fa-layer-group', category: 'filling' },
        { id: 'wedge-1', name: 'Wedge', icon: 'fa-arrow-right', category: 'filling' }
    ],
    suction: [
        { id: 'saliva-ejector-1', name: 'Saliva Ejector', icon: 'fa-wind', category: 'suction' },
        { id: 'high-volume-1', name: 'High Volume Evacuator', icon: 'fa-fan', category: 'suction' }
    ],
    misc: [
        { id: 'gauze-1', name: 'Gauze Pad', icon: 'fa-scroll', category: 'misc' },
        { id: 'cotton-1', name: 'Cotton Roll', icon: 'fa-circle-notch', category: 'misc' },
        { id: 'bib-1', name: 'Patient Bib', icon: 'fa-vest', category: 'misc' }
    ]
};

// Procedure Database - Load from localStorage (moved earlier in file)
function saveProcedures() {
    localStorage.setItem('procedureDatabase', JSON.stringify(procedureDatabase));
}

let procedureDatabase = loadProcedures();
let currentProcedure = null;
let currentProcedureMode = 'new';

function initProceduresModule() {
    renderProceduresList();
    renderCategoryButtons();
    // Get first category from dynamic database
    const dynamicDb = getInstrumentDatabase();
    const firstCategory = Object.keys(dynamicDb)[0] || 'Diagnostic';
    renderInstrumentsList(firstCategory);
    renderTray();
}

function renderProceduresList() {
    const list = document.getElementById('proceduresList');
    if (procedureDatabase.length === 0) {
        list.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-secondary);"><i class="fas fa-inbox"></i><p>No procedures yet</p></div>';
        return;
    }
    let html = '';
    procedureDatabase.forEach(proc => {
        html += `
            <div class="procedure-item ${currentProcedure?.id === proc.id ? 'active' : ''}" onclick="selectProcedure('${proc.id}')">
                <div class="procedure-item-name">${proc.name}</div>
                <div class="procedure-item-meta">
                    <span><i class="fas fa-clock"></i>${proc.estimatedTime}m</span>
                    <span><i class="fas fa-cube"></i>${proc.instruments.length}</span>
                    ${proc.isTemplate ? '<span style="color: var(--accent-primary);"><i class="fas fa-star"></i>Template</span>' : ''}
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

function selectProcedure(procId) {
    currentProcedure = procedureDatabase.find(p => p.id === procId);
    currentProcedureMode = 'edit';
    renderProceduresList();
    renderTray();
    updateDeleteButton();
}

function renderCategoryButtons() {
    const container = document.getElementById('categoryButtons');
    const dynamicDb = getInstrumentDatabase();
    const categories = Object.keys(dynamicDb);
    let html = '';
    const firstCategory = categories[0] || 'Diagnostic';
    categories.forEach((cat, index) => {
        const count = dynamicDb[cat]?.length || 0;
        html += `<button class="category-btn ${index === 0 ? 'active' : ''}" onclick="filterByCategory('${cat}')">${cat} <span style="font-size: 0.75rem; opacity: 0.7;">(${count})</span></button>`;
    });
    container.innerHTML = html;
}

function filterByCategory(category) {
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderInstrumentsList(category);
}

function renderInstrumentsList(category) {
    const list = document.getElementById('instrumentsList');
    const dynamicDb = getInstrumentDatabase();
    const instruments = dynamicDb[category] || [];
    
    if (instruments.length === 0) {
        list.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-secondary);">
            <i class="fas fa-inbox" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
            <p style="margin: 0;">No instruments in this category.</p>
            <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem;">Add instruments via <strong>Manage Instruments</strong> in Settings.</p>
        </div>`;
        return;
    }
    
    let html = '';
    instruments.forEach(instrument => {
        const isSelected = currentProcedure?.instruments.includes(instrument.id);
        html += `
            <div class="instrument-option ${isSelected ? 'selected' : ''}" onclick="toggleInstrument('${instrument.id}')" title="${instrument.manufacturer ? 'Manufacturer: ' + instrument.manufacturer : ''}${instrument.quantity > 1 ? ' | Qty: ' + instrument.quantity : ''}">
                <span class="instrument-option-icon"><i class="fas ${instrument.icon}"></i></span>
                <span class="instrument-option-name">${instrument.name}${instrument.quantity > 1 ? ' <small>(' + instrument.quantity + ')</small>' : ''}</span>
            </div>
        `;
    });
    list.innerHTML = html;
}

function toggleInstrument(instrumentId) {
    if (!currentProcedure) {
        currentProcedure = {
            id: 'proc-new-' + Date.now(),
            name: 'New Procedure',
            description: '',
            category: 'general',
            estimatedTime: 30,
            instruments: [],
            createdDate: new Date(),
            isTemplate: false
        };
        currentProcedureMode = 'new';
        renderProceduresList();
    }
    const index = currentProcedure.instruments.indexOf(instrumentId);
    if (index > -1) {
        currentProcedure.instruments.splice(index, 1);
    } else {
        currentProcedure.instruments.push(instrumentId);
    }
    // Get current active category - extract just the category name without the count
    const activeBtn = document.querySelector('.category-btn.active');
    let currentCategory = 'Diagnostic';
    if (activeBtn) {
        currentCategory = activeBtn.textContent.split('(')[0].trim();
    }
    renderInstrumentsList(currentCategory);
    renderTray();
}

function renderTray() {
    const tray = document.getElementById('trayVisual');
    if (!currentProcedure || currentProcedure.instruments.length === 0) {
        tray.innerHTML = '<div style="grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; color: var(--text-secondary); font-size: 1rem;"><i class="fas fa-info-circle"></i>&nbsp; Select instruments to populate the tray</div>';
        return;
    }
    let html = '';
    const dynamicDb = getInstrumentDatabase();
    
    currentProcedure.instruments.forEach((instrumentId) => {
        // First check dynamic database
        let instrument = Object.values(dynamicDb).flat().find(i => i.id === instrumentId);
        
        // Fallback to legacy static database for backwards compatibility
        if (!instrument) {
            instrument = Object.values(instrumentDatabase).flat().find(i => i.id === instrumentId);
        }
        
        if (instrument) {
            html += `
                <div class="instrument-slot filled">
                    <div class="instrument-slot-icon"><i class="fas ${instrument.icon}"></i></div>
                    <div class="instrument-name">${instrument.name}</div>
                    <button class="slot-remove-btn" onclick="removeInstrument('${instrumentId}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }
    });
    const emptySlots = Math.max(5, 10 - currentProcedure.instruments.length);
    for (let i = 0; i < emptySlots; i++) {
        html += '<div class="instrument-slot"><div class="instrument-slot-label">Empty Slot</div></div>';
    }
    tray.innerHTML = html;
}

function removeInstrument(instrumentId) {
    if (currentProcedure) {
        const index = currentProcedure.instruments.indexOf(instrumentId);
        if (index > -1) {
            currentProcedure.instruments.splice(index, 1);
        }
        renderTray();
        // Get current active category - extract just the category name without the count
        const activeBtn = document.querySelector('.category-btn.active');
        let currentCategory = 'Diagnostic';
        if (activeBtn) {
            currentCategory = activeBtn.textContent.split('(')[0].trim();
        }
        renderInstrumentsList(currentCategory);
    }
}

function saveProcedure() {
    if (!currentProcedure || !currentProcedure.name) {
        alert('Please name the procedure before saving');
        return;
    }
    if (currentProcedure.instruments.length === 0) {
        alert('Please add at least one instrument to the procedure');
        return;
    }
    if (currentProcedureMode === 'new') {
        currentProcedure.id = 'proc-' + Date.now();
        procedureDatabase.push(currentProcedure);
    }
    currentProcedureMode = 'edit';
    saveProcedures(); // Persist to localStorage
    renderProceduresList();
    showNotification(`Procedure "${currentProcedure.name}" saved successfully!`, 'success');
}

function clearProcedure() {
    if (confirm('Clear all instruments from this procedure?')) {
        if (currentProcedure) {
            currentProcedure.instruments = [];
            renderTray();
            renderInstrumentsList(document.querySelector('.category-btn.active')?.textContent.toLowerCase() || 'diagnostic');
            showNotification('Procedure cleared', 'info');
        }
    }
}

function deleteProcedure() {
    if (!currentProcedure) return;
    if (confirm(`Delete procedure "${currentProcedure.name}"?`)) {
        const index = procedureDatabase.findIndex(p => p.id === currentProcedure.id);
        if (index > -1) {
            procedureDatabase.splice(index, 1);
            saveProcedures(); // Persist to localStorage
            currentProcedure = null;
            currentProcedureMode = 'new';
            renderProceduresList();
            renderTray();
            updateDeleteButton();
            showNotification('Procedure deleted', 'success');
        }
    }
}

function updateDeleteButton() {
    const deleteBtn = document.getElementById('deleteProcedureBtn');
    if (currentProcedure && currentProcedureMode === 'edit') {
        deleteBtn.style.display = 'flex';
    } else {
        deleteBtn.style.display = 'none';
    }
}

function saveProcedureTemplate() {
    if (!currentProcedure) {
        alert('Please select or create a procedure first');
        return;
    }
    currentProcedure.isTemplate = true;
    saveProcedures(); // Persist to localStorage
    renderProceduresList();
    showNotification(`"${currentProcedure.name}" saved as template!`, 'success');
}

function openProcedureModal(mode) {
    const modal = document.getElementById('procedureModal');
    const title = document.getElementById('procedureModalTitle');
    if (mode === 'new') {
        title.textContent = 'Create New Procedure';
        document.getElementById('procedureNameInput').value = '';
        document.getElementById('procedureDescInput').value = '';
        document.getElementById('procedureTimeInput').value = '';
        document.getElementById('procedureCategoryInput').value = 'general';
    } else if (currentProcedure) {
        title.textContent = 'Edit Procedure';
        document.getElementById('procedureNameInput').value = currentProcedure.name;
        document.getElementById('procedureDescInput').value = currentProcedure.description;
        document.getElementById('procedureTimeInput').value = currentProcedure.estimatedTime;
        document.getElementById('procedureCategoryInput').value = currentProcedure.category;
    }
    modal.classList.add('active');
}

function closeProcedureModal() {
    document.getElementById('procedureModal').classList.remove('active');
}

function saveProcedureModal() {
    const name = document.getElementById('procedureNameInput').value.trim();
    const desc = document.getElementById('procedureDescInput').value.trim();
    const time = parseInt(document.getElementById('procedureTimeInput').value) || 30;
    const category = document.getElementById('procedureCategoryInput').value;
    if (!name) {
        alert('Please enter a procedure name');
        return;
    }
    if (!currentProcedure) {
        currentProcedure = {
            id: 'proc-' + Date.now(),
            name: name,
            description: desc,
            category: category,
            estimatedTime: time,
            instruments: [],
            createdDate: new Date(),
            isTemplate: false
        };
        procedureDatabase.push(currentProcedure);
        currentProcedureMode = 'edit';
    } else {
        currentProcedure.name = name;
        currentProcedure.description = desc;
        currentProcedure.category = category;
        currentProcedure.estimatedTime = time;
    }
    saveProcedures(); // Persist to localStorage
    renderProceduresList();
    renderTray();
    updateDeleteButton();
    closeProcedureModal();
    showNotification(`Procedure "${name}" updated!`, 'success');
}

// Initialize procedures when page loads

// Bonus Tasks Database - Loaded from API
const bonusTasksDatabase = [];

function toggleBonusTasksPanel() {
    const panel = document.getElementById('bonusTasksPanel');
    if (!panel) {
        console.error('Bonus tasks panel not found');
        return;
    }
    panel.classList.toggle('active');
    
    if (panel.classList.contains('active')) {
        renderBonusTasks();
    }
}

function closeBonusTasksPanel() {
    const panel = document.getElementById('bonusTasksPanel');
    if (!panel) return;
    panel.classList.remove('active');
}

function minimizeBonusTasksPanel() {
    const panel = document.getElementById('bonusTasksPanel');
    panel.classList.toggle('minimized');
}

function renderBonusTasks() {
    const body = document.getElementById('bonusTasksBody');
    
    // Get bonus tasks from tasksData (database-backed)
    const bonusTasks = window.tasksData.filter(t => t.taskType === 'Bonus' && t.status !== 'Completed');
    
    if (bonusTasks.length === 0) {
        body.innerHTML = `
            <div class="no-floating-tasks">
                <i class="fas fa-star"></i>
                <p>No bonus tasks available</p>
                <p style="font-size: 0.85rem; margin-top: 0.5rem;">You're all caught up!</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    bonusTasks.forEach(task => {
        const claimInfo = getTaskClaimInfo(task);
        const isClaimed = !!claimInfo.claimedBy;
        const canUnclaim = isClaimed && canCurrentUserUnclaim(claimInfo.claimedBy);
        const claimedByLabel = isClaimed ? getClaimedByDisplay(claimInfo.claimedBy) : '';
        html += `
            <div class="floating-task-item" ${isClaimed ? `title="Claimed by ${claimedByLabel}"` : ''}>
                <div class="floating-task-header">
                    <div class="floating-task-title">${task.title}</div>
                    <div class="floating-task-badges">
                        <span class="floating-task-badge" style="background: #eab308; color: white;"><i class="fas fa-star"></i></span>
                        ${isClaimed ? `<span class="floating-task-badge" style="background: #e5e7eb; color: #374151;" title="Claimed by ${claimedByLabel}"><i class="fas fa-user-check"></i> Claimed</span>` : ''}
                    </div>
                </div>
                <div class="floating-task-desc">${task.description}</div>
                <div class="floating-task-meta">
                    <span><i class="fas fa-clock"></i>${task.timeEstimate || task.estimatedTime + ' mins'}</span>
                    <span><i class="fas fa-map-marker-alt"></i>${task.location || 'Any Location'}</span>
                    <span><i class="fas fa-calendar"></i>Due: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Flexible'}</span>
                    <span style="color: #eab308; font-weight: 600;"><i class="fas fa-star"></i>$${task.payAmount || '0'}</span>
                </div>
                <div class="floating-task-actions">
                    ${isClaimed ? (canUnclaim ? `
                        <button class="unclaim-task-btn" onclick="unclaimBonusTask('${task.id}')" title="Unclaim this task">
                            <i class="fas fa-undo"></i>
                            Unclaim
                        </button>
                    ` : `
                        <button class="claim-task-btn" disabled title="Claimed by ${claimedByLabel}" style="opacity: 0.6; cursor: not-allowed;">
                            <i class="fas fa-user-check"></i>
                            Claimed
                        </button>
                    `) : `
                        <button class="claim-task-btn" onclick="claimBonusTask('${task.id}')">
                            <i class="fas fa-hand-pointer"></i>
                            Claim This Bonus
                        </button>
                    `}
                    <button class="dismiss-task-btn" onclick="dismissBonusTask('${task.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    body.innerHTML = html;
}

window.addEventListener('load', function() {
    setTimeout(() => {
        try {
            if (typeof initializeResourcesMap === 'function') {
                initializeResourcesMap();
            }
        } catch (e) {
            console.warn('Could not initialize resources:', e.message);
        }
        if (typeof loadTaskClaimCache === 'function') {
            loadTaskClaimCache();
        }
        if (typeof loadTaskCreatorCache === 'function') {
            loadTaskCreatorCache();
        }
        if (typeof updateFilterUI === 'function') {
            updateFilterUI();
        }
        initProceduresModule();
        
        // Initialize floating tasks
        if (typeof updateFloatingTasksCount === 'function') {
            updateFloatingTasksCount();
        }
        
        // Initialize bonus tasks
        if (typeof updateBonusTasksCount === 'function') {
            updateBonusTasksCount();
        }
    }, 500);
});

        // =============== WORKING HOURS CALENDAR FUNCTIONS ===============
        let whCurrentDate = new Date();
                let whCurrentView = 'month';


        // Staff data - Loaded dynamically from User Management
        // Use employeeResources which is populated from localStorage
        function getWhStaffDatabase() {
            return employeeResources.map((emp, index) => ({
                id: index + 1,
                name: emp.title,
                initials: emp.title.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
                role: emp.extendedProps?.role || 'Staff',
                type: emp.extendedProps?.type || 'assistant',
                clinics: emp.extendedProps?.clinics || []
            }));
        }

        // Clinic details - Loaded from masterData
        function getClinicDetails() {
            const details = {};
            masterData.clinics.forEach(clinic => {
                details[clinic.id] = {
                    name: clinic.name,
                    color: clinic.color || '#10b981',
                    shortName: clinic.name.split(' ')[0]
                };
            });
            return details;
        }

        // Rooms for each clinic - Loaded from masterData
        function getClinicRooms() {
            const rooms = {};
            masterData.clinics.forEach(clinic => {
                rooms[clinic.id] = masterData.getRoomsByClinic(clinic.id).map(r => r.name);
            });
            return rooms;
        }

        // Provider-Assistant-Room assignments - Loaded from schedules (localStorage)
        function getProviderAssignments() {
            const assignments = {};
            // Initialize empty assignments for each clinic
            masterData.clinics.forEach(clinic => {
                assignments[clinic.id] = [];
            });
            
            const providerNameSet = new Set(
                (typeof masterData.getProviders === 'function' ? masterData.getProviders() : [])
                    .map(p => String(p?.title || '').trim().toLowerCase())
                    .filter(Boolean)
            );

            // Prefer runtime schedule source, fallback to cached scheduleData.
            let schedules = Array.isArray(window.myScheduleShifts) ? window.myScheduleShifts : [];
            if (!schedules.length) {
                const savedSchedules = localStorage.getItem('scheduleData');
                if (savedSchedules) {
                    try {
                        const parsed = JSON.parse(savedSchedules);
                        schedules = Array.isArray(parsed) ? parsed : [];
                    } catch (e) {
                        console.warn('Could not parse schedule data:', e);
                        schedules = [];
                    }
                }
            }

            // Process only explicit provider-assistant relationships.
            schedules.forEach(schedule => {
                const clinicId = masterData.getClinicByName(schedule?.clinic)?.id;
                if (!clinicId || !assignments[clinicId]) return;

                const providerName = String(schedule?.provider || '').trim();
                const assistantNames = String(schedule?.assistant || '')
                    .split(',')
                    .map(name => String(name || '').trim())
                    .filter(Boolean);

                if (!providerName || assistantNames.length === 0) return;
                if (!providerNameSet.has(providerName.toLowerCase())) return;

                assistantNames.forEach((assistantName) => {
                    assignments[clinicId].push({
                        providerId: null,
                        providerName,
                        assistantId: null,
                        assistantName,
                        room: schedule?.room,
                        shift: `${schedule?.startTime || '08:00'}-${schedule?.endTime || '16:00'}`
                    });
                });
            });

            return assignments;
        }

        // Legacy compatibility - these will reference the dynamic functions
        const whStaffDatabase = [];
        const clinicDetails = {};
        const clinicRooms = {};
        const providerAssignments = {};
        
        const clinics = [];

        // Shift patterns - will be generated dynamically based on user schedules
        // For now, default to standard weekday schedule
        function getEmployeeShiftPattern(employeeId) {
            // Check if there's a saved schedule for this employee
            const savedSchedules = localStorage.getItem('employeeSchedules');
            if (savedSchedules) {
                try {
                    const schedules = JSON.parse(savedSchedules);
                    if (schedules[employeeId]) {
                        return schedules[employeeId];
                    }
                } catch (e) {}
            }
            
            // Default: weekdays 8-4, weekends off
            return (dayOfWeek) => {
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    return { type: 'off', start: '', end: '' };
                }
                return { type: 'morning', start: '08:00', end: '16:00' };
            };
        }

        const employeeShiftPatterns = {};

        function whGenerateShifts(employeeId, date) {
            const dayOfWeek = date.getDay();
            const dateStr = date.toISOString().split('T')[0];
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            
            // Get pattern function for this employee
            const patternFn = employeeShiftPatterns[employeeId] || getEmployeeShiftPattern(employeeId);
            
            if (!patternFn) {
                return { date: dateStr, type: 'off', startTime: '', endTime: '' };
            }
            
            const pattern = patternFn(dayOfWeek);
            return { date: dateStr, type: pattern.type, startTime: pattern.start, endTime: pattern.end };
        }


        function generateWorkingHoursEventsForRange(startDate, endDate) {
            const events = [];

            // If working hours are not toggled on, return empty list
            if (!showWorkingHours) {
                return events;
            }

            if (!startDate || !endDate) {
                return events;
            }

            const start = new Date(startDate);
            const end = new Date(endDate);

            if (!employeeResources || !Array.isArray(employeeResources) || employeeResources.length === 0) {
                console.warn('employeeResources not available for working hours');
                return events;
            }

            // Normalize to date-only loop
            let current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

            while (current <= last) {
                employeeResources.forEach(employee => {
                    const shift = whGenerateShifts(employee.id, current);
                    if (!shift || shift.type === 'off' || !shift.startTime || !shift.endTime) {
                        return;
                    }

                    const dateStr = shift.date;
                    const startIso = dateStr + 'T' + shift.startTime + ':00';
                    const endIso = dateStr + 'T' + shift.endTime + ':00';
                    
                    // Find clinic and assignment info for this employee
                    let clinicInfo = null;
                    let assignmentInfo = null;
                    
                    // Map employee IDs to provider/assistant IDs for matching
                    const employeeMapping = {
                        'dr-sarah-johnson': { type: 'provider', id: 1 },
                        'dr-michael-chen': { type: 'provider', id: 2 },
                        'dr-robert-lee': { type: 'provider', id: 6 },
                        'dr-patricia-martinez': { type: 'provider', id: 7 },
                        'dr-jennifer-garcia': { type: 'provider', id: 10 },
                        'dr-william-taylor': { type: 'provider', id: 11 },
                        'emma-rodriguez': { type: 'assistant', id: 3 },
                        'james-williams': { type: 'assistant', id: 4 },
                        'lisa-anderson': { type: 'assistant', id: 5 },
                        'david-kim': { type: 'assistant', id: 8 },
                        'susan-brown': { type: 'assistant', id: 9 },
                        'michelle-white': { type: 'assistant', id: 12 }
                    };
                    
                    const empMapping = employeeMapping[employee.id];
                    
                    for (const [clinicId, assignments] of Object.entries(providerAssignments)) {
                        let assignment = null;
                        
                        if (empMapping) {
                            if (empMapping.type === 'provider') {
                                assignment = assignments.find(a => a.providerId === empMapping.id);
                            } else if (empMapping.type === 'assistant') {
                                assignment = assignments.find(a => a.assistantId === empMapping.id);
                            }
                        }
                        
                        // Fallback to name matching
                        if (!assignment) {
                            assignment = assignments.find(a => 
                                a.providerName === employee.title || a.assistantName === employee.title
                            );
                        }
                        
                        if (assignment) {
                            clinicInfo = clinics.find(c => c.id === clinicId);
                            assignmentInfo = assignment;
                            break;
                        }
                    }

                    events.push({
                        id: 'wh-' + employee.id + '-' + dateStr,
                        title: employee.title + ' – Working Hours',
                        start: startIso,
                        end: endIso,
                        employee: employee.id,
                        resourceId: employee.id,
                        type: 'working-hours',
                        eventCategory: 'general',
                        isWorkingHours: true,
                        shiftType: shift.type,
                        extendedProps: {
                            employeeName: employee.title,
                            shiftStart: shift.startTime,
                            shiftEnd: shift.endTime,
                            clinic: clinicInfo ? clinicInfo.name : 'Unassigned',
                            clinicId: clinicInfo ? clinicInfo.id : null,
                            room: assignmentInfo ? assignmentInfo.room : 'N/A',
                            isProvider: assignmentInfo && (assignmentInfo.providerId === empMapping?.id || assignmentInfo.providerName === employee.title),
                            isAssistant: assignmentInfo && (assignmentInfo.assistantId === empMapping?.id || assignmentInfo.assistantName === employee.title),
                            providerName: assignmentInfo && (assignmentInfo.assistantId === empMapping?.id || assignmentInfo.assistantName === employee.title) ? assignmentInfo.providerName : null,
                            assistantName: assignmentInfo && (assignmentInfo.providerId === empMapping?.id || assignmentInfo.providerName === employee.title) ? assignmentInfo.assistantName : null
                        }
                    });
                });

                current.setDate(current.getDate() + 1);
            }

            return events;
        }


        function closeWorkingHours() {
            document.getElementById('workingHoursContainer').classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
        
        // Initialize working hours calendar
        function renderWorkingHoursCalendar() {
            whRenderCalendar();
        }
        
        // Show shift details modal for working hours
        function showWorkingHoursShiftDetails(event) {
            const props = event.extendedProps || {};
            const employeeName = props.employeeName || event.title.replace(' – Working Hours', '');
            const shiftStart = props.shiftStart || 'N/A';
            const shiftEnd = props.shiftEnd || 'N/A';
            const clinic = props.clinic || 'Unassigned';
            const room = props.room || 'N/A';
            const isProvider = props.isProvider;
            const isAssistant = props.isAssistant;
            const providerName = props.providerName;
            const assistantName = props.assistantName;
            
            const role = isProvider ? 'Provider' : isAssistant ? 'Assistant' : 'Staff';
            
            let relationshipInfo = '';
            if (isProvider && assistantName) {
                relationshipInfo = `<div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px; margin-top: 0.5rem;">
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">👥 Assistant:</div>
                    <div style="font-weight: 600; color: var(--text-primary);">${assistantName}</div>
                </div>`;
            } else if (isAssistant && providerName) {
                relationshipInfo = `<div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px; margin-top: 0.5rem;">
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">👨‍⚕️ Provider:</div>
                    <div style="font-weight: 600; color: var(--text-primary);">${providerName}</div>
                </div>`;
            }
            
            const modalHtml = `
                <div id="shiftDetailsModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                    <div style="background: var(--card-bg); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
                            <div>
                                <h3 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                                    <i class="fas fa-clock" style="color: #10b981; margin-right: 0.5rem;"></i>
                                    Working Hours Shift
                                </h3>
                                <p style="color: var(--text-secondary); margin: 0.5rem 0 0 0; font-size: 0.9rem;">${event.start.split('T')[0]}</p>
                            </div>
                            <button onclick="document.getElementById('shiftDetailsModal').remove()" style="background: none; border: none; font-size: 1.5rem; color: var(--text-secondary); cursor: pointer; padding: 0; width: 32px; height: 32px;">&times;</button>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <div style="padding: 1rem; background: var(--accent-light); border-radius: 8px; border-left: 4px solid var(--accent-primary);">
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">👤 Employee</div>
                                <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">${employeeName}</div>
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">${role}</div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">⏰ Start Time</div>
                                    <div style="font-weight: 600; color: var(--text-primary);">${shiftStart}</div>
                                </div>
                                <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">⏰ End Time</div>
                                    <div style="font-weight: 600; color: var(--text-primary);">${shiftEnd}</div>
                                </div>
                            </div>
                            
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">🏥 Clinic</div>
                                <div style="font-weight: 600; color: var(--text-primary);">${clinic}</div>
                            </div>
                            
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">🚪 Room</div>
                                <div style="font-weight: 600; color: var(--text-primary);">${room}</div>
                            </div>
                            
                            ${relationshipInfo}
                        </div>
                        
                        <button onclick="document.getElementById('shiftDetailsModal').remove()" style="margin-top: 1.5rem; width: 100%; padding: 0.75rem; background: var(--accent-primary); color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
                            Close
                        </button>
                    </div>
                </div>
            `;
            
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            const modalEl = modalContainer.firstElementChild;
            
            // Close on background click
            modalEl.addEventListener('click', function(e) {
                if (e.target.id === 'shiftDetailsModal') {
                    modalEl.remove();
                }
            });
            
            document.body.appendChild(modalEl);
        }

        // Show shift detail with Edit and Delete options - CRUD operations
        window.showShiftDetail = function(shiftId) {
            const scheduleSource = Array.isArray(window.myScheduleShifts) ? window.myScheduleShifts : [];
            const normalizedId = String(shiftId || '').trim();
            const shift = scheduleSource.find(s => String(s?.id || '').trim() === normalizedId);
            if (!shift) {
                alert('Shift not found!');
                return;
            }
            
            // Find ALL related shifts (same provider, clinic, time) to show merged view
            const relatedShifts = scheduleSource.filter(s => 
                (s.name || '').trim() === (shift.name || '').trim() &&
                (s.clinic || '').trim() === (shift.clinic || '').trim() &&
                (s.startTime || '').trim() === (shift.startTime || '').trim() &&
                (s.endTime || '').trim() === (shift.endTime || '').trim()
            );
            
            // Collect all related shift IDs for group operations
            const relatedShiftIds = relatedShifts.map(s => s.id);
            
            // Merge rooms from all related shifts
            const allRooms = [];
            relatedShifts.forEach(s => {
                if (s.room && !allRooms.includes(s.room)) {
                    allRooms.push(s.room);
                }
            });
            const mergedRooms = allRooms.join(', ');
            
            // Merge assistants from all related shifts
            const allAssistants = [];
            relatedShifts.forEach(s => {
                if (s.assistant) {
                    s.assistant.split(', ').forEach(a => {
                        if (a.trim() && !allAssistants.includes(a.trim())) {
                            allAssistants.push(a.trim());
                        }
                    });
                }
            });
            const mergedAssistants = allAssistants.join(', ');
            
            // Convert times to 12-hour format
            function convertTo12HourFormat(time24) {
                if (!time24) return time24;
                const [hours, minutes] = time24.split(':');
                let hours24 = parseInt(hours);
                const period = hours24 >= 12 ? 'PM' : 'AM';
                hours24 = hours24 % 12 || 12;
                return `${hours24}:${minutes} ${period}`;
            }
            
            const startTimeDisplay = convertTo12HourFormat(shift.startTime);
            const endTimeDisplay = convertTo12HourFormat(shift.endTime);
            
            const assistantInfo = mergedAssistants ? `
                <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px; margin-top: 0.5rem;">
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">👥 Assistant(s):</div>
                    <div style="font-weight: 600; color: var(--text-primary);">${mergedAssistants}</div>
                </div>
            ` : `
                <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px; margin-top: 0.5rem;">
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">No Assistant Assigned</div>
                </div>
            `;
            
            const dateRange = shift.startDate && shift.endDate 
                ? `${new Date(shift.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${new Date(shift.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'Recurring Schedule';
            
            // Show count if multiple schedules are merged
            const scheduleCountInfo = relatedShifts.length > 1 
                ? `<div style="font-size: 0.75rem; color: var(--accent-primary); margin-top: 0.25rem;"><i class="fas fa-layer-group" style="margin-right: 0.3rem;"></i>${relatedShifts.length} schedules merged</div>` 
                : '';
            
            const modalHtml = `
                <div id="shiftDetailsModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                    <div style="background: var(--card-bg); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3); max-height: 90vh; overflow-y: auto;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
                            <div>
                                <h3 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                                    <i class="fas fa-calendar-check" style="color: ${shift.color}; margin-right: 0.5rem;"></i>
                                    Schedule Details
                                </h3>
                                ${scheduleCountInfo}
                            </div>
                            <button onclick="document.getElementById('shiftDetailsModal').remove()" style="background: none; border: none; font-size: 1.5rem; color: var(--text-secondary); cursor: pointer; padding: 0; width: 32px; height: 32px;">&times;</button>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <div style="padding: 1rem; background: var(--accent-light); border-radius: 8px; border-left: 4px solid ${shift.color};">
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">👤 Provider/Employee</div>
                                <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">${shift.name}</div>
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">${shift.role}</div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">⏰ Start Time</div>
                                    <div style="font-weight: 600; color: var(--text-primary);">${startTimeDisplay}</div>
                                </div>
                                <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">⏰ End Time</div>
                                    <div style="font-weight: 600; color: var(--text-primary);">${endTimeDisplay}</div>
                                </div>
                            </div>
                            
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">🏥 Clinic</div>
                                <div style="font-weight: 600; color: var(--text-primary);">${shift.clinic}</div>
                            </div>
                            
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">🚪 Room(s)</div>
                                <div style="font-weight: 600; color: var(--text-primary);">${mergedRooms || 'N/A'}</div>
                            </div>
                            
                            ${assistantInfo}
                            
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">📅 Working Days</div>
                                <div style="font-weight: 600; color: var(--text-primary);">${shift.days ? shift.days.join(', ') : 'N/A'}</div>
                            </div>
                            
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">📆 Date Range</div>
                                <div style="font-weight: 600; color: var(--text-primary);">${dateRange}</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
                            <button onclick="editShiftGroup('${relatedShiftIds.join(',')}')" style="flex: 1; padding: 0.75rem; background: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button onclick="deleteShiftGroup('${relatedShiftIds.join(',')}')" style="flex: 1; padding: 0.75rem; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                <i class="fas fa-trash"></i> Delete ${relatedShifts.length > 1 ? 'All' : ''}
                            </button>
                        </div>
                        
                        <button onclick="document.getElementById('shiftDetailsModal').remove()" style="margin-top: 0.75rem; width: 100%; padding: 0.75rem; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; font-weight: 600; cursor: pointer;">
                            Close
                        </button>
                    </div>
                </div>
            `;
            
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            const modalEl = modalContainer.firstElementChild;
            
            modalEl.addEventListener('click', function(e) {
                if (e.target.id === 'shiftDetailsModal') {
                    modalEl.remove();
                }
            });
            
            document.body.appendChild(modalEl);
        };
        
        // Delete Shift Function
        window.deleteShift = async function(shiftId, options = {}) {
            const normalizedId = String(shiftId || '').trim();
            const numericRequestedId = toNumericId(normalizedId);
            const scheduleList = Array.isArray(window.myScheduleShifts) ? window.myScheduleShifts : [];
            const findShiftIndex = () => {
                return scheduleList.findIndex((s) => {
                    const localId = String(s?.id || '').trim();
                    if (localId === normalizedId) return true;
                    if (numericRequestedId) {
                        const dbId = toNumericId(s?.dbId || s?.apiId);
                        if (dbId && dbId === numericRequestedId) return true;
                        if (localId === `shift-${numericRequestedId}`) return true;
                    }
                    return false;
                });
            };
            const shiftIndex = findShiftIndex();
            const shift = shiftIndex > -1 ? scheduleList[shiftIndex] : null;
            if (!shift) {
                if (!options.silentNotFound) {
                    alert('Shift not found!');
                }
                return false;
            }

            const skipConfirm = options.skipConfirm === true;
            const confirmDelete = skipConfirm ? true : confirm(`Are you sure you want to delete this schedule?\n\n${shift.name}\n${shift.clinic} - ${shift.room}\n${shift.days?.join(', ')}\n${shift.startTime} - ${shift.endTime}\n\nThis action cannot be undone.`);
            
            if (confirmDelete) {
                // Remove from array
                const index = findShiftIndex();
                if (index > -1) {
                    const shiftToDelete = window.myScheduleShifts[index];
                    const deletedOnApi = await persistShiftDeleteToAPI(shiftToDelete, { silent: true, showToast: true });
                    if (!deletedOnApi && shiftLikelyFromDatabase(shiftToDelete) && !options.silentFailure) {
                        console.warn('⚠️ Database delete failed; applying local delete fallback for shift:', shiftToDelete?.id || shiftId);
                        alert('⚠️ Database delete failed. The schedule was removed locally; please click Refresh later to confirm sync.');
                    }
                    window.myScheduleShifts.splice(index, 1);
                    console.log('🗑️ Shift deleted:', shiftId);
                    
                    // Close modal
                    const modal = document.getElementById('shiftDetailsModal');
                    if (modal) modal.remove();
                    
                    // Refresh calendar
                    if (!options.skipViewSync) {
                        if (typeof window.syncScheduleViewsAfterMutation === 'function') {
                            window.syncScheduleViewsAfterMutation();
                        } else if (typeof window.renderMyScheduleCalendar === 'function') {
                            window.renderMyScheduleCalendar();
                        }
                    }
                    
                    if (!options.silentSuccess) {
                        alert('✅ Schedule deleted successfully!');
                    }
                    return true;
                }
            }

            return false;
        };
        
        // Edit Shift Function - Opens edit modal
        window.editShift = function(shiftId) {
            const scheduleSource = Array.isArray(window.myScheduleShifts) ? window.myScheduleShifts : [];
            const normalizedId = String(shiftId || '').trim();
            const shift = scheduleSource.find(s => String(s?.id || '').trim() === normalizedId);
            if (!shift) {
                alert('Shift not found!');
                return;
            }
            
            // Close the details modal first
            const detailsModal = document.getElementById('shiftDetailsModal');
            if (detailsModal) detailsModal.remove();
            
            // Get options from masterData
            const allEmployees = window.masterData?.getAllEmployees?.() || [];
            const assistants = window.masterData ? window.masterData.getAssistants() : [];
            const clinics = window.masterData ? window.masterData.clinics : [];
            const rooms = window.masterData ? window.masterData.rooms : [];
            const timeSlots = window.masterData ? window.masterData.timeSlots : [];
            
            // Build provider options
            let providerOptions = `<option value="">None</option>` + allEmployees.map(emp => {
                const title = String(emp?.title || '').trim();
                if (!title) return '';
                return `<option value="${title}" ${shift.name === title ? 'selected' : ''}>${title}</option>`;
            }).join('');
            if (shift.name && !allEmployees.some(emp => String(emp?.title || '').trim() === String(shift.name).trim())) {
                providerOptions += `<option value="${shift.name}" selected>${shift.name}</option>`;
            }
            
            // Build assistant options
            let assistantOptions = `<option value="">None</option>` + assistants.map(a => 
                `<option value="${a.title}" ${shift.assistant === a.title ? 'selected' : ''}>${a.title}</option>`
            ).join('');
            
            // Build clinic options
            let clinicOptions = clinics.map(c => 
                `<option value="${c.name}" ${shift.clinic === c.name ? 'selected' : ''}>${c.name}</option>`
            ).join('');
            
            // Build room options
            let roomOptions = rooms.map(r => 
                `<option value="${r.name}" ${shift.room === r.name ? 'selected' : ''}>${r.name}</option>`
            ).join('');
            
            // Build time slot options
            let timeOptions = timeSlots.map(t => {
                const timeValue = t.name;
                const currentTime = `${shift.startTime} - ${shift.endTime}`;
                return `<option value="${t.name}" ${currentTime === t.name ? 'selected' : ''}>${t.name}</option>`;
            }).join('');
            
            // Days checkboxes
            const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            let daysCheckboxes = daysOfWeek.map(day => `
                <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer;">
                    <input type="checkbox" id="editDay${day}" ${shift.days?.includes(day) ? 'checked' : ''}>
                    <span style="font-size: 0.85rem;">${day}</span>
                </label>
            `).join('');
            
            const modalHtml = `
                <div id="editShiftModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center; overflow-y: auto; padding: 1rem;">
                    <div style="background: var(--card-bg); border-radius: 12px; padding: 2rem; max-width: 550px; width: 95%; box-shadow: 0 10px 40px rgba(0,0,0,0.3); max-height: 90vh; overflow-y: auto;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
                            <div>
                                <h3 style="font-size: 1.3rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                                    <i class="fas fa-edit" style="color: #3b82f6; margin-right: 0.5rem;"></i>
                                    Edit Schedule
                                </h3>
                                <p style="color: var(--text-secondary); margin: 0.5rem 0 0 0; font-size: 0.8rem;">ID: ${shift.id}</p>
                            </div>
                            <button onclick="document.getElementById('editShiftModal').remove()" style="background: none; border: none; font-size: 1.5rem; color: var(--text-secondary); cursor: pointer;">&times;</button>
                        </div>
                        
                        <form id="editShiftForm" style="display: flex; flex-direction: column; gap: 1rem;">
                            <input type="hidden" id="editShiftId" value="${shift.id}">
                            
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.3rem;">
                                    <i class="fas fa-user-md" style="margin-right: 0.3rem; color: #10b981;"></i>Provider/Employee
                                </label>
                                <select id="editShiftProvider" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; background: var(--bg-secondary);">
                                    ${providerOptions}
                                </select>
                            </div>
                            
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.3rem;">
                                    <i class="fas fa-hospital" style="margin-right: 0.3rem; color: #f59e0b;"></i>Clinic
                                </label>
                                <select id="editShiftClinic" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; background: var(--bg-secondary);">
                                    ${clinicOptions}
                                </select>
                            </div>
                            
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.3rem;">
                                    <i class="fas fa-door-open" style="margin-right: 0.3rem; color: #8b5cf6;"></i>Room
                                </label>
                                <select id="editShiftRoom" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; background: var(--bg-secondary);">
                                    ${roomOptions}
                                </select>
                            </div>
                            
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.3rem;">
                                    <i class="fas fa-user-nurse" style="margin-right: 0.3rem; color: #ec4899;"></i>Assistant
                                </label>
                                <select id="editShiftAssistant" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; background: var(--bg-secondary);">
                                    ${assistantOptions}
                                </select>
                            </div>
                            
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.3rem;">
                                    <i class="fas fa-clock" style="margin-right: 0.3rem; color: #0891b2;"></i>Time Slot
                                </label>
                                <select id="editShiftTime" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; background: var(--bg-secondary);">
                                    ${timeOptions}
                                </select>
                            </div>
                            
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.5rem;">
                                    <i class="fas fa-calendar-day" style="margin-right: 0.3rem; color: #ef4444;"></i>Working Days
                                </label>
                                <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                    ${daysCheckboxes}
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.3rem;">
                                        <i class="fas fa-calendar" style="margin-right: 0.3rem;"></i>Start Date
                                    </label>
                                    <input type="date" id="editShiftStartDate" value="${shift.startDate || ''}" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; background: var(--bg-secondary);">
                                </div>
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.3rem;">
                                        <i class="fas fa-calendar" style="margin-right: 0.3rem;"></i>End Date
                                    </label>
                                    <input type="date" id="editShiftEndDate" value="${shift.endDate || ''}" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; background: var(--bg-secondary);">
                                </div>
                            </div>
                        </form>
                        
                        <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
                            <button onclick="saveShiftEdit()" style="flex: 1; padding: 0.75rem; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                <i class="fas fa-save"></i> Save Changes
                            </button>
                            <button onclick="document.getElementById('editShiftModal').remove()" style="flex: 1; padding: 0.75rem; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; font-weight: 600; cursor: pointer;">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            const modalEl = modalContainer.firstElementChild;
            
            modalEl.addEventListener('click', function(e) {
                if (e.target.id === 'editShiftModal') {
                    modalEl.remove();
                }
            });
            
            document.body.appendChild(modalEl);
        };
        
        // Save Shift Edit
        window.saveShiftEdit = async function() {
            const shiftId = document.getElementById('editShiftId').value;
            const scheduleSource = Array.isArray(window.myScheduleShifts) ? window.myScheduleShifts : [];
            window.myScheduleShifts = scheduleSource;
            const normalizedId = String(shiftId || '').trim();
            const shiftIndex = scheduleSource.findIndex(s => String(s?.id || '').trim() === normalizedId);
            
            if (shiftIndex === -1) {
                alert('Shift not found!');
                return;
            }
            
            // Get form values
            const selectedPerson = String(document.getElementById('editShiftProvider').value || '').trim();
            const clinic = document.getElementById('editShiftClinic').value;
            const room = document.getElementById('editShiftRoom').value;
            const assistant = document.getElementById('editShiftAssistant').value || null;
            const timeSlot = document.getElementById('editShiftTime').value;
            const startDate = document.getElementById('editShiftStartDate').value;
            const endDate = document.getElementById('editShiftEndDate').value;
            
            // Get selected days
            const days = [];
            ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
                if (document.getElementById('editDay' + day)?.checked) {
                    days.push(day);
                }
            });
            
            if (days.length === 0) {
                alert('Please select at least one working day.');
                return;
            }
            
            // Parse time slot
            const timeParts = timeSlot.split(' - ');
            const convertTo24HourForEdit = (timeValue) => {
                const raw = String(timeValue || '').trim();
                if (!raw) return '';
                const match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
                if (!match) return raw;
                let hours = parseInt(match[1], 10);
                const minutes = match[2];
                const period = String(match[3] || '').toUpperCase();
                if (period === 'PM' && hours !== 12) hours += 12;
                if (period === 'AM' && hours === 12) hours = 0;
                return `${String(hours).padStart(2, '0')}:${minutes}`;
            };
            const startTime = convertTo24HourForEdit(timeParts[0] || '08:00');
            const endTime = convertTo24HourForEdit(timeParts[1] || '16:00');
            
            // Get clinic color
            const clinicData = window.masterData?.getClinicByName(clinic);
            const color = clinicData?.color || scheduleSource[shiftIndex].color;
            const providersSet = new Set(
                (window.masterData?.getProviders?.() || [])
                    .map(p => String(p?.title || '').trim().toLowerCase())
                    .filter(Boolean)
            );
            const allEmployees = window.masterData?.getAllEmployees?.() || [];
            const selectedKey = String(selectedPerson || '').trim().toLowerCase();
            const selectedEmployee = allEmployees.find(e => String(e?.title || '').trim().toLowerCase() === selectedKey);
            const roleFromData = String(selectedEmployee?.extendedProps?.role || selectedEmployee?.role || '').trim();
            const roleLooksDoctor = /doctor|dentist|\bdds\b|\bdmd\b/i.test(roleFromData);
            const titleLooksDoctor = /^dr\.?\s/i.test(selectedPerson);
            const roleLooksEmployee = /assistant|employee|staff|front\s*desk|coordinator|reception/i.test(roleFromData);
            const isProvider = roleLooksDoctor || titleLooksDoctor || (providersSet.has(selectedKey) && !roleLooksEmployee);
            const resolvedRole = isProvider ? 'Provider' : 'Employee';
            const resolvedType = isProvider ? 'provider' : 'assistant';
            const resolvedName = selectedPerson || String(scheduleSource[shiftIndex].name || '').trim();
            
            // Update the shift
            scheduleSource[shiftIndex] = {
                ...scheduleSource[shiftIndex],
                name: resolvedName,
                role: resolvedRole,
                type: resolvedType,
                provider: isProvider ? resolvedName : '',
                clinic: clinic,
                room: room,
                assistant: assistant,
                startTime: startTime,
                endTime: endTime,
                days: days,
                startDate: startDate,
                endDate: endDate,
                color: color
            };

            const updatedOnApi = await persistShiftUpdateToAPI(scheduleSource[shiftIndex], { silent: true, showToast: true });
            
            console.log('✏️ Shift updated:', scheduleSource[shiftIndex]);
            
            // Close modal
            const modal = document.getElementById('editShiftModal');
            if (modal) modal.remove();
            
            // Refresh calendar
            if (typeof window.syncScheduleViewsAfterMutation === 'function') {
                window.syncScheduleViewsAfterMutation();
            } else if (typeof window.renderMyScheduleCalendar === 'function') {
                window.renderMyScheduleCalendar();
            }
            
            if (updatedOnApi) {
                alert('✅ Schedule updated successfully!');
            } else {
                alert('⚠️ Schedule updated locally, but database sync failed. Please click Refresh and retry sync.');
            }
        };
        
        // Delete Shift Group Function - Deletes all related shifts
        window.deleteShiftGroup = async function(shiftIdsString) {
            const shiftIds = shiftIdsString.split(',').filter(id => id.trim());
            const scheduleSource = Array.isArray(window.myScheduleShifts) ? window.myScheduleShifts : [];
            window.myScheduleShifts = scheduleSource;
            
            if (shiftIds.length === 0) {
                alert('No shifts to delete!');
                return;
            }
            
            const firstShiftId = String(shiftIds[0] || '').trim();
            const firstShift = scheduleSource.find(s => String(s?.id || '').trim() === firstShiftId);
            if (!firstShift) {
                alert('Shift not found!');
                return;
            }
            
            const message = shiftIds.length > 1 
                ? `Are you sure you want to delete ALL ${shiftIds.length} related schedules?\n\n${firstShift.name}\n${firstShift.clinic}\n${firstShift.days?.join(', ')}\n${firstShift.startTime} - ${firstShift.endTime}\n\nThis will delete all rooms assigned to this time slot. This action cannot be undone.`
                : `Are you sure you want to delete this schedule?\n\n${firstShift.name}\n${firstShift.clinic} - ${firstShift.room}\n${firstShift.days?.join(', ')}\n${firstShift.startTime} - ${firstShift.endTime}\n\nThis action cannot be undone.`;
            
            const confirmDelete = confirm(message);
            
            if (confirmDelete) {
                let deletedCount = 0;
                let failedDeletes = 0;
                
                // Delete all shifts with these IDs (in reverse order to avoid index issues)
                for (const shiftId of shiftIds) {
                    const normalizedId = String(shiftId || '').trim();
                    const index = scheduleSource.findIndex(s => String(s?.id || '').trim() === normalizedId);
                    if (index > -1) {
                        const shiftToDelete = scheduleSource[index];
                        const deletedOnApi = await persistShiftDeleteToAPI(shiftToDelete, { silent: true });
                        if (deletedOnApi || !shiftLikelyFromDatabase(shiftToDelete)) {
                            scheduleSource.splice(index, 1);
                            deletedCount++;
                        } else {
                            failedDeletes++;
                        }
                    }
                }
                
                console.log(`🗑️ Deleted ${deletedCount} shift(s)`);
                
                // Close modal
                const modal = document.getElementById('shiftDetailsModal');
                if (modal) modal.remove();
                
                // Refresh calendar
                if (typeof window.syncScheduleViewsAfterMutation === 'function') {
                    window.syncScheduleViewsAfterMutation();
                } else if (typeof window.renderMyScheduleCalendar === 'function') {
                    window.renderMyScheduleCalendar();
                }
                
                if (failedDeletes > 0) {
                    alert(`⚠️ Deleted ${deletedCount} schedule(s), but ${failedDeletes} could not be deleted from database.`);
                } else {
                    alert(`✅ ${deletedCount > 1 ? deletedCount + ' schedules' : 'Schedule'} deleted successfully!`);
                }
            }
        };
        
        // Edit Shift Group Function - Opens edit modal for all related shifts
        window.editShiftGroup = function(shiftIdsString) {
            const shiftIds = shiftIdsString.split(',').filter(id => id.trim());
            
            if (shiftIds.length === 0) {
                alert('No shifts to edit!');
                return;
            }
            
            // Get the first shift as reference
            const shift = window.myScheduleShifts.find(s => s.id === shiftIds[0]);
            if (!shift) {
                alert('Shift not found!');
                return;
            }
            
            // Collect all rooms from the group
            const allRooms = [];
            shiftIds.forEach(id => {
                const s = window.myScheduleShifts.find(sh => sh.id === id);
                if (s && s.room && !allRooms.includes(s.room)) {
                    allRooms.push(s.room);
                }
            });
            
            // Close the details modal first
            const detailsModal = document.getElementById('shiftDetailsModal');
            if (detailsModal) detailsModal.remove();
            
            // Get options from masterData
            const allEmployees = window.masterData?.getAllEmployees?.() || [];
            const assistants = window.masterData ? window.masterData.getAssistants() : [];
            const clinics = window.masterData ? window.masterData.clinics : [];
            const rooms = window.masterData ? window.masterData.rooms : [];
            const timeSlots = window.masterData ? window.masterData.timeSlots : [];
            
            // Build provider options
            let providerOptions = `<option value="">None</option>` + allEmployees.map(emp => {
                const title = String(emp?.title || '').trim();
                if (!title) return '';
                return `<option value="${title}" ${shift.name === title ? 'selected' : ''}>${title}</option>`;
            }).join('');
            if (shift.name && !allEmployees.some(emp => String(emp?.title || '').trim() === String(shift.name).trim())) {
                providerOptions += `<option value="${shift.name}" selected>${shift.name}</option>`;
            }
            
            // Build assistant checkboxes (multi-select)
            const currentAssistants = shift.assistant ? shift.assistant.split(', ').map(a => a.trim()) : [];
            let assistantCheckboxes = assistants.map(a => `
                <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer; padding: 0.3rem;">
                    <input type="checkbox" class="editGroupAssistant" value="${a.title}" ${currentAssistants.includes(a.title) ? 'checked' : ''}>
                    <span style="font-size: 0.85rem;">${a.title}</span>
                </label>
            `).join('');
            
            // Build clinic options
            let clinicOptions = clinics.map(c => 
                `<option value="${c.name}" ${shift.clinic === c.name ? 'selected' : ''}>${c.name}</option>`
            ).join('');
            
            // Build room options (checkboxes for multi-select)
            let roomCheckboxes = rooms.map(r => `
                <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer; padding: 0.3rem;">
                    <input type="checkbox" class="editGroupRoom" value="${r.name}" ${allRooms.includes(r.name) ? 'checked' : ''}>
                    <span style="font-size: 0.85rem;">${r.name} <span style="color: var(--text-secondary); font-size: 0.75rem;">(${r.clinic})</span></span>
                </label>
            `).join('');
            
            // Build time slot options
            let timeOptions = timeSlots.map(t => {
                const timeValue = t.name;
                const currentTime = `${shift.startTime} - ${shift.endTime}`;
                return `<option value="${t.name}" ${currentTime === t.name ? 'selected' : ''}>${t.name}</option>`;
            }).join('');
            
            // Days checkboxes
            const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            let daysCheckboxes = daysOfWeek.map(day => `
                <label style="display: flex; align-items: center; gap: 0.3rem; cursor: pointer;">
                    <input type="checkbox" id="editGroupDay${day}" ${shift.days?.includes(day) ? 'checked' : ''}>
                    <span style="font-size: 0.85rem;">${day}</span>
                </label>
            `).join('');
            
            const roomsInfo = allRooms.length > 1 
                ? `<div style="color: #f59e0b; font-size: 0.8rem; margin-bottom: 0.5rem;"><i class="fas fa-info-circle"></i> Editing ${allRooms.length} rooms: ${allRooms.join(', ')}</div>`
                : '';
            
            const modalHtml = `
                <div id="editShiftModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center; overflow-y: auto; padding: 1rem;">
                    <div style="background: var(--card-bg); border-radius: 12px; padding: 2rem; max-width: 550px; width: 95%; box-shadow: 0 10px 40px rgba(0,0,0,0.3); max-height: 90vh; overflow-y: auto;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
                            <div>
                                <h3 style="font-size: 1.3rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                                    <i class="fas fa-edit" style="color: #3b82f6; margin-right: 0.5rem;"></i>
                                    Edit Schedule Group
                                </h3>
                                ${roomsInfo}
                            </div>
                            <button onclick="document.getElementById('editShiftModal').remove()" style="background: none; border: none; font-size: 1.5rem; color: var(--text-secondary); cursor: pointer;">&times;</button>
                        </div>
                        
                        <form id="editShiftGroupForm" style="display: flex; flex-direction: column; gap: 1rem;">
                            <input type="hidden" id="editGroupShiftIds" value="${shiftIds.join(',')}">
                            
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.3rem;">
                                    <i class="fas fa-user-md" style="margin-right: 0.3rem; color: #10b981;"></i>Provider/Employee
                                </label>
                                <select id="editGroupProvider" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; background: var(--bg-secondary);">
                                    ${providerOptions}
                                </select>
                            </div>
                            
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.3rem;">
                                    <i class="fas fa-hospital" style="margin-right: 0.3rem; color: #f59e0b;"></i>Clinic
                                </label>
                                <select id="editGroupClinic" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; background: var(--bg-secondary);">
                                    ${clinicOptions}
                                </select>
                            </div>
                            
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.3rem;">
                                    <i class="fas fa-door-open" style="margin-right: 0.3rem; color: #8b5cf6;"></i>Rooms (select multiple)
                                </label>
                                <div style="max-height: 150px; overflow-y: auto; padding: 0.5rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px;">
                                    ${roomCheckboxes}
                                </div>
                            </div>
                            
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.3rem;">
                                    <i class="fas fa-user-nurse" style="margin-right: 0.3rem; color: #ec4899;"></i>Assistants (select multiple)
                                </label>
                                <div style="max-height: 150px; overflow-y: auto; padding: 0.5rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px;">
                                    ${assistantCheckboxes}
                                </div>
                            </div>
                            
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.3rem;">
                                    <i class="fas fa-clock" style="margin-right: 0.3rem; color: #0891b2;"></i>Time Slot
                                </label>
                                <select id="editGroupTime" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; background: var(--bg-secondary);">
                                    ${timeOptions}
                                </select>
                            </div>
                            
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.5rem;">
                                    <i class="fas fa-calendar-day" style="margin-right: 0.3rem; color: #ef4444;"></i>Working Days
                                </label>
                                <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                    ${daysCheckboxes}
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.3rem;">
                                        <i class="fas fa-calendar" style="margin-right: 0.3rem;"></i>Start Date
                                    </label>
                                    <input type="date" id="editGroupStartDate" value="${shift.startDate || ''}" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; background: var(--bg-secondary);">
                                </div>
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.3rem;">
                                        <i class="fas fa-calendar" style="margin-right: 0.3rem;"></i>End Date
                                    </label>
                                    <input type="date" id="editGroupEndDate" value="${shift.endDate || ''}" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; background: var(--bg-secondary);">
                                </div>
                            </div>
                        </form>
                        
                        <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
                            <button onclick="saveShiftGroupEdit()" style="flex: 1; padding: 0.75rem; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                <i class="fas fa-save"></i> Save Changes
                            </button>
                            <button onclick="document.getElementById('editShiftModal').remove()" style="flex: 1; padding: 0.75rem; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; font-weight: 600; cursor: pointer;">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            const modalEl = modalContainer.firstElementChild;
            
            modalEl.addEventListener('click', function(e) {
                if (e.target.id === 'editShiftModal') {
                    modalEl.remove();
                }
            });
            
            document.body.appendChild(modalEl);
        };
        
        // Save Shift Group Edit
        window.saveShiftGroupEdit = async function() {
            const shiftIdsString = document.getElementById('editGroupShiftIds').value;
            const shiftIds = shiftIdsString.split(',').filter(id => id.trim());
            
            if (shiftIds.length === 0) {
                alert('No shifts to update!');
                return;
            }
            
            // Get form values
            const selectedPerson = String(document.getElementById('editGroupProvider').value || '').trim();
            const clinic = document.getElementById('editGroupClinic').value;
            const timeSlot = document.getElementById('editGroupTime').value;
            const startDate = document.getElementById('editGroupStartDate').value;
            const endDate = document.getElementById('editGroupEndDate').value;
            
            // Get selected rooms
            const selectedRooms = [];
            document.querySelectorAll('.editGroupRoom:checked').forEach(cb => {
                selectedRooms.push(cb.value);
            });
            
            if (selectedRooms.length === 0) {
                alert('Please select at least one room.');
                return;
            }
            
            // Get selected assistants
            const selectedAssistants = [];
            document.querySelectorAll('.editGroupAssistant:checked').forEach(cb => {
                selectedAssistants.push(cb.value);
            });
            const assistantString = selectedAssistants.join(', ');
            
            // Get selected days
            const days = [];
            ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
                if (document.getElementById('editGroupDay' + day)?.checked) {
                    days.push(day);
                }
            });
            
            if (days.length === 0) {
                alert('Please select at least one working day.');
                return;
            }
            
            // Parse time slot
            const timeParts = timeSlot.split(' - ');
            const startTime = timeParts[0] || '08:00';
            const endTime = timeParts[1] || '16:00';
            
            // Get clinic color
            const clinicData = window.masterData?.getClinicByName(clinic);
            const color = clinicData?.color || '#3b82f6';
            
            const providersSet = new Set(
                (window.masterData?.getProviders?.() || [])
                    .map(p => String(p?.title || '').trim().toLowerCase())
                    .filter(Boolean)
            );
            const allEmployees = window.masterData?.getAllEmployees?.() || [];
            const selectedKey = String(selectedPerson || '').trim().toLowerCase();
            const selectedEmployee = allEmployees.find(e => String(e?.title || '').trim().toLowerCase() === selectedKey);
            const roleFromData = String(selectedEmployee?.extendedProps?.role || selectedEmployee?.role || '').trim();
            const roleLooksDoctor = /doctor|dentist|\bdds\b|\bdmd\b/i.test(roleFromData);
            const titleLooksDoctor = /^dr\.?\s/i.test(selectedPerson);
            const roleLooksEmployee = /assistant|employee|staff|front\s*desk|coordinator|reception/i.test(roleFromData);
            const isProvider = roleLooksDoctor || titleLooksDoctor || (providersSet.has(selectedKey) && !roleLooksEmployee);
            const resolvedRole = isProvider ? 'Provider' : 'Employee';
            const resolvedType = isProvider ? 'provider' : 'assistant';

            const fallbackShift = window.myScheduleShifts.find(s => shiftIds.includes(String(s.id)));
            const resolvedName = selectedPerson || String(fallbackShift?.name || '').trim();

            if (!resolvedName) {
                alert('Please select a Provider/Employee before saving this group.');
                return;
            }
            
            // Create new shifts for each selected room
            const timestamp = Date.now();
            let createdCount = 0;
            let createSyncFailures = 0;
            for (const [index, room] of selectedRooms.entries()) {
                const newShift = {
                    id: `shift-${timestamp}-${index}`,
                    name: resolvedName,
                    role: resolvedRole,
                    type: resolvedType,
                    provider: isProvider ? resolvedName : '',
                    clinic: clinic,
                    room: room,
                    assistant: assistantString || null,
                    startTime: startTime,
                    endTime: endTime,
                    days: days,
                    startDate: startDate,
                    endDate: endDate,
                    color: color
                };
                window.myScheduleShifts.push(newShift);
                const savedDbId = await persistShiftCreateToAPI(newShift, { silent: true });
                if (!toNumericId(savedDbId || newShift.dbId)) {
                    createSyncFailures++;
                }
                createdCount++;
            }

            if (createdCount === 0) {
                if (typeof window.syncScheduleViewsAfterMutation === 'function') {
                    window.syncScheduleViewsAfterMutation();
                } else if (typeof window.renderMyScheduleCalendar === 'function') {
                    window.renderMyScheduleCalendar();
                }
                alert('⚠️ Update failed. Original schedule was restored.');
                return;
            }

            // Delete old shifts only after replacement shifts exist.
            let failedOldDeletes = 0;
            for (const shiftId of shiftIds) {
                const normalizedId = String(shiftId || '').trim();
                const index = window.myScheduleShifts.findIndex(s => String(s?.id || '').trim() === normalizedId);
                if (index === -1) continue;

                const shiftToDelete = window.myScheduleShifts[index];
                const deletedOnApi = await persistShiftDeleteToAPI(shiftToDelete, { silent: true });
                if (deletedOnApi || !shiftLikelyFromDatabase(shiftToDelete)) {
                    window.myScheduleShifts.splice(index, 1);
                } else {
                    failedOldDeletes++;
                }
            }
            
            console.log(`✏️ Updated group: ${selectedRooms.length} shift(s) created`);
            
            // Close modal
            const modal = document.getElementById('editShiftModal');
            if (modal) modal.remove();
            
            // Refresh calendar
            if (typeof window.syncScheduleViewsAfterMutation === 'function') {
                window.syncScheduleViewsAfterMutation();
            } else if (typeof window.renderMyScheduleCalendar === 'function') {
                window.renderMyScheduleCalendar();
            }

            if (createSyncFailures > 0 || failedOldDeletes > 0) {
                alert(`⚠️ Schedule updated with warnings. ${createSyncFailures} create sync issue(s), ${failedOldDeletes} old-shift delete issue(s). Please refresh after database recovers.`);
            } else {
                alert(`✅ Schedule updated successfully! (${selectedRooms.length} room(s))`);
            }
        };

        // ==========================================
        // TASK MANAGEMENT SYSTEM - FULL CRUD
        // ==========================================
        
        // Global Tasks Data Store - Loaded from API
        window.tasksData = [];
        
        // Load Tasks from API
        async function loadTasksFromAPI() {
            try {
                console.log('📥 Loading tasks from API...');
                const response = await fetch('/api/tasks');
                if (response.ok) {
                    const apiTasks = await response.json();
                    const localTasks = (apiTasks || []).map(t => ({
                        dbId: (t.Id ?? t.id ?? null),
                        id: `task-${t.Id || t.id}`,
                        title: t.Title || t.title,
                        description: t.Description || t.description || '',
                        assignee: t.Assignee || t.assignee || t.AssignedUserId || t.assignedUserId || '',
                        secondaryAssignee: t.SecondaryAssignee || t.secondaryAssignee || '',
                        clinic: t.ClinicId || t.clinicId || '',
                        dueDate: t.DueDate || t.dueDate || '',
                        dueTime: t.DueTime || t.dueTime || '',
                        priority: t.Priority || t.priority || 'Medium',
                        status: t.Status || t.status || 'Pending',
                        category: t.Category || t.category || '',
                        taskType: t.TaskType || t.taskType || 'general',
                        location: t.Location || t.location || '',
                        recurrence: t.Recurrence || t.recurrence || 'One-time',
                        complianceFlag: t.ComplianceFlag || t.complianceFlag || false,
                        linkedComplianceId: t.LinkedComplianceId || t.linkedComplianceId || t.ComplianceId || t.complianceId || null,
                        linkedComplianceTitle: t.LinkedComplianceTitle || t.linkedComplianceTitle || t.ComplianceTitle || t.complianceTitle || '',
                        linkedComplianceStatus: t.LinkedComplianceStatus || t.linkedComplianceStatus || t.ComplianceStatus || t.complianceStatus || '',
                        isPaid: t.IsPaid || t.isPaid || false,
                        payAmount: t.PayAmount || t.payAmount || 0,
                        timeEstimate: t.TimeEstimate || t.timeEstimate || '',
                        createdAt: t.CreatedAt || t.createdAt || new Date().toISOString(),
                        createdBy: t.CreatedBy || t.createdBy || t.AssignedById || t.assignedById || '',
                        assignedById: t.AssignedById || t.assignedById || null,
                        assignedToId: t.AssignedToId || t.assignedToId || null,
                        claimedBy: t.ClaimedBy || t.claimedBy || null,
                        claimedAt: t.ClaimedAt || t.claimedAt || null,
                        completedAt: t.CompletedAt || t.completedAt || null,
                        completedBy: t.CompletedBy || t.completedBy || null,
                        notes: t.Notes || t.notes || ''
                    }));

                    window.tasksData = localTasks;
                    localStorage.setItem('tasksData', JSON.stringify(localTasks));
                    console.log('✅ Loaded', window.tasksData.length, 'tasks from API');
                    applyClaimCacheToTasks();
                    applyCreatorCacheToTasks();
                    
                    // Sync to calendar
                    if (typeof convertTasksToEvents === 'function') {
                        convertTasksToEvents();
                        if (window.calendarInstance && typeof window.calendarInstance.render === 'function') {
                            window.calendarInstance.render();
                        } else if (window.calendar && typeof window.calendar.refetchEvents === 'function') {
                            window.calendar.refetchEvents();
                        }
                    }
                    
                    // Render task lists
                    if (typeof renderTasksList === 'function') {
                        renderTasksList();
                    }
                    if (typeof renderThisWeekTasks === 'function') {
                        renderThisWeekTasks();
                    }
                    if (typeof renderUnassignedTasksSidebar === 'function') {
                        renderUnassignedTasksSidebar();
                    }
                } else {
                    console.error('❌ Failed to load tasks from API:', response.status);
                }
            } catch (error) {
                console.error('❌ Error loading tasks from API:', error);
            }
        }
        
        // Load tasks on page load
        loadTasksFromAPI();
        
        // Global Duties Data Store - Loaded from API
        window.dutiesData = [];
        
        // Load Duties from API
        async function loadDutiesFromAPI() {
            try {
                console.log('Loading duties from API...');
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
                
                const response = await fetch('/api/duties', {
                    signal: controller.signal,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    window.dutiesData = await response.json();
                    try {
                        localStorage.setItem('dutiesDataCache', JSON.stringify(window.dutiesData));
                    } catch (_) {}
                    console.log('Loaded duties from API:', window.dutiesData.length);
                    renderDutiesCheckboxes();
                    renderMyDuties();
                    try { if (typeof renderManagerSavedUsersData === 'function') renderManagerSavedUsersData(); } catch (_) {}
                    return window.dutiesData;
                } else {
                    console.warn('API returned status:', response.status);
                    throw new Error(`API returned ${response.status}`);
                }
            } catch (error) {
                console.error('Error loading duties:', error);
                // Fallback to cached duties or empty array
                try {
                    const cached = safeParseLocalStorageJSON('dutiesDataCache', [], { expect: 'array' });
                    window.dutiesData = Array.isArray(cached) ? cached : [];
                } catch (_) {
                    window.dutiesData = [];
                }
                renderDutiesCheckboxes();
                renderMyDuties();
                try { if (typeof renderManagerSavedUsersData === 'function') renderManagerSavedUsersData(); } catch (_) {}
            }
            return window.dutiesData || [];
        }
        
        // Render duties checkboxes in user creation form
        function renderDutiesCheckboxes() {
            const container = document.getElementById('dutiesCheckboxContainer');
            if (!container) return;
            
            if (window.dutiesData.length === 0) {
                container.innerHTML = `
                    <div style="color: var(--text-tertiary); font-style: italic; padding: 1rem; grid-column: 1 / -1; text-align: center;">
                        <i class="fas fa-info-circle"></i> No duties available. Create duties in the Duties management section.
                    </div>
                `;
                return;
            }
            
            container.innerHTML = window.dutiesData.map(duty => `
                <label style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem; background: var(--card-bg); border-radius: 6px; cursor: pointer; border: 1px solid var(--border-color); transition: all 0.2s;" 
                       onmouseover="this.style.borderColor='var(--accent-primary)'" 
                       onmouseout="this.style.borderColor='var(--border-color)'">
                    <input type="checkbox" name="selectedDuties" value="${duty.Id}" style="margin-top: 0.25rem; width: 18px; height: 18px; cursor: pointer;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${duty.Name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 0.25rem;">
                            <i class="fas fa-clock" style="margin-right: 0.25rem;"></i>${duty.ScheduleTime || duty.Schedule}
                            ${duty.ScheduleDay ? `<span style="margin-left: 0.5rem;"><i class="fas fa-calendar" style="margin-right: 0.25rem;"></i>${duty.ScheduleDay}</span>` : ''}
                        </div>
                        ${duty.Description ? `<div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.25rem;">${duty.Description.substring(0, 60)}${duty.Description.length > 60 ? '...' : ''}</div>` : ''}
                    </div>
                </label>
            `).join('');
        }

        function renderCompliancesCheckboxes() {
            const container = document.getElementById('compliancesCheckboxContainer');
            if (!container) return;

            const reminderOffsetOptions = [
                { value: '', label: 'No reminder date' },
                { value: '0', label: 'On hire date' },
                { value: '7', label: '7 days after hire date' },
                { value: '14', label: '14 days after hire date' },
                { value: '30', label: '30 days after hire date' },
                { value: '60', label: '60 days after hire date' },
                { value: '90', label: '90 days after hire date' },
                { value: '180', label: '180 days after hire date' },
                { value: '365', label: '365 days after hire date' }
            ];

            const compliances = Array.isArray(window.compliancesData) ? window.compliancesData : [];
            const fallbackTypes = [
                { id: 1, name: 'CPR Certification' },
                { id: 2, name: 'BLS Certification' },
                { id: 3, name: 'HIPAA Training' },
                { id: 4, name: 'OSHA Training' },
                { id: 5, name: 'Infection Control' },
                { id: 6, name: 'DEA License' },
                { id: 7, name: 'State Dental License' },
                { id: 8, name: 'Malpractice Insurance' },
                { id: 9, name: 'Business License' },
                { id: 10, name: 'Fire Safety Inspection' },
                { id: 11, name: 'X-Ray Machine Registration' },
                { id: 12, name: 'Waste Disposal License' },
                { id: 13, name: 'Water Quality Test' },
                { id: 14, name: 'HVAC Maintenance' }
            ];
            const fromStorage = safeParseLocalStorageJSON('complianceTypes', [], { expect: 'array' });
            const normalizedStoredTypes = (Array.isArray(fromStorage) ? fromStorage : [])
                .map(normalizeComplianceTypeRecord)
                .filter(Boolean);
            const cachedTypes = normalizedStoredTypes.length
                ? normalizedStoredTypes
                : (Array.isArray(window.__assignmentComplianceTypes) && window.__assignmentComplianceTypes.length
                    ? window.__assignmentComplianceTypes
                    : fallbackTypes);
            window.__assignmentComplianceTypes = cachedTypes;

            if (!compliances.length) {
                container.innerHTML = `
                    <div style="color: var(--text-tertiary); font-style: italic; padding: 1rem; grid-column: 1 / -1; text-align: center;">
                        <i class="fas fa-info-circle"></i> No compliance records yet. Select compliance types below; records will be created for this user on save.
                    </div>
                    ${cachedTypes.map((type) => `
                        <label style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem; background: var(--card-bg); border-radius: 6px; cursor: pointer; border: 1px solid var(--border-color); transition: all 0.2s;"
                               onmouseover="this.style.borderColor='var(--accent-primary)'"
                               onmouseout="this.style.borderColor='var(--border-color)'">
                            <input type="checkbox" name="selectedComplianceTypes" value="${Number(type.id || type.Id)}" style="margin-top: 0.25rem; width: 18px; height: 18px; cursor: pointer;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${String(type.name || type.Name || 'Compliance Type')}</div>
                                <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 0.25rem;">Will create a compliance record for this user</div>
                                <div style="margin-top: 0.45rem;">
                                    <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-bottom: 0.25rem;">Reminder schedule from hire date</div>
                                    <select data-compliance-type-offset="${Number(type.id || type.Id)}" style="width: 100%; max-width: 260px; padding: 0.45rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--card-bg); color: var(--text-primary); font-size: 0.8rem;" onclick="event.stopPropagation()" onchange="event.stopPropagation()">
                                        ${reminderOffsetOptions.map((option) => {
                                            const defaultOffset = parseReminderOffsetDays(type);
                                            const defaultValue = Number.isInteger(defaultOffset) ? String(defaultOffset) : '';
                                            return `<option value="${option.value}" ${String(option.value) === defaultValue ? 'selected' : ''}>${option.label}</option>`;
                                        }).join('')}
                                    </select>
                                </div>
                            </div>
                        </label>
                    `).join('')}
                `;
                return;
            }

            container.innerHTML = `
                <div style="grid-column: 1 / -1; font-size: 0.8rem; color: var(--text-secondary); padding: 0.25rem 0.25rem 0.5rem 0.25rem;">
                    Existing compliance records (assign directly)
                </div>
                ${compliances.map((record) => {
                const compliance = normalizeComplianceRecord(record) || record;
                const complianceId = compliance.id || compliance.Id;
                return `
                    <label style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem; background: var(--card-bg); border-radius: 6px; cursor: pointer; border: 1px solid var(--border-color); transition: all 0.2s;"
                           onmouseover="this.style.borderColor='var(--accent-primary)'"
                           onmouseout="this.style.borderColor='var(--border-color)'">
                        <input type="checkbox" name="selectedCompliances" value="${complianceId}" style="margin-top: 0.25rem; width: 18px; height: 18px; cursor: pointer;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${compliance.title || '(Untitled Compliance)'}</div>
                            <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 0.25rem;">
                                <i class="fas fa-file-contract" style="margin-right: 0.25rem;"></i>${getComplianceTypeDisplay(compliance)}
                            </div>
                            ${compliance.description ? `<div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.25rem;">${String(compliance.description).substring(0, 60)}${String(compliance.description).length > 60 ? '...' : ''}</div>` : ''}
                        </div>
                    </label>
                `;
                }).join('')}
                <div style="grid-column: 1 / -1; font-size: 0.8rem; color: var(--text-secondary); padding: 0.5rem 0.25rem; border-top: 1px dashed var(--border-color); margin-top: 0.25rem;">
                    Compliance types (create and assign new records to this user)
                </div>
                ${cachedTypes.map((type) => `
                    <label style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem; background: var(--card-bg); border-radius: 6px; cursor: pointer; border: 1px solid var(--border-color); transition: all 0.2s;"
                           onmouseover="this.style.borderColor='var(--accent-primary)'"
                           onmouseout="this.style.borderColor='var(--border-color)'">
                        <input type="checkbox" name="selectedComplianceTypes" value="${Number(type.id || type.Id)}" style="margin-top: 0.25rem; width: 18px; height: 18px; cursor: pointer;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${String(type.name || type.Name || 'Compliance Type')}</div>
                            <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 0.25rem;">Create a new compliance record for this user</div>
                            <div style="margin-top: 0.45rem;">
                                <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-bottom: 0.25rem;">Reminder schedule from hire date</div>
                                <select data-compliance-type-offset="${Number(type.id || type.Id)}" style="width: 100%; max-width: 260px; padding: 0.45rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--card-bg); color: var(--text-primary); font-size: 0.8rem;" onclick="event.stopPropagation()" onchange="event.stopPropagation()">
                                    ${reminderOffsetOptions.map((option) => {
                                        const defaultOffset = parseReminderOffsetDays(type);
                                        const defaultValue = Number.isInteger(defaultOffset) ? String(defaultOffset) : '';
                                        return `<option value="${option.value}" ${String(option.value) === defaultValue ? 'selected' : ''}>${option.label}</option>`;
                                    }).join('')}
                                </select>
                            </div>
                        </div>
                    </label>
                `).join('')}
            `;
        }
        
        // Select/Clear all duties
        function selectAllDuties() {
            document.querySelectorAll('input[name="selectedDuties"]').forEach(cb => cb.checked = true);
        }
        
        function clearAllDuties() {
            document.querySelectorAll('input[name="selectedDuties"]').forEach(cb => cb.checked = false);
        }

        function selectAllUserCompliances() {
            document.querySelectorAll('input[name="selectedCompliances"]').forEach(cb => cb.checked = true);
            document.querySelectorAll('input[name="selectedComplianceTypes"]').forEach(cb => cb.checked = true);
        }

        function clearAllUserCompliances() {
            document.querySelectorAll('input[name="selectedCompliances"]').forEach(cb => cb.checked = false);
            document.querySelectorAll('input[name="selectedComplianceTypes"]').forEach(cb => cb.checked = false);
        }

        function openDutiesPageDirect(event) {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            if (event && typeof event.stopPropagation === 'function') event.stopPropagation();

            if (typeof openDutiesManagement === 'function') {
                const addUserModal = document.getElementById('addUserModal');
                if (addUserModal) addUserModal.style.display = 'none';
                openDutiesManagement(true, 'user-creation');
                return;
            }

            if (typeof openDutyTypeManager === 'function') {
                openDutyTypeManager();
                return;
            }

            showNotification('Duties manager is unavailable right now.', 'error');
        }

        function openCompliancesPageDirect(event) {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            if (event && typeof event.stopPropagation === 'function') event.stopPropagation();

            if (typeof openComplianceTypesManager === 'function') {
                openComplianceTypesManager(true);
                return;
            }

            if (typeof switchContentView === 'function') {
                switchContentView('compliances', event);
                return;
            }

            showNotification('Compliances manager is unavailable right now.', 'error');
        }

        function openRolesPageDirect(event) {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            if (event && typeof event.stopPropagation === 'function') event.stopPropagation();

            if (typeof openRolesManagement === 'function') {
                const rolesModal = document.getElementById('rolesManagementModal');
                const addUserModal = document.getElementById('addUserModal');
                const isAddUserContext = !!(addUserModal && addUserModal.style.display !== 'none');
                if (rolesModal) {
                    rolesModal.removeAttribute('data-return-to-edit-user');
                    rolesModal.removeAttribute('data-return-to-add-user');
                }

                if (isAddUserContext) {
                    const isEditMode = String(typeof addUserModalMode !== 'undefined' ? addUserModalMode : '').toLowerCase() === 'edit';
                    const currentUsername = String(document.getElementById('newUsername')?.value || '').trim();

                    if (rolesModal) {
                        if (isEditMode && currentUsername) {
                            rolesModal.setAttribute('data-return-to-edit-user', currentUsername);
                        } else {
                            rolesModal.setAttribute('data-return-to-add-user', 'true');
                        }
                    }

                    addUserModal.style.display = 'none';
                    addUserModal.setAttribute('data-parked-for-role-management', 'true');
                    if (typeof setTopTabsCreateUserVisibility === 'function') {
                        setTopTabsCreateUserVisibility(false);
                    }
                }

                openRolesManagement(true);
                return;
            }

            showNotification('Roles manager is unavailable right now.', 'error');
        }

        window.openDutiesPageDirect = openDutiesPageDirect;
        window.openCompliancesPageDirect = openCompliancesPageDirect;
        window.openRolesPageDirect = openRolesPageDirect;
        
        // Get selected duty IDs
        function getSelectedDutyIds() {
            const selected = [];
            document.querySelectorAll('input[name="selectedDuties"]:checked').forEach(cb => {
                selected.push(parseInt(cb.value));
            });
            return selected;
        }

        function getSelectedComplianceIds() {
            const selected = [];
            document.querySelectorAll('input[name="selectedCompliances"]:checked').forEach(cb => {
                selected.push(parseInt(cb.value));
            });
            return selected.filter((id) => Number.isInteger(id) && id > 0);
        }

        function getSelectedComplianceTypeIds() {
            const selected = [];
            document.querySelectorAll('input[name="selectedComplianceTypes"]:checked').forEach(cb => {
                selected.push(parseInt(cb.value));
            });
            return selected.filter((id) => Number.isInteger(id) && id > 0);
        }

        function getSelectedComplianceTypeSelections() {
            const selections = [];
            document.querySelectorAll('input[name="selectedComplianceTypes"]:checked').forEach((checkbox) => {
                const typeId = Number.parseInt(String(checkbox.value || ''), 10);
                if (!Number.isInteger(typeId) || typeId <= 0) return;
                const offsetSelect = document.querySelector(`select[data-compliance-type-offset="${typeId}"]`);
                const rawOffset = String(offsetSelect?.value || '').trim();
                const parsedOffset = rawOffset === '' ? null : Number.parseInt(rawOffset, 10);
                selections.push({
                    typeId,
                    reminderOffsetDays: Number.isInteger(parsedOffset) ? parsedOffset : null
                });
            });
            return selections;
        }

        function parseReminderOffsetDays(typeRecord) {
            const candidates = [
                typeRecord?.reminderOffsetDays,
                typeRecord?.ReminderOffsetDays,
                typeRecord?.hireDateReminderOffsetDays,
                typeRecord?.HireDateReminderOffsetDays,
                typeRecord?.reminderLeadDays,
                typeRecord?.ReminderLeadDays
            ];

            for (const candidate of candidates) {
                const parsed = Number.parseInt(String(candidate ?? '').trim(), 10);
                if (Number.isInteger(parsed)) return parsed;
            }

            return null;
        }

        function toDateOnlyValue(dateValue) {
            if (!dateValue) return '';
            const raw = String(dateValue).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
            const parsed = new Date(raw);
            if (Number.isNaN(parsed.getTime())) return '';
            return parsed.toISOString().split('T')[0];
        }

        function addDaysToDateString(baseDate, days) {
            const normalized = toDateOnlyValue(baseDate);
            if (!normalized || !Number.isInteger(Number(days))) return '';
            const [year, month, day] = normalized.split('-').map((value) => Number(value));
            const dateObj = new Date(year, month - 1, day);
            if (Number.isNaN(dateObj.getTime())) return '';
            dateObj.setDate(dateObj.getDate() + Number(days));
            const outYear = dateObj.getFullYear();
            const outMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
            const outDay = String(dateObj.getDate()).padStart(2, '0');
            return `${outYear}-${outMonth}-${outDay}`;
        }

        async function createUserCompliancesFromTypes(userId, selectedTypeSelectionsOrIds, hireDateInput = '') {
            const userIdNumber = Number(userId);
            if (!Number.isInteger(userIdNumber) || userIdNumber <= 0) return [];

            const selectedEntriesRaw = Array.isArray(selectedTypeSelectionsOrIds) ? selectedTypeSelectionsOrIds : [];
            const selectedEntries = selectedEntriesRaw
                .map((entry) => {
                    if (entry && typeof entry === 'object') {
                        const typeId = Number(entry.typeId ?? entry.id);
                        const reminderOffsetDays = entry.reminderOffsetDays === null || entry.reminderOffsetDays === undefined || entry.reminderOffsetDays === ''
                            ? null
                            : Number(entry.reminderOffsetDays);
                        return {
                            typeId,
                            reminderOffsetDays: Number.isInteger(reminderOffsetDays) ? reminderOffsetDays : null
                        };
                    }
                    const typeId = Number(entry);
                    return {
                        typeId,
                        reminderOffsetDays: null
                    };
                })
                .filter((entry) => Number.isInteger(entry.typeId) && entry.typeId > 0);

            const typeIds = Array.from(new Set(selectedEntries.map((entry) => entry.typeId)));
            if (!typeIds.length) return [];

            const selectedByTypeId = new Map(selectedEntries.map((entry) => [entry.typeId, entry]));
            const normalizedHireDate = toDateOnlyValue(hireDateInput) || toDateOnlyValue(new Date());

            try {
                const existingResponse = await fetchComplianceApi('compliances', `?userId=${encodeURIComponent(userIdNumber)}`);
                const existingRecords = existingResponse.ok
                    ? (await existingResponse.json()).map(normalizeComplianceRecord).filter(Boolean)
                    : [];
                const existingTypeIds = new Set(existingRecords
                    .map((record) => Number(record?.complianceTypeId))
                    .filter((value) => Number.isInteger(value) && value > 0));

                let typeRecords = Array.isArray(window.__assignmentComplianceTypes) ? window.__assignmentComplianceTypes : [];
                if (!typeRecords.length) {
                    const typeResponse = await fetchComplianceApi('compliance-types');
                    if (typeResponse.ok) {
                        const rawTypes = await typeResponse.json();
                        typeRecords = (Array.isArray(rawTypes) ? rawTypes : []).map(normalizeComplianceTypeRecord).filter(Boolean);
                    }
                }
                if (!typeRecords.length) {
                    typeRecords = [
                        { id: 1, name: 'CPR Certification' },
                        { id: 2, name: 'BLS Certification' },
                        { id: 3, name: 'HIPAA Training' },
                        { id: 4, name: 'OSHA Training' }
                    ];
                }

                const createdIds = [];
                for (const typeId of typeIds) {
                    if (existingTypeIds.has(typeId)) continue;
                    const type = typeRecords.find((entry) => Number(entry?.id || entry?.Id) === typeId);
                    const typeName = String(type?.name || type?.Name || `Compliance Type #${typeId}`);
                    const selectedEntry = selectedByTypeId.get(typeId);
                    const reminderOffsetDays = selectedEntry?.reminderOffsetDays ?? parseReminderOffsetDays(type);
                    const reminderDate = Number.isInteger(reminderOffsetDays)
                        ? addDaysToDateString(normalizedHireDate, reminderOffsetDays)
                        : '';
                    const payload = {
                        title: typeName,
                        complianceTypeId: typeId,
                        description: `${typeName} assigned during user setup`,
                        userId: userIdNumber,
                        status: 'pending',
                        issueDate: normalizedHireDate,
                        reminderDate,
                        createdById: getCurrentUserId(),
                        modifiedById: getCurrentUserId()
                    };

                    const createResponse = await fetchComplianceApi('compliances', '', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (!createResponse.ok) continue;
                    const created = normalizeComplianceRecord(await createResponse.json());
                    const createdId = Number(created?.id || created?.Id);
                    if (Number.isInteger(createdId) && createdId > 0) createdIds.push(createdId);
                }

                return createdIds;
            } catch (error) {
                console.error('Failed creating compliances from selected types:', error);
                return [];
            }
        }
        
        // Assign duties to user
        async function assignDutiesToUser(userId, dutyIds) {
            try {
                await fetch('/api/duties/assignments', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: Number(userId),
                        selectedDutyIds: Array.isArray(dutyIds) ? dutyIds : []
                    })
                });
                console.log(`Assigned ${dutyIds.length} duties to user ${userId}`);
            } catch (error) {
                console.error('Error assigning duties:', error);
            }
        }

        async function assignCompliancesToUser(userId, complianceIds) {
            try {
                await fetch('/api/compliances/assignments', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: Number(userId),
                        selectedComplianceIds: Array.isArray(complianceIds) ? complianceIds : []
                    })
                });
                console.log(`Assigned ${complianceIds.length} compliances to user ${userId}`);
            } catch (error) {
                console.error('Error assigning compliances:', error);
            }
        }
        
        // Render My Duties in the duties view
        function renderMyDuties() {
            const container = document.getElementById('myDutiesContainer');
            if (!container) return;
            
            const currentUser = safeParseLocalStorageJSON('currentUser', null, { expect: 'objectOrNull' });
            const loggedInUsername = String(localStorage.getItem('loggedInUser') || '').trim();
            const users = (typeof loadUsers === 'function') ? loadUsers() : {};
            const mappedUser = loggedInUsername ? users[loggedInUsername] : null;

            const normalizeKey = (value) => String(value ?? '').trim().toLowerCase();
            const userIdentityKeys = new Set();

            const collectIdentityKeys = (value) => {
                if (value === null || value === undefined) return;
                if (typeof value === 'object') {
                    collectIdentityKeys(value.id);
                    collectIdentityKeys(value.Id);
                    collectIdentityKeys(value.dbId);
                    collectIdentityKeys(value.userId);
                    collectIdentityKeys(value.UserId);
                    collectIdentityKeys(value.username);
                    collectIdentityKeys(value.userName);
                    collectIdentityKeys(value.name);
                    return;
                }

                const normalized = normalizeKey(value);
                if (normalized) {
                    userIdentityKeys.add(normalized);
                }
            };

            collectIdentityKeys(currentUser);
            collectIdentityKeys(mappedUser);
            collectIdentityKeys(currentUser?.username);
            collectIdentityKeys(currentUser?.userName);
            collectIdentityKeys(currentUser?.name);
            collectIdentityKeys(loggedInUsername);
            collectIdentityKeys(localStorage.getItem('userName'));
            collectIdentityKeys(window.currentDbUserId);
            collectIdentityKeys(localStorage.getItem('currentDbUserId'));

            if (typeof getCurrentUserKeys === 'function') {
                try {
                    getCurrentUserKeys().forEach((key) => collectIdentityKeys(key));
                } catch (_) {}
            }

            if (typeof loadEmployeeResourcesFromUsers === 'function') {
                try { loadEmployeeResourcesFromUsers(); } catch (_) {}
            }

            if (typeof employeeResources !== 'undefined' && Array.isArray(employeeResources)) {
                employeeResources.forEach((resource) => {
                    const resourceKeys = [
                        resource?.id,
                        resource?.title,
                        resource?.extendedProps?.username,
                        resource?.extendedProps?.email,
                        resource?.extendedProps?.dbId,
                        resource?.extendedProps?.id
                    ].map(normalizeKey).filter(Boolean);

                    if (resourceKeys.some((key) => userIdentityKeys.has(key))) {
                        resourceKeys.forEach((key) => userIdentityKeys.add(key));
                    }
                });
            }

            const duties = Array.isArray(window.dutiesData) ? window.dutiesData : [];
            const myDuties = duties.filter((duty) => {
                const assignedUserIds = [
                    ...(Array.isArray(duty?.assignedUserIds) ? duty.assignedUserIds : []),
                    ...(Array.isArray(duty?.AssignedUserIds) ? duty.AssignedUserIds : [])
                ];
                const dutyKeys = [
                    duty?.AssignedToUserId,
                    duty?.assignedToUserId,
                    duty?.AssignedToId,
                    duty?.assignedToId,
                    duty?.AssignedUserId,
                    duty?.assignedUserId,
                    duty?.EmployeeId,
                    duty?.employeeId,
                    duty?.AssignedTo,
                    duty?.assignedTo,
                    duty?.AssignedToUsername,
                    duty?.assignedToUsername,
                    duty?.AssignedToName,
                    duty?.assignedToName,
                    duty?.assigned_to_user_id,
                    duty?.assigned_user_id,
                    duty?.assigned_to,
                    duty?.assigned_to_username,
                    duty?.assigned_to_name,
                    duty?.UserId,
                    duty?.userId,
                    duty?.Employee,
                    duty?.employee,
                    duty?.EmployeeName,
                    duty?.employeeName,
                    duty?.EmployeeUsername,
                    duty?.employeeUsername,
                    duty?.resourceId,
                    duty?.ResourceId,
                    duty?.user?.Id,
                    duty?.user?.id,
                    duty?.user?.Username,
                    duty?.user?.username,
                    ...assignedUserIds
                ]
                    .map(normalizeKey)
                    .filter(Boolean);

                if (dutyKeys.length === 0 || userIdentityKeys.size === 0) {
                    return false;
                }

                return dutyKeys.some((key) => userIdentityKeys.has(key));
            });

            const legacyDuties = ((typeof employeeDutiesDatabase !== 'undefined' && Array.isArray(employeeDutiesDatabase)) ? employeeDutiesDatabase : [])
                .filter((duty) => {
                    const dutyKeys = [
                        duty?.employeeId,
                        duty?.employee,
                        duty?.employeeName,
                        duty?.employeeUsername,
                        duty?.username,
                        duty?.userId,
                        duty?.assignedTo,
                        duty?.assignedToUserId,
                        duty?.assignedToUsername
                    ].map(normalizeKey).filter(Boolean);

                    return dutyKeys.some((key) => userIdentityKeys.has(key));
                })
                .map((duty, index) => ({
                    Id: duty?.id || duty?.Id || `legacy-duty-${index}`,
                    Name: duty?.name || duty?.dutyName || duty?.title || 'Duty',
                    Description: duty?.description || duty?.notes || '',
                    Priority: duty?.priority || duty?.Priority || 'Medium',
                    ScheduleTime: duty?.scheduleTime || duty?.time || '',
                    ScheduleDay: duty?.scheduleDay || duty?.day || '',
                    Schedule: duty?.schedule || duty?.frequency || '',
                    Location: duty?.location || duty?.room || '',
                    __legacy: true
                }));

            const allMyDuties = [...myDuties];
            const seenDutyKeys = new Set(myDuties.map((d) => normalizeKey(d?.Id || d?.id || d?.Name || d?.name)));
            legacyDuties.forEach((duty) => {
                const key = normalizeKey(duty?.Id || duty?.id || duty?.Name || duty?.name);
                if (!key || seenDutyKeys.has(key)) return;
                seenDutyKeys.add(key);
                allMyDuties.push(duty);
            });
            
            if (allMyDuties.length === 0) {
                container.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: var(--text-tertiary);">
                        <i class="fas fa-clipboard-check" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                        <p>No duties assigned</p>
                        <p style="font-size: 0.85rem; margin-top: 0.5rem;">Talk to your supervisor to get duties assigned.</p>
                    </div>
                `;
                return;
            }
            
            const priorityColors = {
                'High': '#ef4444',
                'Medium': '#eab308',
                'Low': '#10b981'
            };
            
            container.innerHTML = allMyDuties.map(duty => `
                <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; border-left: 4px solid ${priorityColors[duty.Priority || duty.priority] || '#3b82f6'};">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${duty.Name || duty.name || duty.Title || duty.title || 'Duty'}</div>
                        <span style="font-size: 0.7rem; padding: 0.2rem 0.5rem; background: ${priorityColors[duty.Priority || duty.priority] || '#3b82f6'}20; color: ${priorityColors[duty.Priority || duty.priority] || '#3b82f6'}; border-radius: 4px;">${duty.Priority || duty.priority || 'N/A'}</span>
                    </div>
                    ${(duty.Description || duty.description) ? `<div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 0.25rem;">${duty.Description || duty.description}</div>` : ''}
                    <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.5rem; display: flex; gap: 1rem; flex-wrap: wrap;">
                        ${(duty.ScheduleTime || duty.scheduleTime) ? `<span><i class="fas fa-clock"></i> ${duty.ScheduleTime || duty.scheduleTime}</span>` : ''}
                        ${(duty.ScheduleDay || duty.scheduleDay) ? `<span><i class="fas fa-calendar"></i> ${duty.ScheduleDay || duty.scheduleDay}</span>` : ''}
                        ${(duty.Schedule || duty.schedule) && !(duty.ScheduleTime || duty.scheduleTime) && !(duty.ScheduleDay || duty.scheduleDay) ? `<span><i class="fas fa-sync"></i> ${duty.Schedule || duty.schedule}</span>` : ''}
                        ${(duty.Location || duty.location) ? `<span><i class="fas fa-map-marker-alt"></i> ${duty.Location || duty.location}</span>` : ''}
                    </div>
                </div>
            `).join('');
        }
        
        // Duties Management Modal Functions
        let editingDutyId = null;
        
        function openDutiesManagement(fromUserCreation = false, returnView = 'dashboard') {
            console.log('Opening duties management, fromUserCreation:', fromUserCreation, 'returnView:', returnView);
            // Always open as full page view for consistency
            if (!activateManagementView('manage-duties')) {
                switchContentView('manage-duties');
            }

            // Store return destination for close button
            window.dutiesReturnView = returnView;

            // Ensure master data is loaded
            const loadData = async () => {
                try {
                    if (!window.masterData || !window.masterData.clinics) {
                        // Load clinics and rooms from API if not already loaded
                        if (typeof syncClinicsFromAPI === 'function') {
                            await syncClinicsFromAPI();
                        }
                        if (typeof syncRoomsFromAPI === 'function') {
                            await syncRoomsFromAPI();
                        }
                        if (typeof syncAllData === 'function') {
                            syncAllData();
                        }
                    }

                    // Now populate dropdowns with loaded data
                    if (typeof populateDutyOfficeDropdown === 'function') {
                        populateDutyOfficeDropdown();
                    }
                    if (typeof populateDutyTypeDropdown === 'function') {
                        populateDutyTypeDropdown();
                    }
                } catch (error) {
                    console.error('Duties setup warning:', error);
                }
            };

            loadData();

            // Show loading state
            const listContainer = document.getElementById('dutiesListContainer');
            if (listContainer) {
                listContainer.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: var(--text-tertiary);">
                        <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                        <p>Loading duties...</p>
                    </div>
                `;
            }

            Promise.resolve(typeof loadDutiesFromAPI === 'function' ? loadDutiesFromAPI() : [])
                .catch(error => {
                    console.error('Failed loading duties list:', error);
                    return [];
                })
                .finally(() => {
                    if (!Array.isArray(window.dutiesData)) {
                        window.dutiesData = [];
                    }
                    if (typeof renderDutiesList === 'function') {
                        renderDutiesList();
                    }
                });
        }
        
        // Populate office dropdown for duties
        function populateDutyOfficeDropdown() {
            const offices = loadOffices();
            const dropdown = document.getElementById('dutyOffice');
            if (dropdown) {
                dropdown.innerHTML = '<option value="">Select Office</option>';
                console.log('Populating offices:', offices.length); // Debug logging
                offices.forEach(office => {
                    const option = document.createElement('option');
                    option.value = office.officeID;
                    option.textContent = office.officeName;
                    dropdown.appendChild(option);
                });
            }
        }
        
        // Populate room dropdown for duties based on selected office
        function populateDutyRoomDropdown() {
            const officeId = document.getElementById('dutyOffice').value;
            const roomSelect = document.getElementById('dutyRoom');
            if (!roomSelect) return;

            roomSelect.innerHTML = '<option value="">Select Room</option>';

            if (!officeId) return;

            const rooms = loadRooms();

            // Filter rooms by office ID
            const filteredRooms = rooms.filter(r => {
                const roomOfficeId = String(r.officeID || r.clinicId || '');
                const selectedOfficeId = String(officeId);
                return roomOfficeId === selectedOfficeId;
            });

            if (filteredRooms.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No rooms found for this office';
                option.disabled = true;
                roomSelect.appendChild(option);
                return;
            }

            filteredRooms.forEach(room => {
                const option = document.createElement('option');
                option.value = room.roomID || room.id;
                option.textContent = room.roomName || room.name || room.roomType;
                roomSelect.appendChild(option);
            });
        }
        
        function closeDutiesManagement() {
            const returnView = window.dutiesReturnView || 'dashboard';

            // If coming from user creation, show the user creation modal instead
            if (returnView === 'user-creation') {
                if (typeof switchContentView === 'function') {
                    switchContentView('manage-users', null, { force: true });
                }
                if (typeof window.urrSetActiveTab === 'function') {
                    window.urrSetActiveTab('manager');
                }
                const addUserModal = document.getElementById('addUserModal');
                if (addUserModal) {
                    addUserModal.style.display = 'flex';
                    if (typeof setTopTabsCreateUserVisibility === 'function') {
                        setTopTabsCreateUserVisibility(true);
                    }
                    // Refresh duties checkboxes in the user creation form
                    loadDutiesFromAPI().then(() => {
                        renderDutiesCheckboxes();
                    });
                } else {
                    switchContentView('dashboard');
                }
            } else {
                switchContentView(returnView);
            }
        }
        
        // ============ ROLES MANAGEMENT ============
        
        let editingRoleId = null;

        function normalizeRolesManagementCloseBehavior(fromUserCreation = false) {
            const modal = document.getElementById('rolesManagementModal');
            if (!modal) return;

            const closeBtn = document.querySelector('#rolesManagementModal .login-header button[onclick*="closeRolesManagement"]')
                || document.querySelector('#rolesManagementModal .login-header button[onclick*="closeRolesManagementFromUserCreation"]');

            if (fromUserCreation) {
                modal.setAttribute('data-from-user-creation', 'true');
                modal.style.zIndex = '10200';
                if (closeBtn) {
                    closeBtn.setAttribute('onclick', 'closeRolesManagementFromUserCreation()');
                }
                const formActions = document.querySelector('#rolesManagementModal form .form-group:last-child');
                if (formActions && !formActions.querySelector('.cancel-from-user-creation')) {
                    const cancelBtn = document.createElement('button');
                    cancelBtn.type = 'button';
                    cancelBtn.className = 'cancel-from-user-creation';
                    cancelBtn.style.cssText = 'padding: 0.75rem 1rem; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer;';
                    cancelBtn.innerHTML = '<i class="fas fa-arrow-left"></i> Back to User Creation';
                    cancelBtn.onclick = closeRolesManagementFromUserCreation;
                    formActions.appendChild(cancelBtn);
                }
                return;
            }

            modal.removeAttribute('data-from-user-creation');
            modal.style.zIndex = '10001';
            if (closeBtn) {
                closeBtn.setAttribute('onclick', 'closeRolesManagement()');
            }
            document.querySelectorAll('#rolesManagementModal .cancel-from-user-creation').forEach((btn) => btn.remove());
        }
        
        async function openRolesManagement(fromUserCreation = false) {
            const modal = document.getElementById('rolesManagementModal');
            if (modal) {
                installManagementDraftAutoSave();
                normalizeRolesManagementCloseBehavior(fromUserCreation);
                ensureUnifiedRightRailExpandedForModal();
                modal.style.display = 'flex';

                const rolesListSection = document.getElementById('rolesListSection');
                const roleFormSection = document.getElementById('roleFormSection');
                if (rolesListSection) rolesListSection.style.display = 'block';
                if (roleFormSection) roleFormSection.style.display = 'none';

                await syncRolesFromAPI();
                displayRolesList();
                if (!fromUserCreation) {
                    setTimeout(() => {
                        maybeRestoreRolesDraft();
                    }, 120);
                }
            }
        }
        
        function closeRolesManagement() {
            const modal = document.getElementById('rolesManagementModal');
            const closeChoice = String(window.__rdLastCloseChoice || '').toLowerCase();
            const roleDraftSnapshot = buildRoleDraftSnapshot();
            forceReleaseGlobalModalOverlays();
            if (modal) {
                modal.style.display = 'none';
                modal.style.zIndex = '10001'; // Reset to default z-index
            }
            normalizeRolesManagementCloseBehavior(false);
            editingRoleId = null;
            closeRoleForm();
            if (closeChoice === 'discard') {
                saveManagementDraftCloud('roles', null, true);
            } else if (hasMeaningfulFormDraft(roleDraftSnapshot)) {
                saveManagementDraftCloud('roles', roleDraftSnapshot, false);
            }
            if (closeChoice === 'save' || closeChoice === 'discard') {
                scheduleAppHardRefresh(180);
            }
            window.__rdLastCloseChoice = '';
            forceReleaseGlobalModalOverlays();
        }
        
        function closeRolesManagementFromUserCreation() {
            const modal = document.getElementById('rolesManagementModal');
            forceReleaseGlobalModalOverlays();

            const returnToEditUsername = modal ? String(modal.getAttribute('data-return-to-edit-user') || '').trim() : '';
            const returnToAddUser = !!(modal && modal.getAttribute('data-return-to-add-user') === 'true');

            if (modal) {
                modal.style.display = 'none';
                modal.style.zIndex = '10001'; // Reset to default z-index
                modal.removeAttribute('data-return-to-edit-user');
                modal.removeAttribute('data-return-to-add-user');
            }
            normalizeRolesManagementCloseBehavior(false);
            if (typeof window.urrSetActiveTab === 'function') {
                window.urrSetActiveTab('manager');
            }
            // Refresh roles in user creation form
            syncRolesFromAPI().then(() => {
                if (typeof populateRoleDropdowns === 'function') {
                    populateRoleDropdowns();
                }
                if (typeof populateRoleTypeDropdown === 'function') {
                    populateRoleTypeDropdown();
                }

                if (returnToEditUsername && typeof openEditUserModal === 'function') {
                    setTimeout(() => {
                        openEditUserModal(returnToEditUsername);
                    }, 80);
                    return;
                }

                if (returnToAddUser) {
                    const addUserModal = document.getElementById('addUserModal');
                    if (addUserModal) {
                        ensureUnifiedRightRailExpandedForModal();
                        addUserModal.removeAttribute('data-parked-for-role-management');
                        addUserModal.setAttribute('data-keep-open-across-tabs', 'true');
                        addUserModal.style.display = 'flex';
                        if (typeof setTopTabsCreateUserVisibility === 'function') {
                            setTopTabsCreateUserVisibility(true);
                        }
                    }
                }
            });
            forceReleaseGlobalModalOverlays();
        }
        
        function openAddRoleForm() {
            const rolesListSection = document.getElementById('rolesListSection');
            if (rolesListSection) rolesListSection.style.display = 'none';

            document.getElementById('roleFormSection').style.display = 'block';
            document.getElementById('roleFormTitle').innerHTML = '<i class="fas fa-plus-circle" style="color: var(--accent-primary); margin-right: 0.5rem;"></i>Add New Role';
            document.getElementById('roleSubmitBtn').innerHTML = '<i class="fas fa-plus-circle" style="margin-right: 0.5rem;"></i>Add Role';
            document.getElementById('editRoleId').value = '';
            document.getElementById('createRoleForm').reset();
            document.getElementById('roleFileName').textContent = 'No file selected';
            document.getElementById('roleFileUrl').value = '';
            editingRoleId = null;
            document.getElementById('roleFormSection').scrollIntoView({ behavior: 'smooth' });
        }
        
        function closeRoleForm() {
            document.getElementById('roleFormSection').style.display = 'none';
            document.getElementById('createRoleForm').reset();
            document.getElementById('roleFileName').textContent = 'No file selected';
            document.getElementById('roleFileUrl').value = '';
            editingRoleId = null;

            const rolesListSection = document.getElementById('rolesListSection');
            if (rolesListSection) rolesListSection.style.display = 'block';
        }
        
        function loadRoles() {
            return safeParseLocalStorageJSON('roles', [], { expect: 'array' });
        }
        
        function saveRoles(roles) {
            localStorage.setItem('roles', JSON.stringify(roles));
        }
        
        async function createRole(event) {
            event.preventDefault();
            
            const editId = document.getElementById('editRoleId').value;
            const roleName = document.getElementById('newRoleName').value.trim();
            const roleType = document.getElementById('newRoleType').value.trim();
            const description = document.getElementById('newRoleDescription').value.trim();
            const duties = document.getElementById('newRoleDuties').value.trim();
            const responsibilities = document.getElementById('newRoleResponsibilities').value.trim();
            const fileUrl = document.getElementById('roleFileUrl').value;
            const fileName = document.getElementById('roleFileName').textContent !== 'No file selected' ? document.getElementById('roleFileName').textContent : '';
            const errorDiv = document.getElementById('createRoleError');
            
            if (!roleName) {
                errorDiv.style.display = 'block';
                errorDiv.textContent = 'Role name is required.';
                return;
            }
            
            const roleData = {
                roleName,
                roleType,
                description,
                duties,
                responsibilities,
                fileUrl,
                fileName
            };
            
            try {
                let response;
                if (editId) {
                    response = await fetch(`${API_BASE_URL}/roles/${editId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(roleData)
                    });
                } else {
                    response = await fetch(`${API_BASE_URL}/roles`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(roleData)
                    });
                }
                
                if (response.ok) {
                    showNotification(editId ? 'Role updated successfully!' : 'Role created successfully!', 'success');
                    saveManagementDraftCloud('roles', null, true);
                    await syncRolesFromAPI();
                    displayRolesList();
                    closeRoleForm();
                    populateRoleDropdowns();
                    const rolesModal = document.getElementById('rolesManagementModal');
                    const openedFromUserFlow = rolesModal && rolesModal.getAttribute('data-from-user-creation') === 'true';
                    if (!openedFromUserFlow) {
                        scheduleAppHardRefresh(260);
                    }
                    
                    // If opened from user creation, redirect back
                    if (document.getElementById('rolesManagementModal').getAttribute('data-from-user-creation') === 'true') {
                        closeRolesManagementFromUserCreation();
                    }
                } else {
                    throw new Error('API request failed');
                }
            } catch (error) {
                console.error('Error saving role:', error);
                // Fallback to localStorage
                const roles = loadRoles();
                
                if (editId) {
                    const index = roles.findIndex(r => r.id == editId);
                    if (index !== -1) {
                        roles[index] = { ...roles[index], ...roleData, modifiedDate: new Date().toISOString() };
                    }
                } else {
                    roleData.id = Date.now();
                    roleData.createdDate = new Date().toISOString();
                    roles.push(roleData);
                }
                
                saveRoles(roles);
                showNotification(editId ? 'Role updated locally!' : 'Role created locally!', 'success');
                saveManagementDraftCloud('roles', null, true);
                displayRolesList();
                closeRoleForm();
                populateRoleDropdowns();
                const rolesModal = document.getElementById('rolesManagementModal');
                const openedFromUserFlow = rolesModal && rolesModal.getAttribute('data-from-user-creation') === 'true';
                if (!openedFromUserFlow) {
                    scheduleAppHardRefresh(260);
                }
                
                // If opened from user creation, redirect back
                if (document.getElementById('rolesManagementModal').getAttribute('data-from-user-creation') === 'true') {
                    closeRolesManagementFromUserCreation();
                }
            }
        }
        
        function editRole(roleId) {
            const roles = loadRoles();
            const role = roles.find(r => r.id == roleId);
            
            if (!role) {
                showNotification('Role not found', 'error');
                return;
            }
            
            editingRoleId = roleId;
            document.getElementById('editRoleId').value = roleId;

            const rolesListSection = document.getElementById('rolesListSection');
            if (rolesListSection) rolesListSection.style.display = 'none';

            document.getElementById('roleFormSection').style.display = 'block';
            document.getElementById('roleFormTitle').innerHTML = '<i class="fas fa-edit" style="color: var(--accent-primary); margin-right: 0.5rem;"></i>Edit Role';
            document.getElementById('roleSubmitBtn').innerHTML = '<i class="fas fa-save" style="margin-right: 0.5rem;"></i>Update Role';
            
            document.getElementById('newRoleName').value = role.roleName || '';
            document.getElementById('newRoleType').value = role.roleType || '';
            document.getElementById('newRoleDescription').value = role.description || '';
            document.getElementById('newRoleDuties').value = role.duties || '';
            document.getElementById('newRoleResponsibilities').value = role.responsibilities || '';
            document.getElementById('roleFileUrl').value = role.fileUrl || '';
            document.getElementById('roleFileName').textContent = role.fileName || 'No file selected';
            
            document.getElementById('roleFormSection').scrollIntoView({ behavior: 'smooth' });
        }
        
        async function deleteRole(roleId) {
            if (!confirm('Are you sure you want to delete this role?')) return;
            
            try {
                const response = await fetch(`${API_BASE_URL}/roles/${roleId}`, { method: 'DELETE' });
                if (response.ok) {
                    showNotification('Role deleted successfully!', 'success');
                    await syncRolesFromAPI();
                } else {
                    throw new Error('API delete failed');
                }
            } catch (error) {
                console.error('Error deleting role:', error);
                const roles = loadRoles();
                const updatedRoles = roles.filter(r => r.id != roleId);
                saveRoles(updatedRoles);
                showNotification('Role deleted locally!', 'success');
            }
            
            displayRolesList();
            populateRoleDropdowns();
        }
        
        function viewRole(roleId) {
            const roles = loadRoles();
            const role = roles.find(r => r.id == roleId);
            
            if (!role) {
                showNotification('Role not found', 'error');
                return;
            }
            
            const modalContent = `
                <div id="viewRoleModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10100;">
                    <div style="background: var(--bg-primary); border-radius: 12px; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                        <div style="padding: 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #10b981, #059669); border-radius: 12px 12px 0 0;">
                            <h2 style="margin: 0; color: white; font-size: 1.4rem;">
                                <i class="fas fa-user-tag" style="margin-right: 0.5rem;"></i>${role.roleName}
                            </h2>
                            <button onclick="closeViewRoleModal()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 1.2rem;">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div style="padding: 1.5rem;">
                            ${role.description ? `
                            <div style="background: var(--bg-secondary); border-radius: 10px; padding: 1.25rem; margin-bottom: 1rem;">
                                <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary); font-size: 0.9rem;">
                                    <i class="fas fa-info-circle" style="color: var(--accent-primary); margin-right: 0.5rem;"></i>Description
                                </h4>
                                <p style="margin: 0; color: var(--text-secondary);">${role.description}</p>
                            </div>
                            ` : ''}
                            ${role.duties ? `
                            <div style="background: var(--bg-secondary); border-radius: 10px; padding: 1.25rem; margin-bottom: 1rem;">
                                <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary); font-size: 0.9rem;">
                                    <i class="fas fa-tasks" style="color: #3b82f6; margin-right: 0.5rem;"></i>Duties
                                </h4>
                                <p style="margin: 0; color: var(--text-secondary); white-space: pre-wrap;">${role.duties}</p>
                            </div>
                            ` : ''}
                            ${role.responsibilities ? `
                            <div style="background: var(--bg-secondary); border-radius: 10px; padding: 1.25rem; margin-bottom: 1rem;">
                                <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary); font-size: 0.9rem;">
                                    <i class="fas fa-clipboard-check" style="color: #10b981; margin-right: 0.5rem;"></i>Responsibilities
                                </h4>
                                <p style="margin: 0; color: var(--text-secondary); white-space: pre-wrap;">${role.responsibilities}</p>
                            </div>
                            ` : ''}
                            ${role.fileUrl || role.fileName ? `
                            <div style="background: var(--bg-secondary); border-radius: 10px; padding: 1.25rem;">
                                <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary); font-size: 0.9rem;">
                                    <i class="fas fa-file-alt" style="color: #f59e0b; margin-right: 0.5rem;"></i>Attached Document
                                </h4>
                                <a href="${role.fileUrl || '#'}" target="_blank" style="color: var(--accent-primary); text-decoration: none;">
                                    <i class="fas fa-download" style="margin-right: 0.5rem;"></i>${role.fileName || 'Download File'}
                                </a>
                            </div>
                            ` : ''}
                        </div>
                        <div style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 0.75rem;">
                            <button onclick="closeViewRoleModal(); editRole(${role.id});" style="padding: 0.6rem 1.25rem; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">
                                <i class="fas fa-edit" style="margin-right: 0.5rem;"></i>Edit
                            </button>
                            <button onclick="closeViewRoleModal()" style="padding: 0.6rem 1.25rem; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; font-weight: 500;">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            const existingModal = document.getElementById('viewRoleModal');
            if (existingModal) existingModal.remove();
            document.body.insertAdjacentHTML('beforeend', modalContent);
        }
        
        function closeViewRoleModal() {
            const modal = document.getElementById('viewRoleModal');
            if (modal) modal.remove();
        }
        
        function displayRolesList() {
            const roles = loadRoles();
            const tbody = document.getElementById('rolesTableBody');
            
            if (!tbody) return;
            
            if (roles.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-tertiary);">
                            <i class="fas fa-user-tag" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                            <p>No roles defined yet</p>
                            <p style="font-size: 0.85rem;">Click "Add New Role" to create your first role</p>
                        </td>
                    </tr>
                `;
                return;
            }
            
            tbody.innerHTML = roles.map(role => `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 1rem;">
                        <div style="font-weight: 600; color: var(--text-primary);">${role.roleName || 'Unknown'}</div>
                    </td>
                    <td style="padding: 1rem; color: var(--text-secondary);">${role.roleType || '-'}</td>
                    <td style="padding: 1rem; color: var(--text-secondary);">${role.description || '-'}</td>
                    <td style="padding: 1rem; color: var(--text-secondary);">${(role.duties || '-').substring(0, 50)}${(role.duties || '').length > 50 ? '...' : ''}</td>
                    <td style="padding: 1rem;">
                        ${role.fileName ? `<a href="${role.fileUrl || '#'}" target="_blank" style="color: var(--accent-primary); text-decoration: none;"><i class="fas fa-file-pdf"></i> ${role.fileName}</a>` : '-'}
                    </td>
                    <td style="padding: 1rem; text-align: center;">
                        <div style="display: flex; gap: 0.5rem; justify-content: center;">
                            <button onclick="viewRole(${role.id})" style="padding: 0.5rem 1rem; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer;" title="View">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button onclick="editRole(${role.id})" style="padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer;" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteRole(${role.id})" style="padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
        
        function handleRoleFileUpload(event) {
            const file = event.target.files[0];
            if (file) {
                document.getElementById('roleFileName').textContent = file.name;
                // For now, store as base64 or you can implement Azure Blob storage
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('roleFileUrl').value = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        }
        
        async function syncRolesFromAPI() {
            try {
                const response = await fetch(`${API_BASE_URL}/roles`);
                if (!response.ok) return false;
                const apiRoles = await response.json();
                
                if (apiRoles && apiRoles.length > 0) {
                    const localRoles = apiRoles.map(r => ({
                        id: r.Id || r.id,
                        roleName: r.RoleName || r.roleName || '',
                        description: r.Description || r.description || '',
                        duties: r.Duties || r.duties || '',
                        responsibilities: r.Responsibilities || r.responsibilities || '',
                        fileUrl: r.FileUrl || r.fileUrl || '',
                        fileName: r.FileName || r.fileName || '',
                        createdDate: r.CreatedDate || r.createdDate || '',
                        modifiedDate: r.ModifiedDate || r.modifiedDate || ''
                    }));
                    localStorage.setItem('roles', JSON.stringify(localRoles));
                    console.log('✅ Synced', localRoles.length, 'roles from API');
                    if (typeof populateRoleDropdowns === 'function') {
                        populateRoleDropdowns();
                    }
                }
                return true;
            } catch (error) {
                console.error('❌ Error syncing roles:', error);
                return false;
            }
        }
        
        function populateRoleDropdowns() {
            const roles = loadRoles();
            const newJobRoleSelect = document.getElementById('newJobRole');
            const editJobRoleSelect = document.getElementById('editJobRole');
            
            const options = '<option value="">--Select Role--</option>' + 
                roles.map(r => `<option value="${r.id}">${r.roleName}</option>`).join('');
            
            if (newJobRoleSelect) newJobRoleSelect.innerHTML = options;
            if (editJobRoleSelect) editJobRoleSelect.innerHTML = options;
        }
        
        // ============ PASSWORD MANAGER ============
        
        function openPasswordManager() {
            // Check permission
            const currentUser = safeParseLocalStorageJSON('currentUser', {}, { expect: 'object' });
            const hasPermission = currentUser.role === 'admin' || 
                (currentUser.permissions && currentUser.permissions.password_manager && 
                 currentUser.permissions.password_manager.view === 'full');
            
            if (!hasPermission) {
                showNotification('You do not have permission to access the Password Manager', 'error');
                return;
            }
            
            const modal = document.getElementById('passwordManagerModal');
            if (modal) {
                ensureUnifiedRightRailExpandedForModal();
                modal.style.display = 'flex';
                renderPasswordManagerList();
            }
        }
        
        function closePasswordManager() {
            const modal = document.getElementById('passwordManagerModal');
            if (modal) {
                modal.style.display = 'none';
            }
        }
        
        function renderPasswordManagerList() {
            const tbody = document.getElementById('passwordManagerTableBody');
            if (!tbody) return;
            
            const vendors = loadVendors();
            const vendorsWithCredentials = vendors.filter(v => v.portalUsername || v.portalPassword);
            
            if (vendorsWithCredentials.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-tertiary);">
                            <i class="fas fa-key" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                            <p>No vendor credentials stored yet</p>
                            <p style="font-size: 0.85rem;">Add credentials when creating or editing vendors</p>
                        </td>
                    </tr>
                `;
                return;
            }
            
            tbody.innerHTML = vendorsWithCredentials.map(vendor => `
                <tr style="border-bottom: 1px solid var(--border-color);" class="password-manager-row" data-vendor-name="${(vendor.vendorName || '').toLowerCase()}" data-vendor-type="${(vendor.vendorType || '').toLowerCase()}">
                    <td style="padding: 0.75rem 1rem;">
                        <div style="font-weight: 600; color: var(--text-primary);">${vendor.vendorName || 'Unknown'}</div>
                        ${vendor.contactName ? `<div style="font-size: 0.8rem; color: var(--text-tertiary);">${vendor.contactName}</div>` : ''}
                    </td>
                    <td style="padding: 0.75rem 1rem;">
                        <span style="font-size: 0.85rem; color: var(--text-secondary);">${vendor.vendorType || '-'}</span>
                    </td>
                    <td style="padding: 0.75rem 1rem;">
                        ${vendor.website ? `<a href="${vendor.website.startsWith('http') ? vendor.website : 'https://' + vendor.website}" target="_blank" style="color: var(--accent-primary); text-decoration: none; font-size: 0.85rem;">${vendor.website}</a>` : '-'}
                    </td>
                    <td style="padding: 0.75rem 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-family: monospace; font-size: 0.9rem; color: var(--text-primary);">${vendor.portalUsername || '-'}</span>
                            ${vendor.portalUsername ? `<button onclick="copyToClipboard('${vendor.portalUsername}')" style="background: none; border: none; cursor: pointer; color: var(--text-tertiary); padding: 0.25rem;" title="Copy username"><i class="fas fa-copy"></i></button>` : ''}
                        </div>
                    </td>
                    <td style="padding: 0.75rem 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="password-field" id="pw-${vendor.vendorID}" style="font-family: monospace; font-size: 0.9rem; color: var(--text-primary);">••••••••</span>
                            <span class="password-value" id="pw-val-${vendor.vendorID}" style="display: none;">${vendor.portalPassword || ''}</span>
                            ${vendor.portalPassword ? `
                                <button onclick="togglePasswordVisibility('${vendor.vendorID}')" style="background: none; border: none; cursor: pointer; color: var(--text-tertiary); padding: 0.25rem;" title="Show/Hide password">
                                    <i class="fas fa-eye" id="pw-icon-${vendor.vendorID}"></i>
                                </button>
                                <button onclick="copyToClipboard(document.getElementById('pw-val-${vendor.vendorID}').textContent)" style="background: none; border: none; cursor: pointer; color: var(--text-tertiary); padding: 0.25rem;" title="Copy password">
                                    <i class="fas fa-copy"></i>
                                </button>
                            ` : '-'}
                        </div>
                    </td>
                    <td style="padding: 0.75rem 1rem; text-align: center;">
                        <button onclick="closePasswordManager(); editVendor('${vendor.vendorID}'); openVendorsManagement();" style="padding: 0.4rem 0.6rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;" title="Edit Vendor">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
        
        function togglePasswordVisibility(vendorId) {
            const field = document.getElementById(`pw-${vendorId}`);
            const value = document.getElementById(`pw-val-${vendorId}`);
            const icon = document.getElementById(`pw-icon-${vendorId}`);
            
            if (field.textContent === '••••••••') {
                field.textContent = value.textContent;
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                field.textContent = '••••••••';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        }
        
        function filterPasswordManagerList() {
            const searchTerm = document.getElementById('passwordManagerSearch').value.toLowerCase();
            const rows = document.querySelectorAll('.password-manager-row');
            
            rows.forEach(row => {
                const vendorName = row.getAttribute('data-vendor-name') || '';
                const vendorType = row.getAttribute('data-vendor-type') || '';
                
                if (vendorName.includes(searchTerm) || vendorType.includes(searchTerm)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }
        
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                showNotification('Copied to clipboard', 'success');
            }).catch(() => {
                showNotification('Failed to copy', 'error');
            });
        }
        
        function exportPasswordList() {
            const currentUser = safeParseLocalStorageJSON('currentUser', {}, { expect: 'object' });
            const hasPermission = currentUser.role === 'admin' || 
                (currentUser.permissions && currentUser.permissions.password_manager && 
                 currentUser.permissions.password_manager.export === 'full');
            
            if (!hasPermission) {
                showNotification('You do not have permission to export passwords', 'error');
                return;
            }
            
            const vendors = loadVendors();
            const vendorsWithCredentials = vendors.filter(v => v.portalUsername || v.portalPassword);
            
            if (vendorsWithCredentials.length === 0) {
                showNotification('No credentials to export', 'warning');
                return;
            }
            
            // Create CSV content
            let csv = 'Vendor Name,Type,Website,Username,Password,Contact,Email,Phone\\n';
            vendorsWithCredentials.forEach(v => {
                csv += `"${v.vendorName || ''}","${v.vendorType || ''}","${v.website || ''}","${v.portalUsername || ''}","${v.portalPassword || ''}","${v.contactName || ''}","${v.email || ''}","${v.phone || ''}"\\n`;
            });
            
            // Download file
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vendor-credentials-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showNotification('Credentials exported successfully', 'success');
        }
        
        function renderDutiesList() {
            const container = document.getElementById('dutiesListContainer');
            if (!container) {
                console.error('dutiesListContainer not found');
                return;
            }

            if (!Array.isArray(window.dutiesData)) {
                window.dutiesData = [];
            }

            console.log('Rendering duties list with', window.dutiesData.length, 'duties');

            // Update count
            const countEl = document.getElementById('dutiesCount');
            if (countEl) countEl.textContent = window.dutiesData.length;
            
            if (window.dutiesData.length === 0) {
                container.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: var(--text-tertiary);">
                        <i class="fas fa-clipboard-check" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                        <p>No duties created yet</p>
                        <p style="font-size: 0.85rem; margin-top: 0.5rem;">Create your first duty using the form.</p>
                    </div>
                `;
                return;
            }
            
            const priorityColors = {
                'High': '#ef4444',
                'Medium': '#eab308',
                'Low': '#10b981'
            };
            
            container.innerHTML = window.dutiesData.map(duty => `
                <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; border-left: 4px solid ${priorityColors[duty.Priority] || '#3b82f6'}; margin-bottom: 0.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${duty.Name}</div>
                            ${duty.DutyType ? `<div style="display: inline-block; padding: 0.2rem 0.5rem; background: #f59e0b; color: white; border-radius: 12px; font-size: 0.7rem; font-weight: 500; margin-top: 0.25rem;">${duty.DutyType}</div>` : ''}
                            ${duty.Description ? `<div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 0.25rem;">${duty.Description.substring(0, 80)}${duty.Description.length > 80 ? '...' : ''}</div>` : ''}
                            <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.5rem;">
                                ${duty.ScheduleTime ? `<span style="margin-right: 0.75rem;"><i class="fas fa-clock"></i> ${duty.ScheduleTime}</span>` : ''}
                                ${duty.ScheduleDay ? `<span><i class="fas fa-calendar"></i> ${duty.ScheduleDay}</span>` : ''}
                                ${duty.AssignedToName ? `<span style="margin-left: 0.75rem;"><i class="fas fa-user"></i> ${duty.AssignedToName}</span>` : ''}
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button onclick="editDuty(${duty.Id})" style="padding: 0.4rem 0.6rem; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteDuty(${duty.Id})" style="padding: 0.4rem 0.6rem; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        function resetDutyForm() {
            document.getElementById('dutyName').value = '';
            document.getElementById('dutyDescription').value = '';
            document.getElementById('dutyType').value = '';
            document.getElementById('dutySchedule').value = 'Daily';
            document.getElementById('dutyScheduleTime').value = '';
            document.getElementById('dutyScheduleDay').value = '';
            document.getElementById('dutyOffice').value = '';
            document.getElementById('dutyRoom').innerHTML = '<option value="">Select Room</option>';
            document.getElementById('dutyPriority').value = 'Medium';
            document.getElementById('dutyFormTitle').textContent = 'Add New Duty';
            document.getElementById('saveDutyBtn').innerHTML = '<i class="fas fa-plus"></i> Add Duty';
            editingDutyId = null;
        }
        
        function editDuty(dutyId) {
            const duty = window.dutiesData.find(d => d.Id === dutyId);
            if (!duty) return;

            editingDutyId = dutyId;
            document.getElementById('dutyName').value = duty.Name || '';
            document.getElementById('dutyDescription').value = duty.Description || '';
            document.getElementById('dutyType').value = duty.DutyType || '';
            document.getElementById('dutySchedule').value = duty.Schedule || 'Daily';
            document.getElementById('dutyScheduleTime').value = duty.ScheduleTime || '';
            document.getElementById('dutyScheduleDay').value = duty.ScheduleDay || '';

            // Set office and room
            if (duty.RoomId) {
                const rooms = loadRooms();
                const room = rooms.find(r => String(r.roomID) === String(duty.RoomId));
                if (room) {
                    document.getElementById('dutyOffice').value = room.officeID || room.clinicId || '';
                    populateDutyRoomDropdown();
                    document.getElementById('dutyRoom').value = duty.RoomId;
                }
            } else {
                document.getElementById('dutyOffice').value = '';
                document.getElementById('dutyRoom').innerHTML = '<option value="">Select Room</option>';
            }

            document.getElementById('dutyPriority').value = duty.Priority || 'Medium';
            document.getElementById('dutyFormTitle').textContent = 'Edit Duty';
            document.getElementById('saveDutyBtn').innerHTML = '<i class="fas fa-save"></i> Update Duty';
        }
        
        async function saveDuty(event) {
            event.preventDefault();
            
            const roomId = document.getElementById('dutyRoom').value;
            const roomSelect = document.getElementById('dutyRoom');
            const roomName = roomSelect.options[roomSelect.selectedIndex]?.text || '';
            
            const dutyData = {
                name: document.getElementById('dutyName').value.trim(),
                description: document.getElementById('dutyDescription').value.trim(),
                dutyType: document.getElementById('dutyType').value.trim(),
                schedule: document.getElementById('dutySchedule').value,
                scheduleTime: document.getElementById('dutyScheduleTime').value.trim(),
                scheduleDay: document.getElementById('dutyScheduleDay').value.trim(),
                roomId: roomId || null,
                location: roomName !== 'Select Room' ? roomName : '',
                priority: document.getElementById('dutyPriority').value
            };
            
            console.log('Duty data:', dutyData); // Debug logging
            
            if (!dutyData.name) {
                showNotification('Please enter a duty name', 'error');
                return;
            }
            
            try {
                const url = editingDutyId ? `/api/duties/${editingDutyId}` : '/api/duties';
                const method = editingDutyId ? 'PUT' : 'POST';
                
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dutyData)
                });
                
                if (response.ok) {
                    showNotification(editingDutyId ? 'Duty updated successfully!' : 'Duty created successfully!', 'success');
                    resetDutyForm();
                    await loadDutiesFromAPI();
                    renderDutiesList();
                    
                    // If opened from user creation, redirect back
                    if (document.getElementById('dutiesManagementModal').getAttribute('data-from-user-creation') === 'true') {
                        closeDutiesManagementFromUserCreation();
                    }
                } else {
                    throw new Error('Failed to save duty');
                }
            } catch (error) {
                console.error('Error saving duty:', error);
                showNotification('Failed to save duty', 'error');
            }
        }
        
        async function deleteDuty(dutyId) {
            if (!confirm('Are you sure you want to delete this duty?')) return;
            
            try {
                const response = await fetch(`/api/duties/${dutyId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    showNotification('Duty deleted successfully!', 'success');
                    await loadDutiesFromAPI();
                    renderDutiesList();
                } else {
                    throw new Error('Failed to delete duty');
                }
            } catch (error) {
                console.error('Error deleting duty:', error);
                showNotification('Failed to delete duty', 'error');
            }
        }
        
        // ============================================
        // TEAM CHAT FUNCTIONS
        // ============================================
        window.currentChatUserId = null;
        window.currentChatType = 'direct'; // 'direct', 'group', 'announcement'
        window.currentChatTab = 'direct';
        window.chatPollingInterval = null;
        window.lastMessageTimestamp = null;
        window.chatUsersCache = [];
        window.chatPendingAttachments = [];
        window.chatAttachmentDownloadCache = {};
        window.chatImageReviewState = null;
        window.chatUploadProgressState = null;
        window.chatActiveUploadXhr = null;
        window.chatRetryUploadPayload = null;
        
        function openChat() {
            const panel = document.getElementById('chatPanel');
            if (panel) {
                panel.classList.add('open');
                window.currentChatTab = 'direct';
                window.currentChatType = 'direct';
                try { loadConversations(); } catch (error) { console.error('Failed to load chat conversations:', error); }
                try { startChatPolling(); } catch (error) { console.error('Failed to start chat polling:', error); }
                try { updateOnlineStatus(true); } catch (error) { console.error('Failed to update chat online status:', error); }
                // Attach drag handler
                setTimeout(() => {
                    try { attachChatDrag(); } catch (error) { console.error('Failed to attach chat drag behavior:', error); }
                }, 50);
            }
        }
        
        function closeChat() {
            const panel = document.getElementById('chatPanel');
            if (panel) {
                panel.classList.remove('open', 'fullscreen');
                // Reset position
                panel.classList.remove('dragged');
                panel.style.left = '';
                panel.style.top = '';
                // Reset fullscreen icon
                const btn = document.getElementById('chatFullscreenBtn');
                if (btn) { const i = btn.querySelector('i'); if (i) i.className = 'fas fa-expand'; }
            }
            stopChatPolling();
            window.currentChatUserId = null;
            clearChatAttachmentSelection();
            hideNewChatPanel();
        }

        window.openChat = openChat;
        window.closeChat = closeChat;
        
        // Switch between chat tabs (direct, group, announcements)
        function switchChatTab(tab) {
            console.log('📑 Switching to tab:', tab);
            window.currentChatTab = tab;
            window.currentChatType = tab === 'announcements' ? 'announcement' : tab;
            window.currentChatUserId = null;
            
            // Hide new chat panel if open
            hideNewChatPanel();
            
            // Update tab button styles
            const directBtn = document.getElementById('chatTabDirect');
            const groupBtn = document.getElementById('chatTabGroup');
            const annBtn = document.getElementById('chatTabAnnouncements');
            
            [directBtn, groupBtn, annBtn].forEach(btn => {
                if (btn) {
                    btn.style.background = 'var(--bg-tertiary)';
                    btn.style.color = 'var(--text-secondary)';
                }
            });
            
            if (tab === 'direct' && directBtn) {
                directBtn.style.background = 'var(--accent-primary)';
                directBtn.style.color = 'white';
            } else if (tab === 'group' && groupBtn) {
                groupBtn.style.background = 'var(--accent-primary)';
                groupBtn.style.color = 'white';
            } else if (tab === 'announcements' && annBtn) {
                annBtn.style.background = 'var(--accent-primary)';
                annBtn.style.color = 'white';
            }
            
            // Update button text and visibility
            const newChatBtn = document.getElementById('newChatBtn');
            const newChatBtnText = document.getElementById('newChatBtnText');
            
            if (newChatBtn && newChatBtnText) {
                if (tab === 'direct') {
                    newChatBtn.style.display = 'flex';
                    newChatBtnText.textContent = 'New Chat';
                } else if (tab === 'group') {
                    newChatBtn.style.display = 'flex';
                    newChatBtnText.textContent = 'New Group';
                } else if (tab === 'announcements') {
                    const currentUser = safeParseLocalStorageJSON('currentUser', {}, { expect: 'object' });
                    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
                        newChatBtn.style.display = 'flex';
                        newChatBtnText.textContent = 'New Announcement';
                    } else {
                        newChatBtn.style.display = 'none';
                    }
                }
            }
            
            // Reset chat area
            resetChatArea();
            
            // Load appropriate content based on tab
            if (tab === 'direct') {
                loadConversations();
            } else if (tab === 'group') {
                loadGroupChats();
            } else if (tab === 'announcements') {
                loadAnnouncements();
            }
        }
        window.switchChatTab = switchChatTab;
        
        // Reset chat area to placeholder
        function resetChatArea() {
            const chatHeader = document.getElementById('chatAreaHeader');
            const messageInput = document.getElementById('messageInputArea');
            const messagesArea = document.getElementById('messagesArea');
            const deleteBtn = document.getElementById('chatDeleteConversationBtn');
            
            if (chatHeader) chatHeader.style.display = 'none';
            if (messageInput) messageInput.style.display = 'none';
            if (deleteBtn) deleteBtn.style.display = 'none';
            if (messagesArea) {
                messagesArea.innerHTML = `
                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-tertiary);">
                        <i class="fas fa-comments" style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                        <p style="margin: 0; font-size: 1.1rem;">Select a conversation or start a new chat</p>
                    </div>
                `;
            }
        }
        
        // Close current conversation and go back to list
        function closeChatConversation() {
            console.log('🔙 Closing conversation');
            window.currentChatUserId = null;
            clearChatAttachmentSelection();
            resetChatArea();
        }

        function shouldShowChatDeleteConversationButton() {
            const type = String(window.currentChatType || '').trim();
            const chatId = String(window.currentChatUserId || '').trim();
            if (!type || !chatId) return false;

            if (type === 'direct' || type === 'group') {
                return true;
            }

            if (type === 'announcement') {
                const announcements = safeParseLocalStorageJSON('announcements', [], { expect: 'array' });
                const ann = announcements.find((row) => String(row?.id || '') === chatId);
                if (!ann) return false;

                const currentUser = safeParseLocalStorageJSON('currentUser', {}, { expect: 'object' });
                const role = String(currentUser?.role || '').toLowerCase();
                const displayName = String(currentUser?.name || '').trim().toLowerCase();
                const username = String(currentUser?.username || '').trim().toLowerCase();
                const author = String(ann?.author || '').trim().toLowerCase();

                return role === 'admin' || role === 'manager' || (author && (author === displayName || author === username));
            }

            return false;
        }

        function refreshChatDeleteConversationButton() {
            const btn = document.getElementById('chatDeleteConversationBtn');
            if (!btn) return;
            btn.style.display = shouldShowChatDeleteConversationButton() ? 'inline-flex' : 'none';
        }

        async function deleteCurrentChatConversation() {
            const type = String(window.currentChatType || '').trim();
            const chatId = String(window.currentChatUserId || '').trim();
            if (!type || !chatId) return;

            const confirmLabel = type === 'announcement'
                ? 'Delete this entire announcement thread?'
                : 'Delete this entire chat conversation?';
            if (!confirm(confirmLabel)) return;

            try {
                if (type === 'direct') {
                    const userId = await getCurrentChatUserId();
                    const otherUserId = Number.parseInt(chatId, 10);
                    if (!userId || !Number.isInteger(otherUserId)) {
                        throw new Error('Invalid conversation context');
                    }

                    const response = await fetch(`/api/chat?action=conversation&userId=${userId}&otherUserId=${otherUserId}`, {
                        method: 'DELETE'
                    });
                    if (!response.ok) {
                        throw new Error(`Delete failed: ${response.status}`);
                    }

                    window.currentChatUserId = null;
                    clearChatAttachmentSelection();
                    resetChatArea();
                    await loadConversations();
                    await updateUnreadBadge();
                    if (typeof showNotification === 'function') {
                        showNotification('Conversation deleted', 'success');
                    }
                    return;
                }

                if (type === 'group') {
                    const groups = safeParseLocalStorageJSON('groupChats', [], { expect: 'array' });
                    const nextGroups = groups.filter((g) => String(g?.id || '') !== chatId);
                    if (nextGroups.length === groups.length) return;

                    localStorage.setItem('groupChats', JSON.stringify(nextGroups));
                    window.currentChatUserId = null;
                    clearChatAttachmentSelection();
                    resetChatArea();
                    await loadGroupChats();
                    if (typeof showNotification === 'function') {
                        showNotification('Group chat deleted', 'success');
                    }
                    return;
                }

                if (type === 'announcement') {
                    const announcements = safeParseLocalStorageJSON('announcements', [], { expect: 'array' });
                    const nextAnnouncements = announcements.filter((a) => String(a?.id || '') !== chatId);
                    if (nextAnnouncements.length === announcements.length) return;

                    localStorage.setItem('announcements', JSON.stringify(nextAnnouncements));
                    window.currentChatUserId = null;
                    clearChatAttachmentSelection();
                    resetChatArea();
                    await loadAnnouncements();
                    if (typeof showNotification === 'function') {
                        showNotification('Announcement thread deleted', 'success');
                    }
                }
            } catch (error) {
                console.error('Error deleting conversation:', error);
                if (typeof showNotification === 'function') {
                    showNotification('Failed to delete conversation', 'error');
                }
            }
        }
        
        // Load group chats
        async function loadGroupChats() {
            const container = document.getElementById('conversationsList');
            if (!container) return;
            
            // Load group chats from localStorage (will integrate with API later)
            const groupChats = safeParseLocalStorageJSON('groupChats', [], { expect: 'array' });
            
            if (groupChats.length === 0) {
                container.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: var(--text-tertiary);">
                        <i class="fas fa-users" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                        <p style="margin: 0;">No group chats yet</p>
                        <p style="font-size: 0.85rem; margin-top: 0.5rem;">Create a group to start chatting with multiple team members</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = groupChats.map(group => `
                <div onclick="selectGroupChat('${group.id}')" style="padding: 0.75rem; background: transparent; border-radius: 8px; cursor: pointer; margin-bottom: 0.25rem; transition: all 0.2s;" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='transparent'">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #8b5cf6, #7c3aed); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                            <i class="fas fa-users"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; color: var(--text-primary);">${group.name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-tertiary);">
                                ${group.members?.length || 0} members
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        // Load announcements
        async function loadAnnouncements() {
            const container = document.getElementById('conversationsList');
            if (!container) return;
            
            // Load announcements from localStorage (will integrate with API later)
            const announcements = safeParseLocalStorageJSON('announcements', [], { expect: 'array' });
            
            if (announcements.length === 0) {
                container.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: var(--text-tertiary);">
                        <i class="fas fa-bullhorn" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                        <p style="margin: 0;">No announcements yet</p>
                        <p style="font-size: 0.85rem; margin-top: 0.5rem;">Announcements from management will appear here</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = announcements.map(ann => `
                <div onclick="selectAnnouncement('${ann.id}')" style="padding: 0.75rem; background: transparent; border-radius: 8px; cursor: pointer; margin-bottom: 0.25rem; transition: all 0.2s; border-left: 3px solid ${ann.priority === 'high' ? '#ef4444' : ann.priority === 'medium' ? '#f59e0b' : '#10b981'};" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='transparent'">
                    <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                        <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                            <i class="fas fa-bullhorn"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; color: var(--text-primary);">${ann.title}</div>
                            <div style="font-size: 0.8rem; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${ann.content?.substring(0, 50)}${ann.content?.length > 50 ? '...' : ''}
                            </div>
                            <div style="font-size: 0.7rem; color: var(--text-tertiary); margin-top: 0.25rem;">
                                ${ann.author} • ${formatChatTime(ann.createdAt)}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        // Select group chat
        function selectGroupChat(groupId) {
            console.log('👥 selectGroupChat called with groupId:', groupId);
            const groupChats = safeParseLocalStorageJSON('groupChats', [], { expect: 'array' });
            const group = groupChats.find(g => g.id === groupId);
            if (!group) {
                console.log('❌ Group not found');
                return;
            }
            
            // Set chat type
            window.currentChatType = 'group';
            window.currentChatUserId = groupId;
            
            // Show chat area with null checks
            const chatHeader = document.getElementById('chatAreaHeader');
            const messageInput = document.getElementById('messageInputArea');
            const avatarEl = document.getElementById('chatUserAvatar');
            const nameEl = document.getElementById('chatUserName');
            const statusEl = document.getElementById('chatUserStatus');
            
            if (chatHeader) chatHeader.style.display = 'block';
            if (messageInput) messageInput.style.display = 'block';
            
            // Update header
            if (avatarEl) {
                avatarEl.innerHTML = '<i class="fas fa-users"></i>';
                avatarEl.style.background = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
            }
            if (nameEl) nameEl.textContent = group.name;
            if (statusEl) statusEl.textContent = `${group.members?.length || 0} members`;
            refreshChatDeleteConversationButton();
            
            // Load group messages
            const messages = group.messages || [];
            displayMessages(messages, true);
        }
        
        // Select announcement
        function selectAnnouncement(annId) {
            console.log('📢 selectAnnouncement called with annId:', annId);
            const announcements = safeParseLocalStorageJSON('announcements', [], { expect: 'array' });
            const ann = announcements.find(a => a.id === annId);
            if (!ann) {
                console.log('❌ Announcement not found');
                return;
            }
            
            // Set chat type
            window.currentChatType = 'announcement';
            window.currentChatUserId = annId;
            
            // Show chat area with null checks
            const chatHeader = document.getElementById('chatAreaHeader');
            const messageInput = document.getElementById('messageInputArea');
            const avatarEl = document.getElementById('chatUserAvatar');
            const nameEl = document.getElementById('chatUserName');
            const statusEl = document.getElementById('chatUserStatus');
            const messagesArea = document.getElementById('messagesArea');
            
            if (chatHeader) chatHeader.style.display = 'block';
            
            // Only admins/managers can reply to announcements
            const currentUser = safeParseLocalStorageJSON('currentUser', {}, { expect: 'object' });
            if (messageInput) {
                if (currentUser.role === 'admin' || currentUser.role === 'manager') {
                    messageInput.style.display = 'block';
                } else {
                    messageInput.style.display = 'none';
                }
            }
            
            // Update header
            if (avatarEl) {
                avatarEl.innerHTML = '<i class="fas fa-bullhorn"></i>';
                avatarEl.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
            }
            if (nameEl) nameEl.textContent = ann.title;
            if (statusEl) statusEl.textContent = `By ${ann.author} • ${formatChatTime(ann.createdAt)}${ann.recipients ? ` • Sent to ${ann.recipients.length} employees` : ''}`;
            refreshChatDeleteConversationButton();
            
            // Display announcement content
            if (messagesArea) {
                messagesArea.innerHTML = `
                    <div style="max-width: 90%; padding: 1rem; background: linear-gradient(135deg, #fef3c7, #fde68a); border-radius: 12px; border-left: 4px solid #f59e0b; margin-bottom: 1rem;">
                        <div style="font-weight: 600; color: #92400e; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-bullhorn"></i> ${ann.title}
                        </div>
                        <div style="color: #78350f; white-space: pre-wrap;">${ann.content}</div>
                        <div style="font-size: 0.75rem; color: #92400e; margin-top: 0.75rem; opacity: 0.8;">
                            Posted by ${ann.author} on ${new Date(ann.createdAt).toLocaleDateString()}
                        </div>
                    </div>
                    ${ann.replies && ann.replies.length > 0 ? ann.replies.map(reply => `
                        <div style="max-width: 80%; margin-left: auto; padding: 0.75rem 1rem; background: var(--bg-secondary); border-radius: 12px; margin-bottom: 0.5rem;">
                            <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-bottom: 0.25rem;">${reply.author}</div>
                            <div style="color: var(--text-primary);">${reply.content}</div>
                        </div>
                    `).join('') : ''}
                `;
            }
        }
        
        // Display messages helper
        function displayMessages(messages, isGroup = false) {
            const messagesArea = document.getElementById('messagesArea');
            const currentUser = safeParseLocalStorageJSON('currentUser', {}, { expect: 'object' });
            
            if (!messages || messages.length === 0) {
                messagesArea.innerHTML = `
                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-tertiary);">
                        <i class="fas fa-comment-slash" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.3;"></i>
                        <p style="margin: 0;">No messages yet. Start the conversation!</p>
                    </div>
                `;
                return;
            }
            
            messagesArea.innerHTML = messages.map(msg => {
                const isOwn = msg.senderId === currentUser.username || msg.sender === currentUser.name;
                const attachments = Array.isArray(msg.attachments) ? msg.attachments : (Array.isArray(msg.Attachments) ? msg.Attachments : []);
                const textBody = String(msg.content || msg.message || '').trim();
                const attachmentsHtml = renderChatAttachmentListHtml(attachments, msg.id || msg.timestamp || `local-${Math.random().toString(36).slice(2, 9)}`);
                const canDeleteLocal = isGroup && isOwn && msg && msg.id !== undefined && msg.id !== null;
                return `
                    <div style="display: flex; ${isOwn ? 'justify-content: flex-end' : 'justify-content: flex-start'};">
                        <div style="max-width: 70%; padding: 0.75rem 1rem; background: ${isOwn ? 'var(--accent-primary)' : 'var(--bg-secondary)'}; color: ${isOwn ? 'white' : 'var(--text-primary)'}; border-radius: ${isOwn ? '12px 12px 0 12px' : '12px 12px 12px 0'}; position: relative;">
                            ${canDeleteLocal ? `<button type="button" title="Delete message" onclick="deleteGroupMessageById('${String(window.currentChatUserId || '').replace(/'/g, "\\'")}', '${String(msg.id).replace(/'/g, "\\'")}')" style="position:absolute; top:0.3rem; right:0.3rem; background:transparent; border:none; color:inherit; opacity:0.75; cursor:pointer; padding:0.15rem;"><i class="fas fa-trash"></i></button>` : ''}
                            ${isGroup && !isOwn ? `<div style="font-size: 0.7rem; font-weight: 600; margin-bottom: 0.25rem; opacity: 0.8;">${msg.sender || 'Unknown'}</div>` : ''}
                            ${textBody ? `<div>${escapeHtml(textBody)}</div>` : ''}
                            ${attachmentsHtml}
                            <div style="font-size: 0.65rem; opacity: 0.7; margin-top: 0.25rem; text-align: right;">
                                ${formatChatTime(msg.timestamp || msg.createdAt)}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
        
        // Show new chat/group/announcement panel
        function showNewChatPanel() {
            console.log('🆕 showNewChatPanel called, currentChatTab:', window.currentChatTab);
            if (window.currentChatTab === 'direct') {
                showDirectChatPanel();
            } else if (window.currentChatTab === 'group') {
                showCreateGroupPanel();
            } else if (window.currentChatTab === 'announcements') {
                showCreateAnnouncementPanel();
            }
        }
        window.showNewChatPanel = showNewChatPanel;
        
        // Show direct chat user selection panel
        function showDirectChatPanel() {
            console.log('🆕 showDirectChatPanel called');
            const panel = document.getElementById('newChatPanel');
            console.log('🆕 newChatPanel element:', panel);
            if (panel) {
                panel.style.display = 'block';
                panel.innerHTML = `
                    <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 1rem;">
                        <button onclick="hideNewChatPanel()" style="background: none; border: none; cursor: pointer; color: var(--text-tertiary); font-size: 1.25rem;">
                            <i class="fas fa-arrow-left"></i>
                        </button>
                        <h4 style="margin: 0; color: var(--text-primary);">Start New Chat</h4>
                    </div>
                    <div style="padding: 1rem;">
                        <input type="text" id="userSearchInput" placeholder="Search team members..." oninput="filterChatUsers()" style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); margin-bottom: 1rem;">
                    </div>
                    <div id="chatUsersList" style="padding: 0 1rem; overflow-y: auto; max-height: calc(100% - 140px);">
                        <div style="text-align: center; padding: 1rem; color: var(--text-tertiary);"><i class="fas fa-spinner fa-spin"></i> Loading users...</div>
                    </div>
                `;
                const localUsers = getLocalChatUsersList();
                if (localUsers.length > 0) {
                    window.chatUsersCache = localUsers;
                    renderChatUsersListLocal(localUsers);
                }
                loadChatUsers();
            } else {
                console.error('❌ newChatPanel not found!');
            }
        }
        
        // Show create group panel
        function showCreateGroupPanel() {
            const panel = document.getElementById('newChatPanel');
            if (panel) {
                panel.style.display = 'block';
                panel.innerHTML = `
                    <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 1rem;">
                        <button onclick="hideNewChatPanel()" style="background: none; border: none; cursor: pointer; color: var(--text-tertiary); font-size: 1.25rem;">
                            <i class="fas fa-arrow-left"></i>
                        </button>
                        <h4 style="margin: 0; color: var(--text-primary);">Create New Group</h4>
                    </div>
                    <div style="padding: 1rem; overflow-y: auto; max-height: calc(100vh - 200px);">
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.5rem;">Group Name *</label>
                            <input type="text" id="newGroupName" placeholder="Enter group name..." style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary);">
                        </div>
                        <div class="form-group">
                            <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.5rem;">
                                <i class="fas fa-user-plus" style="margin-right: 0.5rem;"></i>Select Members *
                            </label>
                            <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <button type="button" onclick="selectAllGroupMembers()" style="padding: 0.4rem 0.75rem; font-size: 0.75rem; background: var(--accent-primary); color: white; border: none; border-radius: 4px; cursor: pointer;">
                                    <i class="fas fa-check-double"></i> Select All
                                </button>
                                <button type="button" onclick="clearAllGroupMembers()" style="padding: 0.4rem 0.75rem; font-size: 0.75rem; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">
                                    <i class="fas fa-times"></i> Clear All
                                </button>
                            </div>
                            <div id="groupMembersList" style="max-height: 250px; overflow-y: auto; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.5rem;">
                                Loading members...
                            </div>
                            <div id="groupMembersCount" style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.5rem;">
                                0 members selected
                            </div>
                        </div>
                        <button onclick="createGroup()" style="width: 100%; padding: 0.75rem; background: var(--accent-primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; margin-top: 1rem;">
                            <i class="fas fa-plus"></i> Create Group
                        </button>
                    </div>
                `;
                loadGroupMembers();
            }
        }
        window.showCreateGroupPanel = showCreateGroupPanel;
        
        // Show create announcement panel
        function showCreateAnnouncementPanel() {
            const panel = document.getElementById('newChatPanel');
            if (panel) {
                panel.style.display = 'block';
                const currentUser = safeParseLocalStorageJSON('currentUser', {}, { expect: 'object' });
                panel.innerHTML = `
                    <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 1rem;">
                        <button onclick="hideNewChatPanel()" style="background: none; border: none; cursor: pointer; color: var(--text-tertiary); font-size: 1.25rem;">
                            <i class="fas fa-arrow-left"></i>
                        </button>
                        <h4 style="margin: 0; color: var(--text-primary);">Create Announcement</h4>
                    </div>
                    <div style="padding: 1rem; overflow-y: auto; max-height: calc(100vh - 200px);">
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.5rem;">Title *</label>
                            <input type="text" id="announcementTitle" placeholder="Announcement title..." style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary);">
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.5rem;">Content *</label>
                            <textarea id="announcementContent" placeholder="Write your announcement..." rows="4" style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); resize: vertical;"></textarea>
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.5rem;">Priority</label>
                            <select id="announcementPriority" style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary);">
                                <option value="low">🟢 Low - General Information</option>
                                <option value="medium" selected>🟡 Medium - Important Update</option>
                                <option value="high">🔴 High - Urgent/Critical</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.5rem;">
                                <i class="fas fa-users" style="margin-right: 0.5rem;"></i>Select Recipients *
                            </label>
                            <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <button type="button" onclick="selectAllAnnouncementRecipients()" style="padding: 0.4rem 0.75rem; font-size: 0.75rem; background: var(--accent-primary); color: white; border: none; border-radius: 4px; cursor: pointer;">
                                    <i class="fas fa-check-double"></i> Select All
                                </button>
                                <button type="button" onclick="clearAllAnnouncementRecipients()" style="padding: 0.4rem 0.75rem; font-size: 0.75rem; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">
                                    <i class="fas fa-times"></i> Clear All
                                </button>
                            </div>
                            <div id="announcementRecipientsList" style="max-height: 200px; overflow-y: auto; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.5rem;">
                                Loading employees...
                            </div>
                            <div id="announcementRecipientsCount" style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.5rem;">
                                0 employees selected
                            </div>
                        </div>
                        <button onclick="createAnnouncement()" style="width: 100%; padding: 0.75rem; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            <i class="fas fa-bullhorn"></i> Post Announcement
                        </button>
                    </div>
                `;
                loadAnnouncementRecipients();
            }
        }
        window.showCreateAnnouncementPanel = showCreateAnnouncementPanel;
        
        // Load employees for announcement recipients
        async function loadAnnouncementRecipients() {
            const container = document.getElementById('announcementRecipientsList');
            if (!container) return;
            
            container.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: 1rem;"><i class="fas fa-spinner fa-spin"></i> Loading employees...</p>';
            
            try {
                // Load all users from database
                const response = await fetch('/api/users');
                if (!response.ok) throw new Error('Failed to load users');
                
                const dbUsers = await response.json();
                console.log('👥 Loaded announcement recipients from database:', dbUsers.length);
                
                if (dbUsers.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: 1rem;">No employees found</p>';
                    return;
                }
                
                container.innerHTML = dbUsers.map(emp => `
                    <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; cursor: pointer; border-radius: 6px; transition: background 0.2s; border: 1px solid transparent;" onmouseover="this.style.background='var(--bg-tertiary)'; this.style.borderColor='var(--border-color)'" onmouseout="this.style.background='transparent'; this.style.borderColor='transparent'">
                        <input type="checkbox" name="announcementRecipients" value="${emp.Id}" onchange="updateAnnouncementRecipientsCount()" style="width: 20px; height: 20px; accent-color: #f59e0b; cursor: pointer; flex-shrink: 0;">
                        <div style="flex: 1;">
                            <div style="font-weight: 500; color: var(--text-primary); font-size: 0.9rem;">${emp.FirstName} ${emp.LastName}</div>
                            <div style="font-size: 0.75rem; color: var(--text-tertiary);">${emp.Role || 'Staff'}</div>
                        </div>
                    </label>
                `).join('');
                
            } catch (error) {
                console.error('Error loading announcement recipients:', error);
                container.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 1rem;"><i class="fas fa-exclamation-circle"></i> Failed to load employees</p>';
            }
        }
        window.loadAnnouncementRecipients = loadAnnouncementRecipients;
        
        // Select all announcement recipients
        function selectAllAnnouncementRecipients() {
            const checkboxes = document.querySelectorAll('input[name="announcementRecipients"]');
            checkboxes.forEach(cb => cb.checked = true);
            updateAnnouncementRecipientsCount();
        }
        window.selectAllAnnouncementRecipients = selectAllAnnouncementRecipients;
        
        // Clear all announcement recipients
        function clearAllAnnouncementRecipients() {
            const checkboxes = document.querySelectorAll('input[name="announcementRecipients"]');
            checkboxes.forEach(cb => cb.checked = false);
            updateAnnouncementRecipientsCount();
        }
        window.clearAllAnnouncementRecipients = clearAllAnnouncementRecipients;
        
        // Update recipients count display
        function updateAnnouncementRecipientsCount() {
            const checkboxes = document.querySelectorAll('input[name="announcementRecipients"]:checked');
            const countDisplay = document.getElementById('announcementRecipientsCount');
            if (countDisplay) {
                countDisplay.textContent = `${checkboxes.length} employee${checkboxes.length !== 1 ? 's' : ''} selected`;
                countDisplay.style.color = checkboxes.length > 0 ? 'var(--accent-primary)' : 'var(--text-tertiary)';
            }
        }
        window.updateAnnouncementRecipientsCount = updateAnnouncementRecipientsCount;
        
        // Load members for group creation
        async function loadGroupMembers() {
            const container = document.getElementById('groupMembersList');
            if (!container) return;
            
            container.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: 1rem;"><i class="fas fa-spinner fa-spin"></i> Loading members...</p>';
            
            const userId = await getCurrentChatUserId();
            
            try {
                // Load users from database
                const response = await fetch(`/api/chat?action=users&userId=${userId}`);
                if (!response.ok) throw new Error('Failed to load users');
                
                const dbUsers = await response.json();
                console.log('👥 Loaded group members from database:', dbUsers.length);
                
                if (dbUsers.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: 1rem;">No other team members found</p>';
                    return;
                }
                
                container.innerHTML = dbUsers.map(member => `
                    <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; cursor: pointer; border-radius: 6px; transition: background 0.2s; border: 1px solid transparent;" onmouseover="this.style.background='var(--bg-tertiary)'; this.style.borderColor='var(--border-color)'" onmouseout="this.style.background='transparent'; this.style.borderColor='transparent'">
                        <input type="checkbox" name="groupMembers" value="${member.Id}" onchange="updateGroupMembersCount()" style="width: 20px; height: 20px; accent-color: #06b6d4; cursor: pointer; flex-shrink: 0; border: 2px solid var(--border-color); border-radius: 4px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 500; color: var(--text-primary); font-size: 0.9rem;">${member.FirstName} ${member.LastName}</div>
                            <div style="font-size: 0.75rem; color: var(--text-tertiary);">${member.Role || 'Staff'}</div>
                        </div>
                        <span class="checkmark-indicator" style="width: 24px; height: 24px; border-radius: 50%; background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; color: transparent; font-size: 0.75rem; transition: all 0.2s;">✓</span>
                    </label>
                `).join('');
                
            } catch (error) {
                console.error('Error loading group members:', error);
                container.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 1rem;"><i class="fas fa-exclamation-circle"></i> Failed to load members</p>';
            }
        }
        window.loadGroupMembers = loadGroupMembers;
        
        // Select all group members
        function selectAllGroupMembers() {
            const checkboxes = document.querySelectorAll('input[name="groupMembers"]');
            checkboxes.forEach(cb => cb.checked = true);
            updateGroupMembersCount();
        }
        window.selectAllGroupMembers = selectAllGroupMembers;
        
        // Clear all group members
        function clearAllGroupMembers() {
            const checkboxes = document.querySelectorAll('input[name="groupMembers"]');
            checkboxes.forEach(cb => cb.checked = false);
            updateGroupMembersCount();
        }
        window.clearAllGroupMembers = clearAllGroupMembers;
        
        // Update group members count display
        function updateGroupMembersCount() {
            const checkboxes = document.querySelectorAll('input[name="groupMembers"]:checked');
            const countDisplay = document.getElementById('groupMembersCount');
            if (countDisplay) {
                countDisplay.textContent = `${checkboxes.length} member${checkboxes.length !== 1 ? 's' : ''} selected`;
                countDisplay.style.color = checkboxes.length > 0 ? 'var(--accent-primary)' : 'var(--text-tertiary)';
            }
        }
        window.updateGroupMembersCount = updateGroupMembersCount;
        
        // Create new group
        function createGroup() {
            const name = document.getElementById('newGroupName')?.value?.trim();
            if (!name) {
                alert('Please enter a group name');
                return;
            }
            
            const checkboxes = document.querySelectorAll('input[name="groupMembers"]:checked');
            const members = Array.from(checkboxes).map(cb => cb.value);
            
            if (members.length === 0) {
                alert('Please select at least one member');
                return;
            }
            
            const currentUser = safeParseLocalStorageJSON('currentUser', {}, { expect: 'object' });
            members.push(currentUser.username); // Add creator to group
            
            const newGroup = {
                id: 'group-' + Date.now(),
                name: name,
                members: members,
                createdAt: new Date().toISOString(),
                createdBy: currentUser.username,
                messages: []
            };
            
            const groupChats = safeParseLocalStorageJSON('groupChats', []);
            groupChats.push(newGroup);
            localStorage.setItem('groupChats', JSON.stringify(groupChats));
            
            hideNewChatPanel();
            loadGroupChats();
            showNotification('Group created successfully!', 'success');
        }
        window.createGroup = createGroup;
        
        // Create new announcement
        function createAnnouncement() {
            const title = document.getElementById('announcementTitle')?.value?.trim();
            const content = document.getElementById('announcementContent')?.value?.trim();
            const priority = document.getElementById('announcementPriority')?.value || 'medium';
            
            if (!title || !content) {
                alert('Please enter a title and content');
                return;
            }
            
            // Get selected recipients
            const checkboxes = document.querySelectorAll('input[name="announcementRecipients"]:checked');
            const recipients = Array.from(checkboxes).map(cb => cb.value);
            
            if (recipients.length === 0) {
                alert('Please select at least one recipient');
                return;
            }
            
            const currentUser = safeParseLocalStorageJSON('currentUser', {}, { expect: 'object' });
            
            const newAnnouncement = {
                id: 'ann-' + Date.now(),
                title: title,
                content: content,
                priority: priority,
                author: currentUser.name || currentUser.username || 'Admin',
                recipients: recipients,
                createdAt: new Date().toISOString(),
                replies: []
            };
            
            const announcements = safeParseLocalStorageJSON('announcements', []);
            announcements.unshift(newAnnouncement); // Add to beginning
            localStorage.setItem('announcements', JSON.stringify(announcements));
            
            hideNewChatPanel();
            loadAnnouncements();
            showNotification(`Announcement posted to ${recipients.length} employee${recipients.length !== 1 ? 's' : ''}!`, 'success');
        }
        window.createAnnouncement = createAnnouncement;
        
        async function updateOnlineStatus(isOnline) {
            try {
                const userId = await getCurrentChatUserId();
                if (!userId) return;
                
                await fetch('/api/chat?action=status', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, isOnline })
                });
            } catch (error) {
                console.error('Error updating online status:', error);
            }
        }
        window.updateOnlineStatus = updateOnlineStatus;
        
        // Cache for users loaded from API for chat - use window to make globally accessible
        window.chatUserIdCache = null;
        window.currentDbUserId = null; // Store the database user ID

        function getCurrentChatSessionUser() {
            const storedCurrentUser = safeParseLocalStorageJSON('currentUser', null, { expect: 'objectOrNull' });
            if (storedCurrentUser && (storedCurrentUser.username || storedCurrentUser.name)) {
                return storedCurrentUser;
            }

            const loggedInUser = String(localStorage.getItem('loggedInUser') || '').trim();
            const displayName = String(localStorage.getItem('userName') || document.getElementById('displayUserName')?.textContent || '').trim();
            const role = String(localStorage.getItem('userRole') || 'user').trim() || 'user';
            const isLoggedIn = document.body?.classList?.contains('auth-logged-in');

            if (!loggedInUser && !isLoggedIn) {
                return null;
            }

            const seedUser = {
                name: displayName || loggedInUser,
                role
            };
            const resolvedUser = (typeof buildSessionUserFromUsername === 'function' && loggedInUser)
                ? buildSessionUserFromUsername(loggedInUser, seedUser)
                : {
                    username: loggedInUser,
                    name: displayName || loggedInUser,
                    role
                };

            if (!resolvedUser || (!resolvedUser.username && !resolvedUser.name)) {
                return null;
            }

            try {
                if (resolvedUser.username) {
                    localStorage.setItem('loggedInUser', resolvedUser.username);
                }
                localStorage.setItem('userName', resolvedUser.name || displayName || loggedInUser);
                localStorage.setItem('userRole', resolvedUser.role || role);
                localStorage.setItem('currentUser', JSON.stringify(resolvedUser));
            } catch (_) {}

            return resolvedUser;
        }
        
        async function getCurrentChatUserId() {
            // Return cached ID if we have it
            if (window.currentDbUserId) {
                return window.currentDbUserId;
            }

            const currentUserData = getCurrentChatSessionUser();
            if (!currentUserData) {
                console.log('❌ No current chat session user available');
                return null;
            }

            try {
                console.log('👤 Current user data:', currentUserData);
                
                // Check if user has a stored database ID
                if (currentUserData.dbId) {
                    window.currentDbUserId = currentUserData.dbId;
                    console.log('✅ Using stored database ID:', window.currentDbUserId);
                    return window.currentDbUserId;
                }

                const localUserId = getCurrentUserIdFromLocalUsers(currentUserData);
                if (localUserId) {
                    window.currentDbUserId = localUserId;
                    currentUserData.dbId = localUserId;
                    localStorage.setItem('currentUser', JSON.stringify(currentUserData));
                    console.log('✅ Resolved database ID from local user cache:', window.currentDbUserId);
                    return window.currentDbUserId;
                }
                
                // Fetch users from API to get the ID
                if (!window.chatUserIdCache) {
                    const response = await fetch('/api/users');
                    if (response.ok) {
                        window.chatUserIdCache = await response.json();
                        console.log('📥 Loaded users from API:', window.chatUserIdCache.length, 'users');
                    }
                }
                
                if (window.chatUserIdCache && window.chatUserIdCache.length > 0) {
                    // Find matching user by name or username (case-insensitive)
                    const loggedInUser = window.chatUserIdCache.find(u => {
                        const fnMatch = u.FirstName?.toLowerCase() === currentUserData.firstName?.toLowerCase();
                        const lnMatch = u.LastName?.toLowerCase() === currentUserData.lastName?.toLowerCase();
                        const unMatch = u.Username?.toLowerCase() === currentUserData.username?.toLowerCase();
                        const nameMatch = `${u.FirstName} ${u.LastName}`.toLowerCase() === currentUserData.name?.toLowerCase();
                        return (fnMatch && lnMatch) || unMatch || nameMatch;
                    });
                    
                    if (loggedInUser) {
                        window.currentDbUserId = loggedInUser.Id;
                        console.log('✅ Found user in database with ID:', window.currentDbUserId);
                        
                        // Store the database ID for future use
                        currentUserData.dbId = window.currentDbUserId;
                        localStorage.setItem('currentUser', JSON.stringify(currentUserData));
                        
                        return window.currentDbUserId;
                    } else {
                        console.warn('⚠️ User not found in database. Available users:', window.chatUserIdCache.map(u => `${u.FirstName} ${u.LastName} (${u.Username})`));
                        return null;
                    }
                }
                
                console.warn('⚠️ No users loaded from database');
                return null;
                
            } catch (e) {
                console.error('Error getting current user ID:', e);
                return null;
            }
        }
        
        async function loadConversations() {
            const container = document.getElementById('conversationsList');
            if (!container) return;
            
            const userId = await getCurrentChatUserId();
            console.log('📋 Loading conversations for user ID:', userId);
            
            if (!userId) {
                container.innerHTML = `
                    <div style="padding: 1.5rem; text-align: center; color: var(--text-tertiary);">
                        <i class="fas fa-user-slash" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                        <p style="margin: 0;">User not found in database</p>
                        <p style="font-size: 0.8rem; margin-top: 0.5rem;">Your account needs to be synced with the database to use chat.</p>
                    </div>`;
                return;
            }
            
            try {
                const response = await fetch(`/api/chat?action=conversations&userId=${userId}`);
                console.log('📋 Conversations API response status:', response.status);
                if (!response.ok) throw new Error('Failed to load conversations');
                
                const conversations = await response.json();
                console.log('📋 Loaded conversations:', conversations.length);
                
                if (conversations.length === 0) {
                    container.innerHTML = `
                        <div style="padding: 2rem; text-align: center; color: var(--text-tertiary);">
                            <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                            <p style="margin: 0;">No conversations yet</p>
                            <p style="font-size: 0.85rem; margin-top: 0.5rem;">Start a new chat to begin messaging</p>
                        </div>
                    `;
                    return;
                }
                
                container.innerHTML = conversations.map(conv => `
                    <div onclick="selectConversation(${conv.OtherUserId}, '${(conv.FirstName || '').replace(/'/g, "\\'")}', '${(conv.LastName || '').replace(/'/g, "\\'")}', ${conv.IsOnline ? 'true' : 'false'})" style="padding: 0.75rem; background: transparent; border-radius: 8px; cursor: pointer; margin-bottom: 0.25rem; transition: all 0.2s;" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='transparent'" data-userid="${conv.OtherUserId}">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="position: relative;">
                                <div style="width: 44px; height: 44px; background: var(--accent-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 1rem;">
                                    ${conv.FirstName?.[0] || ''}${conv.LastName?.[0] || ''}
                                </div>
                                <div style="position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; background: ${conv.IsOnline ? '#10b981' : '#6b7280'}; border-radius: 50%; border: 2px solid var(--bg-secondary);"></div>
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-weight: 600; color: var(--text-primary);">${conv.FirstName} ${conv.LastName}</span>
                                    ${conv.UnreadCount > 0 ? `<span style="background: var(--accent-primary); color: white; font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 999px; font-weight: 600;">${conv.UnreadCount}</span>` : ''}
                                </div>
                                <div style="font-size: 0.8rem; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                    ${conv.LastMessage ? (conv.LastMessageSenderId === userId ? 'You: ' : '') + conv.LastMessage.substring(0, 30) + (conv.LastMessage.length > 30 ? '...' : '') : 'No messages yet'}
                                </div>
                                <div style="font-size: 0.7rem; color: var(--text-tertiary);">
                                    ${conv.LastMessageTime ? formatChatTime(conv.LastMessageTime) : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('');
                
            } catch (error) {
                console.error('Error loading conversations:', error);
                container.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-tertiary);">Failed to load conversations</div>';
            }
        }
        
        async function selectConversation(otherUserId, firstName, lastName, isOnline) {
            console.log('📨 Selecting conversation with user ID:', otherUserId, firstName, lastName);
            
            // Reset chat type and set new user
            window.currentChatType = 'direct';
            window.currentChatUserId = otherUserId;
            
            // Clear messages immediately to prevent showing old messages
            const messagesArea = document.getElementById('messagesArea');
            if (messagesArea) {
                messagesArea.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-tertiary);"><i class="fas fa-spinner fa-spin"></i> Loading messages...</div>';
            }
            
            // Update UI to show chat area - use null checks
            const chatHeader = document.getElementById('chatAreaHeader');
            const messageInput = document.getElementById('messageInputArea');
            
            if (chatHeader) chatHeader.style.display = 'block';
            if (messageInput) messageInput.style.display = 'block';
            hideNewChatPanel();
            
            // Update header with passed user info (more reliable than cache lookup)
            const avatarEl = document.getElementById('chatUserAvatar');
            const nameEl = document.getElementById('chatUserName');
            const statusEl = document.getElementById('chatUserStatus');
            
            if (firstName || lastName) {
                if (avatarEl) {
                    avatarEl.textContent = `${firstName?.[0] || ''}${lastName?.[0] || ''}`;
                    avatarEl.style.background = 'var(--accent-primary)';
                }
                if (nameEl) nameEl.textContent = `${firstName || ''} ${lastName || ''}`.trim();
                if (statusEl) statusEl.textContent = isOnline ? 'Online' : 'Offline';
            } else {
                // Fallback to cache lookup
                const user = window.chatUsersCache.find(u => u.Id === otherUserId) || 
                             window.usersData?.find(u => u.Id === otherUserId);
                
                if (user) {
                    if (avatarEl) {
                        avatarEl.textContent = `${user.FirstName?.[0] || ''}${user.LastName?.[0] || ''}`;
                        avatarEl.style.background = 'var(--accent-primary)';
                    }
                    if (nameEl) nameEl.textContent = `${user.FirstName} ${user.LastName}`;
                    if (statusEl) statusEl.textContent = user.IsOnline ? 'Online' : 'Offline';
                }
            }
            refreshChatDeleteConversationButton();
            
            // Highlight selected conversation in the list
            document.querySelectorAll('#conversationsList > div[data-userid]').forEach(el => {
                if (parseInt(el.dataset.userid) === otherUserId) {
                    el.style.background = 'var(--bg-tertiary)';
                } else {
                    el.style.background = 'transparent';
                }
            });
            
            // Load messages for this specific user
            await loadMessages(otherUserId);
            
            // Mark messages as read
            try {
                const userId = await getCurrentChatUserId();
                await fetch('/api/chat?action=markRead', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, otherUserId })
                });
            } catch (e) {
                console.error('Error marking messages as read:', e);
            }
            
            // Refresh conversations to update unread counts
            loadConversations();
            updateUnreadBadge();
        }
        
        async function loadMessages(otherUserId) {
            const container = document.getElementById('messagesArea');
            if (!container) return;
            
            // Verify we're loading for the correct user
            if (window.currentChatType !== 'direct' || window.currentChatUserId !== otherUserId) {
                console.log('⚠️ Chat context changed, skipping message load');
                return;
            }
            
            const userId = await getCurrentChatUserId();
            if (!userId) {
                container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-tertiary);">Please log in to view messages</div>';
                return;
            }
            
            console.log('📬 Loading messages between user', userId, 'and', otherUserId);
            
            try {
                const response = await fetch(`/api/chat?action=messages&userId=${userId}&otherUserId=${otherUserId}`);
                if (!response.ok) throw new Error('Failed to load messages');
                
                // Double-check the context hasn't changed while we were fetching
                if (window.currentChatType !== 'direct' || window.currentChatUserId !== otherUserId) {
                    console.log('⚠️ Chat context changed during fetch, discarding messages');
                    return;
                }
                
                const messages = await response.json();
                console.log('📬 Loaded', messages.length, 'messages for user', otherUserId);
                
                if (messages.length === 0) {
                    container.innerHTML = `
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-tertiary);">
                            <i class="fas fa-comment-dots" style="font-size: 3rem; margin-bottom: 0.5rem; opacity: 0.3;"></i>
                            <p style="margin: 0;">No messages yet</p>
                            <p style="font-size: 0.85rem;">Send a message to start the conversation</p>
                        </div>
                    `;
                    return;
                }
                
                // Update last message timestamp for polling
                if (messages.length > 0) {
                    window.lastMessageTimestamp = messages[messages.length - 1].SentAt;
                }
                
                container.innerHTML = messages.map(msg => {
                    const isMe = msg.SenderId === userId;
                    const attachments = Array.isArray(msg.Attachments) ? msg.Attachments : [];
                    const rawMessage = String(msg.Message || '').trim();
                    const displayMessage = rawMessage === '[Attachment]' ? '' : rawMessage;
                    const attachmentsHtml = renderChatAttachmentListHtml(attachments, msg.Id || `api-${Math.random().toString(36).slice(2, 9)}`);
                    const canDelete = isMe && Number.isInteger(Number(msg.Id));
                    return `
                        <div style="display: flex; justify-content: ${isMe ? 'flex-end' : 'flex-start'}; margin-bottom: 0.5rem;">
                            <div style="max-width: 70%; padding: 0.75rem 1rem; background: ${isMe ? 'var(--accent-primary)' : 'var(--bg-secondary)'}; color: ${isMe ? 'white' : 'var(--text-primary)'}; border-radius: 18px; border-bottom-${isMe ? 'right' : 'left'}-radius: 4px; position: relative;">
                                ${canDelete ? `<button type="button" title="Delete message" onclick="deleteDirectMessageById(${Number(msg.Id)})" style="position:absolute; top:0.3rem; right:0.3rem; background:transparent; border:none; color:inherit; opacity:0.75; cursor:pointer; padding:0.15rem;"><i class="fas fa-trash"></i></button>` : ''}
                                ${displayMessage ? `<div style="word-wrap: break-word;">${escapeHtml(displayMessage)}</div>` : ''}
                                ${attachmentsHtml}
                                <div style="font-size: 0.65rem; opacity: 0.7; margin-top: 0.25rem; text-align: ${isMe ? 'right' : 'left'};">
                                    ${formatChatTime(msg.SentAt)}
                                    ${isMe && msg.IsRead ? ' <i class="fas fa-check-double"></i>' : isMe ? ' <i class="fas fa-check"></i>' : ''}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                // Scroll to bottom
                container.scrollTop = container.scrollHeight;
                
            } catch (error) {
                console.error('Error loading messages:', error);
                container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #ef4444;"><i class="fas fa-exclamation-circle"></i> Failed to load messages</div>';
            }
        }

        async function deleteDirectMessageById(messageId) {
            const normalizedId = Number.parseInt(String(messageId || ''), 10);
            if (!Number.isInteger(normalizedId) || normalizedId <= 0) return;
            if (!confirm('Delete this message?')) return;

            try {
                const userId = await getCurrentChatUserId();
                if (!userId) return;

                const response = await fetch(`/api/chat/${normalizedId}?userId=${userId}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    throw new Error(`Delete failed: ${response.status}`);
                }

                if (window.currentChatType === 'direct' && window.currentChatUserId) {
                    await loadMessages(window.currentChatUserId);
                    await loadConversations();
                }
                if (typeof showNotification === 'function') {
                    showNotification('Message deleted', 'success');
                }
            } catch (error) {
                console.error('Error deleting direct message:', error);
                if (typeof showNotification === 'function') {
                    showNotification('Failed to delete message', 'error');
                }
            }
        }

        function deleteGroupMessageById(groupId, messageId) {
            const groupKey = String(groupId || '').trim();
            const messageKey = String(messageId || '').trim();
            if (!groupKey || !messageKey) return;
            if (!confirm('Delete this message?')) return;

            const groups = safeParseLocalStorageJSON('groupChats', []);
            const groupIndex = groups.findIndex((g) => String(g?.id || '') === groupKey);
            if (groupIndex < 0) return;

            const group = groups[groupIndex] || {};
            const existing = Array.isArray(group.messages) ? group.messages : [];
            const nextMessages = existing.filter((msg) => String(msg?.id || '') !== messageKey);
            if (nextMessages.length === existing.length) return;

            groups[groupIndex] = {
                ...group,
                messages: nextMessages
            };
            localStorage.setItem('groupChats', JSON.stringify(groups));

            if (window.currentChatType === 'group' && String(window.currentChatUserId || '') === groupKey) {
                displayMessages(nextMessages, true);
            }
            if (typeof showNotification === 'function') {
                showNotification('Message deleted', 'success');
            }
        }

        function getChatUploadTrackerFiles(files) {
            return (Array.isArray(files) ? files : []).map((file) => ({
                name: String(file?.name || 'attachment'),
                size: Math.max(1, Number(file?.size || 0) || 1),
                isImage: String(file?.type || '').toLowerCase().startsWith('image/'),
                percent: 0
            }));
        }

        function derivePerFileUploadPercent(files, overallPercent) {
                                    throw new Error(normalizeDeleteBlockedMessage(
                                        payload?.error || payload?.message || `Failed to delete clinic (HTTP ${response.status})`,
                                        'clinic'
                                    ));
            const totalBytes = safeFiles.reduce((sum, item) => sum + Math.max(1, Number(item?.size || 0) || 1), 0);
            if (totalBytes <= 0) {
                return safeFiles.map(() => Math.max(0, Math.min(100, Number(overallPercent || 0))));
                                showNotification(`Failed to delete clinic: ${normalizeDeleteBlockedMessage(error?.message, 'clinic')}`, 'error');

            let remainingBytes = (Math.max(0, Math.min(100, Number(overallPercent || 0))) / 100) * totalBytes;
            return safeFiles.map((item) => {
                const fileSize = Math.max(1, Number(item?.size || 0) || 1);
                if (remainingBytes <= 0) return 0;
                if (remainingBytes >= fileSize) {
                    remainingBytes -= fileSize;
                    return 100;
                }
                const partial = Math.max(0, Math.min(100, (remainingBytes / fileSize) * 100));
                remainingBytes = 0;
                return partial;
            });
        }

        function renderChatUploadProgress() {
            const container = document.getElementById('chatUploadProgress');
            if (!container) return;

            const state = window.chatUploadProgressState;
            if (!state || !state.active) {
                container.style.display = 'none';
                container.innerHTML = '';
                return;
            }

            const files = Array.isArray(state.files) ? state.files : [];
            const label = escapeHtml(String(state.label || 'Uploading attachments...'));
            const pct = Math.max(0, Math.min(100, Number(state.percent || 0)));
            const canCancel = Boolean(state.canCancel && window.chatActiveUploadXhr);
            const canRetry = Boolean(state.canRetry && !window.chatActiveUploadXhr && window.chatRetryUploadPayload);
            const canDismiss = Boolean(!window.chatActiveUploadXhr);
            const bars = files.map((file) => {
                const filePct = Math.max(0, Math.min(100, Number(file?.percent || 0)));
                const icon = file?.isImage ? 'fa-image' : 'fa-paperclip';
                return `
                    <div style="margin-top:0.35rem;">
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; font-size:0.75rem; color:var(--text-secondary);">
                            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><i class="fas ${icon}" style="margin-right:0.35rem;"></i>${escapeHtml(String(file?.name || 'attachment'))}</span>
                            <span>${Math.round(filePct)}%</span>
                        </div>
                        <div style="margin-top:0.2rem; height:6px; background:var(--bg-tertiary); border-radius:999px; overflow:hidden;">
                            <div style="height:100%; width:${filePct}%; background:linear-gradient(90deg, #06b6d4, #22c55e);"></div>
                        </div>
                    </div>
                `;
            }).join('');

            container.style.display = 'block';
            container.innerHTML = `
                <div style="padding:0.55rem 0.65rem; border:1px solid var(--border-color); border-radius:10px; background:var(--bg-secondary);">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; font-size:0.78rem; color:var(--text-secondary);">
                        <span>${label}</span>
                        <div style="display:flex; align-items:center; gap:0.45rem;">
                            <strong style="color:var(--text-primary);">${Math.round(pct)}%</strong>
                            ${canCancel ? '<button type="button" onclick="cancelChatUpload()" style="border:1px solid var(--border-color); background:var(--bg-primary); color:var(--text-primary); border-radius:999px; padding:0.12rem 0.55rem; font-size:0.72rem; cursor:pointer;">Cancel</button>' : ''}
                            ${canRetry ? '<button type="button" onclick="retryLastCanceledChatUpload()" style="border:1px solid var(--border-color); background:var(--bg-primary); color:var(--text-primary); border-radius:999px; padding:0.12rem 0.55rem; font-size:0.72rem; cursor:pointer;">Retry</button>' : ''}
                            ${canDismiss ? '<button type="button" onclick="dismissChatUploadProgress()" style="border:1px solid var(--border-color); background:transparent; color:var(--text-secondary); border-radius:999px; padding:0.12rem 0.55rem; font-size:0.72rem; cursor:pointer;">Dismiss</button>' : ''}
                        </div>
                    </div>
                    <div style="margin-top:0.3rem; height:7px; background:var(--bg-tertiary); border-radius:999px; overflow:hidden;">
                        <div style="height:100%; width:${pct}%; background:linear-gradient(90deg, #0ea5e9, #22c55e);"></div>
                    </div>
                    ${bars}
                </div>
            `;
        }

        function setChatUploadProgressState(nextState) {
            window.chatUploadProgressState = {
                ...(window.chatUploadProgressState || {}),
                ...(nextState || {})
            };
            renderChatUploadProgress();
        }

        function clearChatUploadProgressState(delayMs = 0) {
            const clearNow = () => {
                window.chatUploadProgressState = null;
                renderChatUploadProgress();
            };
            if (delayMs > 0) {
                setTimeout(clearNow, delayMs);
                return;
            }
            clearNow();
        }

        function cancelChatUpload() {
            const xhr = window.chatActiveUploadXhr;
            if (!xhr) return;
            try {
                xhr.abort();
            } catch (_) { }
        }

        function dismissChatUploadProgress() {
            if (window.chatActiveUploadXhr) return;
            window.chatRetryUploadPayload = null;
            clearChatUploadProgressState();
        }

        async function sendDirectChatMessageWithProgress(bodyPayload, onProgress) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                window.chatActiveUploadXhr = xhr;
                xhr.open('POST', '/api/chat', true);
                xhr.setRequestHeader('Content-Type', 'application/json');

                const cleanup = () => {
                    if (window.chatActiveUploadXhr === xhr) {
                        window.chatActiveUploadXhr = null;
                    }
                };

                xhr.upload.onprogress = (event) => {
                    if (!event || !event.lengthComputable) return;
                    const percent = Math.round((event.loaded / Math.max(1, event.total)) * 100);
                    if (typeof onProgress === 'function') onProgress(percent);
                };

                xhr.onload = () => {
                    cleanup();
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve({ ok: true, status: xhr.status });
                    } else {
                        reject(new Error(`Failed to send message (HTTP ${xhr.status})`));
                    }
                };
                xhr.onerror = () => {
                    cleanup();
                    reject(new Error('Network error while uploading message'));
                };
                xhr.onabort = () => {
                    cleanup();
                    reject(new Error('Message upload was canceled'));
                };

                xhr.send(JSON.stringify(bodyPayload));
            });
        }
        
        async function sendMessage(event) {
            event.preventDefault();

            if (window.chatActiveUploadXhr) {
                if (typeof showNotification === 'function') {
                    showNotification('An upload is already in progress.', 'warning');
                }
                return;
            }
            
            const input = document.getElementById('messageInput');
            const message = String(input?.value || '').trim();
            const pendingAttachments = Array.isArray(window.chatPendingAttachments) ? window.chatPendingAttachments : [];

            if ((!message && !pendingAttachments.length) || !window.currentChatUserId) return;

            let attachmentsPayload = [];
            if (pendingAttachments.length) {
                try {
                    attachmentsPayload = await buildChatAttachmentPayload();
                } catch (error) {
                    console.error('Error preparing attachments:', error);
                    showNotification('Failed to read one or more attachments', 'error');
                    return;
                }
            }
            
            const currentUser = safeParseLocalStorageJSON('currentUser', {}, { expect: 'object' });
            
            // Handle group messages (localStorage)
            if (window.currentChatType === 'group') {
                const groupChats = safeParseLocalStorageJSON('groupChats', []);
                const groupIndex = groupChats.findIndex(g => g.id === window.currentChatUserId);
                
                if (groupIndex !== -1) {
                    if (!groupChats[groupIndex].messages) {
                        groupChats[groupIndex].messages = [];
                    }
                    
                    groupChats[groupIndex].messages.push({
                        id: Date.now(),
                        sender: currentUser.name || currentUser.username || 'You',
                        senderId: currentUser.username,
                        content: message,
                        attachments: attachmentsPayload,
                        timestamp: new Date().toISOString()
                    });
                    
                    localStorage.setItem('groupChats', JSON.stringify(groupChats));
                    input.value = '';
                    clearChatAttachmentSelection();
                    
                    // Reload messages
                    displayMessages(groupChats[groupIndex].messages, true);
                    showNotification('Message sent!', 'success');
                }
                return;
            }
            
            // Handle announcement replies (localStorage)
            if (window.currentChatType === 'announcement') {
                const announcements = safeParseLocalStorageJSON('announcements', []);
                const annIndex = announcements.findIndex(a => a.id === window.currentChatUserId);
                
                if (annIndex !== -1) {
                    if (!announcements[annIndex].replies) {
                        announcements[annIndex].replies = [];
                    }
                    
                    announcements[annIndex].replies.push({
                        author: currentUser.name || currentUser.username || 'You',
                        content: message,
                        attachments: attachmentsPayload,
                        timestamp: new Date().toISOString()
                    });
                    
                    localStorage.setItem('announcements', JSON.stringify(announcements));
                    input.value = '';
                    clearChatAttachmentSelection();
                    
                    // Reload announcement
                    selectAnnouncement(window.currentChatUserId);
                    showNotification('Reply sent!', 'success');
                }
                return;
            }
            
            // Handle direct messages (API)
            const userId = await getCurrentChatUserId();
            if (!userId) return;
            
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        senderId: userId,
                        receiverId: window.currentChatUserId,
                        message: message,
                        attachments: attachmentsPayload
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to send message');
                }

                input.value = '';
                clearChatAttachmentSelection();
                await loadMessages(window.currentChatUserId);
                loadConversations();
            } catch (error) {
                console.error('Error sending message:', error);
                showNotification('Failed to send message', 'error');
            }
        }
        
        function hideNewChatPanel() {
            const panel = document.getElementById('newChatPanel');
            if (panel) {
                panel.style.display = 'none';
            }
        }
        window.hideNewChatPanel = hideNewChatPanel;
        
        async function loadChatUsers() {
            const container = document.getElementById('chatUsersList');
            if (!container) return;

            const localUsers = getLocalChatUsersList();
            let renderedLocalFallback = false;

            if (Array.isArray(window.chatUsersCache) && window.chatUsersCache.length > 0) {
                renderChatUsersList(window.chatUsersCache);
            } else if (localUsers.length > 0) {
                window.chatUsersCache = localUsers;
                renderChatUsersListLocal(localUsers);
                renderedLocalFallback = true;
            } else {
                container.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-tertiary);"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
            }

            let userId = window.currentDbUserId || safeParseLocalStorageJSON('currentUser', {}, { expect: 'object' })?.dbId || null;
            if (!userId) {
                if (renderedLocalFallback) {
                    getCurrentChatUserId().then((resolvedUserId) => {
                        if (resolvedUserId) {
                            loadChatUsers();
                        }
                    }).catch((error) => {
                        console.error('Error resolving current chat user ID in background:', error);
                    });
                    return;
                }
                userId = await getCurrentChatUserId();
            }

            console.log('👥 Loading chat users, current user ID:', userId);
            if (!userId) {
                loadChatUsersFromLocalStorage();
                return;
            }

            try {
                const response = await fetchChatUsersWithTimeout(userId);
                console.log('👥 Chat users API response status:', response.status);
                if (!response.ok) throw new Error('Failed to load users');

                window.chatUsersCache = await response.json();
                console.log('👥 Loaded', window.chatUsersCache.length, 'users from database');

                if (window.chatUsersCache.length === 0) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 1.5rem; color: var(--text-tertiary);">
                            <i class="fas fa-users" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                            <p style="margin: 0;">No other users found</p>
                            <p style="font-size: 0.8rem; margin-top: 0.5rem;">Add team members to start chatting</p>
                        </div>
                    `;
                } else {
                    renderChatUsersList(window.chatUsersCache);
                }

            } catch (error) {
                console.error('Error loading users from API:', error);
                if (renderedLocalFallback) {
                    return;
                }
                loadChatUsersFromLocalStorage();
            }
        }

        async function fetchChatUsersWithTimeout(userId, timeoutMs = 4000) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            try {
                return await fetch(`/api/chat?action=users&userId=${userId}`, { signal: controller.signal });
            } finally {
                clearTimeout(timeoutId);
            }
        }

        function getLocalChatUsersEntries() {
            const parsedUsers = safeParseLocalStorageJSON('users', {});
            if (Array.isArray(parsedUsers)) {
                return parsedUsers
                    .filter(user => user && typeof user === 'object')
                    .map((user, index) => [user.username || user.userName || user.Username || user.email || user.id || user.Id || user.name || `user-${index}`, user]);
            }
            if (parsedUsers && typeof parsedUsers === 'object') {
                return Object.entries(parsedUsers);
            }
            return [];
        }

        function getLocalChatUsersList() {
            const userEntries = getLocalChatUsersEntries();
            const currentUser = safeParseLocalStorageJSON('currentUser', {}, { expect: 'object' });
            const currentUsername = String(currentUser?.username || '').toLowerCase();
            const currentName = String(currentUser?.name || '').toLowerCase();

            return userEntries
                .filter(([username, user]) => {
                    const normalizedUsername = String(user?.Username || user?.username || username || '').toLowerCase();
                    const firstName = String(user?.firstName || user?.FirstName || '').trim();
                    const lastName = String(user?.lastName || user?.LastName || '').trim();
                    const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
                    return normalizedUsername !== currentUsername && normalizedUsername !== 'admin' && fullName !== currentName;
                })
                .map(([username, user]) => ({
                    Id: user?.Id || user?.id || username,
                    Username: user?.Username || user?.username || username,
                    FirstName: user?.FirstName || user?.firstName || username,
                    LastName: user?.LastName || user?.lastName || '',
                    Role: user?.Role || user?.role || 'User',
                    IsOnline: Boolean(user?.IsOnline)
                }));
        }

        function getCurrentUserIdFromLocalUsers(currentUserData) {
            const currentUsername = String(currentUserData?.username || '').toLowerCase();
            const currentName = String(currentUserData?.name || '').toLowerCase();
            const currentFirstName = String(currentUserData?.firstName || currentUserData?.FirstName || '').toLowerCase();
            const currentLastName = String(currentUserData?.lastName || currentUserData?.LastName || '').toLowerCase();

            const localMatch = getLocalChatUsersEntries()
                .map(([, user]) => user)
                .find((user) => {
                    const username = String(user?.Username || user?.username || '').toLowerCase();
                    const firstName = String(user?.FirstName || user?.firstName || '').toLowerCase();
                    const lastName = String(user?.LastName || user?.lastName || '').toLowerCase();
                    const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
                    return (username && username === currentUsername)
                        || (firstName && lastName && firstName === currentFirstName && lastName === currentLastName)
                        || (fullName && fullName === currentName);
                });

            return localMatch?.Id || localMatch?.id || null;
        }
        
        // Fallback: Load users from localStorage
        function loadChatUsersFromLocalStorage() {
            const container = document.getElementById('chatUsersList');
            if (!container) return;

            const users = getLocalChatUsersList();
            
            if (users.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 1.5rem; color: var(--text-tertiary);">
                        <i class="fas fa-users-slash" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                        <p style="margin: 0;">No team members found</p>
                        <p style="font-size: 0.8rem; margin-top: 0.5rem;">Add users in User Management first</p>
                    </div>
                `;
                return;
            }
            
            window.chatUsersCache = users;
            renderChatUsersListLocal(users);
        }
        
        // Render users from localStorage format
        function renderChatUsersListLocal(users) {
            const container = document.getElementById('chatUsersList');
            if (!container) return;
            
            container.innerHTML = users.map(user => `
                <div onclick="startChatWithLocal('${user.Username}', '${user.FirstName}', '${user.LastName}')" style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; cursor: pointer; margin-bottom: 0.5rem; transition: all 0.2s;" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='var(--bg-secondary)'">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="position: relative;">
                            <div style="width: 40px; height: 40px; background: var(--accent-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                                ${user.FirstName?.[0] || ''}${user.LastName?.[0] || ''}
                            </div>
                            <div style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background: #6b7280; border-radius: 50%; border: 2px solid var(--bg-secondary);"></div>
                        </div>
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary);">${user.FirstName} ${user.LastName || ''}</div>
                            <div style="font-size: 0.8rem; color: var(--text-tertiary);">${user.Role || 'Staff'}</div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        // Start chat with local user (create if needed in DB)
        async function startChatWithLocal(username, firstName, lastName) {
            console.log('📧 Starting chat with local user:', username, firstName, lastName);
            hideNewChatPanel();
            
            // Try to find user in API cache first
            let userId = null;
            if (window.chatUserIdCache) {
                const apiUser = window.chatUserIdCache.find(u => 
                    u.Username === username || 
                    (u.FirstName === firstName && u.LastName === lastName)
                );
                userId = apiUser?.Id;
            }
            
            if (userId) {
                selectConversation(userId, firstName, lastName, false);
            } else {
                // Show message that user needs to be synced to database
                showNotification('This user needs to be synced to the database first. Try logging in as this user or sync users.', 'warning');
            }
        }
        
        function renderChatUsersList(users) {
            const container = document.getElementById('chatUsersList');
            if (!container) return;
            
            container.innerHTML = users.map(user => `
                <div onclick="startChatWith(${user.Id})" style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; cursor: pointer; margin-bottom: 0.5rem; transition: all 0.2s;" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='var(--bg-secondary)'">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="position: relative;">
                            <div style="width: 40px; height: 40px; background: var(--accent-primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                                ${user.FirstName?.[0] || ''}${user.LastName?.[0] || ''}
                            </div>
                            <div style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background: ${user.IsOnline ? '#10b981' : '#6b7280'}; border-radius: 50%; border: 2px solid var(--bg-secondary);"></div>
                        </div>
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary);">${user.FirstName} ${user.LastName}</div>
                            <div style="font-size: 0.8rem; color: var(--text-tertiary);">${user.Role || 'Staff'}</div>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        function filterChatUsers() {
            const search = document.getElementById('userSearchInput').value.toLowerCase();
            const filtered = window.chatUsersCache.filter(u => 
                `${u.FirstName} ${u.LastName}`.toLowerCase().includes(search)
            );
            renderChatUsersList(filtered);
        }
        
        function startChatWith(userId) {
            console.log('💬 startChatWith called with userId:', userId);
            
            // Hide the new chat panel first
            hideNewChatPanel();
            
            // Set to direct chat mode
            window.currentChatTab = 'direct';
            window.currentChatType = 'direct';
            
            // Find user info from cache
            const user = window.chatUsersCache.find(u => u.Id === userId);
            console.log('💬 Found user in cache:', user);
            
            if (user) {
                selectConversation(userId, user.FirstName, user.LastName, user.IsOnline);
            } else {
                selectConversation(userId, null, null, false);
            }
        }
        
        function startChatPolling() {
            // Poll for new messages every 5 seconds
            window.chatPollingInterval = setInterval(async () => {
                // Only poll when on direct messages tab AND viewing a specific conversation
                if (window.currentChatTab === 'direct' && window.currentChatType === 'direct' && window.currentChatUserId) {
                    await loadMessages(window.currentChatUserId);
                    await loadConversations();
                }
                // Always update unread badge
                await updateUnreadBadge();
            }, 5000);
        }
        window.startChatPolling = startChatPolling;
        
        function stopChatPolling() {
            if (window.chatPollingInterval) {
                clearInterval(window.chatPollingInterval);
                window.chatPollingInterval = null;
            }
        }
        window.stopChatPolling = stopChatPolling;
        
        async function updateUnreadBadge() {
            try {
                const userId = await getCurrentChatUserId();
                if (!userId) return;
                
                const response = await fetch(`/api/chat?action=unreadCount&userId=${userId}`);
                if (!response.ok) return;
                
                const data = await response.json();
                const count = data.UnreadCount || 0;
                
                // Update floating chat button badge
                const floatingBadge = document.getElementById('floatingChatBadge');
                const floatingBtn = document.getElementById('floatingChatBtn');
                const logoBadge = document.getElementById('logoChatBadge');
                
                if (count > 0) {
                    if (floatingBadge) {
                        floatingBadge.textContent = count > 99 ? '99+' : count;
                        floatingBadge.style.display = 'flex';
                    }
                    if (floatingBtn) floatingBtn.classList.add('has-messages');
                    if (logoBadge) {
                        logoBadge.textContent = count > 99 ? '99+' : count;
                        logoBadge.style.display = 'flex';
                    }
                } else {
                    if (floatingBadge) floatingBadge.style.display = 'none';
                    if (floatingBtn) floatingBtn.classList.remove('has-messages');
                    if (logoBadge) logoBadge.style.display = 'none';
                }
                
                // Also call global updateChatBadges if available
                if (typeof updateChatBadges === 'function') {
                    updateChatBadges(count);
                }
                
                // Update badge on all chat buttons
                const chatBadges = document.querySelectorAll('.chat-unread-badge');
                chatBadges.forEach(badge => {
                    if (count > 0) {
                        badge.textContent = count > 99 ? '99+' : count;
                        badge.style.display = 'flex';
                    } else {
                        badge.style.display = 'none';
                    }
                });
            } catch (error) {
                console.error('Error updating unread badge:', error);
            }
        }
        
        function formatChatTime(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            const now = new Date();
            const diff = now - date;
            
            // Less than 1 minute
            if (diff < 60000) return 'Just now';
            
            // Less than 1 hour
            if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
            
            // Less than 24 hours
            if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Less than 7 days
            if (diff < 604800000) {
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                return days[date.getDay()];
            }
            
            // Otherwise show date
            return date.toLocaleDateString();
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function formatChatFileSize(bytes) {
            const size = Math.max(0, Number(bytes || 0));
            if (size < 1024) return `${size} B`;
            if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
            return `${(size / (1024 * 1024)).toFixed(2)} MB`;
        }

        function normalizeChatAttachment(att) {
            const fileName = String(att?.fileName || att?.FileName || att?.name || att?.Name || 'attachment');
            const contentType = String(att?.contentType || att?.ContentType || att?.type || att?.Type || att?.mimeType || att?.MimeType || '').trim();
            const rawData = String(att?.fileData || att?.FileData || att?.data || att?.Data || att?.base64 || att?.Base64 || att?.fileUrl || att?.FileUrl || att?.url || att?.Url || '').trim();
            const fileSize = Number(att?.fileSize || att?.FileSize || att?.size || att?.Size || 0) || 0;

            let fileData = rawData;
            if (fileData && !/^data:/i.test(fileData) && !/^blob:/i.test(fileData) && !/^https?:\/\//i.test(fileData) && !/^\//.test(fileData)) {
                const mime = contentType || 'application/octet-stream';
                fileData = `data:${mime};base64,${fileData}`;
            }

            return {
                ...att,
                fileName,
                contentType,
                fileData,
                fileSize
            };
        }

        function isChatImageAttachment(att) {
            const contentType = String(att?.contentType || att?.type || '').toLowerCase();
            if (contentType.startsWith('image/')) return true;
            const name = String(att?.fileName || att?.name || '').toLowerCase();
            return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
        }

        function buildChatImageCandidates(attachments) {
            const list = Array.isArray(attachments) ? attachments : [];
            return list
                .map((att) => normalizeChatAttachment(att))
                .filter((item) => item.fileData && isChatImageAttachment(item));
        }

        function openChatImageReview(cacheKey, imageIndex = 0) {
            const item = window.chatAttachmentDownloadCache?.[cacheKey];
            if (!item || !Array.isArray(item.images) || !item.images.length) {
                if (typeof showNotification === 'function') showNotification('Image preview unavailable', 'warning');
                return;
            }

            const modal = document.getElementById('chatImageReviewModal');
            const img = document.getElementById('chatImageReviewImage');
            const title = document.getElementById('chatImageReviewTitle');
            const sizeEl = document.getElementById('chatImageReviewSize');
            const counter = document.getElementById('chatImageReviewCounter');
            const prevBtn = document.getElementById('chatImageReviewPrev');
            const nextBtn = document.getElementById('chatImageReviewNext');
            const downloadBtn = document.getElementById('chatImageReviewDownloadBtn');
            if (!modal || !img || !title || !sizeEl || !counter || !prevBtn || !nextBtn || !downloadBtn) return;

            const maxIndex = item.images.length - 1;
            const clampedIndex = Math.max(0, Math.min(maxIndex, Number(imageIndex) || 0));
            const activeImage = item.images[clampedIndex];

            window.chatImageReviewState = {
                cacheKey,
                index: clampedIndex
            };

            img.src = activeImage.fileData;
            img.alt = activeImage.fileName || 'Chat image';
            title.textContent = activeImage.fileName || 'Chat image';
            sizeEl.textContent = formatChatFileSize(activeImage.fileSize || 0);
            counter.textContent = `${clampedIndex + 1} / ${item.images.length}`;

            prevBtn.disabled = clampedIndex <= 0;
            nextBtn.disabled = clampedIndex >= maxIndex;
            downloadBtn.onclick = () => {
                const link = document.createElement('a');
                link.href = activeImage.fileData;
                link.download = String(activeImage.fileName || 'chat-image');
                link.click();
            };

            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }

        function closeChatImageReview() {
            const modal = document.getElementById('chatImageReviewModal');
            const img = document.getElementById('chatImageReviewImage');
            if (modal) modal.style.display = 'none';
            if (img) {
                img.src = '';
                img.alt = '';
            }
            document.body.style.overflow = '';
        }

        function stepChatImageReview(delta) {
            const state = window.chatImageReviewState;
            if (!state) return;
            const item = window.chatAttachmentDownloadCache?.[state.cacheKey];
            if (!item || !Array.isArray(item.images) || !item.images.length) return;
            const nextIndex = Math.max(0, Math.min(item.images.length - 1, Number(state.index || 0) + Number(delta || 0)));
            openChatImageReview(state.cacheKey, nextIndex);
        }

        document.addEventListener('keydown', (event) => {
            const modal = document.getElementById('chatImageReviewModal');
            if (!modal || modal.style.display !== 'flex') return;
            if (event.key === 'Escape') closeChatImageReview();
            if (event.key === 'ArrowLeft') stepChatImageReview(-1);
            if (event.key === 'ArrowRight') stepChatImageReview(1);
        });

        function renderChatAttachmentPreview() {
            const preview = document.getElementById('chatAttachmentPreview');
            if (!preview) return;

            const files = Array.isArray(window.chatPendingAttachments) ? window.chatPendingAttachments : [];
            if (!files.length) {
                preview.style.display = 'none';
                preview.innerHTML = '';
                return;
            }

            const labels = files
                .map((f, index) => {
                    const icon = String(f?.type || '').toLowerCase().startsWith('image/') ? '<i class="fas fa-image" style="margin-right:0.35rem;"></i>' : '<i class="fas fa-paperclip" style="margin-right:0.35rem;"></i>';
                    return `<div style="display:flex; align-items:center; gap:0.35rem; margin-bottom:0.25rem;">${icon}<span>${index + 1}. ${escapeHtml(f.name || 'attachment')} (${formatChatFileSize(f.size || 0)})</span></div>`;
                })
                .join('');

            const imageTiles = files
                .filter((f) => String(f?.type || '').toLowerCase().startsWith('image/'))
                .map((f) => {
                    const url = URL.createObjectURL(f);
                    return `<img src="${url}" alt="${escapeHtml(f.name || 'image')}" style="width:56px; height:56px; object-fit:cover; border-radius:10px; border:1px solid var(--border-color);">`;
                })
                .join('');

            preview.style.display = 'block';
            preview.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
                    <div>
                        <strong>${files.length}</strong> attachment${files.length === 1 ? '' : 's'} selected
                        <div style="margin-top:0.35rem;">${labels}</div>
                        ${imageTiles ? `<div style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.45rem;">${imageTiles}</div>` : ''}
                    </div>
                    <button type="button" onclick="clearChatAttachmentSelection()" style="background:none; border:none; color:var(--text-tertiary); cursor:pointer;">Clear</button>
                </div>
            `;

            // Release temporary object URLs created for this preview render.
            setTimeout(() => {
                const images = preview.querySelectorAll('img[src^="blob:"]');
                images.forEach((img) => {
                    try { URL.revokeObjectURL(img.src); } catch (_) { }
                });
            }, 0);
        }

        function clearChatAttachmentSelection() {
            window.chatPendingAttachments = [];
            const input = document.getElementById('chatAttachmentInput');
            if (input) input.value = '';
            renderChatAttachmentPreview();
            if (!window.chatUploadProgressState?.active) {
                clearChatUploadProgressState();
            }
        }
        window.clearChatAttachmentSelection = clearChatAttachmentSelection;

        function handleChatAttachmentSelection(event) {
            const selected = Array.from(event?.target?.files || []);
            if (!selected.length) return;

            const maxFiles = 5;
            const maxBytes = 4 * 1024 * 1024;
            const current = Array.isArray(window.chatPendingAttachments) ? window.chatPendingAttachments : [];
            const next = [...current, ...selected].slice(0, maxFiles);
            const filtered = next.filter((file) => Number(file?.size || 0) <= maxBytes);

            if (filtered.length < next.length && typeof showNotification === 'function') {
                showNotification('Some files were skipped (max 4 MB each).', 'warning');
            }

            window.chatPendingAttachments = filtered;
            renderChatAttachmentPreview();
        }

        Object.assign(window, {
            switchChatTab,
            closeChatConversation,
            deleteCurrentChatConversation,
            loadGroupChats,
            loadAnnouncements,
            showNewChatPanel,
            loadConversations,
            selectConversation,
            sendMessage,
            hideNewChatPanel,
            filterChatUsers,
            closeChatImageReview,
            handleChatAttachmentSelection
        });

        Object.assign(window.ReformChat || (window.ReformChat = {}), {
            open() {
                const panel = document.getElementById('chatPanel');
                if (!panel) return;

                panel.classList.add('open');
                window.currentChatTab = 'direct';
                window.currentChatType = 'direct';

                try { loadConversations(); } catch (error) { console.error('Failed to load chat conversations:', error); }
                try { startChatPolling(); } catch (error) { console.error('Failed to start chat polling:', error); }
                try { updateOnlineStatus(true); } catch (error) { console.error('Failed to update chat online status:', error); }

                if (typeof window.attachChatDrag === 'function') {
                    setTimeout(() => {
                        try { window.attachChatDrag(); } catch (error) { console.error('Failed to attach chat drag behavior:', error); }
                    }, 50);
                }
            },

            close() {
                const panel = document.getElementById('chatPanel');
                if (!panel) return;

                panel.classList.remove('open', 'fullscreen', 'dragged');
                panel.style.left = '';
                panel.style.top = '';

                const btn = document.getElementById('chatFullscreenBtn');
                if (btn) {
                    const icon = btn.querySelector('i');
                    if (icon) icon.className = 'fas fa-expand';
                }

                try { stopChatPolling(); } catch (error) { console.error('Failed to stop chat polling:', error); }
                window.currentChatUserId = null;
                try { clearChatAttachmentSelection(); } catch (error) { console.error('Failed to clear chat attachments:', error); }
                try { hideNewChatPanel(); } catch (error) { console.error('Failed to hide new chat panel:', error); }
            },

            toggle() {
                const panel = document.getElementById('chatPanel');
                if (!panel || !panel.classList.contains('open')) {
                    this.open();
                    return;
                }

                this.close();
            },

            switchTab(tab) {
                return switchChatTab(tab);
            },

            showNewChatPanel() {
                return showNewChatPanel();
            },

            hideNewChatPanel() {
                return hideNewChatPanel();
            },

            closeChatConversation() {
                return closeChatConversation();
            },

            deleteCurrentChatConversation() {
                return deleteCurrentChatConversation();
            },

            sendMessage(event) {
                return sendMessage(event);
            },

            filterChatUsers() {
                return filterChatUsers();
            },

            handleChatAttachmentSelection(event) {
                return handleChatAttachmentSelection(event);
            },

            closeImageReview() {
                return closeChatImageReview();
            },

            selectConversation(otherUserId, firstName, lastName, isOnline) {
                return selectConversation(otherUserId, firstName, lastName, isOnline);
            }
        });

        async function readChatFileAsDataUrl(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(file);
            });
        }

        function chatEstimateDataUrlBytes(dataUrl) {
            const value = String(dataUrl || '');
            const commaIndex = value.indexOf(',');
            const base64Part = commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
            if (!base64Part) return 0;
            return Math.floor((base64Part.length * 3) / 4);
        }

        function chatRenameFileExtension(fileName, extensionWithDot) {
            const safeName = String(fileName || 'image').trim() || 'image';
            const ext = String(extensionWithDot || '.jpg');
            const dotIndex = safeName.lastIndexOf('.');
            if (dotIndex <= 0) return `${safeName}${ext}`;
            return `${safeName.slice(0, dotIndex)}${ext}`;
        }

        async function compressChatImageForUpload(file) {
            const originalType = String(file?.type || '').toLowerCase();
            const isSvg = originalType === 'image/svg+xml';
            if (!String(originalType).startsWith('image/') || isSvg) {
                return {
                    fileName: String(file?.name || 'attachment'),
                    contentType: String(file?.type || 'application/octet-stream'),
                    fileSize: Number(file?.size || 0) || 0,
                    fileData: await readChatFileAsDataUrl(file),
                    compressed: false
                };
            }

            if (typeof createImageBitmap !== 'function') {
                return {
                    fileName: String(file?.name || 'attachment'),
                    contentType: String(file?.type || 'application/octet-stream'),
                    fileSize: Number(file?.size || 0) || 0,
                    fileData: await readChatFileAsDataUrl(file),
                    compressed: false
                };
            }

            const bitmap = await createImageBitmap(file);
            const maxDimension = 1600;
            const longest = Math.max(bitmap.width, bitmap.height);
            const ratio = longest > maxDimension ? (maxDimension / longest) : 1;
            let width = Math.max(1, Math.round(bitmap.width * ratio));
            let height = Math.max(1, Math.round(bitmap.height * ratio));

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                bitmap.close();
                return {
                    fileName: String(file?.name || 'attachment'),
                    contentType: String(file?.type || 'application/octet-stream'),
                    fileSize: Number(file?.size || 0) || 0,
                    fileData: await readChatFileAsDataUrl(file),
                    compressed: false
                };
            }

            const canKeepType = originalType === 'image/jpeg' || originalType === 'image/webp';
            const outputType = canKeepType ? originalType : 'image/jpeg';
            const maxBytes = 1500 * 1024;
            let quality = canKeepType ? 0.82 : 0.8;
            let bestDataUrl = '';

            for (let attempts = 0; attempts < 6; attempts += 1) {
                canvas.width = width;
                canvas.height = height;
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(bitmap, 0, 0, width, height);
                bestDataUrl = canvas.toDataURL(outputType, quality);

                const bytes = chatEstimateDataUrlBytes(bestDataUrl);
                if (bytes <= maxBytes) break;

                if (quality > 0.5) {
                    quality = Math.max(0.5, quality - 0.08);
                } else {
                    width = Math.max(320, Math.round(width * 0.86));
                    height = Math.max(320, Math.round(height * 0.86));
                }
            }

            bitmap.close();

            const outputBytes = chatEstimateDataUrlBytes(bestDataUrl);
            const outputName = outputType === 'image/jpeg'
                ? chatRenameFileExtension(file?.name || 'image', '.jpg')
                : String(file?.name || 'image');

            return {
                fileName: outputName,
                contentType: outputType,
                fileSize: outputBytes,
                fileData: bestDataUrl,
                compressed: outputBytes < (Number(file?.size || 0) || 0)
            };
        }

        async function buildChatAttachmentPayload(onProgress) {
            const files = Array.isArray(window.chatPendingAttachments) ? window.chatPendingAttachments : [];
            const payload = [];
            let compressedCount = 0;
            for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
                const file = files[fileIndex];
                const isImage = String(file?.type || '').toLowerCase().startsWith('image/');
                if (isImage) {
                    const compressed = await compressChatImageForUpload(file);
                    payload.push({
                        fileName: compressed.fileName,
                        contentType: compressed.contentType,
                        fileSize: compressed.fileSize,
                        fileData: compressed.fileData
                    });
                    if (compressed.compressed) compressedCount += 1;
                    if (typeof onProgress === 'function') {
                        onProgress({ completed: fileIndex + 1, total: files.length, file });
                    }
                    continue;
                }

                const fileData = await readChatFileAsDataUrl(file);
                payload.push({
                    fileName: String(file?.name || 'attachment'),
                    contentType: String(file?.type || 'application/octet-stream'),
                    fileSize: Number(file?.size || 0) || 0,
                    fileData
                });
                if (typeof onProgress === 'function') {
                    onProgress({ completed: fileIndex + 1, total: files.length, file });
                }
            }

            if (compressedCount > 0 && typeof showNotification === 'function') {
                showNotification(`${compressedCount} image${compressedCount === 1 ? '' : 's'} optimized for upload`, 'success');
            }
            return payload;
        }

        function renderChatAttachmentListHtml(attachments, messageKey) {
            const list = Array.isArray(attachments) ? attachments : [];
            if (!list.length) return '';

            const normalizedList = list.map((att) => normalizeChatAttachment(att));

            const imageCandidates = buildChatImageCandidates(normalizedList);
            const imageButtonsHtml = imageCandidates.map((img, index) => {
                const cacheKey = `${String(messageKey || 'msg')}:image:${index}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;
                window.chatAttachmentDownloadCache[cacheKey] = {
                    images: imageCandidates,
                    sourceMessageKey: String(messageKey || '')
                };
                return `
                    <div style="position:relative; margin-top:0.35rem; margin-right:0.35rem;">
                        <button type="button" onclick="openChatImageReview('${cacheKey}', ${index})" title="Preview image" style="border:none; background:transparent; padding:0; cursor:pointer; display:block;">
                            <img src="${img.fileData}" alt="${escapeHtml(img.fileName || 'chat image')}" style="width:88px; height:88px; object-fit:cover; border-radius:10px; border:1px solid rgba(255,255,255,0.3); display:block;">
                        </button>
                    </div>
                `;
            }).join('');

            const items = normalizedList.map((att, index) => {
                const cacheKey = `${String(messageKey || 'msg')}:${index}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;
                window.chatAttachmentDownloadCache[cacheKey] = att;
                const fileName = escapeHtml(String(att?.fileName || 'attachment'));
                const fileSize = formatChatFileSize(att?.fileSize || 0);
                const hasData = String(att?.fileData || '').trim().length > 0;
                const isImage = isChatImageAttachment(att);
                if (!hasData) {
                    return `<div style="display:block; margin-top:0.35rem; padding:0.35rem 0.5rem; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.22); border-radius:8px; color:inherit;"><i class="fas fa-paperclip"></i> ${fileName} <span style="opacity:0.75;">(${fileSize})</span></div>`;
                }
                // Image attachments are shown via thumbnail previews above; no duplicate file row.
                if (isImage) return '';
                return `<button type="button" onclick="openChatAttachment('${cacheKey}')" style="display:block; width:100%; text-align:left; margin-top:0.35rem; padding:0.35rem 0.5rem; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.22); border-radius:8px; color:inherit; cursor:pointer;"><i class="fas fa-paperclip"></i> ${fileName} <span style="opacity:0.75;">(${fileSize})</span></button>`;
            }).join('');

            return `<div style="margin-top:0.3rem;">${imageButtonsHtml ? `<div style="display:flex; flex-wrap:wrap; align-items:center;">${imageButtonsHtml}</div>` : ''}${items}</div>`;
        }

        function openChatAttachment(cacheKey, forceDownload = false) {
            const item = window.chatAttachmentDownloadCache?.[cacheKey];
            if (!item) return;

            const href = String(item.fileData || '').trim();
            if (!href) {
                if (typeof showNotification === 'function') showNotification('Attachment data missing', 'error');
                return;
            }

            if (isChatImageAttachment(item) && !forceDownload) {
                window.chatAttachmentDownloadCache[cacheKey] = {
                    images: [
                        {
                            fileName: String(item.fileName || 'chat-image'),
                            fileData: href,
                            fileSize: Number(item.fileSize || 0) || 0,
                            contentType: String(item.contentType || '')
                        }
                    ]
                };
                openChatImageReview(cacheKey, 0);
                return;
            }

            const link = document.createElement('a');
            link.href = href;
            link.download = String(item.fileName || 'attachment');
            link.click();
        }
        
        // Start background badge updates when logged in
        function initChatNotifications() {
            setInterval(updateUnreadBadge, 30000); // Update every 30 seconds
            updateUnreadBadge(); // Initial check
        }
        
        // Update online status when page closes
        window.addEventListener('beforeunload', () => {
            updateOnlineStatus(false);
        });
        
        // ============================================
        // END TEAM CHAT FUNCTIONS
        // ============================================
        
        // ============================================
        // TASK ASSIGNMENT SYSTEM
        // ============================================
        
        // Task Assignments - Links tasks to entities (employees, equipment, instruments, supplies, etc.)
        window.taskAssignments = safeParseLocalStorageJSON('reformDental_taskAssignments', [], { expect: 'array' });
        
        // Entity Types for Task Assignments
        const taskEntityTypes = [
            { id: 'employee', name: 'Employee', icon: 'fa-user', color: '#3b82f6' },
            { id: 'equipment', name: 'Equipment', icon: 'fa-cog', color: '#f59e0b' },
            { id: 'instrument', name: 'Instrument', icon: 'fa-tools', color: '#8b5cf6' },
            { id: 'supply', name: 'Supply', icon: 'fa-boxes', color: '#ec4899' },
            { id: 'vendor', name: 'Vendor', icon: 'fa-truck', color: '#78716c' },
            { id: 'room', name: 'Room', icon: 'fa-door-open', color: '#14b8a6' },
            { id: 'clinic', name: 'Clinic', icon: 'fa-hospital', color: '#6366f1' },
            { id: 'patient', name: 'Patient', icon: 'fa-user-injured', color: '#ef4444' },
            { id: 'provider', name: 'Provider', icon: 'fa-user-md', color: '#10b981' }
        ];
        
        // Assignment Status Options
        const assignmentStatusOptions = [
            { id: 'pending', name: 'Pending', color: '#eab308', icon: 'fa-clock' },
            { id: 'in-progress', name: 'In Progress', color: '#3b82f6', icon: 'fa-spinner' },
            { id: 'completed', name: 'Completed', color: '#10b981', icon: 'fa-check-circle' },
            { id: 'overdue', name: 'Overdue', color: '#ef4444', icon: 'fa-exclamation-circle' },
            { id: 'cancelled', name: 'Cancelled', color: '#64748b', icon: 'fa-times-circle' }
        ];
        
        // Save Task Assignments to localStorage
        function saveTaskAssignments() {
            localStorage.setItem('reformDental_taskAssignments', JSON.stringify(window.taskAssignments));
        }
        
        // Generate unique ID for assignments
        function generateAssignmentId() {
            return 'assign-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        }
        
        // Create a new task assignment
        function createTaskAssignment(data) {
            const assignment = {
                id: generateAssignmentId(),
                taskTemplateId: data.taskTemplateId,
                title: data.title || '',
                description: data.description || '',
                priority: data.priority || 'Medium',
                status: data.status || 'pending',
                dueDate: data.dueDate || null,
                dueTime: data.dueTime || null,
                recurrence: data.recurrence || 'one-time',
                linkedEntities: data.linkedEntities || [], // Array of { entityType, entityId, entityName, role }
                primaryAssignee: data.primaryAssignee || null, // { entityType, entityId, entityName }
                notes: data.notes || '',
                createdAt: new Date().toISOString(),
                createdBy: 'current-user', // Would be actual user in real app
                completedAt: null,
                completedBy: null
            };
            
            window.taskAssignments.push(assignment);
            saveTaskAssignments();
            renderTaskAssignmentsView();
            
            if (typeof showNotification === 'function') {
                showNotification('Task assignment created successfully', 'success');
            }
            
            return assignment;
        }
        
        // Update task assignment
        function updateTaskAssignment(assignmentId, updates) {
            const index = window.taskAssignments.findIndex(a => a.id === assignmentId);
            if (index !== -1) {
                window.taskAssignments[index] = { ...window.taskAssignments[index], ...updates };
                saveTaskAssignments();
                renderTaskAssignmentsView();
                return window.taskAssignments[index];
            }
            return null;
        }
        
        // Delete task assignment
        function deleteTaskAssignment(assignmentId) {
            const index = window.taskAssignments.findIndex(a => a.id === assignmentId);
            if (index !== -1) {
                window.taskAssignments.splice(index, 1);
                saveTaskAssignments();
                renderTaskAssignmentsView();
                if (typeof showNotification === 'function') {
                    showNotification('Task assignment deleted', 'info');
                }
                return true;
            }
            return false;
        }
        
        // Get entities by type for dropdown population
        function getEntitiesByType(entityType) {
            try {
                switch (entityType) {
                    case 'employee':
                        // Use masterData.getAllEmployees() which returns employeeResources
                        const employees = window.masterData?.getAllEmployees() || [];
                        return employees.map(e => ({ 
                            id: e.id, 
                            name: e.title || e.name, 
                            details: e.extendedProps?.role || e.extendedProps?.type || '' 
                        }));
                    
                    case 'equipment':
                        // Use loadEquipment() function
                        const equipment = typeof loadEquipment === 'function' ? loadEquipment() : [];
                        return equipment.map(e => ({ 
                            id: e.id, 
                            name: e.name, 
                            details: e.type || e.category || e.status || '' 
                        }));
                    
                    case 'instrument':
                        // Use loadInstruments() function
                        const instruments = typeof loadInstruments === 'function' ? loadInstruments() : [];
                        return instruments.map(i => ({ 
                            id: i.id, 
                            name: i.name, 
                            details: i.category || i.type || '' 
                        }));
                    
                    case 'supply':
                        // Use loadSupplies() function
                        const supplies = typeof loadSupplies === 'function' ? loadSupplies() : [];
                        return supplies.map(s => ({ 
                            id: s.id, 
                            name: s.name, 
                            details: s.category || `Qty: ${s.quantity || 0}` 
                        }));
                    
                    case 'room':
                        // Use masterData.rooms
                        const rooms = window.masterData?.rooms || [];
                        return rooms.map(r => ({ 
                            id: r.id || r.roomID, 
                            name: r.name || r.roomName || r.roomType, 
                            details: r.clinicName || '' 
                        }));
                    
                    case 'clinic':
                        // Use masterData.clinics
                        const clinics = window.masterData?.clinics || [];
                        return clinics.map(c => ({ 
                            id: c.id || c.dbId, 
                            name: c.name, 
                            details: c.address || '' 
                        }));
                    
                    case 'patient':
                        // Patients may be stored differently - check localStorage or API
                        const patients = safeParseLocalStorageJSON('patients', [], { expect: 'array' });
                        return patients.map(p => ({ 
                            id: p.id, 
                            name: p.name || `${p.firstName} ${p.lastName}`, 
                            details: p.phone || p.email || '' 
                        }));
                    
                    case 'provider':
                        // Use masterData.getProviders()
                        const providers = window.masterData?.getProviders() || [];
                        return providers.map(p => ({ 
                            id: p.id, 
                            name: p.title || p.name, 
                            details: p.extendedProps?.role || p.extendedProps?.specialty || '' 
                        }));
                    
                    case 'vendor':
                        // Use loadVendors() function
                        const vendors = typeof loadVendors === 'function' ? loadVendors() : [];
                        return vendors.map(v => ({ 
                            id: v.id, 
                            name: v.name || v.companyName, 
                            details: v.category || v.contactName || '' 
                        }));
                    
                    default:
                        return [];
                }
            } catch (e) {
                console.error('Error getting entities by type:', entityType, e);
                return [];
            }
        }
        
        // Get assignment statistics
        function getAssignmentStats() {
            const stats = {
                total: window.taskAssignments.length,
                pending: 0,
                inProgress: 0,
                completed: 0,
                overdue: 0,
                byEntity: {}
            };
            
            const now = new Date();
            
            window.taskAssignments.forEach(a => {
                // Check if overdue
                if (a.dueDate && a.status !== 'completed' && a.status !== 'cancelled') {
                    const dueDate = new Date(a.dueDate);
                    if (dueDate < now) {
                        a.status = 'overdue';
                    }
                }
                
                switch (a.status) {
                    case 'pending': stats.pending++; break;
                    case 'in-progress': stats.inProgress++; break;
                    case 'completed': stats.completed++; break;
                    case 'overdue': stats.overdue++; break;
                }
                
                // Count by entity
                a.linkedEntities.forEach(entity => {
                    if (!stats.byEntity[entity.entityType]) {
                        stats.byEntity[entity.entityType] = 0;
                    }
                    stats.byEntity[entity.entityType]++;
                });
            });
            
            return stats;
        }
        
        // Open Task Assignment Modal
        function openTaskAssignmentModal(templateId = null, assignmentId = null) {
            try { ensureUnifiedRightRailExpandedForModal(); } catch (_) {}
            const template = templateId ? window.taskTemplates.find(t => t.id === templateId) : null;
            const assignment = assignmentId ? window.taskAssignments.find(a => a.id === assignmentId) : null;
            const isEdit = !!assignment;
            
            const modalHTML = `
                <div class="modal-overlay active" id="taskAssignmentModal" onclick="if(event.target === this) closeTaskAssignmentModal()">
                    <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;" onclick="event.stopPropagation()">
                        <div class="modal-header">
                            <h2 style="display: flex; align-items: center; gap: 0.75rem;">
                                <i class="fas fa-link" style="color: var(--accent-primary);"></i>
                                ${isEdit ? 'Edit Task Assignment' : 'Create Task Assignment'}
                            </h2>
                            <button class="modal-close" onclick="closeTaskAssignmentModal()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        
                        <div class="modal-body" style="padding: 1.5rem;">
                            <!-- Task Template Selection -->
                            <div class="form-group" style="margin-bottom: 1.5rem;">
                                <label class="form-label">Task Template</label>
                                <select id="assignTaskTemplate" class="form-input-enhanced" onchange="onTaskTemplateSelect(this.value)" ${isEdit ? 'disabled' : ''}>
                                    <option value="">-- Select a task template --</option>
                                    ${window.taskTemplates.map(t => `
                                        <option value="${t.id}" ${(template && t.id === template.id) || (assignment && t.id === assignment.taskTemplateId) ? 'selected' : ''}>
                                            ${t.title} (${t.category})
                                        </option>
                                    `).join('')}
                                    <option value="custom">+ Custom Task (No Template)</option>
                                </select>
                            </div>
                            
                            <!-- Custom Title (shown if no template or custom) -->
                            <div class="form-group" id="customTitleGroup" style="margin-bottom: 1rem; ${template ? 'display: none;' : ''}">
                                <label class="form-label">Task Title</label>
                                <input type="text" id="assignTaskTitle" class="form-input-enhanced" placeholder="Enter task title" value="${assignment?.title || ''}">
                            </div>
                            
                            <!-- Description -->
                            <div class="form-group" style="margin-bottom: 1rem;">
                                <label class="form-label">Description</label>
                                <textarea id="assignTaskDescription" class="form-input-enhanced" rows="2" placeholder="Task description...">${assignment?.description || template?.description || ''}</textarea>
                            </div>
                            
                            <!-- Priority & Status Row -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div class="form-group">
                                    <label class="form-label">Priority</label>
                                    <select id="assignTaskPriority" class="form-input-enhanced">
                                        <option value="Low" ${(assignment?.priority || template?.priority) === 'Low' ? 'selected' : ''}>Low</option>
                                        <option value="Medium" ${(assignment?.priority || template?.priority || 'Medium') === 'Medium' ? 'selected' : ''}>Medium</option>
                                        <option value="High" ${(assignment?.priority || template?.priority) === 'High' ? 'selected' : ''}>High</option>
                                        <option value="Critical" ${(assignment?.priority || template?.priority) === 'Critical' ? 'selected' : ''}>Critical</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Status</label>
                                    <select id="assignTaskStatus" class="form-input-enhanced">
                                        ${assignmentStatusOptions.map(s => `
                                            <option value="${s.id}" ${(assignment?.status || 'pending') === s.id ? 'selected' : ''}>${s.name}</option>
                                        `).join('')}
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Due Date & Time Row -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div class="form-group">
                                    <label class="form-label">Due Date</label>
                                    <input type="date" id="assignTaskDueDate" class="form-input-enhanced" value="${assignment?.dueDate || ''}">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Due Time</label>
                                    <input type="time" id="assignTaskDueTime" class="form-input-enhanced" value="${assignment?.dueTime || ''}">
                                </div>
                            </div>
                            
                            <!-- Recurrence -->
                            <div class="form-group" style="margin-bottom: 1.5rem;">
                                <label class="form-label">Recurrence</label>
                                <select id="assignTaskRecurrence" class="form-input-enhanced">
                                    <option value="one-time" ${(assignment?.recurrence || template?.recurrence || 'one-time').toLowerCase().includes('one') ? 'selected' : ''}>One-time</option>
                                    <option value="daily" ${(assignment?.recurrence || template?.recurrence || '').toLowerCase() === 'daily' ? 'selected' : ''}>Daily</option>
                                    <option value="weekly" ${(assignment?.recurrence || template?.recurrence || '').toLowerCase() === 'weekly' ? 'selected' : ''}>Weekly</option>
                                    <option value="monthly" ${(assignment?.recurrence || template?.recurrence || '').toLowerCase() === 'monthly' ? 'selected' : ''}>Monthly</option>
                                </select>
                            </div>
                            
                            <!-- Linked Entities Section -->
                            <div style="background: var(--bg-secondary); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                    <h4 style="margin: 0; font-size: 0.95rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                                        <i class="fas fa-link" style="color: var(--accent-primary);"></i>
                                        Linked Entities
                                    </h4>
                                    <button type="button" onclick="addLinkedEntityRow()" style="background: var(--accent-primary); color: white; border: none; padding: 0.4rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">
                                        <i class="fas fa-plus"></i> Add Entity
                                    </button>
                                </div>
                                
                                <div id="linkedEntitiesContainer">
                                    ${(assignment?.linkedEntities || []).map((entity, idx) => createLinkedEntityRowHTML(idx, entity)).join('')}
                                </div>
                                
                                <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.75rem; margin-bottom: 0;">
                                    <i class="fas fa-info-circle"></i> Link employees, equipment, instruments, supplies, rooms, etc. to this task.
                                </p>
                            </div>
                            
                            <!-- Primary Assignee -->
                            <div class="form-group" style="margin-bottom: 1rem;">
                                <label class="form-label">Primary Assignee (Optional)</label>
                                <select id="assignPrimaryAssignee" class="form-input-enhanced">
                                    <option value="">-- Select from linked entities --</option>
                                </select>
                                <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                    The primary person/entity responsible for completing this task.
                                </p>
                            </div>
                            
                            <!-- Notes -->
                            <div class="form-group">
                                <label class="form-label">Notes</label>
                                <textarea id="assignTaskNotes" class="form-input-enhanced" rows="2" placeholder="Additional notes...">${assignment?.notes || ''}</textarea>
                            </div>
                        </div>
                        
                        <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between;">
                            <button type="button" onclick="closeTaskAssignmentModal()" style="padding: 0.6rem 1.25rem; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; cursor: pointer; color: var(--text-secondary);">
                                Cancel
                            </button>
                            <button type="button" onclick="saveTaskAssignment('${assignmentId || ''}')" style="padding: 0.6rem 1.25rem; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                <i class="fas fa-save"></i> ${isEdit ? 'Update Assignment' : 'Create Assignment'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // If editing, populate primary assignee dropdown
            if (assignment) {
                setTimeout(() => updatePrimaryAssigneeDropdown(), 100);
            }
        }
        
        // Create HTML for a linked entity row
        function createLinkedEntityRowHTML(index, entity = null) {
            return `
                <div class="linked-entity-row" data-index="${index}" style="display: grid; grid-template-columns: 140px 1fr 100px 40px; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center;">
                    <select class="form-input-enhanced entity-type-select" onchange="onEntityTypeChange(${index}, this.value)" style="font-size: 0.85rem;">
                        <option value="">Type...</option>
                        ${taskEntityTypes.map(t => `
                            <option value="${t.id}" ${entity?.entityType === t.id ? 'selected' : ''}>${t.name}</option>
                        `).join('')}
                    </select>
                    <select class="form-input-enhanced entity-select" id="entitySelect_${index}" style="font-size: 0.85rem;">
                        <option value="">Select ${entity?.entityType || 'entity'}...</option>
                        ${entity ? getEntitiesByType(entity.entityType).map(e => `
                            <option value="${e.id}" data-name="${e.name}" ${e.id === entity.entityId ? 'selected' : ''}>${e.name}${e.details ? ' (' + e.details + ')' : ''}</option>
                        `).join('') : ''}
                    </select>
                    <select class="form-input-enhanced entity-role-select" style="font-size: 0.85rem;">
                        <option value="assigned" ${entity?.role === 'assigned' ? 'selected' : ''}>Assigned</option>
                        <option value="responsible" ${entity?.role === 'responsible' ? 'selected' : ''}>Responsible</option>
                        <option value="involved" ${entity?.role === 'involved' ? 'selected' : ''}>Involved</option>
                        <option value="uses" ${entity?.role === 'uses' ? 'selected' : ''}>Uses</option>
                        <option value="located-at" ${entity?.role === 'located-at' ? 'selected' : ''}>Located At</option>
                    </select>
                    <button type="button" onclick="removeLinkedEntityRow(${index})" style="background: #fee2e2; border: none; color: #dc2626; padding: 0.4rem; border-radius: 6px; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }
        
        // Add a new linked entity row
        let linkedEntityIndex = 0;
        function addLinkedEntityRow() {
            const container = document.getElementById('linkedEntitiesContainer');
            if (container) {
                linkedEntityIndex++;
                container.insertAdjacentHTML('beforeend', createLinkedEntityRowHTML(linkedEntityIndex));
            }
        }
        
        // Remove a linked entity row
        function removeLinkedEntityRow(index) {
            const row = document.querySelector(`.linked-entity-row[data-index="${index}"]`);
            if (row) {
                row.remove();
                updatePrimaryAssigneeDropdown();
            }
        }
        
        // On entity type change, populate the entity select
        function onEntityTypeChange(index, entityType) {
            const entitySelect = document.getElementById(`entitySelect_${index}`);
            if (entitySelect && entityType) {
                const entities = getEntitiesByType(entityType);
                entitySelect.innerHTML = `
                    <option value="">Select ${entityType}...</option>
                    ${entities.map(e => `
                        <option value="${e.id}" data-name="${e.name}">${e.name}${e.details ? ' (' + e.details + ')' : ''}</option>
                    `).join('')}
                `;
            }
            updatePrimaryAssigneeDropdown();
        }
        
        // On task template select
        function onTaskTemplateSelect(templateId) {
            const customTitleGroup = document.getElementById('customTitleGroup');
            const descriptionField = document.getElementById('assignTaskDescription');
            const priorityField = document.getElementById('assignTaskPriority');
            
            if (templateId === 'custom' || !templateId) {
                if (customTitleGroup) customTitleGroup.style.display = 'block';
                if (descriptionField) descriptionField.value = '';
            } else {
                const template = window.taskTemplates.find(t => t.id === templateId);
                if (template) {
                    if (customTitleGroup) customTitleGroup.style.display = 'none';
                    if (descriptionField) descriptionField.value = template.description || '';
                    if (priorityField) priorityField.value = template.priority || 'Medium';
                }
            }
        }
        
        // Update primary assignee dropdown based on linked entities
        function updatePrimaryAssigneeDropdown() {
            const dropdown = document.getElementById('assignPrimaryAssignee');
            if (!dropdown) return;
            
            const linkedEntities = collectLinkedEntities();
            const assignableEntities = linkedEntities.filter(e => 
                e.entityType === 'employee' || e.entityType === 'provider'
            );
            
            dropdown.innerHTML = `
                <option value="">-- Select from linked entities --</option>
                ${assignableEntities.map(e => `
                    <option value="${e.entityType}:${e.entityId}">${e.entityName} (${e.entityType})</option>
                `).join('')}
            `;
        }
        
        // Collect linked entities from the form
        function collectLinkedEntities() {
            const entities = [];
            const rows = document.querySelectorAll('.linked-entity-row');
            
            rows.forEach(row => {
                const typeSelect = row.querySelector('.entity-type-select');
                const entitySelect = row.querySelector('.entity-select');
                const roleSelect = row.querySelector('.entity-role-select');
                
                if (typeSelect?.value && entitySelect?.value) {
                    entities.push({
                        entityType: typeSelect.value,
                        entityId: entitySelect.value,
                        entityName: entitySelect.options[entitySelect.selectedIndex]?.dataset?.name || entitySelect.options[entitySelect.selectedIndex]?.text || '',
                        role: roleSelect?.value || 'assigned'
                    });
                }
            });
            
            return entities;
        }
        
        // Save task assignment from modal
        function saveTaskAssignment(assignmentId) {
            const templateSelect = document.getElementById('assignTaskTemplate');
            const titleInput = document.getElementById('assignTaskTitle');
            const descriptionInput = document.getElementById('assignTaskDescription');
            const prioritySelect = document.getElementById('assignTaskPriority');
            const statusSelect = document.getElementById('assignTaskStatus');
            const dueDateInput = document.getElementById('assignTaskDueDate');
            const dueTimeInput = document.getElementById('assignTaskDueTime');
            const recurrenceSelect = document.getElementById('assignTaskRecurrence');
            const primaryAssigneeSelect = document.getElementById('assignPrimaryAssignee');
            const notesInput = document.getElementById('assignTaskNotes');
            
            const templateId = templateSelect?.value;
            const template = templateId && templateId !== 'custom' ? window.taskTemplates.find(t => t.id === templateId) : null;
            
            const linkedEntities = collectLinkedEntities();
            
            // Parse primary assignee
            let primaryAssignee = null;
            if (primaryAssigneeSelect?.value) {
                const [entityType, entityId] = primaryAssigneeSelect.value.split(':');
                const entity = linkedEntities.find(e => e.entityType === entityType && e.entityId === entityId);
                if (entity) {
                    primaryAssignee = {
                        entityType: entity.entityType,
                        entityId: entity.entityId,
                        entityName: entity.entityName
                    };
                }
            }
            
            const data = {
                taskTemplateId: templateId !== 'custom' ? templateId : null,
                title: template ? template.title : (titleInput?.value || 'Untitled Task'),
                description: descriptionInput?.value || '',
                priority: prioritySelect?.value || 'Medium',
                status: statusSelect?.value || 'pending',
                dueDate: dueDateInput?.value || null,
                dueTime: dueTimeInput?.value || null,
                recurrence: recurrenceSelect?.value || 'one-time',
                linkedEntities: linkedEntities,
                primaryAssignee: primaryAssignee,
                notes: notesInput?.value || ''
            };
            
            // Validation
            if (!data.title && !template) {
                showNotification('Please enter a task title or select a template', 'error');
                return;
            }
            
            if (assignmentId) {
                updateTaskAssignment(assignmentId, data);
                showNotification('Task assignment updated', 'success');
            } else {
                createTaskAssignment(data);
            }
            
            closeTaskAssignmentModal();
        }
        
        // Close task assignment modal
        function closeTaskAssignmentModal() {
            const modal = document.getElementById('taskAssignmentModal');
            if (modal) modal.remove();
            linkedEntityIndex = 0;
        }
        
        // Render task assignments view
        function renderTaskAssignmentsView() {
            const container = document.getElementById('taskAssignmentsContainer');
            if (!container) return;
            
            const stats = getAssignmentStats();
            const filterStatus = document.getElementById('assignmentFilterStatus')?.value || 'all';
            const filterEntity = document.getElementById('assignmentFilterEntity')?.value || 'all';
            const searchQuery = document.getElementById('assignmentSearch')?.value?.toLowerCase() || '';
            
            // Filter assignments
            let filteredAssignments = window.taskAssignments.filter(a => {
                if (filterStatus !== 'all' && a.status !== filterStatus) return false;
                if (filterEntity !== 'all' && !a.linkedEntities.some(e => e.entityType === filterEntity)) return false;
                if (searchQuery && !a.title.toLowerCase().includes(searchQuery) && !a.description.toLowerCase().includes(searchQuery)) return false;
                return true;
            });
            
            // Sort by due date, then by priority
            const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
            filteredAssignments.sort((a, b) => {
                if (a.dueDate && b.dueDate) {
                    return new Date(a.dueDate) - new Date(b.dueDate);
                }
                if (a.dueDate) return -1;
                if (b.dueDate) return 1;
                return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
            });
            
            container.innerHTML = `
                <!-- Stats Cards -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="background: white; padding: 1rem; border-radius: 12px; border-left: 4px solid #3b82f6; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <div style="font-size: 2rem; font-weight: 700; color: #3b82f6;">${stats.total}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">Total Assignments</div>
                    </div>
                    <div style="background: white; padding: 1rem; border-radius: 12px; border-left: 4px solid #eab308; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <div style="font-size: 2rem; font-weight: 700; color: #eab308;">${stats.pending}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">Pending</div>
                    </div>
                    <div style="background: white; padding: 1rem; border-radius: 12px; border-left: 4px solid #3b82f6; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <div style="font-size: 2rem; font-weight: 700; color: #3b82f6;">${stats.inProgress}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">In Progress</div>
                    </div>
                    <div style="background: white; padding: 1rem; border-radius: 12px; border-left: 4px solid #10b981; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <div style="font-size: 2rem; font-weight: 700; color: #10b981;">${stats.completed}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">Completed</div>
                    </div>
                    <div style="background: white; padding: 1rem; border-radius: 12px; border-left: 4px solid #ef4444; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <div style="font-size: 2rem; font-weight: 700; color: #ef4444;">${stats.overdue}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">Overdue</div>
                    </div>
                </div>
                
                <!-- Assignment Cards -->
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    ${filteredAssignments.length === 0 ? `
                        <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                            <i class="fas fa-clipboard-list" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                            <p>No task assignments found.</p>
                            <button onclick="openTaskAssignmentModal()" style="margin-top: 1rem; padding: 0.6rem 1.25rem; background: var(--accent-primary); color: white; border: none; border-radius: 8px; cursor: pointer;">
                                <i class="fas fa-plus"></i> Create First Assignment
                            </button>
                        </div>
                    ` : filteredAssignments.map(a => renderAssignmentCard(a)).join('')}
                </div>
            `;
        }
        
        // Render a single assignment card
        function renderAssignmentCard(assignment) {
            const statusOption = assignmentStatusOptions.find(s => s.id === assignment.status) || assignmentStatusOptions[0];
            const priorityColor = { 'Critical': '#dc2626', 'High': '#f59e0b', 'Medium': '#3b82f6', 'Low': '#10b981' }[assignment.priority] || '#64748b';
            const template = assignment.taskTemplateId ? window.taskTemplates.find(t => t.id === assignment.taskTemplateId) : null;
            
            const dueInfo = assignment.dueDate ? formatDueDate(assignment.dueDate, assignment.dueTime) : null;
            
            return `
                <div class="assignment-card card-enhanced" style="background: white; border-radius: 12px; padding: 1rem; border-left: 4px solid ${priorityColor}; transition: all 0.2s;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                                ${template ? `<i class="fas ${template.icon}" style="color: ${template.iconColor};"></i>` : '<i class="fas fa-tasks" style="color: var(--accent-primary);"></i>'}
                                <h4 style="margin: 0; font-size: 1rem; color: var(--text-primary);">${assignment.title}</h4>
                            </div>
                            <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">${assignment.description || 'No description'}</p>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <span style="background: ${statusOption.color}20; color: ${statusOption.color}; padding: 0.25rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">
                                <i class="fas ${statusOption.icon}" style="margin-right: 0.25rem;"></i>${statusOption.name}
                            </span>
                        </div>
                    </div>
                    
                    <!-- Linked Entities -->
                    ${assignment.linkedEntities.length > 0 ? `
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
                            ${assignment.linkedEntities.map(e => {
                                const entityType = taskEntityTypes.find(t => t.id === e.entityType);
                                return `
                                    <span style="background: ${entityType?.color}15; color: ${entityType?.color}; padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.75rem; display: flex; align-items: center; gap: 0.25rem;">
                                        <i class="fas ${entityType?.icon}"></i> ${e.entityName}
                                        <span style="opacity: 0.7; font-size: 0.65rem;">(${e.role})</span>
                                    </span>
                                `;
                            }).join('')}
                        </div>
                    ` : ''}
                    
                    <!-- Footer -->
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
                        <div style="display: flex; gap: 1rem; font-size: 0.8rem; color: var(--text-secondary);">
                            ${dueInfo ? `
                                <span style="color: ${dueInfo.isOverdue ? '#ef4444' : 'inherit'};">
                                    <i class="fas fa-calendar"></i> ${dueInfo.text}
                                </span>
                            ` : ''}
                            <span style="background: ${priorityColor}15; color: ${priorityColor}; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">
                                ${assignment.priority}
                            </span>
                            ${assignment.primaryAssignee ? `
                                <span><i class="fas fa-user"></i> ${assignment.primaryAssignee.entityName}</span>
                            ` : ''}
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button onclick="openTaskAssignmentModal(null, '${assignment.id}')" style="background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); padding: 0.35rem 0.6rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem;" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="quickUpdateAssignmentStatus('${assignment.id}')" style="background: var(--accent-primary); border: none; color: white; padding: 0.35rem 0.6rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem;" title="Update Status">
                                <i class="fas fa-check"></i>
                            </button>
                            <button onclick="confirmDeleteAssignment('${assignment.id}')" style="background: #fee2e2; border: none; color: #dc2626; padding: 0.35rem 0.6rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem;" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Format due date for display
        function formatDueDate(dueDate, dueTime) {
            const due = new Date(dueDate);
            const now = new Date();
            const isOverdue = due < now && !dueDate.includes(now.toISOString().split('T')[0]);
            
            const options = { month: 'short', day: 'numeric' };
            let text = due.toLocaleDateString('en-US', options);
            
            if (dueTime) {
                text += ' at ' + dueTime;
            }
            
            // Check if today
            if (due.toDateString() === now.toDateString()) {
                text = 'Today' + (dueTime ? ' at ' + dueTime : '');
            }
            
            // Check if tomorrow
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            if (due.toDateString() === tomorrow.toDateString()) {
                text = 'Tomorrow' + (dueTime ? ' at ' + dueTime : '');
            }
            
            return { text, isOverdue };
        }
        
        // Quick update assignment status
        function quickUpdateAssignmentStatus(assignmentId) {
            const assignment = window.taskAssignments.find(a => a.id === assignmentId);
            if (!assignment) return;
            
            const statusOrder = ['pending', 'in-progress', 'completed'];
            const currentIndex = statusOrder.indexOf(assignment.status);
            const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
            
            updateTaskAssignment(assignmentId, { 
                status: nextStatus,
                completedAt: nextStatus === 'completed' ? new Date().toISOString() : null
            });
            
            const statusName = assignmentStatusOptions.find(s => s.id === nextStatus)?.name || nextStatus;
            showNotification(`Status updated to: ${statusName}`, 'success');
        }
        
        // Confirm delete assignment
        function confirmDeleteAssignment(assignmentId) {
            if (confirm('Are you sure you want to delete this task assignment?')) {
                deleteTaskAssignment(assignmentId);
            }
        }
        
        // Update nav badge for task assignments
        function updateTaskAssignmentsNavBadge() {
            const badge = document.getElementById('taskAssignmentsNavBadge');
            if (badge) {
                const pendingCount = window.taskAssignments.filter(a => 
                    a.status === 'pending' || a.status === 'in-progress' || a.status === 'overdue'
                ).length;
                badge.textContent = pendingCount;
                badge.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
            }
        }
        
        // Initialize task assignments on page load
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                updateTaskAssignmentsNavBadge();
            }, 500);
        });
        
        // ============================================
        // END TASK ASSIGNMENT SYSTEM
        // ============================================
        
        // ============================================
        // TASK HUB - UNIFIED TASK MANAGEMENT
        // ============================================
        
        // Task Hub State - use window for global access
        window.taskHubState = {
            currentTab: 'my-tasks',
            filters: {
                status: 'all',
                priority: 'all',
                category: 'all',
                dueDate: 'all'
            },
            searchQuery: ''
        };
        
        // Initialize Task Hub
        function initTaskHub() {
            // Render initial view
            renderTaskHubMyTasks();
            updateTaskHubStats();
            updateTaskHubBadges();
        }
        
        // Switch Task Hub Tab
        function switchTaskHubTab(tabName) {
            // Ensure taskHubState is initialized
            if (!window.taskHubState) {
                window.taskHubState = {
                    currentTab: 'my-tasks',
                    filters: {
                        priority: 'all',
                        status: 'all',
                        category: 'all'
                    },
                    searchQuery: ''
                };
            }
            window.taskHubState.currentTab = tabName;
            
            // Update tab buttons
            document.querySelectorAll('.task-hub-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.tab === tabName);
            });
            
            // Update panels
            document.querySelectorAll('.task-hub-panel').forEach(panel => {
                panel.classList.toggle('active', panel.id === `panel-${tabName}`);
            });
            
            // Render appropriate view
            switch (tabName) {
                case 'my-tasks':
                    renderTaskHubMyTasks();
                    break;
                case 'floating':
                    renderTaskHubFloating();
                    break;
                case 'bonus':
                    renderTaskHubBonus();
                    break;
                case 'assignment-board':
                    renderAssignmentBoard();
                    break;
                case 'completed':
                    renderTaskHubCompleted();
                    break;
            }
        }
        
        // Update Task Hub Stats
        function updateTaskHubStats() {
            const currentUser = safeParseLocalStorageJSON('currentUser', null, { expect: 'objectOrNull' });
            const userId = currentUser?.id || currentUser?.name;
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            // Get user's tasks
            const myTasks = window.tasksData.filter(t => 
                t.assignedTo === userId || t.claimedBy === userId
            );
            
            // Calculate stats
            const pending = myTasks.filter(t => t.status === 'Pending' || t.status === 'Not Started').length;
            const inProgress = myTasks.filter(t => t.status === 'In Progress').length;
            const overdue = myTasks.filter(t => {
                if (t.status === 'Completed') return false;
                if (!t.dueDate) return false;
                return new Date(t.dueDate) < today;
            }).length;
            const completedToday = myTasks.filter(t => {
                if (t.status !== 'Completed') return false;
                if (!t.completedAt) return false;
                const completed = new Date(t.completedAt);
                return completed >= today;
            }).length;
            
            // Update DOM
            const statPending = document.getElementById('statPending');
            const statInProgress = document.getElementById('statInProgress');
            const statOverdue = document.getElementById('statOverdue');
            const statCompletedToday = document.getElementById('statCompletedToday');
            
            if (statPending) statPending.textContent = pending;
            if (statInProgress) statInProgress.textContent = inProgress;
            if (statOverdue) statOverdue.textContent = overdue;
            if (statCompletedToday) statCompletedToday.textContent = completedToday;
        }
        
        // Render My Tasks
        function renderTaskHubMyTasks() {
            const container = document.getElementById('myTasksContainer');
            if (!container) return;
            
            const currentUser = safeParseLocalStorageJSON('currentUser', null, { expect: 'objectOrNull' });
            const userId = currentUser?.id || currentUser?.name;
            const userClaimKey = getCurrentUserClaimKey();
            
            // Get user's assigned and claimed tasks
            let myTasks = window.tasksData.filter(t => 
                ((t.assignedTo === userId) || (userClaimKey && String(getTaskClaimInfo(t).claimedBy) === String(userClaimKey))) && t.status !== 'Completed'
            );
            
            // Apply filters
            myTasks = applyTaskFilters(myTasks);
            
            // Apply sorting
            const sortBy = document.getElementById('myTasksSort')?.value || 'dueDate';
            myTasks = sortTasks(myTasks, sortBy);
            
            if (myTasks.length === 0) {
                container.innerHTML = `
                    <div class="empty-tasks-message">
                        <i class="fas fa-clipboard-check"></i>
                        <h4>No tasks assigned</h4>
                        <p>Check the Floating or Bonus tabs for available tasks to claim!</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = myTasks.map(task => renderTaskHubCard(task)).join('');
        }
        
        // Render Floating Tasks in Hub
        function renderTaskHubFloating() {
            const container = document.getElementById('floatingTasksContainer');
            if (!container) return;
            
            // Get unclaimed floating tasks
            let floatingTasks = window.tasksData.filter(t => 
                t.taskType === 'Floating' && t.status !== 'Completed'
            );
            
            // Apply filters
            floatingTasks = applyTaskFilters(floatingTasks);
            
            if (floatingTasks.length === 0) {
                container.innerHTML = `
                    <div class="empty-tasks-message">
                        <i class="fas fa-hand-pointer"></i>
                        <h4>No floating tasks available</h4>
                        <p>Check back later for new tasks to claim!</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = floatingTasks.map(task => renderTaskHubCard(task, 'floating')).join('');
        }
        
        // Render Bonus Tasks in Hub
        function renderTaskHubBonus() {
            const container = document.getElementById('bonusTasksContainer');
            if (!container) return;
            
            // Get unclaimed bonus tasks
            let bonusTasks = window.tasksData.filter(t => 
                t.taskType === 'Bonus' && t.status !== 'Completed'
            );
            
            // Apply filters
            bonusTasks = applyTaskFilters(bonusTasks);
            
            if (bonusTasks.length === 0) {
                container.innerHTML = `
                    <div class="empty-tasks-message">
                        <i class="fas fa-star"></i>
                        <h4>No bonus tasks available</h4>
                        <p>Bonus tasks offer extra compensation. Check back later!</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = bonusTasks.map(task => renderTaskHubCard(task, 'bonus')).join('');
        }
        
        // ============================================
        // ASSIGNMENT BOARD - Drag & Drop Task Assignment
        // ============================================

        function getUsersDataSafe() {
            const parsed = safeParseLocalStorageJSON('users', {});
            if (Array.isArray(parsed)) {
                const obj = {};
                parsed.forEach(u => {
                    if (!u) return;
                    if (typeof u === 'string') {
                        obj[u] = { firstName: '', lastName: '', role: 'User' };
                        return;
                    }
                    const key = u.username || u.userName || u.email || u.id || u.name;
                    if (key) obj[key] = u;
                });
                return obj;
            }
            return (parsed && typeof parsed === 'object') ? parsed : {};
        }

        function ensureTasksDataArray() {
            if (Array.isArray(window.tasksData)) return window.tasksData;

            const repaired = safeParseLocalStorageJSON('tasksData', [], { expect: 'array' });
            window.tasksData = Array.isArray(repaired) ? repaired : [];
            try {
                localStorage.setItem('tasksData', JSON.stringify(window.tasksData));
            } catch (e) {
                console.warn('Could not persist repaired tasksData:', e);
            }
            return window.tasksData;
        }
        
        let assignmentBoardFilter = 'all';
        let draggedEmployeeData = null;
        
        // Render the Assignment Board
        function renderAssignmentBoard() {
            renderEmployeesForAssignment();
            renderUnassignedTasks();
            updateUnassignedBadge();
        }
        
        // Render employees list for drag and drop
        function renderEmployeesForAssignment() {
            const container = document.getElementById('employeeListForAssignment');
            if (!container) return;
            
            // Get employees from users
            const usersData = getUsersDataSafe();
            const employees = Object.entries(usersData).map(([username, user]) => ({
                id: username,
                name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : username,
                role: user.role || 'User',
                jobTitle: user.jobTitle || user.role || '',
                avatar: (user.firstName?.[0] || 'U') + (user.lastName?.[0] || '')
            }));
            
            // Also add from masterData if available
            if (window.masterData) {
                const providers = window.masterData.getProviders() || [];
                const assistants = window.masterData.getAssistants() || [];
                [...providers, ...assistants].forEach(emp => {
                    if (!employees.find(e => e.name === emp.title)) {
                        employees.push({
                            id: emp.id || emp.title,
                            name: emp.title,
                            role: emp.jobTitle || 'Staff',
                            jobTitle: emp.jobTitle || '',
                            avatar: emp.title.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
                        });
                    }
                });
            }
            
            if (employees.length === 0) {
                container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 1rem;">No employees found</div>';
                return;
            }
            
            container.innerHTML = employees.map(emp => {
                const safeId = (emp.id || '').replace(/'/g, '&#39;');
                const safeName = (emp.name || '').replace(/'/g, '&#39;');
                return `
                <div class="draggable-employee" 
                     draggable="true" 
                     data-employee-id="${emp.id}" 
                     data-employee-name="${emp.name}"
                     ondragstart="handleEmployeeDragStart(event, '${safeId}', '${safeName}')"
                     ondragend="handleEmployeeDragEnd(event)"
                     style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--card-bg); border: 2px solid var(--border-color); border-radius: 8px; cursor: grab; transition: all 0.2s;"
                     onmouseover="this.style.borderColor='var(--accent-primary)'; this.style.transform='translateX(4px)';"
                     onmouseout="this.style.borderColor='var(--border-color)'; this.style.transform='none';">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem;">${emp.avatar}</div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${emp.name}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${emp.jobTitle || emp.role}</div>
                    </div>
                    <i class="fas fa-grip-vertical" style="color: var(--text-tertiary);"></i>
                </div>
            `}).join('');
        }
        
        // Filter employees search
        window.filterEmployeesForAssignment = function() {
            const search = document.getElementById('employeeSearchAssignment')?.value?.toLowerCase() || '';
            const items = document.querySelectorAll('.draggable-employee');
            items.forEach(item => {
                const name = item.dataset.employeeName?.toLowerCase() || '';
                item.style.display = name.includes(search) ? 'flex' : 'none';
            });
        };
        
        // Render unassigned tasks (Floating/Bonus without assignee)
        function renderUnassignedTasks() {
            const container = document.getElementById('unassignedTasksContainer');
            if (!container) return;
            
            // Get unassigned tasks (Floating or Bonus with no assignee and not claimed)
            let unassignedTasks = window.tasksData.filter(t => {
                const isUnassigned = !t.assignee && !t.claimedBy;
                const isFloatingOrBonus = t.taskType === 'Floating' || t.taskType === 'Bonus';
                const notCompleted = t.status !== 'Completed';
                
                // Apply filter
                if (assignmentBoardFilter !== 'all' && t.taskType !== assignmentBoardFilter) {
                    return false;
                }
                
                return isUnassigned && isFloatingOrBonus && notCompleted;
            });
            
            if (unassignedTasks.length === 0) {
                container.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-secondary);">
                        <i class="fas fa-check-circle" style="font-size: 3rem; color: #10b981; margin-bottom: 1rem; display: block;"></i>
                        <h4 style="margin: 0 0 0.5rem 0;">All tasks are assigned!</h4>
                        <p style="margin: 0; font-size: 0.9rem;">Create new Floating or Bonus tasks to assign them here.</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = unassignedTasks.map(task => {
                const priorityColors = { 'Critical': '#dc2626', 'High': '#f59e0b', 'Medium': '#3b82f6', 'Low': '#10b981' };
                const priorityColor = priorityColors[task.priority] || '#64748b';
                const typeColor = task.taskType === 'Bonus' ? '#f59e0b' : '#3b82f6';
                const typeBg = task.taskType === 'Bonus' ? '#fef3c7' : '#dbeafe';
                
                return `
                    <div class="unassigned-task-card" 
                         data-task-id="${task.id}"
                         ondragover="handleTaskDragOver(event)"
                         ondragleave="handleTaskDragLeave(event)"
                         ondrop="handleTaskDrop(event, '${task.id}')"
                         style="background: var(--card-bg); border: 2px dashed var(--border-color); border-radius: 12px; padding: 1rem; transition: all 0.3s;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span style="padding: 0.25rem 0.5rem; background: ${typeBg}; color: ${typeColor}; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">
                                    <i class="fas ${task.taskType === 'Bonus' ? 'fa-star' : 'fa-hand-pointer'}"></i> ${task.taskType}
                                </span>
                                <span style="padding: 0.25rem 0.5rem; background: ${priorityColor}20; color: ${priorityColor}; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">
                                    ${task.priority}
                                </span>
                            </div>
                            ${task.isPaid && task.payAmount ? `<span style="font-weight: 700; color: #10b981; font-size: 0.9rem;">$${task.payAmount}</span>` : ''}
                        </div>
                        <h4 style="margin: 0 0 0.5rem 0; font-size: 1rem; color: var(--text-primary);">${task.title}</h4>
                        <p style="margin: 0 0 0.75rem 0; font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4;">${(task.description || '').substring(0, 80)}${task.description?.length > 80 ? '...' : ''}</p>
                        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1rem;">
                            ${task.dueDate ? `<span><i class="fas fa-calendar"></i> ${new Date(task.dueDate).toLocaleDateString()}</span>` : ''}
                            ${task.location ? `<span><i class="fas fa-map-marker-alt"></i> ${task.location}</span>` : ''}
                            ${task.timeEstimate ? `<span><i class="fas fa-clock"></i> ${task.timeEstimate}</span>` : ''}
                        </div>
                        <div class="drop-zone" style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border: 2px dashed #3b82f6; border-radius: 8px; padding: 1rem; text-align: center; color: #3b82f6; font-weight: 600; font-size: 0.85rem;">
                            <i class="fas fa-user-plus" style="margin-right: 0.5rem;"></i> Drop employee here to assign
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        // Filter unassigned tasks
        window.filterUnassignedTasks = function(filter) {
            assignmentBoardFilter = filter;
            // Update filter buttons
            document.querySelectorAll('.assignment-filter-btn').forEach(btn => {
                btn.style.background = btn.dataset.filter === filter ? 'var(--accent-primary)' : 'var(--bg-secondary)';
                btn.style.color = btn.dataset.filter === filter ? 'white' : 'var(--text-primary)';
                btn.style.border = btn.dataset.filter === filter ? 'none' : '1px solid var(--border-color)';
            });
            renderUnassignedTasks();
        };
        
        // Drag handlers for employees
        window.handleEmployeeDragStart = function(event, employeeId, employeeName) {
            draggedEmployeeData = { id: employeeId, name: employeeName };
            event.dataTransfer.setData('text/plain', JSON.stringify(draggedEmployeeData));
            event.dataTransfer.effectAllowed = 'copy';
            event.target.style.opacity = '0.5';
            event.target.style.cursor = 'grabbing';
        };
        
        window.handleEmployeeDragEnd = function(event) {
            event.target.style.opacity = '1';
            event.target.style.cursor = 'grab';
            draggedEmployeeData = null;
        };
        
        // Drag handlers for task cards (drop zones)
        window.handleTaskDragOver = function(event) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            const card = event.currentTarget;
            card.style.borderColor = '#10b981';
            card.style.borderStyle = 'solid';
            card.style.background = '#f0fdf4';
            const dropZone = card.querySelector('.drop-zone');
            if (dropZone) {
                dropZone.style.background = '#10b981';
                dropZone.style.color = 'white';
                dropZone.style.borderColor = '#10b981';
            }
        };
        
        window.handleTaskDragLeave = function(event) {
            const card = event.currentTarget;
            card.style.borderColor = 'var(--border-color)';
            card.style.borderStyle = 'dashed';
            card.style.background = 'var(--card-bg)';
            const dropZone = card.querySelector('.drop-zone');
            if (dropZone) {
                dropZone.style.background = 'linear-gradient(135deg, #f0f9ff, #e0f2fe)';
                dropZone.style.color = '#3b82f6';
                dropZone.style.borderColor = '#3b82f6';
            }
        };
        
        window.handleTaskDrop = function(event, taskId) {
            event.preventDefault();
            
            const data = event.dataTransfer.getData('text/plain');
            if (!data) return;
            
            const employee = JSON.parse(data);
            
            // Find and update the task
            const taskIndex = window.tasksData.findIndex(t => t.id === taskId);
            if (taskIndex === -1) return;
            
            const task = window.tasksData[taskIndex];
            
            // Assign the employee to the task
            task.assignee = employee.name;
            task.assignedAt = new Date().toISOString();
            task.assignedBy = 'Admin'; // Or get current user
            
            // Save to localStorage
            localStorage.setItem('tasksData', JSON.stringify(window.tasksData));
            
            // Update in database
            if (typeof updateTaskViaAPI === 'function') {
                updateTaskViaAPI(taskId.replace('task-', ''), {
                    assignee: employee.name,
                    assignedUserId: employee.id
                });
            }
            
            // Show success notification
            if (typeof showNotification === 'function') {
                showNotification(`Task "${task.title}" assigned to ${employee.name}`, 'success');
            } else {
                alert(`✅ Task "${task.title}" assigned to ${employee.name}`);
            }
            
            // Re-render the board
            renderAssignmentBoard();
            updateTaskHubBadges();
        };
        
        // Update unassigned tasks badge
        function updateUnassignedBadge() {
            const badge = document.getElementById('unassignedTasksBadge');
            if (!badge) return;
            
            const count = window.tasksData.filter(t => {
                const isUnassigned = !t.assignee && !t.claimedBy;
                const isFloatingOrBonus = t.taskType === 'Floating' || t.taskType === 'Bonus';
                const notCompleted = t.status !== 'Completed';
                return isUnassigned && isFloatingOrBonus && notCompleted;
            }).length;
            
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        }
        
        // ============================================
        // END ASSIGNMENT BOARD
        // ============================================
        
        // Render Completed Tasks in Hub
        function renderTaskHubCompleted() {
            const container = document.getElementById('completedTasksContainer');
            if (!container) return;
            
            const currentUser = safeParseLocalStorageJSON('currentUser', null, { expect: 'objectOrNull' });
            const userId = currentUser?.id || currentUser?.name;
            const range = document.getElementById('completedTasksRange')?.value || 'month';
            
            // Get date range
            const now = new Date();
            let startDate;
            switch (range) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    startDate = new Date(now);
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'month':
                default:
                    startDate = new Date(now);
                    startDate.setDate(startDate.getDate() - 30);
                    break;
            }
            
            // Get completed tasks
            let completedTasks = window.tasksData.filter(t => {
                if (t.status !== 'Completed') return false;
                if (t.assignedTo !== userId && t.claimedBy !== userId && t.completedBy !== userId) return false;
                if (t.completedAt && new Date(t.completedAt) < startDate) return false;
                return true;
            });
            
            // Sort by completion date (most recent first)
            completedTasks.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
            
            if (completedTasks.length === 0) {
                container.innerHTML = `
                    <div class="empty-tasks-message">
                        <i class="fas fa-check-circle"></i>
                        <h4>No completed tasks</h4>
                        <p>Tasks you complete will appear here.</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = completedTasks.map(task => renderTaskHubCard(task, 'completed')).join('');
        }
        
        // Render Task Hub Card
        function renderTaskHubCard(task, type = 'normal') {
            const priorityColors = {
                'Critical': '#dc2626',
                'High': '#f59e0b',
                'Medium': '#3b82f6',
                'Low': '#10b981'
            };
            const priorityColor = priorityColors[task.priority] || '#64748b';
            
            const dueInfo = task.dueDate ? formatTaskDueDate(task.dueDate) : null;
            const isOverdue = dueInfo && dueInfo.isOverdue;
            const linkedComplianceId = (typeof window.getTaskLinkedComplianceId === 'function')
                ? window.getTaskLinkedComplianceId(task)
                : (() => {
                    if (!task || typeof task !== 'object') return null;
                    const value = task.linkedComplianceId || task.complianceId || null;
                    const parsed = Number.parseInt(value, 10);
                    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
                })();
            
            let actionButtons = '';
            if (type === 'floating' || type === 'bonus') {
                const claimInfo = getTaskClaimInfo(task);
                if (claimInfo.claimedBy) {
                    const claimedByLabel = getClaimedByDisplay(claimInfo.claimedBy);
                    actionButtons = canCurrentUserUnclaim(claimInfo.claimedBy) ? `
                        <button class="task-action-btn unclaim" onclick="unclaimTaskFromHub('${task.id}')" title="Unclaim this task">
                            <i class="fas fa-undo"></i> Unclaim
                        </button>
                    ` : `
                        <span class="task-completed-badge" title="Claimed by ${claimedByLabel}" style="background: #e5e7eb; color: #374151;">
                            <i class="fas fa-user-check"></i> Claimed
                        </span>
                    `;
                } else {
                    actionButtons = `
                        <button class="task-action-btn claim" onclick="claimTaskFromHub('${task.id}')">
                            <i class="fas fa-hand-pointer"></i> Claim
                        </button>
                    `;
                }
            } else if (type === 'completed') {
                actionButtons = `
                    <span class="task-completed-badge">
                        <i class="fas fa-check"></i> Completed
                    </span>
                `;
            } else {
                actionButtons = `
                    <button class="task-action-btn" onclick="viewTaskDetails('${task.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="task-action-btn complete" onclick="completeTaskFromHub('${task.id}')">
                        <i class="fas fa-check"></i>
                    </button>
                `;
            }

            const complianceActionButton = linkedComplianceId
                ? `<button class="task-action-btn" onclick="openComplianceFromTask('${task.id}')" title="Open linked compliance"><i class="fas fa-shield-alt"></i></button>`
                : '';
            
            return `
                <div class="task-hub-card ${type} ${isOverdue ? 'overdue' : ''}" style="border-left-color: ${priorityColor};">
                    <div class="task-hub-card-header">
                        <div class="task-hub-card-title">${task.title}</div>
                        <div class="task-hub-card-badges">
                            <span class="priority-badge ${task.priority?.toLowerCase()}">${task.priority || 'Medium'}</span>
                            ${task.taskType === 'Bonus' && task.payAmount ? `<span class="pay-badge"><i class="fas fa-dollar-sign"></i>${task.payAmount}</span>` : ''}
                        </div>
                    </div>
                    ${task.description ? `<div class="task-hub-card-desc">${task.description}</div>` : ''}
                    <div class="task-hub-card-meta">
                        ${task.estimatedTime ? `<span><i class="fas fa-clock"></i> ${task.estimatedTime} min</span>` : ''}
                        ${task.category ? `<span><i class="fas fa-folder"></i> ${task.category}</span>` : ''}
                        ${linkedComplianceId ? `<span><i class="fas fa-shield-alt"></i> ${task.linkedComplianceTitle || ('Compliance #' + linkedComplianceId)}</span>` : ''}
                        ${dueInfo ? `<span class="${isOverdue ? 'overdue' : ''}"><i class="fas fa-calendar"></i> ${dueInfo.text}</span>` : ''}
                    </div>
                    <div class="task-hub-card-actions">
                        ${actionButtons}
                        ${complianceActionButton}
                    </div>
                </div>
            `;
        }
        
        // Helper Functions
        function applyTaskFilters(tasks) {
            const priority = document.getElementById('taskHubFilterPriority')?.value || 'all';
            const dueFilter = document.getElementById('taskHubFilterDue')?.value || 'all';
            const category = document.getElementById('taskHubFilterCategory')?.value || 'all';
            const search = window.taskHubState.searchQuery?.toLowerCase() || '';
            
            return tasks.filter(task => {
                if (priority !== 'all' && task.priority !== priority) return false;
                if (category !== 'all' && task.category !== category) return false;
                
                if (dueFilter !== 'all' && task.dueDate) {
                    const due = new Date(task.dueDate);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const weekEnd = new Date(today);
                    weekEnd.setDate(weekEnd.getDate() + 7);
                    
                    if (dueFilter === 'today' && due.toDateString() !== today.toDateString()) return false;
                    if (dueFilter === 'week' && due > weekEnd) return false;
                    if (dueFilter === 'overdue' && due >= today) return false;
                }
                
                if (search && !task.title?.toLowerCase().includes(search) && !task.description?.toLowerCase().includes(search)) {
                    return false;
                }
                
                return true;
            });
        }
        
        function sortTasks(tasks, sortBy) {
            return [...tasks].sort((a, b) => {
                switch (sortBy) {
                    case 'dueDate':
                        if (!a.dueDate && !b.dueDate) return 0;
                        if (!a.dueDate) return 1;
                        if (!b.dueDate) return -1;
                        return new Date(a.dueDate) - new Date(b.dueDate);
                    case 'priority':
                        const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
                        return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
                    case 'status':
                        return (a.status || '').localeCompare(b.status || '');
                    default:
                        return 0;
                }
            });
        }
        
        function formatTaskDueDate(dueDate) {
            const due = new Date(dueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const isOverdue = due < today;
            
            let text;
            if (due.toDateString() === today.toDateString()) {
                text = 'Due Today';
            } else if (due.toDateString() === tomorrow.toDateString()) {
                text = 'Due Tomorrow';
            } else if (isOverdue) {
                const daysAgo = Math.ceil((today - due) / (1000 * 60 * 60 * 24));
                text = `${daysAgo} day${daysAgo > 1 ? 's' : ''} overdue`;
            } else {
                text = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
            
            return { text, isOverdue };
        }
        
        // Task Actions
        async function claimTaskFromHub(taskId) {
            const taskIndex = window.tasksData.findIndex(t => t.id == taskId);
            if (taskIndex === -1) return;
            const task = window.tasksData[taskIndex];

            try {
                if (task.taskType === 'Floating') {
                    await claimFloatingTask(taskId);
                } else if (task.taskType === 'Bonus') {
                    await claimBonusTask(taskId);
                } else {
                    showNotification('Only Floating/Bonus tasks can be claimed here.', 'info');
                    return;
                }
                initTaskHub();
                switchTaskHubTab('my-tasks');
            } catch (e) {
                // claimFloatingTask/claimBonusTask already notify
            }
        }

        async function unclaimTaskFromHub(taskId) {
            const taskIndex = window.tasksData.findIndex(t => t.id == taskId);
            if (taskIndex === -1) return;
            const task = window.tasksData[taskIndex];

            try {
                if (task.taskType === 'Floating') {
                    await unclaimFloatingTask(taskId);
                } else if (task.taskType === 'Bonus') {
                    await unclaimBonusTask(taskId);
                } else {
                    return;
                }
                initTaskHub();
                switchTaskHubTab('my-tasks');
            } catch (e) {
                // unclaim functions already notify
            }
        }
        
        function completeTaskFromHub(taskId) {
            const taskIndex = window.tasksData.findIndex(t => t.id == taskId);
            if (taskIndex === -1) return;
            
            const currentUser = safeParseLocalStorageJSON('currentUser', null, { expect: 'objectOrNull' });
            window.tasksData[taskIndex].status = 'Completed';
            window.tasksData[taskIndex].completedBy = currentUser?.id || currentUser?.name;
            window.tasksData[taskIndex].completedAt = new Date().toISOString();

            const completedTask = window.tasksData[taskIndex];
            if (typeof updateTaskViaAPI === 'function') {
                const apiId = String(taskId).startsWith('task-') ? String(taskId).replace('task-', '') : taskId;
                updateTaskViaAPI(apiId, {
                    status: 'Completed',
                    completedAt: completedTask.completedAt,
                    completedBy: completedTask.completedBy,
                    linkedComplianceStatus: 'completed'
                });
            }

            syncLinkedComplianceOnTaskCompletion(completedTask);
            
            showNotification('Task completed!', 'success');
            initTaskHub();
        }
        
        function viewTaskDetails(taskId) {
            const task = window.tasksData.find(t => t.id == taskId);
            if (!task) return;
            
            // Open task details modal (if exists) or show alert
            if (typeof openTaskModal === 'function') {
                openTaskModal(task);
            } else {
                alert(`Task: ${task.title}\n\n${task.description || 'No description'}\n\nPriority: ${task.priority}\nStatus: ${task.status}`);
            }
        }
        
        // Alias for HTML compatibility
        function renderMyTasks() {
            renderTaskHubMyTasks();
        }
        
        function renderCompletedTasks() {
            renderTaskHubCompleted();
        }
        
        // Render Kanban Board
        function renderKanbanBoard() {
            const assignments = getFilteredAssignments();
            
            // Group by status
            const grouped = {
                'pending': [],
                'in-progress': [],
                'completed': [],
                'overdue': []
            };
            
            const now = new Date();
            assignments.forEach(a => {
                // Check for overdue
                if (a.dueDate && a.status !== 'completed' && new Date(a.dueDate) < now) {
                    grouped['overdue'].push(a);
                } else if (grouped[a.status]) {
                    grouped[a.status].push(a);
                } else {
                    grouped['pending'].push(a);
                }
            });
            
            // Render each column
            Object.keys(grouped).forEach(status => {
                const column = document.getElementById(`kanban-${status}`);
                const countBadge = document.getElementById(`kanban-count-${status}`);
                
                if (column) {
                    column.innerHTML = grouped[status].length === 0 
                        ? '<div class="kanban-empty">No tasks</div>'
                        : grouped[status].map(a => renderKanbanCard(a)).join('');
                }
                
                if (countBadge) {
                    countBadge.textContent = grouped[status].length;
                }
            });
        }
        
        // Render Kanban Card
        function renderKanbanCard(assignment) {
            const priorityColor = { 'Critical': '#dc2626', 'High': '#f59e0b', 'Medium': '#3b82f6', 'Low': '#10b981' }[assignment.priority] || '#64748b';
            const template = assignment.taskTemplateId ? window.taskTemplates.find(t => t.id === assignment.taskTemplateId) : null;
            const dueInfo = assignment.dueDate ? formatDueDate(assignment.dueDate, assignment.dueTime) : null;
            
            // Entity badges (max 3 shown)
            const entityBadges = assignment.linkedEntities.slice(0, 3).map(e => {
                const entityType = taskEntityTypes.find(t => t.id === e.entityType);
                return `<span class="kanban-card-entity" style="background: ${entityType?.color}15; color: ${entityType?.color};"><i class="fas ${entityType?.icon}"></i> ${e.entityName.split(' ')[0]}</span>`;
            }).join('');
            
            const moreEntities = assignment.linkedEntities.length > 3 ? `<span class="kanban-card-entity" style="background: var(--bg-tertiary);">+${assignment.linkedEntities.length - 3}</span>` : '';
            
            return `
                <div class="kanban-card ${assignment.priority.toLowerCase()}" 
                     draggable="true" 
                     data-id="${assignment.id}"
                     ondragstart="handleKanbanDragStart(event, '${assignment.id}')"
                     ondragend="handleKanbanDragEnd(event)"
                     onclick="openTaskAssignmentModal(null, '${assignment.id}')">
                    <div class="kanban-card-header">
                        <span class="kanban-card-priority ${assignment.priority.toLowerCase()}">${assignment.priority}</span>
                        ${dueInfo ? `<span class="kanban-card-due ${dueInfo.isOverdue ? 'overdue' : ''}">${dueInfo.text}</span>` : ''}
                    </div>
                    <div class="kanban-card-title">${assignment.title}</div>
                    ${assignment.description ? `<div class="kanban-card-desc">${assignment.description.substring(0, 80)}${assignment.description.length > 80 ? '...' : ''}</div>` : ''}
                    <div class="kanban-card-footer">
                        <div class="kanban-card-entities">
                            ${entityBadges}${moreEntities}
                        </div>
                        ${assignment.primaryAssignee ? `
                            <div class="kanban-card-assignee">
                                <i class="fas fa-user-circle"></i>
                                ${assignment.primaryAssignee.entityName.split(' ')[0]}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        // Kanban Drag and Drop handlers
        function handleKanbanDragStart(event, assignmentId) {
            window.taskHubState.draggedCard = assignmentId;
            event.target.classList.add('dragging');
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', assignmentId);
        }
        
        function handleKanbanDragEnd(event) {
            event.target.classList.remove('dragging');
            window.taskHubState.draggedCard = null;
            document.querySelectorAll('.kanban-column').forEach(col => col.classList.remove('drag-over'));
        }
        
        function handleKanbanDragOver(event) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            event.currentTarget.classList.add('drag-over');
        }
        
        function handleKanbanDrop(event, newStatus) {
            event.preventDefault();
            event.currentTarget.classList.remove('drag-over');
            
            const assignmentId = event.dataTransfer.getData('text/plain') || window.taskHubState.draggedCard;
            if (!assignmentId) return;
            
            const assignment = window.taskAssignments.find(a => a.id === assignmentId);
            if (!assignment) return;
            
            const oldStatus = assignment.status;
            
            // Handle overdue - if moving from overdue, go to in-progress
            if (oldStatus === 'overdue' && newStatus === 'overdue') {
                newStatus = 'in-progress';
            }
            
            // Don't do anything if status is the same
            if (oldStatus === newStatus) return;
            
            // Update the assignment
            const updates = { 
                status: newStatus,
                completedAt: newStatus === 'completed' ? new Date().toISOString() : null
            };
            
            updateTaskAssignment(assignmentId, updates);
            
            // Log activity
            logTaskActivity('status_changed', assignment.title, `Status changed from ${oldStatus} to ${newStatus}`);
            
            // Re-render
            renderKanbanBoard();
            updateTaskHubBadges();
            
            showNotification(`Task moved to ${newStatus.replace('-', ' ')}`, 'success');
        }
        
        // Render Timeline View
        function renderTimelineView() {
            const container = document.getElementById('timelineGrid');
            if (!container) return;
            
            const assignments = getFilteredAssignments().filter(a => a.dueDate);
            const view = window.taskHubState.timelineView;
            const currentDate = window.taskHubState.timelineDate;
            
            // Update date range display
            const dateRangeEl = document.getElementById('timelineDateRange');
            if (dateRangeEl) {
                const options = view === 'week' 
                    ? { month: 'short', day: 'numeric', year: 'numeric' }
                    : { month: 'long', year: 'numeric' };
                dateRangeEl.textContent = currentDate.toLocaleDateString('en-US', options);
            }
            
            // Update view buttons
            document.getElementById('timelineViewWeek')?.classList.toggle('btn-primary-enhanced', view === 'week');
            document.getElementById('timelineViewMonth')?.classList.toggle('btn-primary-enhanced', view === 'month');
            
            // Build timeline based on view
            if (view === 'week') {
                renderWeekTimeline(container, assignments, currentDate);
            } else {
                renderMonthTimeline(container, assignments, currentDate);
            }
        }
        
        // Render Week Timeline
        function renderWeekTimeline(container, assignments, baseDate) {
            const startOfWeek = new Date(baseDate);
            startOfWeek.setDate(baseDate.getDate() - baseDate.getDay());
            
            const days = [];
            for (let i = 0; i < 7; i++) {
                const day = new Date(startOfWeek);
                day.setDate(startOfWeek.getDate() + i);
                days.push(day);
            }
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            container.innerHTML = `
                <div class="timeline-week">
                    ${days.map(day => {
                        const dayStr = day.toISOString().split('T')[0];
                        const dayAssignments = assignments.filter(a => a.dueDate === dayStr);
                        const isToday = day.toDateString() === today.toDateString();
                        const isPast = day < today;
                        
                        return `
                            <div class="timeline-day ${isToday ? 'today' : ''} ${isPast ? 'past' : ''}">
                                <div class="timeline-day-header">
                                    <span class="day-name">${day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                    <span class="day-number">${day.getDate()}</span>
                                </div>
                                <div class="timeline-day-content">
                                    ${dayAssignments.length === 0 
                                        ? '<div class="timeline-empty">No tasks</div>' 
                                        : dayAssignments.map(a => renderTimelineTask(a)).join('')
                                    }
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
        
        // Render Month Timeline
        function renderMonthTimeline(container, assignments, baseDate) {
            const year = baseDate.getFullYear();
            const month = baseDate.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const startPadding = firstDay.getDay();
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            let html = `
                <div class="timeline-month">
                    <div class="timeline-month-header">
                        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                    </div>
                    <div class="timeline-month-grid">
            `;
            
            // Empty cells for padding
            for (let i = 0; i < startPadding; i++) {
                html += '<div class="timeline-cell empty"></div>';
            }
            
            // Days of month
            for (let day = 1; day <= lastDay.getDate(); day++) {
                const date = new Date(year, month, day);
                const dayStr = date.toISOString().split('T')[0];
                const dayAssignments = assignments.filter(a => a.dueDate === dayStr);
                const isToday = date.toDateString() === today.toDateString();
                const isPast = date < today;
                
                html += `
                    <div class="timeline-cell ${isToday ? 'today' : ''} ${isPast ? 'past' : ''} ${dayAssignments.length > 0 ? 'has-tasks' : ''}">
                        <div class="timeline-cell-day">${day}</div>
                        <div class="timeline-cell-tasks">
                            ${dayAssignments.slice(0, 2).map(a => `
                                <div class="timeline-task-dot ${a.priority.toLowerCase()}" title="${a.title}" onclick="openTaskAssignmentModal(null, '${a.id}')"></div>
                            `).join('')}
                            ${dayAssignments.length > 2 ? `<div class="timeline-task-more">+${dayAssignments.length - 2}</div>` : ''}
                        </div>
                    </div>
                `;
            }
            
            html += '</div></div>';
            container.innerHTML = html;
        }
        
        // Render Timeline Task
        function renderTimelineTask(assignment) {
            const priorityColor = { 'Critical': '#dc2626', 'High': '#f59e0b', 'Medium': '#3b82f6', 'Low': '#10b981' }[assignment.priority] || '#64748b';
            return `
                <div class="timeline-task ${assignment.priority.toLowerCase()}" onclick="openTaskAssignmentModal(null, '${assignment.id}')" style="border-left-color: ${priorityColor};">
                    <div class="timeline-task-title">${assignment.title}</div>
                    ${assignment.dueTime ? `<div class="timeline-task-time">${assignment.dueTime}</div>` : ''}
                </div>
            `;
        }
        
        // Timeline Navigation
        function navigateTimeline(direction) {
            if (window.taskHubState.timelineView === 'week') {
                window.taskHubState.timelineDate.setDate(window.taskHubState.timelineDate.getDate() + (direction * 7));
            } else {
                window.taskHubState.timelineDate.setMonth(window.taskHubState.timelineDate.getMonth() + direction);
            }
            renderTimelineView();
        }
        
        function navigateTimelineToday() {
            window.taskHubState.timelineDate = new Date();
            renderTimelineView();
        }
        
        function setTimelineView(view) {
            window.taskHubState.timelineView = view;
            renderTimelineView();
        }
        
        // Render Templates Grid
        function renderTemplatesGrid() {
            const container = document.getElementById('templatesGrid');
            if (!container) return;
            
            const templates = window.taskTemplates || [];
            
            container.innerHTML = templates.length === 0 
                ? `<div style="text-align: center; padding: 3rem; color: var(--text-secondary); grid-column: 1/-1;">
                       <i class="fas fa-layer-group" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                       <p>No task templates found.</p>
                       <button onclick="openCreateTemplateModal()" class="btn-enhanced btn-primary-enhanced" style="margin-top: 1rem;">
                           <i class="fas fa-plus"></i> Create First Template
                       </button>
                   </div>`
                : templates.map(t => renderTemplateCard(t)).join('');
        }
        
        // Render Template Card
        function renderTemplateCard(template) {
            const priorityColor = { 'Critical': '#dc2626', 'High': '#f59e0b', 'Medium': '#3b82f6', 'Low': '#10b981' }[template.priority] || '#64748b';
            
            return `
                <div class="template-card" onclick="openTaskAssignmentModal('${template.id}')">
                    <div class="template-card-icon" style="background: ${template.iconColor}20; color: ${template.iconColor};">
                        <i class="fas ${template.icon || 'fa-tasks'}"></i>
                    </div>
                    <div class="template-card-content">
                        <h4 class="template-card-title">${template.title}</h4>
                        <p class="template-card-desc">${template.description ? template.description.substring(0, 60) + '...' : 'No description'}</p>
                        <div class="template-card-meta">
                            <span style="color: ${priorityColor};">${template.priority}</span>
                            <span>${template.category}</span>
                            <span>${template.recurrence || 'One-time'}</span>
                        </div>
                    </div>
                    <div class="template-card-actions">
                        <button onclick="event.stopPropagation(); openTaskAssignmentModal('${template.id}')" class="btn-enhanced btn-primary-enhanced" style="padding: 0.4rem 0.75rem; font-size: 0.8rem;">
                            <i class="fas fa-plus"></i> Assign
                        </button>
                        <button onclick="event.stopPropagation(); editTaskTemplate('${template.id}')" class="btn-enhanced btn-secondary-enhanced" style="padding: 0.4rem 0.6rem; font-size: 0.8rem;">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
            `;
        }
        
        // Render Activity Feed
        function renderActivityFeed() {
            const container = document.getElementById('activityFeed');
            if (!container) return;
            
            const filterType = document.getElementById('activityFilter')?.value || 'all';
            let activities = window.taskHubState.activityLog || [];
            
            if (filterType !== 'all') {
                activities = activities.filter(a => a.type === filterType);
            }
            
            // Sort by date, newest first
            activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            container.innerHTML = activities.length === 0 
                ? `<div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                       <i class="fas fa-history" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                       <p>No activity recorded yet.</p>
                   </div>`
                : activities.slice(0, 50).map(a => renderActivityItem(a)).join('');
        }
        
        // Render Activity Item
        function renderActivityItem(activity) {
            const iconMap = {
                'created': { icon: 'fa-plus-circle', color: '#10b981' },
                'completed': { icon: 'fa-check-circle', color: '#3b82f6' },
                'updated': { icon: 'fa-edit', color: '#f59e0b' },
                'assigned': { icon: 'fa-user-plus', color: '#8b5cf6' },
                'status_changed': { icon: 'fa-exchange-alt', color: '#06b6d4' },
                'deleted': { icon: 'fa-trash', color: '#ef4444' }
            };
            
            const config = iconMap[activity.type] || { icon: 'fa-circle', color: '#64748b' };
            const timeAgo = getTimeAgo(new Date(activity.timestamp));
            
            return `
                <div class="activity-item">
                    <div class="activity-icon" style="background: ${config.color}20; color: ${config.color};">
                        <i class="fas ${config.icon}"></i>
                    </div>
                    <div class="activity-content">
                        <div class="activity-title">${activity.title}</div>
                        <div class="activity-desc">${activity.description || ''}</div>
                        <div class="activity-time">${timeAgo}</div>
                    </div>
                </div>
            `;
        }
        
        // Log Task Activity
        function logTaskActivity(type, title, description = '') {
            const activity = {
                id: 'act-' + Date.now(),
                type: type,
                title: title,
                description: description,
                timestamp: new Date().toISOString(),
                user: 'current-user'
            };
            
            window.taskHubState.activityLog.unshift(activity);
            
            // Keep only last 200 activities
            if (window.taskHubState.activityLog.length > 200) {
                window.taskHubState.activityLog = window.taskHubState.activityLog.slice(0, 200);
            }
            
            localStorage.setItem('taskActivityLog', JSON.stringify(window.taskHubState.activityLog));
        }
        
        // Get Time Ago string
        function getTimeAgo(date) {
            const now = new Date();
            const seconds = Math.floor((now - date) / 1000);
            
            if (seconds < 60) return 'Just now';
            if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
            if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
            if (seconds < 604800) return Math.floor(seconds / 86400) + ' days ago';
            
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        
        // Filter Activity Feed
        function filterActivityFeed(type) {
            renderActivityFeed();
        }
        
        // Get Filtered Assignments
        function getFilteredAssignments() {
            let assignments = [...window.taskAssignments];
            const { status, priority, entityType } = window.taskHubState.filters;
            const query = window.taskHubState.searchQuery.toLowerCase();
            
            if (status !== 'all') {
                assignments = assignments.filter(a => a.status === status);
            }
            
            if (priority !== 'all') {
                assignments = assignments.filter(a => a.priority === priority);
            }
            
            if (entityType !== 'all') {
                assignments = assignments.filter(a => 
                    a.linkedEntities.some(e => e.entityType === entityType)
                );
            }
            
            if (query) {
                assignments = assignments.filter(a => 
                    a.title.toLowerCase().includes(query) ||
                    a.description?.toLowerCase().includes(query) ||
                    a.linkedEntities.some(e => e.entityName.toLowerCase().includes(query))
                );
            }
            
            return assignments;
        }
        
        // Task Hub Search
        function handleTaskHubSearch(query) {
            window.taskHubState.searchQuery = query;
            
            // Debounce the search
            clearTimeout(window.taskHubState.searchTimeout);
            window.taskHubState.searchTimeout = setTimeout(() => {
                renderCurrentTaskHubView();
                showSmartSearchResults(query);
            }, 300);
        }
        
        function showSearchResults() {
            const results = document.getElementById('taskHubSearchResults');
            if (results && window.taskHubState.searchQuery) {
                results.classList.add('active');
            }
        }
        
        function hideSearchResults() {
            const results = document.getElementById('taskHubSearchResults');
            if (results) results.classList.remove('active');
        }
        
        function showSmartSearchResults(query) {
            const container = document.getElementById('taskHubSearchResults');
            if (!container || !query || query.length < 2) {
                if (container) container.innerHTML = '';
                return;
            }
            
            const lowerQuery = query.toLowerCase();
            
            // Search tasks
            const matchingTasks = window.tasksData.filter(t => 
                t.title?.toLowerCase().includes(lowerQuery) ||
                t.description?.toLowerCase().includes(lowerQuery)
            ).slice(0, 8);
            
            container.innerHTML = `
                ${matchingTasks.length > 0 ? `
                    <div class="search-category">
                        <div class="search-category-title"><i class="fas fa-tasks"></i> Tasks</div>
                        ${matchingTasks.map(t => `
                            <div class="search-result-item" onclick="viewTaskDetails('${t.id}'); hideSearchResults();">
                                <i class="fas fa-clipboard-list"></i>
                                <span>${t.title}</span>
                                <span class="search-result-badge ${t.taskType?.toLowerCase() || ''}">${t.taskType || t.status}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div style="padding: 1rem; text-align: center; color: var(--text-secondary);">
                        <i class="fas fa-search" style="opacity: 0.5;"></i>
                        No tasks found
                    </div>
                `}
            `;
            
            container.classList.add('active');
        }
        
        // Apply Task Hub Filters
        function applyTaskHubFilters() {
            renderCurrentTaskHubView();
        }
        
        function clearTaskHubFilters() {
            window.taskHubState.searchQuery = '';
            
            const priorityFilter = document.getElementById('taskHubFilterPriority');
            const dueFilter = document.getElementById('taskHubFilterDue');
            const categoryFilter = document.getElementById('taskHubFilterCategory');
            const searchInput = document.getElementById('taskHubSearch');
            
            if (priorityFilter) priorityFilter.value = 'all';
            if (dueFilter) dueFilter.value = 'all';
            if (categoryFilter) categoryFilter.value = 'all';
            if (searchInput) searchInput.value = '';
            
            renderCurrentTaskHubView();
        }
        
        function toggleTaskHubFilter() {
            const dropdown = document.getElementById('taskHubFilterDropdown');
            if (dropdown) {
                dropdown.classList.toggle('active');
            }
        }
        
        // Render Current View
        function renderCurrentTaskHubView() {
            switch (window.taskHubState.currentTab) {
                case 'my-tasks':
                    renderTaskHubMyTasks();
                    break;
                case 'floating':
                    renderTaskHubFloating();
                    break;
                case 'bonus':
                    renderTaskHubBonus();
                    break;
                case 'completed':
                    renderTaskHubCompleted();
                    break;
            }
        }
        
        // Update Task Hub Badges
        function updateTaskHubBadges() {
            const currentUser = safeParseLocalStorageJSON('currentUser', null, { expect: 'objectOrNull' });
            const userId = currentUser?.id || currentUser?.name;
            
            // My Tasks badge
            const myTasksBadge = document.getElementById('myTasksBadge');
            if (myTasksBadge) {
                const myTasksCount = window.tasksData.filter(t => 
                    (t.assignedTo === userId || t.claimedBy === userId) && t.status !== 'Completed'
                ).length;
                myTasksBadge.textContent = myTasksCount;
            }
            
            // Floating Tasks badge
            const floatingBadge = document.getElementById('floatingTasksBadge');
            if (floatingBadge) {
                const floatingCount = window.tasksData.filter(t => 
                    t.taskType === 'Floating' && t.status !== 'Completed' && !t.claimedBy
                ).length;
                floatingBadge.textContent = floatingCount;
            }
            
            // Bonus Tasks badge
            const bonusBadge = document.getElementById('bonusTasksBadge');
            if (bonusBadge) {
                const bonusCount = window.tasksData.filter(t => 
                    t.taskType === 'Bonus' && t.status !== 'Completed' && !t.claimedBy
                ).length;
                bonusBadge.textContent = bonusCount;
            }
            
            // Nav badge (total active)
            const navBadge = document.getElementById('taskHubNavBadge');
            if (navBadge) {
                const totalActive = window.tasksData.filter(t => 
                    ((t.assignedTo === userId || t.claimedBy === userId) && t.status !== 'Completed') ||
                    ((t.taskType === 'Floating' || t.taskType === 'Bonus') && t.status !== 'Completed' && !t.claimedBy)
                ).length;
                navBadge.textContent = totalActive;
            }
            
            // Unassigned Tasks badge (Assignment Board)
            const unassignedBadge = document.getElementById('unassignedTasksBadge');
            if (unassignedBadge) {
                const unassignedCount = window.tasksData.filter(t => {
                    const isUnassigned = !t.assignee && !t.claimedBy;
                    const isFloatingOrBonus = t.taskType === 'Floating' || t.taskType === 'Bonus';
                    const notCompleted = t.status !== 'Completed';
                    return isUnassigned && isFloatingOrBonus && notCompleted;
                }).length;
                unassignedBadge.textContent = unassignedCount;
                unassignedBadge.style.display = unassignedCount > 0 ? 'inline-flex' : 'none';
            }
        }
        
        // FAB (Floating Action Button) Toggle
        function toggleTaskHubFab() {
            const fab = document.getElementById('taskHubFab');
            if (fab) {
                window.taskHubState.fabOpen = !window.taskHubState.fabOpen;
                fab.classList.toggle('active', window.taskHubState.fabOpen);
            }
        }
        
        // Quick Create Panel
        function openQuickCreatePanel(defaultStatus = 'pending') {
            const panel = document.getElementById('quickCreatePanel');
            if (panel) {
                panel.classList.add('active');
                document.getElementById('quickTaskTitle')?.focus();
                
                // Set default due date to today
                const today = new Date().toISOString().split('T')[0];
                const dueDateInput = document.getElementById('quickTaskDueDate');
                if (dueDateInput) dueDateInput.value = today;
            }
            
            // Close FAB
            if (window.taskHubState.fabOpen) toggleTaskHubFab();
        }
        
        function closeQuickCreatePanel() {
            const panel = document.getElementById('quickCreatePanel');
            if (panel) {
                panel.classList.remove('active');
            }
        }
        
        // Create Quick Task
        function createQuickTask() {
            const title = document.getElementById('quickTaskTitle')?.value?.trim();
            const priority = document.getElementById('quickTaskPriority')?.value || 'Medium';
            const dueDate = document.getElementById('quickTaskDueDate')?.value || null;
            
            if (!title) {
                showNotification('Please enter a task title', 'error');
                return;
            }
            
            // Create the assignment
            createTaskAssignment({
                title: title,
                priority: priority,
                dueDate: dueDate,
                status: 'pending',
                linkedEntities: []
            });
            
            // Log activity
            logTaskActivity('created', title, 'Quick task created');
            
            // Clear and close
            document.getElementById('quickTaskTitle').value = '';
            closeQuickCreatePanel();
            
            // Refresh view
            renderCurrentTaskHubView();
            updateTaskHubBadges();
        }
        
        // Quick Entity Search for Quick Create
        function handleQuickEntitySearch(query) {
            const container = document.getElementById('quickEntityResults');
            if (!container || query.length < 2) {
                if (container) container.style.display = 'none';
                return;
            }
            
            const lowerQuery = query.toLowerCase();
            const results = [];
            
            ['employee', 'equipment', 'instrument', 'supply', 'room', 'provider'].forEach(type => {
                const entities = getEntitiesByType(type);
                entities.forEach(e => {
                    if (e.name.toLowerCase().includes(lowerQuery)) {
                        results.push({ ...e, entityType: type });
                    }
                });
            });
            
            if (results.length === 0) {
                container.style.display = 'none';
                return;
            }
            
            container.innerHTML = results.slice(0, 6).map(e => {
                const entityType = taskEntityTypes.find(t => t.id === e.entityType);
                return `
                    <div onclick="selectQuickEntity('${e.id}', '${e.entityType}', '${e.name}')" style="padding: 0.5rem; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; border-radius: 6px; background: var(--bg-tertiary); margin-bottom: 0.25rem;">
                        <i class="fas ${entityType?.icon}" style="color: ${entityType?.color};"></i>
                        <span style="font-size: 0.85rem;">${e.name}</span>
                        <span style="font-size: 0.7rem; color: var(--text-secondary); margin-left: auto;">${e.entityType}</span>
                    </div>
                `;
            }).join('');
            
            container.style.display = 'block';
        }
        
        function selectQuickEntity(id, type, name) {
            document.getElementById('quickTaskEntity').value = name;
            document.getElementById('quickEntityResults').style.display = 'none';
            // Store for later use when creating the task
            window.quickSelectedEntity = { entityType: type, entityId: id, entityName: name };
        }
        
        // Open Create Template Modal (bridge to existing function)
        function openCreateTemplateModal() {
            if (typeof openManageTemplatesModal === 'function') {
                openManageTemplatesModal();
            } else {
                showNotification('Template management not available', 'info');
            }
        }
        
        // Edit Task Template (bridge to existing function)
        function editTaskTemplate(templateId) {
            if (typeof openManageTemplatesModal === 'function') {
                openManageTemplatesModal(templateId);
            }
        }
        
        // Override switchContentView to redirect old views to Task Hub
        const originalSwitchContentView = typeof switchContentView === 'function' ? switchContentView : null;
        
        // Hook into content view switching
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                initTaskHub();
            }, 1000);
        });
        
        // ============================================
        // END TASK HUB
        // ============================================
        
        // Task Templates - Now customizable!
        window.taskTemplates = [
            {
                id: 'daily-close',
                title: 'Daily Close Checklist',
                description: 'Complete end-of-day closing procedures including cash reconciliation, equipment shutdown, and security check.',
                priority: 'High',
                category: 'Administrative',
                recurrence: 'Daily',
                linkedContext: { type: 'Process', value: 'Daily Close' },
                completionCriteria: 'All items checked off + initials',
                complianceFlag: false,
                estimatedTime: 30,
                icon: 'fa-door-closed',
                iconColor: '#ef4444'
            },
            {
                id: 'sterilization',
                title: 'Sterilization Task',
                description: 'Run sterilization cycle on designated equipment per OSHA protocol.',
                priority: 'Critical',
                category: 'Clinical',
                recurrence: 'Daily',
                linkedContext: { type: 'Equipment', value: 'Sterilization Equipment' },
                completionCriteria: 'Cycle complete + logged',
                complianceFlag: true,
                estimatedTime: 45,
                icon: 'fa-pump-medical',
                iconColor: '#10b981'
            },
            {
                id: 'equipment-check',
                title: 'Equipment Maintenance Check',
                description: 'Perform routine maintenance check on dental equipment.',
                priority: 'Medium',
                category: 'Equipment',
                recurrence: 'Weekly',
                linkedContext: { type: 'Equipment', value: '' },
                completionCriteria: 'Checklist completed + issues logged',
                complianceFlag: false,
                estimatedTime: 30,
                icon: 'fa-tools',
                iconColor: '#f59e0b'
            },
            {
                id: 'patient-followup',
                title: 'Patient Follow-up Call',
                description: 'Contact patient to check on post-procedure recovery.',
                priority: 'Medium',
                category: 'Clinical',
                recurrence: 'One-time',
                linkedContext: { type: 'Patient', value: '' },
                completionCriteria: 'Call logged in patient record',
                complianceFlag: false,
                estimatedTime: 10,
                icon: 'fa-phone',
                iconColor: '#3b82f6'
            },
            {
                id: 'compliance-audit',
                title: 'Compliance Audit Task',
                description: 'Complete compliance review per regulatory requirements.',
                priority: 'High',
                category: 'Compliance',
                recurrence: 'Monthly',
                linkedContext: { type: 'Process', value: '' },
                completionCriteria: 'Audit report completed + filed',
                complianceFlag: true,
                estimatedTime: 60,
                icon: 'fa-clipboard-check',
                iconColor: '#8b5cf6'
            },
            {
                id: 'supply-order',
                title: 'Supply Order',
                description: 'Review inventory and place order for supplies.',
                priority: 'Medium',
                category: 'Administrative',
                recurrence: 'Weekly',
                linkedContext: { type: 'Process', value: 'Inventory' },
                completionCriteria: 'Order placed + confirmation received',
                complianceFlag: false,
                estimatedTime: 20,
                icon: 'fa-boxes',
                iconColor: '#ec4899'
            }
        ];
        
        // Template icon options for selection
        const templateIconOptions = [
            { icon: 'fa-door-closed', label: 'Door/Close', color: '#ef4444' },
            { icon: 'fa-pump-medical', label: 'Medical', color: '#10b981' },
            { icon: 'fa-tools', label: 'Tools', color: '#f59e0b' },
            { icon: 'fa-phone', label: 'Phone', color: '#3b82f6' },
            { icon: 'fa-clipboard-check', label: 'Clipboard', color: '#8b5cf6' },
            { icon: 'fa-boxes', label: 'Boxes', color: '#ec4899' },
            { icon: 'fa-broom', label: 'Cleaning', color: '#14b8a6' },
            { icon: 'fa-file-medical', label: 'Medical File', color: '#f43f5e' },
            { icon: 'fa-calendar-check', label: 'Calendar', color: '#6366f1' },
            { icon: 'fa-user-nurse', label: 'Staff', color: '#0ea5e9' },
            { icon: 'fa-tooth', label: 'Dental', color: '#84cc16' },
            { icon: 'fa-envelope', label: 'Email', color: '#a855f7' },
            { icon: 'fa-money-bill', label: 'Financial', color: '#22c55e' },
            { icon: 'fa-shield-alt', label: 'Compliance', color: '#8b5cf6' },
            { icon: 'fa-laptop', label: 'Computer', color: '#64748b' },
            { icon: 'fa-truck', label: 'Delivery', color: '#78716c' }
        ];
        
        // Priority colors
        const priorityColors = {
            'Critical': '#dc2626',
            'High': '#f59e0b',
            'Medium': '#3b82f6',
            'Low': '#10b981'
        };
        
        // Status colors
        const statusColors = {
            'Pending': '#eab308',
            'In Progress': '#3b82f6',
            'Completed': '#10b981',
            'Overdue': '#ef4444'
        };
        
        // Task Calendar State
        let taskCalendarDate = new Date();
        let taskCalendarOpen = false;
        let taskDateRangeMode = 'week'; // 'today', 'week', 'month', 'all', 'custom'
        let taskDateRangeStart = null;
        let taskDateRangeEnd = null;
        
        // Initialize date range to this week
        (function() {
            const today = new Date();
            const dayOfWeek = today.getDay();
            taskDateRangeStart = new Date(today);
            taskDateRangeStart.setDate(today.getDate() - dayOfWeek);
            taskDateRangeStart.setHours(0, 0, 0, 0);
            
            taskDateRangeEnd = new Date(taskDateRangeStart);
            taskDateRangeEnd.setDate(taskDateRangeStart.getDate() + 6);
            taskDateRangeEnd.setHours(23, 59, 59, 999);
        })();
        
        // Toggle Task Calendar
        window.toggleTaskCalendar = function() {
            taskCalendarOpen = !taskCalendarOpen;
            const dropdown = document.getElementById('taskCalendarDropdown');
            const chevron = document.getElementById('taskCalendarChevron');
            
            if (dropdown) {
                if (taskCalendarOpen) {
                    dropdown.classList.add('active');
                    if (chevron) chevron.style.transform = 'rotate(180deg)';
                    renderTaskCalendar();
                } else {
                    dropdown.classList.remove('active');
                    if (chevron) chevron.style.transform = 'rotate(0deg)';
                }
            }
        };
        
        // Render Task Calendar
        function renderTaskCalendar() {
            const year = taskCalendarDate.getFullYear();
            const month = taskCalendarDate.getMonth();
            
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                              'July', 'August', 'September', 'October', 'November', 'December'];
            
            const monthDisplay = document.getElementById('taskCalendarMonth');
            if (monthDisplay) {
                monthDisplay.textContent = monthNames[month] + ' ' + year;
            }
            
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const daysInPrevMonth = new Date(year, month, 0).getDate();
            
            const grid = document.getElementById('taskCalendarGrid');
            if (!grid) return;
            
            // Clear and rebuild with headers
            grid.innerHTML = '';
            const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
            dayNames.forEach(function(name) {
                const headerEl = document.createElement('div');
                headerEl.style.cssText = 'font-weight: 600; color: var(--text-secondary); font-size: 0.75rem; padding: 0.25rem; text-align: center;';
                headerEl.textContent = name;
                grid.appendChild(headerEl);
            });
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Count tasks per day for this month
            const taskCountByDay = {};
            var monthStr = String(month + 1).padStart(2, '0');
            var prefix = year + '-' + monthStr;
            window.tasksData.forEach(function(task) {
                var taskDate = task.dueDate;
                if (taskDate && taskDate.indexOf(prefix) === 0) {
                    var day = parseInt(taskDate.split('-')[2]);
                    taskCountByDay[day] = (taskCountByDay[day] || 0) + 1;
                }
            });
            
            // Previous month days
            for (let i = firstDay - 1; i >= 0; i--) {
                const day = daysInPrevMonth - i;
                const dayEl = document.createElement('div');
                dayEl.style.cssText = 'padding: 0.4rem; color: var(--text-secondary); opacity: 0.4; font-size: 0.8rem; text-align: center;';
                dayEl.textContent = day;
                grid.appendChild(dayEl);
            }
            
            // Current month days
            for (let day = 1; day <= daysInMonth; day++) {
                const dayEl = document.createElement('div');
                const dateObj = new Date(year, month, day);
                dateObj.setHours(0, 0, 0, 0);
                
                const isToday = dateObj.getTime() === today.getTime();
                const isInRange = taskDateRangeStart && taskDateRangeEnd && 
                                  dateObj >= taskDateRangeStart && dateObj <= taskDateRangeEnd;
                const taskCount = taskCountByDay[day] || 0;
                
                dayEl.style.padding = '0.3rem';
                dayEl.style.cursor = 'pointer';
                dayEl.style.borderRadius = '6px';
                dayEl.style.transition = 'all 0.2s';
                dayEl.style.fontSize = '0.8rem';
                dayEl.style.fontWeight = '500';
                dayEl.style.textAlign = 'center';
                dayEl.style.position = 'relative';
                dayEl.style.color = isToday ? 'white' : (isInRange ? 'var(--accent-dark)' : 'var(--text-primary)');
                dayEl.style.background = isToday ? 'var(--accent-primary)' : (isInRange ? 'var(--accent-light)' : 'transparent');
                if (isInRange && !isToday) dayEl.style.fontWeight = '700';
                
                if (taskCount > 0) {
                    var countSpan = document.createElement('span');
                    countSpan.style.cssText = 'position: absolute; top: 0; right: 2px; font-size: 0.55rem; font-weight: 700;';
                    countSpan.style.color = isToday ? '#fef3c7' : '#ef4444';
                    countSpan.textContent = taskCount;
                    dayEl.textContent = day;
                    dayEl.appendChild(countSpan);
                } else {
                    dayEl.textContent = day;
                }
                
                (function(d, isTdy, isRng) {
                    dayEl.onmouseover = function() {
                        if (!isTdy && !isRng) this.style.background = 'var(--accent-light)';
                    };
                    dayEl.onmouseout = function() {
                        if (!isTdy && !isRng) this.style.background = 'transparent';
                    };
                    dayEl.onclick = function(e) {
                        e.stopPropagation();
                        selectTaskDate(new Date(year, month, d));
                    };
                })(day, isToday, isInRange);
                
                grid.appendChild(dayEl);
            }
            
            // Next month days
            const totalCells = grid.children.length - 7;
            const remainingCells = 42 - totalCells;
            for (let day = 1; day <= remainingCells; day++) {
                const dayEl = document.createElement('div');
                dayEl.style.cssText = 'padding: 0.4rem; color: var(--text-secondary); opacity: 0.4; font-size: 0.8rem; text-align: center;';
                dayEl.textContent = day;
                grid.appendChild(dayEl);
            }
        }
        
        // Select specific date
        function selectTaskDate(date) {
            taskDateRangeMode = 'custom';
            taskDateRangeStart = new Date(date);
            taskDateRangeStart.setHours(0, 0, 0, 0);
            taskDateRangeEnd = new Date(date);
            taskDateRangeEnd.setHours(23, 59, 59, 999);
            
            updateTaskDateDisplay();
            renderTaskCalendar();
            renderTasksList();
            toggleTaskCalendar();
        }
        
        // Set date range preset
        window.setTaskDateRange = function(mode) {
            taskDateRangeMode = mode;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            switch(mode) {
                case 'today':
                    taskDateRangeStart = new Date(today);
                    taskDateRangeEnd = new Date(today);
                    taskDateRangeEnd.setHours(23, 59, 59, 999);
                    break;
                case 'week':
                    const dayOfWeek = today.getDay();
                    taskDateRangeStart = new Date(today);
                    taskDateRangeStart.setDate(today.getDate() - dayOfWeek);
                    taskDateRangeEnd = new Date(taskDateRangeStart);
                    taskDateRangeEnd.setDate(taskDateRangeStart.getDate() + 6);
                    taskDateRangeEnd.setHours(23, 59, 59, 999);
                    break;
                case 'month':
                    taskDateRangeStart = new Date(today.getFullYear(), today.getMonth(), 1);
                    taskDateRangeEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    taskDateRangeEnd.setHours(23, 59, 59, 999);
                    break;
                case 'all':
                    taskDateRangeStart = null;
                    taskDateRangeEnd = null;
                    break;
            }
            
            taskCalendarDate = new Date(today);
            updateTaskDateDisplay();
            renderTaskCalendar();
            renderTasksList();
            toggleTaskCalendar();
        };
        
        // Navigate weeks
        window.taskCalendarPrevWeek = function() {
            if (!taskDateRangeStart) {
                setTaskDateRange('week');
                return;
            }
            taskDateRangeStart.setDate(taskDateRangeStart.getDate() - 7);
            taskDateRangeEnd.setDate(taskDateRangeEnd.getDate() - 7);
            taskCalendarDate = new Date(taskDateRangeStart);
            taskDateRangeMode = 'week';
            updateTaskDateDisplay();
            renderTasksList();
            if (taskCalendarOpen) renderTaskCalendar();
        };
        
        window.taskCalendarNextWeek = function() {
            if (!taskDateRangeStart) {
                setTaskDateRange('week');
                return;
            }
            taskDateRangeStart.setDate(taskDateRangeStart.getDate() + 7);
            taskDateRangeEnd.setDate(taskDateRangeEnd.getDate() + 7);
            taskCalendarDate = new Date(taskDateRangeStart);
            taskDateRangeMode = 'week';
            updateTaskDateDisplay();
            renderTasksList();
            if (taskCalendarOpen) renderTaskCalendar();
        };
        
        // Navigate months in calendar
        window.taskCalendarPrevMonth = function() {
            taskCalendarDate.setMonth(taskCalendarDate.getMonth() - 1);
            renderTaskCalendar();
        };
        
        window.taskCalendarNextMonth = function() {
            taskCalendarDate.setMonth(taskCalendarDate.getMonth() + 1);
            renderTaskCalendar();
        };
        
        // Jump to today
        window.taskCalendarToday = function() {
            setTaskDateRange('week');
        };
        
        // Update date display
        function updateTaskDateDisplay() {
            const buttonDate = document.getElementById('taskCalendarButtonDate');
            const rangeText = document.getElementById('taskDateRangeText');
            
            const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const formatDateLong = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
            let displayText = '';
            let rangeDescription = '';
            
            if (taskDateRangeMode === 'all' || !taskDateRangeStart) {
                displayText = 'All Tasks';
                rangeDescription = 'Showing all tasks';
            } else if (taskDateRangeMode === 'today') {
                displayText = 'Today';
                rangeDescription = `Showing tasks for today (${formatDateLong(taskDateRangeStart)})`;
            } else if (taskDateRangeMode === 'week') {
                displayText = `${formatDate(taskDateRangeStart)} - ${formatDate(taskDateRangeEnd)}`;
                rangeDescription = `Showing tasks for week: ${formatDate(taskDateRangeStart)} - ${formatDate(taskDateRangeEnd)}`;
            } else if (taskDateRangeMode === 'month') {
                const monthName = taskDateRangeStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                displayText = monthName;
                rangeDescription = `Showing tasks for ${monthName}`;
            } else if (taskDateRangeMode === 'custom') {
                displayText = formatDateLong(taskDateRangeStart);
                rangeDescription = `Showing tasks for ${formatDateLong(taskDateRangeStart)}`;
            }
            
            if (buttonDate) buttonDate.textContent = displayText;
            if (rangeText) rangeText.textContent = rangeDescription;
        }
        
        // Initialize Tasks View
        function initTasksView() {
            populateTaskAssigneeFilter();
            updateTaskDateDisplay();
            renderTasksList();
            updateTaskStats();
            renderThisWeekTasks();
            updateCategoryBadges();
            renderTemplatesSidebar();
            // Pre-render sidebar calendar (will show when expanded)
            renderTaskSidebarCalendar();
        }
        
        // Populate assignee filter dropdown
        function populateTaskAssigneeFilter() {
            const filterEl = document.getElementById('taskFilterAssignee');
            if (!filterEl) return;
            
            const employees = window.masterData ? [...window.masterData.getProviders(), ...window.masterData.getAssistants()] : [];
            
            let options = '<option value="">All Assignees</option>';
            employees.forEach(emp => {
                options += `<option value="${emp.title}">${emp.title}</option>`;
            });
            filterEl.innerHTML = options;
        }
        
        // Render tasks list
        window.renderTasksList = function() {
            const container = document.getElementById('tasksListContainer');
            if (!container) return;
            
            // Get current user role and name
            const userRole = localStorage.getItem('userRole');
            const userName = localStorage.getItem('userName');
            
            // Get filters
            const statusFilter = document.getElementById('taskFilterStatus')?.value || '';
            const priorityFilter = document.getElementById('taskFilterPriority')?.value || '';
            const categoryFilter = document.getElementById('taskFilterCategory')?.value || '';
            const assigneeFilter = document.getElementById('taskFilterAssignee')?.value || '';
            
            // Filter tasks by dropdown filters
            let filteredTasks = window.tasksData.filter(task => {
                // For non-admin users, show:
                // 1. Tasks assigned to them (primary or secondary)
                // 2. Bonus and Floating tasks (unassigned tasks that anyone can claim)
                if (userRole !== 'admin' && userName) {
                    const isAssignedToUser = task.assignee === userName || task.secondaryAssignee === userName;
                    const isBonusOrFloating = task.taskType === 'Bonus' || task.taskType === 'Floating';
                    if (!isAssignedToUser && !isBonusOrFloating) return false;
                }
                
                if (statusFilter && task.status !== statusFilter) return false;
                if (priorityFilter && task.priority !== priorityFilter) return false;
                if (categoryFilter && task.category !== categoryFilter) return false;
                // For assignee filter, include unassigned Bonus/Floating tasks when "All" or no filter
                if (assigneeFilter) {
                    const isBonusOrFloating = task.taskType === 'Bonus' || task.taskType === 'Floating';
                    if (task.assignee !== assigneeFilter && !isBonusOrFloating) return false;
                }
                return true;
            });
            
            // Filter by date range (if set)
            if (taskDateRangeStart && taskDateRangeEnd) {
                filteredTasks = filteredTasks.filter(task => {
                    // Parse the date string as local time (not UTC)
                    var parts = task.dueDate.split('-');
                    var taskDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    taskDate.setHours(0, 0, 0, 0);
                    return taskDate >= taskDateRangeStart && taskDate <= taskDateRangeEnd;
                });
            }
            
            // Update date range count
            const countEl = document.getElementById('taskDateRangeCount');
            if (countEl) {
                countEl.textContent = `${filteredTasks.length} task${filteredTasks.length !== 1 ? 's' : ''}`;
            }
            
            // Update overdue status and AUTO-ESCALATE priority based on days overdue
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            filteredTasks.forEach(task => {
                if (task.status === 'Completed') return;
                
                const dueDate = new Date(task.dueDate);
                dueDate.setHours(0, 0, 0, 0);
                const diffTime = today - dueDate;
                const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                if (daysOverdue > 0) {
                    task.status = 'Overdue';
                    task.daysOverdue = daysOverdue;
                    
                    // Store original priority if not already stored
                    if (!task.originalPriority) {
                        task.originalPriority = task.priority;
                    }
                    
                    // AUTO-ESCALATE PRIORITY based on days overdue:
                    // Low → Medium (3+ days) → High (6+ days) → Critical (9+ days)
                    // Medium → High (3+ days) → Critical (6+ days)
                    // High → Critical (2+ days)
                    const original = task.originalPriority;
                    
                    if (original === 'Low') {
                        if (daysOverdue >= 9) task.priority = 'Critical';
                        else if (daysOverdue >= 6) task.priority = 'High';
                        else if (daysOverdue >= 3) task.priority = 'Medium';
                    } else if (original === 'Medium') {
                        if (daysOverdue >= 6) task.priority = 'Critical';
                        else if (daysOverdue >= 3) task.priority = 'High';
                    } else if (original === 'High') {
                        if (daysOverdue >= 2) task.priority = 'Critical';
                    }
                } else {
                    task.daysOverdue = 0;
                }
            });
            
            // Sort: Overdue first (most overdue at top), then by due date, then by priority
            const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
            filteredTasks.sort((a, b) => {
                if (a.status === 'Overdue' && b.status !== 'Overdue') return -1;
                if (b.status === 'Overdue' && a.status !== 'Overdue') return 1;
                // Most overdue first
                if (a.status === 'Overdue' && b.status === 'Overdue') {
                    return (b.daysOverdue || 0) - (a.daysOverdue || 0);
                }
                if (a.status === 'Completed' && b.status !== 'Completed') return 1;
                if (b.status === 'Completed' && a.status !== 'Completed') return -1;
                if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });
            
            if (filteredTasks.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        <i class="fas fa-clipboard-check" style="font-size: 3rem; opacity: 0.3; margin-bottom: 1rem;"></i>
                        <p>No tasks found</p>
                    </div>
                `;
                return;
            }
            
            let html = '';
            filteredTasks.forEach(task => {
                const priorityColor = priorityColors[task.priority] || '#6b7280';
                const statusColor = statusColors[task.status] || '#6b7280';
                const dueDateFormatted = new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const isOverdue = task.status === 'Overdue';
                const isCompleted = task.status === 'Completed';
                const daysOverdue = task.daysOverdue || 0;
                const wasEscalated = task.originalPriority && task.originalPriority !== task.priority;
                
                html += `
                    <div class="task-card" onclick="showTaskDetail('${task.id}')" style="padding: 1rem; background: ${isOverdue ? '#fef2f2' : 'var(--bg-secondary)'}; border-radius: 8px; border-left: 4px solid ${priorityColor}; cursor: pointer; transition: all 0.2s; ${isCompleted ? 'opacity: 0.7;' : ''}" onmouseover="this.style.transform='translateX(4px)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)';" onmouseout="this.style.transform='none'; this.style.boxShadow='none';">
                        <div style="display: flex; justify-content: space-between; align-items: start; gap: 1rem;">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                    <span style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem; ${isCompleted ? 'text-decoration: line-through;' : ''}">${task.title}</span>
                                    ${task.complianceFlag ? '<i class="fas fa-shield-alt" style="color: var(--accent-primary); font-size: 0.75rem;" title="Compliance Task"></i>' : ''}
                                    ${wasEscalated ? '<i class="fas fa-arrow-up" style="color: #ef4444; font-size: 0.7rem;" title="Priority escalated due to being overdue"></i>' : ''}
                                </div>
                                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;">${task.description.substring(0, 80)}${task.description.length > 80 ? '...' : ''}</div>
                                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
                                    <span style="font-size: 0.7rem; padding: 0.2rem 0.5rem; background: ${priorityColor}20; color: ${priorityColor}; border-radius: 4px; font-weight: 600;">${task.priority}${wasEscalated ? ' ⬆' : ''}</span>
                                    <span style="font-size: 0.7rem; padding: 0.2rem 0.5rem; background: ${statusColor}20; color: ${statusColor}; border-radius: 4px; font-weight: 600;">${task.status}</span>
                                    ${isOverdue && daysOverdue > 0 ? `<span style="font-size: 0.7rem; padding: 0.2rem 0.5rem; background: #fecaca; color: #b91c1c; border-radius: 4px; font-weight: 700;"><i class="fas fa-exclamation-triangle" style="margin-right: 0.2rem;"></i>${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue</span>` : ''}
                                    <span style="font-size: 0.7rem; color: var(--text-secondary);"><i class="fas fa-folder" style="margin-right: 0.2rem;"></i>${task.category}</span>
                                    <span style="font-size: 0.7rem; color: var(--text-secondary);"><i class="fas fa-user" style="margin-right: 0.2rem;"></i>${task.assignee.split(' ')[0]}</span>
                                </div>
                            </div>
                            <div style="text-align: right; min-width: 100px;">
                                <div style="font-size: 0.75rem; color: ${isOverdue ? '#ef4444' : 'var(--text-secondary)'}; font-weight: ${isOverdue ? '600' : '400'};">
                                    <i class="fas fa-calendar" style="margin-right: 0.2rem;"></i>${dueDateFormatted}
                                </div>
                                <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                    <i class="fas fa-clock" style="margin-right: 0.2rem;"></i>${task.dueTime || 'EOD'}
                                </div>
                                ${task.recurrence !== 'One-time' ? `<div style="font-size: 0.65rem; color: var(--accent-primary); margin-top: 0.25rem;"><i class="fas fa-redo" style="margin-right: 0.2rem;"></i>${task.recurrence}</div>` : ''}
                                ${wasEscalated ? `<div style="font-size: 0.6rem; color: #ef4444; margin-top: 0.25rem; font-style: italic;">was ${task.originalPriority}</div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
            updateTaskStats();
            updateCategoryBadges();
        };
        
        // Update task statistics
        function updateTaskStats() {
            const pending = window.tasksData.filter(t => t.status === 'Pending').length;
            const inProgress = window.tasksData.filter(t => t.status === 'In Progress').length;
            const completed = window.tasksData.filter(t => t.status === 'Completed').length;
            const overdue = window.tasksData.filter(t => t.status === 'Overdue').length;
            
            const pendingEl = document.getElementById('taskStatPending');
            const inProgressEl = document.getElementById('taskStatInProgress');
            const completedEl = document.getElementById('taskStatCompleted');
            const overdueEl = document.getElementById('taskStatOverdue');
            
            if (pendingEl) pendingEl.textContent = pending;
            if (inProgressEl) inProgressEl.textContent = inProgress;
            if (completedEl) completedEl.textContent = completed;
            if (overdueEl) overdueEl.textContent = overdue;
        }
        
        // Update category badges
        function updateCategoryBadges() {
            const categories = ['Clinical', 'Administrative', 'Compliance', 'Equipment', 'Facility'];
            categories.forEach(cat => {
                const count = window.tasksData.filter(t => t.category === cat && t.status !== 'Completed').length;
                const badge = document.getElementById('catBadge' + cat);
                if (badge) badge.textContent = count;
            });
        }
        
        // Render this week's tasks
        function renderThisWeekTasks() {
            const container = document.getElementById('tasksThisWeekList');
            if (!container) return;
            
            const today = new Date();
            const weekEnd = new Date(today);
            weekEnd.setDate(weekEnd.getDate() + 7);
            
            const thisWeekTasks = window.tasksData.filter(task => {
                const dueDate = new Date(task.dueDate);
                return dueDate >= today && dueDate <= weekEnd && task.status !== 'Completed';
            }).slice(0, 5);
            
            if (thisWeekTasks.length === 0) {
                container.innerHTML = '<div style="padding: 0.5rem; font-size: 0.8rem; color: var(--text-secondary); text-align: center;">No tasks due this week</div>';
                return;
            }
            
            let html = '';
            thisWeekTasks.forEach(task => {
                const priorityColor = priorityColors[task.priority];
                html += `
                    <a href="#" class="nav-item" onclick="showTaskDetail('${task.id}'); return false;" style="border-left: 3px solid ${priorityColor};">
                        <i class="fas fa-circle" style="color: ${priorityColor}; font-size: 0.5rem;"></i>
                        <span style="font-size: 0.8rem;">${task.title.substring(0, 20)}${task.title.length > 20 ? '...' : ''}</span>
                    </a>
                `;
            });
            container.innerHTML = html;
        }
        
        // Clear task filters
        window.clearTaskFilters = function() {
            document.getElementById('taskFilterStatus').value = '';
            document.getElementById('taskFilterPriority').value = '';
            document.getElementById('taskFilterCategory').value = '';
            document.getElementById('taskFilterAssignee').value = '';
            // Reset date range to this week
            setTaskDateRange('week');
        };
        
        // Close task calendar when clicking outside
        document.addEventListener('click', function(e) {
            const dropdown = document.getElementById('taskCalendarDropdown');
            const button = document.getElementById('taskCalendarButton');
            
            if (taskCalendarOpen && dropdown && button && 
                !dropdown.contains(e.target) && !button.contains(e.target)) {
                toggleTaskCalendar();
            }
        });
        
        // ==========================================
        // TASK SIDEBAR QUICK CALENDAR
        // ==========================================
        
        let taskSidebarCalendarOpen = false;
        let taskSidebarCalendarDate = new Date();
        
        // Toggle sidebar calendar
        window.toggleTaskSidebarCalendar = function() {
            taskSidebarCalendarOpen = !taskSidebarCalendarOpen;
            const container = document.getElementById('taskSidebarCalendarContainer');
            const chevron = document.getElementById('taskSidebarCalendarChevron');
            
            if (container) {
                container.style.display = taskSidebarCalendarOpen ? 'block' : 'none';
                if (chevron) {
                    chevron.style.transform = taskSidebarCalendarOpen ? 'rotate(180deg)' : 'rotate(0deg)';
                }
                if (taskSidebarCalendarOpen) {
                    renderTaskSidebarCalendar();
                }
            }
        };
        
        // Navigate months
        window.taskSidebarCalendarPrevMonth = function() {
            taskSidebarCalendarDate.setMonth(taskSidebarCalendarDate.getMonth() - 1);
            renderTaskSidebarCalendar();
        };
        
        window.taskSidebarCalendarNextMonth = function() {
            taskSidebarCalendarDate.setMonth(taskSidebarCalendarDate.getMonth() + 1);
            renderTaskSidebarCalendar();
        };
        
        // Render sidebar calendar
        function renderTaskSidebarCalendar() {
            const year = taskSidebarCalendarDate.getFullYear();
            const month = taskSidebarCalendarDate.getMonth();
            
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                              'July', 'August', 'September', 'October', 'November', 'December'];
            
            const monthDisplay = document.getElementById('taskSidebarCalendarMonth');
            if (monthDisplay) {
                monthDisplay.textContent = `${monthNames[month]} ${year}`;
            }
            
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const daysInPrevMonth = new Date(year, month, 0).getDate();
            
            const grid = document.getElementById('taskSidebarCalendarGrid');
            if (!grid) return;
            
            // Clear and rebuild with headers
            grid.innerHTML = '';
            var dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
            dayNames.forEach(function(name) {
                var headerEl = document.createElement('div');
                headerEl.style.cssText = 'font-weight: 600; color: var(--text-secondary); font-size: 0.7rem; padding: 0.2rem; text-align: center;';
                headerEl.textContent = name;
                grid.appendChild(headerEl);
            });
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Count tasks per day for indicators
            const taskCountByDay = {};
            var monthStr = String(month + 1).padStart(2, '0');
            var prefix = year + '-' + monthStr;
            window.tasksData.forEach(function(task) {
                var taskDate = task.dueDate;
                if (taskDate && taskDate.indexOf(prefix) === 0) {
                    var day = parseInt(taskDate.split('-')[2]);
                    taskCountByDay[day] = (taskCountByDay[day] || 0) + 1;
                }
            });
            
            // Previous month days
            for (let i = firstDay - 1; i >= 0; i--) {
                const day = daysInPrevMonth - i;
                const dayEl = document.createElement('div');
                dayEl.style.cssText = 'padding: 0.25rem; color: var(--text-secondary); opacity: 0.4; font-size: 0.75rem; text-align: center;';
                dayEl.textContent = day;
                grid.appendChild(dayEl);
            }
            
            // Current month days
            for (let day = 1; day <= daysInMonth; day++) {
                const dayEl = document.createElement('div');
                const dateObj = new Date(year, month, day);
                dateObj.setHours(0, 0, 0, 0);
                
                const isToday = dateObj.getTime() === today.getTime();
                const isInRange = taskDateRangeStart && taskDateRangeEnd && 
                                  dateObj >= taskDateRangeStart && dateObj <= taskDateRangeEnd;
                const taskCount = taskCountByDay[day] || 0;
                
                dayEl.style.padding = '0.25rem';
                dayEl.style.cursor = 'pointer';
                dayEl.style.borderRadius = '4px';
                dayEl.style.transition = 'all 0.2s';
                dayEl.style.fontSize = '0.75rem';
                dayEl.style.fontWeight = '500';
                dayEl.style.textAlign = 'center';
                dayEl.style.position = 'relative';
                dayEl.style.color = isToday ? 'white' : (isInRange ? 'var(--accent-dark)' : 'var(--text-primary)');
                dayEl.style.background = isToday ? 'var(--accent-primary)' : (isInRange ? 'var(--accent-light)' : 'transparent');
                
                // Show task indicator dot
                dayEl.textContent = day;
                if (taskCount > 0 && !isToday) {
                    var dotSpan = document.createElement('span');
                    dotSpan.style.cssText = 'position: absolute; bottom: 1px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px; border-radius: 50%;';
                    dotSpan.style.background = taskCount > 2 ? '#ef4444' : '#f59e0b';
                    dayEl.appendChild(dotSpan);
                }
                
                (function(d, isTdy, isRng) {
                    dayEl.onmouseover = function() {
                        if (!isTdy) this.style.background = isRng ? 'var(--accent-secondary)' : 'var(--accent-light)';
                        if (!isTdy && isRng) this.style.color = 'white';
                    };
                    dayEl.onmouseout = function() {
                        this.style.background = isTdy ? 'var(--accent-primary)' : (isRng ? 'var(--accent-light)' : 'transparent');
                        if (!isTdy && isRng) this.style.color = 'var(--accent-dark)';
                    };
                    dayEl.onclick = function() {
                        // Select this specific date
                        taskDateRangeMode = 'custom';
                        taskDateRangeStart = new Date(year, month, d);
                        taskDateRangeStart.setHours(0, 0, 0, 0);
                        taskDateRangeEnd = new Date(year, month, d);
                        taskDateRangeEnd.setHours(23, 59, 59, 999);
                        taskCalendarDate = new Date(year, month, d);
                        
                        updateTaskDateDisplay();
                        renderTaskSidebarCalendar();
                        renderTasksList();
                        
                        // Also update the header dropdown calendar if open
                        if (taskCalendarOpen) renderTaskCalendar();
                    };
                })(day, isToday, isInRange);
                
                grid.appendChild(dayEl);
            }
            
            // Next month days
            const totalCells = grid.children.length - 7;
            const remainingCells = Math.ceil(totalCells / 7) * 7 - totalCells + 7;
            for (let day = 1; day <= remainingCells && grid.children.length < 49; day++) {
                const dayEl = document.createElement('div');
                dayEl.style.cssText = 'padding: 0.25rem; color: var(--text-secondary); opacity: 0.4; font-size: 0.75rem; text-align: center;';
                dayEl.textContent = day;
                grid.appendChild(dayEl);
            }
        }
        
        // Filter by category from sidebar
        window.filterTasksByCategory = function(category) {
            document.getElementById('taskFilterCategory').value = category;
            renderTasksList();
        };
        
        // Show task detail modal
        window.showTaskDetail = function(taskId) {
            const task = window.tasksData.find(t => t.id === taskId);
            if (!task) {
                alert('Task not found!');
                return;
            }
            
            const userRole = localStorage.getItem('userRole');
            const isAdmin = userRole === 'admin';
            const canManageTask = canEditTask(task) || isAdmin;
            const priorityColor = priorityColors[task.priority];
            const statusColor = statusColors[task.status];
            const dueDateFormatted = new Date(task.dueDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            const daysOverdue = task.daysOverdue || 0;
            const wasEscalated = task.originalPriority && task.originalPriority !== task.priority;
            
            const modalHtml = `
                <div id="taskDetailModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 1rem; overflow-y: auto;">
                    <div style="background: var(--card-bg); border-radius: 12px; padding: 1.5rem; max-width: 600px; width: 95%; box-shadow: 0 10px 40px rgba(0,0,0,0.3); max-height: 90vh; overflow-y: auto;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
                                    <span style="padding: 0.25rem 0.6rem; background: ${priorityColor}20; color: ${priorityColor}; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">${task.priority}${wasEscalated ? ' ⬆' : ''}</span>
                                    <span style="padding: 0.25rem 0.6rem; background: ${statusColor}20; color: ${statusColor}; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">${task.status}</span>
                                    ${daysOverdue > 0 ? `<span style="padding: 0.25rem 0.6rem; background: #fecaca; color: #b91c1c; border-radius: 4px; font-size: 0.75rem; font-weight: 700;"><i class="fas fa-exclamation-triangle"></i> ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue</span>` : ''}
                                    ${task.complianceFlag ? '<span style="padding: 0.25rem 0.6rem; background: var(--accent-light); color: var(--accent-dark); border-radius: 4px; font-size: 0.75rem; font-weight: 600;"><i class="fas fa-shield-alt"></i> Compliance</span>' : ''}
                                </div>
                                <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0;">${task.title}</h3>
                            </div>
                            <button onclick="document.getElementById('taskDetailModal').remove()" style="background: none; border: none; font-size: 1.5rem; color: var(--text-secondary); cursor: pointer;">&times;</button>
                        </div>
                        
                        ${wasEscalated ? `
                        <div style="padding: 0.75rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin-bottom: 1rem;">
                            <div style="font-size: 0.85rem; color: #b91c1c; font-weight: 600;">
                                <i class="fas fa-arrow-up"></i> Priority Escalated: Originally <strong>${task.originalPriority}</strong> → Now <strong>${task.priority}</strong>
                            </div>
                            <div style="font-size: 0.75rem; color: #dc2626; margin-top: 0.25rem;">
                                This task has been overdue for ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}, causing automatic priority escalation.
                            </div>
                        </div>
                        ` : ''}
                        
                        <div style="padding: 1rem; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 1rem;">
                            <div style="font-size: 0.9rem; color: var(--text-primary); line-height: 1.5;">${task.description}</div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;"><i class="fas fa-user"></i> Assigned To</div>
                                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${task.assignee}</div>
                            </div>
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;"><i class="fas fa-user-friends"></i> Backup</div>
                                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${task.secondaryAssignee || 'None'}</div>
                            </div>
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;"><i class="fas fa-calendar"></i> Due Date</div>
                                <div style="font-weight: 600; color: ${task.status === 'Overdue' ? '#ef4444' : 'var(--text-primary)'}; font-size: 0.9rem;">${dueDateFormatted}</div>
                            </div>
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;"><i class="fas fa-clock"></i> Due Time</div>
                                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${task.dueTime || 'End of Day'}</div>
                            </div>
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;"><i class="fas fa-folder"></i> Category</div>
                                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${task.category}</div>
                            </div>
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;"><i class="fas fa-redo"></i> Recurrence</div>
                                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${task.recurrence}${task.recurrenceDay ? ' - ' + task.recurrenceDay : ''}</div>
                            </div>
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;"><i class="fas fa-user-tie"></i> Manager</div>
                                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${task.manager || 'Not Assigned'}</div>
                            </div>
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;"><i class="fas fa-hourglass-half"></i> Est. Time</div>
                                <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${task.estimatedTime || '?'} mins</div>
                            </div>
                        </div>
                        
                        ${task.linkedContext ? `
                        <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 1rem;">
                            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;"><i class="fas fa-link"></i> Linked Context</div>
                            <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${task.linkedContext.type}: ${task.linkedContext.value}</div>
                        </div>
                        ` : ''}
                        
                        <div style="padding: 0.75rem; background: #dcfce7; border-radius: 6px; margin-bottom: 1rem;">
                            <div style="font-size: 0.75rem; color: #166534; margin-bottom: 0.25rem;"><i class="fas fa-check-circle"></i> Completion Criteria</div>
                            <div style="font-weight: 600; color: #166534; font-size: 0.9rem;">${task.completionCriteria}</div>
                        </div>
                        
                        ${task.status === 'Completed' ? `
                        <div style="padding: 0.75rem; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; margin-bottom: 1rem;">
                            <div style="font-size: 0.85rem; color: #166534;"><i class="fas fa-check-circle"></i> Completed by <strong>${task.completedBy}</strong> on ${new Date(task.completedAt).toLocaleString()}</div>
                            ${task.notes ? `<div style="font-size: 0.8rem; color: #166534; margin-top: 0.5rem;"><i class="fas fa-sticky-note"></i> ${task.notes}</div>` : ''}
                        </div>
                        ` : ''}
                        
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            ${task.status !== 'Completed' ? `
                            <button onclick="markTaskComplete('${task.id}')" style="flex: 1; min-width: 120px; padding: 0.75rem; background: var(--accent-primary); color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                <i class="fas fa-check"></i> Complete
                            </button>
                            <button onclick="updateTaskStatus('${task.id}', 'In Progress')" style="flex: 1; min-width: 120px; padding: 0.75rem; background: var(--accent-secondary); color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                <i class="fas fa-play"></i> In Progress
                            </button>
                            ` : ''}
                            ${canManageTask ? `
                            <button onclick="openEditTaskModal('${task.id}')" style="flex: 1; min-width: 100px; padding: 0.75rem; background: #f59e0b; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button onclick="deleteTask('${task.id}')" style="flex: 1; min-width: 100px; padding: 0.75rem; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
            
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            const modalEl = modalContainer.firstElementChild;
            
            modalEl.addEventListener('click', function(e) {
                if (e.target.id === 'taskDetailModal') {
                    modalEl.remove();
                }
            });
            
            document.body.appendChild(modalEl);
        };
        
        // Mark task as complete
        window.markTaskComplete = function(taskId) {
            const task = window.tasksData.find(t => t.id === taskId);
            if (!task) return;
            
            const notes = prompt('Add completion notes (optional):');
            
            task.status = 'Completed';
            task.completedAt = new Date().toISOString();
            task.completedBy = 'Current User'; // In real app, get from session
            task.notes = notes || '';

            if (typeof updateTaskViaAPI === 'function') {
                const apiId = String(taskId).startsWith('task-') ? String(taskId).replace('task-', '') : taskId;
                updateTaskViaAPI(apiId, {
                    status: 'Completed',
                    completedAt: task.completedAt,
                    completedBy: task.completedBy,
                    notes: task.notes,
                    linkedComplianceStatus: 'completed'
                });
            }

            syncLinkedComplianceOnTaskCompletion(task);
            
            document.getElementById('taskDetailModal')?.remove();
            renderTasksList();
            renderThisWeekTasks();
            alert('✅ Task marked as complete!');
        };
        
        // Update task status
        window.updateTaskStatus = function(taskId, newStatus) {
            const task = window.tasksData.find(t => t.id === taskId);
            if (!task) return;
            
            task.status = newStatus;
            if (typeof updateTaskViaAPI === 'function') {
                const apiId = String(taskId).startsWith('task-') ? String(taskId).replace('task-', '') : taskId;
                const payload = { status: newStatus };
                if (newStatus === 'Completed') {
                    task.completedAt = task.completedAt || new Date().toISOString();
                    payload.completedAt = task.completedAt;
                    payload.linkedComplianceStatus = 'completed';
                    syncLinkedComplianceOnTaskCompletion(task);
                }
                updateTaskViaAPI(apiId, payload);
            }
            document.getElementById('taskDetailModal')?.remove();
            renderTasksList();
            renderThisWeekTasks();
        };
        
        // Delete task
        window.deleteTask = function(taskId) {
            const task = window.tasksData.find(t => t.id === taskId);
            if (!task) return;
            if (!canEditTask(task)) {
                showNotification('Only the task creator can delete this task.', 'warning');
                return;
            }
            
            if (!confirm(`Are you sure you want to delete this task?\n\n"${task.title}"\n\nThis action cannot be undone.`)) return;
            
            const index = window.tasksData.findIndex(t => t.id === taskId);
            if (index > -1) {
                window.tasksData.splice(index, 1);
                document.getElementById('taskDetailModal')?.remove();
                renderTasksList();
                renderThisWeekTasks();
                alert('🗑️ Task deleted successfully!');
            }
        };
        
        // Safe task form opener fallback (do not override earlier canonical implementation)
        if (typeof window.openTaskFormSafeWithId !== 'function') {
            window.openTaskFormSafeWithId = function(taskId, template = null) {
                if (typeof window.openTaskFormModal === 'function') {
                    try {
                        window.openTaskFormModal(taskId, template);
                    } catch (e) {
                        console.error('❌ Error opening task form:', e);
                        if (typeof showNotification === 'function') {
                            showNotification('Error opening task form. Please try again.', 'error');
                        }
                    }
                    return;
                }
                window.__taskFormQueue = window.__taskFormQueue || [];
                window.__taskFormQueue.push({ taskId, template });
                if (typeof attemptFlushTaskFormQueue === 'function') {
                    attemptFlushTaskFormQueue();
                }
            };
        }

        // Open create task modal
        window.openCreateTaskModal = function() {
            console.log('openCreateTaskModal called');
            window.openTaskFormSafeWithId(null, null);
        };
        
        // Open edit task modal
        window.openEditTaskModal = async function(taskId) {
            console.log('openEditTaskModal called for:', taskId);
            if (typeof loadTasksFromAPI === 'function') {
                try {
                    await loadTasksFromAPI();
                } catch (e) {
                    console.warn('Failed to refresh tasks before edit:', e);
                }
            }
            const task = window.tasksData?.find(t => t.id === taskId);
            if (task && !canEditTask(task)) {
                if (typeof showNotification === 'function') {
                    showNotification('Only the task creator can edit this task.', 'warning');
                } else {
                    alert('Only the task creator can edit this task.');
                }
                return;
            }
            document.getElementById('taskDetailModal')?.remove();
            window.openTaskFormSafeWithId(taskId, null);
        };
        
        // Create task from template
        window.createTaskFromTemplate = function(templateId) {
            const template = window.taskTemplates.find(t => t.id === templateId);
            if (!template) {
                alert('Template not found!');
                return;
            }
            
            window.openTaskFormSafeWithId(null, template);
        };
        
        // Render templates in sidebar
        window.renderTemplatesSidebar = function() {
            const container = document.getElementById('templatesSidebarList');
            if (!container) return;
            
            let html = '';
            window.taskTemplates.forEach(template => {
                html += `
                    <a href="#" class="nav-item" onclick="createTaskFromTemplate('${template.id}'); return false;">
                        <i class="fas ${template.icon || 'fa-tasks'}" style="color: ${template.iconColor || '#6b7280'};"></i>
                        <span>${template.title.length > 20 ? template.title.substring(0, 20) + '...' : template.title}</span>
                    </a>
                `;
            });
            container.innerHTML = html;
        };
        
        // Open Manage Templates Modal
        window.openManageTemplatesModal = function() {
            try { ensureUnifiedRightRailExpandedForModal(); } catch (_) {}
            let templatesHtml = '';
            window.taskTemplates.forEach(template => {
                const priorityColor = priorityColors[template.priority] || '#6b7280';
                templatesHtml += `
                    <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 0.5rem;">
                        <div style="width: 36px; height: 36px; background: ${template.iconColor}20; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas ${template.icon || 'fa-tasks'}" style="color: ${template.iconColor || '#6b7280'};"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${template.title}</div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">
                                <span style="color: ${priorityColor};">${template.priority}</span> • ${template.category} • ${template.recurrence}
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button onclick="openEditTemplateModal('${template.id}')" style="background: none; border: none; color: #f59e0b; cursor: pointer; padding: 0.5rem;" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteTemplate('${template.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 0.5rem;" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            
            const modalHtml = `
                <div id="manageTemplatesModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 1rem; overflow-y: auto;">
                    <div style="background: var(--card-bg); border-radius: 12px; padding: 1.5rem; max-width: 550px; width: 95%; box-shadow: 0 10px 40px rgba(0,0,0,0.3); max-height: 90vh; overflow-y: auto;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                                <i class="fas fa-layer-group" style="color: var(--accent-color); margin-right: 0.5rem;"></i>
                                Manage Task Templates
                            </h3>
                            <button onclick="document.getElementById('manageTemplatesModal').remove()" style="background: none; border: none; font-size: 1.5rem; color: var(--text-secondary); cursor: pointer;">&times;</button>
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
                                <i class="fas fa-info-circle"></i> Templates allow you to quickly create common tasks with pre-filled values. Click on a template in the sidebar to create a task from it.
                            </div>
                            
                            <div id="templatesListManage">
                                ${templatesHtml || '<p style="text-align: center; color: var(--text-secondary);">No templates yet. Create your first one!</p>'}
                            </div>
                        </div>
                        
                        <button onclick="document.getElementById('manageTemplatesModal').remove(); openCreateTemplateModal();" style="width: 100%; padding: 0.75rem; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                            <i class="fas fa-plus"></i> Create New Template
                        </button>
                    </div>
                </div>
            `;
            
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            const modalEl = modalContainer.firstElementChild;
            
            modalEl.addEventListener('click', function(e) {
                if (e.target.id === 'manageTemplatesModal') {
                    modalEl.remove();
                }
            });
            
            document.body.appendChild(modalEl);
        };
        
        // Open Create Template Modal
        window.openCreateTemplateModal = function() {
            openTemplateFormModal(null);
        };
        
        // Open Edit Template Modal
        window.openEditTemplateModal = function(templateId) {
            document.getElementById('manageTemplatesModal')?.remove();
            openTemplateFormModal(templateId);
        };
        
        // Delete Template
        window.deleteTemplate = function(templateId) {
            const template = window.taskTemplates.find(t => t.id === templateId);
            if (!template) return;
            
            if (!confirm(`Delete template "${template.title}"?\n\nThis will not affect existing tasks created from this template.`)) return;
            
            const index = window.taskTemplates.findIndex(t => t.id === templateId);
            if (index > -1) {
                window.taskTemplates.splice(index, 1);
                renderTemplatesSidebar();
                // Refresh the manage modal if open
                document.getElementById('manageTemplatesModal')?.remove();
                openManageTemplatesModal();
                alert('🗑️ Template deleted!');
            }
        };
        
        // Template Form Modal (Create/Edit)
        function openTemplateFormModal(templateId) {
            try { ensureUnifiedRightRailExpandedForModal(); } catch (_) {}
            const template = templateId ? window.taskTemplates.find(t => t.id === templateId) : null;
            const isEdit = !!template;
            const data = template || {};
            
            // Build icon selector grid
            let iconGrid = '';
            templateIconOptions.forEach(opt => {
                const isSelected = data.icon === opt.icon;
                iconGrid += `
                    <div class="icon-option" onclick="selectTemplateIcon('${opt.icon}', '${opt.color}')" 
                         data-icon="${opt.icon}" 
                         style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px; cursor: pointer; border: 2px solid ${isSelected ? opt.color : 'transparent'}; background: ${isSelected ? opt.color + '20' : 'var(--bg-secondary)'};">
                        <i class="fas ${opt.icon}" style="color: ${opt.color};"></i>
                    </div>
                `;
            });
            
            const modalHtml = `
                <div id="templateFormModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center; padding: 1rem; overflow-y: auto;">
                    <div style="background: var(--card-bg); border-radius: 12px; padding: 1.5rem; max-width: 600px; width: 95%; box-shadow: 0 10px 40px rgba(0,0,0,0.3); max-height: 90vh; overflow-y: auto;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                                <i class="fas ${isEdit ? 'fa-edit' : 'fa-plus-circle'}" style="color: ${isEdit ? '#f59e0b' : '#10b981'}; margin-right: 0.5rem;"></i>
                                ${isEdit ? 'Edit Template' : 'Create New Template'}
                            </h3>
                            <button onclick="document.getElementById('templateFormModal').remove()" style="background: none; border: none; font-size: 1.5rem; color: var(--text-secondary); cursor: pointer;">&times;</button>
                        </div>
                        
                        <form id="templateForm" style="display: flex; flex-direction: column; gap: 1rem;">
                            <input type="hidden" id="templateFormId" value="${template?.id || ''}">
                            <input type="hidden" id="templateFormIcon" value="${data.icon || 'fa-tasks'}">
                            <input type="hidden" id="templateFormIconColor" value="${data.iconColor || '#6b7280'}">
                            
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Template Name *</label>
                                <input type="text" id="templateFormTitle" value="${data.title || ''}" placeholder="e.g., Weekly Inventory Check" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                            </div>
                            
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Icon</label>
                                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px;">
                                    ${iconGrid}
                                </div>
                            </div>
                            
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Description *</label>
                                <textarea id="templateFormDescription" placeholder="What should be done when this task is assigned..." required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem; min-height: 70px; resize: vertical;">${data.description || ''}</textarea>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Default Priority *</label>
                                    <select id="templateFormPriority" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                        <option value="Low" ${data.priority === 'Low' ? 'selected' : ''}>Low</option>
                                        <option value="Medium" ${data.priority === 'Medium' || !data.priority ? 'selected' : ''}>Medium</option>
                                        <option value="High" ${data.priority === 'High' ? 'selected' : ''}>High</option>
                                        <option value="Critical" ${data.priority === 'Critical' ? 'selected' : ''}>Critical</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Category *</label>
                                    <select id="templateFormCategory" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                        <option value="Clinical" ${data.category === 'Clinical' ? 'selected' : ''}>Clinical</option>
                                        <option value="Administrative" ${data.category === 'Administrative' ? 'selected' : ''}>Administrative</option>
                                        <option value="Compliance" ${data.category === 'Compliance' ? 'selected' : ''}>Compliance</option>
                                        <option value="Equipment" ${data.category === 'Equipment' ? 'selected' : ''}>Equipment</option>
                                        <option value="Marketing" ${data.category === 'Marketing' ? 'selected' : ''}>Marketing</option>
                                        <option value="Facility" ${data.category === 'Facility' ? 'selected' : ''}>Facility</option>
                                        <option value="Business Center" ${data.category === 'Business Center' ? 'selected' : ''}>Business Center</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Recurrence</label>
                                    <select id="templateFormRecurrence" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                        <option value="One-time" ${data.recurrence === 'One-time' || !data.recurrence ? 'selected' : ''}>One-time</option>
                                        <option value="Daily" ${data.recurrence === 'Daily' ? 'selected' : ''}>Daily</option>
                                        <option value="Weekly" ${data.recurrence === 'Weekly' ? 'selected' : ''}>Weekly</option>
                                        <option value="Monthly" ${data.recurrence === 'Monthly' ? 'selected' : ''}>Monthly</option>
                                        <option value="Quarterly" ${data.recurrence === 'Quarterly' ? 'selected' : ''}>Quarterly</option>
                                        <option value="Annually" ${data.recurrence === 'Annually' || data.recurrence === 'Annual' ? 'selected' : ''}>Annually</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Linked Context Type</label>
                                    <select id="templateFormContextType" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                        <option value="">None</option>
                                        <option value="Room" ${data.linkedContext?.type === 'Room' ? 'selected' : ''}>Room</option>
                                        <option value="Equipment" ${data.linkedContext?.type === 'Equipment' ? 'selected' : ''}>Equipment</option>
                                        <option value="Process" ${data.linkedContext?.type === 'Process' ? 'selected' : ''}>Process</option>
                                        <option value="Patient" ${data.linkedContext?.type === 'Patient' ? 'selected' : ''}>Patient</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Default Context Value</label>
                                    <input type="text" id="templateFormContextValue" value="${data.linkedContext?.value || ''}" placeholder="e.g., Operatory 1" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                </div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Completion Criteria *</label>
                                    <input type="text" id="templateFormCriteria" value="${data.completionCriteria || ''}" placeholder="e.g., Photo uploaded, logged in system" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                </div>
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Est. Time (mins)</label>
                                    <input type="number" id="templateFormEstTime" value="${data.estimatedTime || 30}" min="5" step="5" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                </div>
                            </div>
                            
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <input type="checkbox" id="templateFormCompliance" ${data.complianceFlag ? 'checked' : ''}>
                                <label for="templateFormCompliance" style="font-size: 0.85rem; color: var(--text-primary);">
                                    <i class="fas fa-shield-alt" style="color: var(--accent-primary);"></i> This is a compliance/regulatory task
                                </label>
                            </div>
                        </form>
                        
                        <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
                            <button onclick="saveTemplate()" style="flex: 1; padding: 0.75rem; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                <i class="fas fa-save"></i> ${isEdit ? 'Save Changes' : 'Create Template'}
                            </button>
                            <button onclick="document.getElementById('templateFormModal').remove(); openManageTemplatesModal();" style="flex: 1; padding: 0.75rem; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; font-weight: 600; cursor: pointer;">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            const modalEl = modalContainer.firstElementChild;
            
            modalEl.addEventListener('click', function(e) {
                if (e.target.id === 'templateFormModal') {
                    modalEl.remove();
                }
            });
            
            document.body.appendChild(modalEl);
        }
        
        // Select template icon
        window.selectTemplateIcon = function(icon, color) {
            document.getElementById('templateFormIcon').value = icon;
            document.getElementById('templateFormIconColor').value = color;
            
            // Update visual selection
            document.querySelectorAll('#templateFormModal .icon-option').forEach(el => {
                if (el.dataset.icon === icon) {
                    el.style.border = `2px solid ${color}`;
                    el.style.background = color + '20';
                } else {
                    el.style.border = '2px solid transparent';
                    el.style.background = 'var(--bg-secondary)';
                }
            });
        };
        
        // Save template (create or update)
        window.saveTemplate = function() {
            const form = document.getElementById('templateForm');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            
            const templateId = document.getElementById('templateFormId').value;
            const isEdit = !!templateId;
            
            const contextType = document.getElementById('templateFormContextType').value;
            const contextValue = document.getElementById('templateFormContextValue').value;
            
            const templateData = {
                id: templateId || 'template-' + Date.now(),
                title: document.getElementById('templateFormTitle').value,
                description: document.getElementById('templateFormDescription').value,
                priority: document.getElementById('templateFormPriority').value,
                category: document.getElementById('templateFormCategory').value,
                recurrence: document.getElementById('templateFormRecurrence').value,
                linkedContext: contextType ? { type: contextType, value: contextValue } : null,
                completionCriteria: document.getElementById('templateFormCriteria').value,
                complianceFlag: document.getElementById('templateFormCompliance').checked,
                estimatedTime: parseInt(document.getElementById('templateFormEstTime').value) || 30,
                icon: document.getElementById('templateFormIcon').value,
                iconColor: document.getElementById('templateFormIconColor').value
            };
            
            if (isEdit) {
                const index = window.taskTemplates.findIndex(t => t.id === templateId);
                if (index > -1) {
                    window.taskTemplates[index] = templateData;
                }
            } else {
                window.taskTemplates.push(templateData);
            }
            
            document.getElementById('templateFormModal')?.remove();
            renderTemplatesSidebar();
            openManageTemplatesModal();
            alert(`✅ Template ${isEdit ? 'updated' : 'created'} successfully!`);
        };

        // Get equipment categories dynamically from saved equipment
        function getEquipmentCategories() {
            const equipment = loadEquipment ? loadEquipment() : [];
            const categories = {};
            
            // Default categories as fallback
            const defaultCategories = {
                'Sterilization': ['Autoclave #1', 'Autoclave #2', 'Ultrasonic Cleaner'],
                'Imaging': ['X-Ray Unit', 'Panoramic X-Ray', 'Intraoral Camera', 'CBCT Scanner'],
                'Dental Chairs': ['Operatory 1 Chair', 'Operatory 2 Chair', 'Operatory 3 Chair'],
                'Handpieces': ['High-Speed Handpiece', 'Low-Speed Handpiece', 'Electric Handpiece'],
                'Lasers': ['Diode Laser', 'CO2 Laser', 'Soft Tissue Laser'],
                'Lab Equipment': ['Curing Light', 'Amalgamator', 'Model Trimmer'],
                'Computers': ['Front Desk PC', 'Operatory 1 PC', 'Server'],
                'HVAC/Facility': ['HVAC System', 'Compressor', 'Vacuum Pump'],
                'Other': []
            };
            
            // Build categories from saved equipment
            equipment.forEach(item => {
                if (item.isActive !== false) {
                    const cat = item.category || 'Other';
                    if (!categories[cat]) {
                        categories[cat] = [];
                    }
                    if (!categories[cat].includes(item.equipmentName)) {
                        categories[cat].push(item.equipmentName);
                    }
                }
            });
            
            // Merge with defaults for empty categories
            Object.keys(defaultCategories).forEach(cat => {
                if (!categories[cat]) {
                    categories[cat] = defaultCategories[cat];
                }
            });
            
            return categories;
        }
        
        // Equipment categories for linked equipment selection (legacy reference)
        const equipmentCategories = {
            'Sterilization': ['Autoclave #1', 'Autoclave #2', 'Ultrasonic Cleaner', 'Sterilization Pouches', 'Chemical Indicators'],
            'Imaging': ['X-Ray Unit', 'Panoramic X-Ray', 'Intraoral Camera', 'CBCT Scanner', 'Digital Sensors'],
            'Dental Chairs': ['Operatory 1 Chair', 'Operatory 2 Chair', 'Operatory 3 Chair', 'Operatory 4 Chair', 'Hygiene Chair 1', 'Hygiene Chair 2'],
            'Handpieces': ['High-Speed Handpiece', 'Low-Speed Handpiece', 'Electric Handpiece', 'Prophy Handpiece'],
            'Lasers': ['Diode Laser', 'CO2 Laser', 'Soft Tissue Laser'],
            'Lab Equipment': ['Curing Light', 'Amalgamator', 'Model Trimmer', 'Vacuum Former'],
            'Computers': ['Front Desk PC', 'Operatory 1 PC', 'Operatory 2 PC', 'Server', 'Tablet'],
            'HVAC/Facility': ['HVAC System', 'Compressor', 'Vacuum Pump', 'Nitrous System', 'Water Filtration'],
            'Other': ['Waiting Room TV', 'Phone System', 'Security System', 'Fire Extinguisher']
        };

        // Safe users data helper (prevents task form from failing if not defined elsewhere)
        if (typeof window.getUsersDataSafe !== 'function') {
            window.getUsersDataSafe = function() {
                try {
                    if (typeof safeParseLocalStorageJSON === 'function') {
                        return safeParseLocalStorageJSON('usersData', {}, { expect: 'object' });
                    }
                    const raw = localStorage.getItem('usersData');
                    const parsed = raw ? JSON.parse(raw) : {};
                    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
                } catch (e) {
                    console.warn('Failed to load usersData:', e);
                    return {};
                }
            };
        }
        
        // Build private employee checkboxes for task visibility (defined early to be available in modal)
        window.buildPrivateEmployeeCheckboxes = function(selectedEmployees = []) {
            const usersData = getUsersDataSafe();
            const employees = Object.entries(usersData).map(([username, user]) => ({
                id: username,
                name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : username,
                role: user.role || 'User',
                jobTitle: user.jobTitle || ''
            }));
            
            if (employees.length === 0) {
                return '<p style="text-align: center; color: var(--text-secondary); padding: 0.5rem; font-size: 0.85rem;">No employees found</p>';
            }
            
            let html = '';
            employees.forEach(emp => {
                const isChecked = selectedEmployees.includes(emp.id) || selectedEmployees.includes(emp.name);
                html += `
                    <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; cursor: pointer; border-bottom: 1px solid var(--border-color);" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                        <input type="checkbox" name="taskPrivateEmployees" value="${emp.id}" ${isChecked ? 'checked' : ''} style="accent-color: var(--accent-primary);">
                        <span style="font-size: 0.85rem; color: var(--text-primary);">${emp.name}</span>
                        <span style="font-size: 0.75rem; color: var(--text-tertiary); margin-left: auto;">${emp.jobTitle || emp.role}</span>
                    </label>
                `;
            });
            return html;
        };

        // Task form modal (Create/Edit) - Enhanced Version
        window.__realOpenTaskFormModal = function(taskId, template = null) {
            try {
                console.log('✅ Real openTaskFormModal called with taskId:', taskId, 'template:', template);
                
                // Remove any existing modal first to prevent duplicates
                const existingModal = document.getElementById('taskFormModal');
                if (existingModal) {
                    console.log('🗑️ Removing existing task form modal');
                    existingModal.remove();
                }
                
                console.log('🔍 Loading task data for ID:', taskId);
                
                const taskList = Array.isArray(window.tasksData) ? window.tasksData : [];
                const task = taskId ? taskList.find(t => t.id === taskId) : null;
                console.log('Found task:', task);
                const isEdit = !!task;
                if (isEdit && !canEditTask(task)) {
                    if (typeof showNotification === 'function') {
                        showNotification('Only the task creator can edit this task.', 'warning');
                    } else {
                        alert('Only the task creator can edit this task.');
                    }
                    return;
                }
                const data = task || template || {};
                
                // Get dynamic equipment categories
                const dynamicEquipmentCategories = (typeof getEquipmentCategories === 'function') ? getEquipmentCategories() : {};
                
                // Get employees from masterData (guarded)
                const employees = (window.masterData && typeof window.masterData.getProviders === 'function' && typeof window.masterData.getAssistants === 'function')
                    ? [...window.masterData.getProviders(), ...window.masterData.getAssistants()]
                    : [];
                
                // Get vendors from localStorage
                const vendors = (typeof loadVendors === 'function') ? loadVendors() : [];
                
                // Get users from localStorage
                const usersData = getUsersDataSafe();
            const usersList = Object.entries(usersData).map(([username, user]) => ({
                id: username,
                name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : username,
                role: user.role || 'User'
            }));
            
            // Build assignee options with only employees (no vendors)
            let assigneeOptions = '<option value="">Select Assignee (Optional)</option>';
            assigneeOptions += '<optgroup label="👤 Users/Employees">';
            employees.forEach(emp => {
                // Use emp.id as value (e.g., "dr-smith") so it matches resource IDs
                const isSelected = data.assignee === emp.id || data.assignee === emp.title;
                assigneeOptions += `<option value="${emp.id}" ${isSelected ? 'selected' : ''}>${emp.title}</option>`;
            });
            usersList.forEach(user => {
                if (!employees.some(e => e.title === user.name || e.id === user.id)) {
                    const isSelected = data.assignee === user.id || data.assignee === user.name;
                    assigneeOptions += `<option value="${user.id}" ${isSelected ? 'selected' : ''}>${user.name} (${user.role})</option>`;
                }
            });
            assigneeOptions += '</optgroup>';
            
            // Build manager options
            let managerOptions = '<option value="">Select Manager</option>';
            managerOptions += '<optgroup label="👤 Users/Employees">';
            employees.forEach(emp => {
                managerOptions += `<option value="${emp.title}" ${data.manager === emp.title ? 'selected' : ''}>${emp.title}</option>`;
            });
            usersList.forEach(user => {
                if (!employees.some(e => e.title === user.name)) {
                    managerOptions += `<option value="${user.name}" ${data.manager === user.name ? 'selected' : ''}>${user.name} (${user.role})</option>`;
                }
            });
            managerOptions += '</optgroup>';
            managerOptions += '<optgroup label="🏢 Vendors">';
            vendors.forEach(vendor => {
                managerOptions += `<option value="vendor:${vendor.vendorName}" ${data.manager === 'vendor:' + vendor.vendorName ? 'selected' : ''}>${vendor.vendorName} (Vendor)</option>`;
            });
            managerOptions += '</optgroup>';
            
            // Build equipment category options from dynamic categories
            let equipmentCategoryOptions = '<option value="">Select Category</option>';
            Object.keys(dynamicEquipmentCategories).forEach(cat => {
                equipmentCategoryOptions += `<option value="${cat}" ${data.linkedEquipment?.category === cat ? 'selected' : ''}>${cat}</option>`;
            });
            
            // Get existing categories for multi-select
            const categories = ['Clinical', 'Administrative', 'Compliance', 'Equipment', 'Marketing', 'Facility', 'Business Center'];
            const selectedCategories = Array.isArray(data.categories) ? data.categories : (data.category ? [data.category] : []);
            
            // Get rooms dynamically from localStorage
            const rooms = typeof loadRooms === 'function' ? loadRooms() : [];
            let roomOptions = '<option value="">Select Room (Optional)</option>';
            roomOptions += '<option value="Any Room" ' + (data.location === 'Any Room' ? 'selected' : '') + '>Any Room</option>';
            rooms.forEach(room => {
                const roomName = room.name || room.roomName || room;
                roomOptions += `<option value="${roomName}" ${data.location === roomName ? 'selected' : ''}>${roomName}</option>`;
            });
            roomOptions += '<option value="Other">Other (Specify)</option>';
            
            // Check if assignee should be shown (hidden for Floating/Bonus)
            const isFloatingOrBonus = data.taskType === 'Floating' || data.taskType === 'Bonus';
            const assigneeDisplay = isFloatingOrBonus ? 'none' : 'grid';
            
            // Tomorrow's date as default
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const defaultDate = tomorrow.toISOString().split('T')[0];
            const selectedLinkedComplianceId = data.linkedComplianceId || data.complianceId || '';
            const selectedLinkedComplianceTitle = data.linkedComplianceTitle || data.complianceTitle || '';
            
            const modalHtml = `
                <div id="taskFormModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 1rem; overflow-y: auto;">
                    <div style="background: var(--card-bg); border-radius: 12px; padding: 1.5rem; max-width: 750px; width: 95%; box-shadow: 0 10px 40px rgba(0,0,0,0.3); max-height: 90vh; overflow-y: auto;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                                <i class="fas ${isEdit ? 'fa-edit' : 'fa-plus-circle'}" style="color: ${isEdit ? '#f59e0b' : '#10b981'}; margin-right: 0.5rem;"></i>
                                ${isEdit ? 'Edit Task' : 'Create New Task'}
                            </h3>
                            <button onclick="document.getElementById('taskFormModal').remove()" style="background: none; border: none; font-size: 1.5rem; color: var(--text-secondary); cursor: pointer;">&times;</button>
                        </div>
                        
                        <form id="taskForm" style="display: flex; flex-direction: column; gap: 1rem;">
                            <input type="hidden" id="taskFormId" value="${task?.id || ''}">
                            
                            <!-- Required Fields Notice -->
                            <div style="background: #fef3c7; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.75rem; color: #92400e;">
                                <i class="fas fa-exclamation-triangle"></i> Required fields are marked with *
                            </div>
                            
                            <!-- Task Title -->
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Task Title *</label>
                                <input type="text" id="taskFormTitle" value="${data.title || ''}" placeholder="Short, action-oriented title (e.g., Weekly Autoclave Spore Test)" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                            </div>
                            
                            <!-- Task Type & Location -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Task Type *</label>
                                    <select id="taskFormTaskType" onchange="toggleTaskTypeFields()" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                        <option value="Regular" ${data.taskType === 'Regular' || !data.taskType ? 'selected' : ''}>📋 Regular Task</option>
                                        <option value="Floating" ${data.taskType === 'Floating' ? 'selected' : ''}>🎯 Floating Task (Unassigned - Anyone can claim)</option>
                                        <option value="Bonus" ${data.taskType === 'Bonus' ? 'selected' : ''}>⭐ Bonus Task (Unassigned - Paid)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Room/Location</label>
                                    <select id="taskFormLocationSelect" onchange="handleRoomSelection()" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                        ${roomOptions}
                                    </select>
                                    <input type="text" id="taskFormLocation" value="${data.location || ''}" placeholder="Enter custom location..." style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.5rem; display: none;">
                                </div>
                            </div>
                            
                            <!-- Bonus/Paid Task Fields (Hidden by default) -->
                            <div id="taskFormBonusFields" style="display: ${data.taskType === 'Bonus' || data.isPaid ? 'grid' : 'none'}; grid-template-columns: 1fr 1fr; gap: 1rem; background: linear-gradient(135deg, #fef3c7, #fde68a); padding: 1rem; border-radius: 8px; border: 2px solid #f59e0b;">
                                <div style="grid-column: 1 / -1;">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                                        <i class="fas fa-star" style="color: #f59e0b;"></i>
                                        <span style="font-weight: 600; color: #92400e;">Bonus Task Payment</span>
                                    </div>
                                </div>
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: #92400e;">This Task is Paid</label>
                                    <div style="margin-top: 0.25rem;">
                                        <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                            <input type="checkbox" id="taskFormIsPaid" ${data.isPaid ? 'checked' : ''} onchange="togglePayAmountField()">
                                            <span style="font-size: 0.9rem; color: #92400e;">Yes, this task offers bonus pay</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: #92400e;">Pay Amount ($)</label>
                                    <input type="number" id="taskFormPayAmount" value="${data.payAmount || ''}" placeholder="e.g., 25.00" min="0" step="0.01" style="width: 100%; padding: 0.6rem; border: 1px solid #f59e0b; border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem; background: white;">
                                </div>
                            </div>
                            
                            <!-- Time Estimate for Floating/Bonus -->
                            <div id="taskFormTimeEstimateRow" style="display: ${data.taskType === 'Floating' || data.taskType === 'Bonus' ? 'block' : 'none'};">
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Time Estimate</label>
                                <input type="text" id="taskFormTimeEstimate" value="${data.timeEstimate || ''}" placeholder="e.g., 30 mins, 1 hour, 2 hours" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                            </div>
                            
                            <!-- Description -->
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Description *</label>
                                <textarea id="taskFormDescription" placeholder="What exactly needs to be done? Include standards or references if applicable..." required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem; min-height: 80px; resize: vertical;">${data.description || ''}</textarea>
                            </div>
                            
                            <!-- Info Banner for Floating/Bonus Tasks -->
                            <div id="taskFormUnassignedBanner" style="display: ${isFloatingOrBonus ? 'block' : 'none'}; background: linear-gradient(135deg, #dbeafe, #bfdbfe); padding: 1rem; border-radius: 8px; border: 2px solid #3b82f6;">
                                <div style="display: flex; align-items: center; gap: 0.75rem;">
                                    <i class="fas fa-info-circle" style="color: #2563eb; font-size: 1.25rem;"></i>
                                    <div>
                                        <div style="font-weight: 600; color: #1e40af;">Unassigned Task</div>
                                        <div style="font-size: 0.85rem; color: #3b82f6;">This task will be available for any employee to claim. You can assign it later via drag-and-drop in the Task Assignment Board.</div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Primary & Secondary Assignee (hidden for Floating/Bonus) -->
                            <div id="taskFormAssigneeSection" style="display: ${assigneeDisplay}; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Primary Assignee (Optional) <i class="fas fa-search" style="color: var(--text-secondary); font-size: 0.7rem;"></i></label>
                                    <select id="taskFormAssignee" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                        ${assigneeOptions}
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Secondary/Backup Assignee <i class="fas fa-search" style="color: var(--text-secondary); font-size: 0.7rem;"></i></label>
                                    <select id="taskFormSecondary" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                        <option value="">None</option>
                                        ${assigneeOptions.replace('Select Assignee', 'None')}
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Due Date, Time, Priority -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Due Date</label>
                                    <input type="date" id="taskFormDueDate" value="${data.dueDate || ''}" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                </div>
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Due Time</label>
                                    <input type="time" id="taskFormDueTime" value="${data.dueTime || ''}" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                </div>
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Priority * <i class="fas fa-clock" title="Higher priorities auto-escalate" style="color: #f59e0b; font-size: 0.7rem;"></i></label>
                                    <select id="taskFormPriority" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                        <option value="Low" ${data.priority === 'Low' ? 'selected' : ''}>🟢 Low</option>
                                        <option value="Medium" ${data.priority === 'Medium' || !data.priority ? 'selected' : ''}>🟡 Medium</option>
                                        <option value="High" ${data.priority === 'High' ? 'selected' : ''}>🟠 High</option>
                                        <option value="Critical" ${data.priority === 'Critical' ? 'selected' : ''}>🔴 Critical (Auto-Escalate)</option>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Categories (Multi-Select Checkboxes) -->
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.5rem;">Categories * (Select all that apply)</label>
                                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; background: var(--bg-secondary); padding: 0.75rem; border-radius: 6px;">
                                    ${categories.map(cat => `
                                        <label style="display: flex; align-items: center; gap: 0.25rem; padding: 0.4rem 0.75rem; background: var(--card-bg); border-radius: 4px; cursor: pointer; font-size: 0.85rem; border: 1px solid var(--border-color);">
                                            <input type="checkbox" name="taskCategories" value="${cat}" ${selectedCategories.includes(cat) ? 'checked' : ''} style="margin-right: 0.25rem;">
                                            ${cat}
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                            
                            <!-- Recurrence & Status -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Recurrence</label>
                                    <select id="taskFormRecurrence" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                        <option value="One-time" ${data.recurrence === 'One-time' || !data.recurrence ? 'selected' : ''}>One-time</option>
                                        <option value="Daily" ${data.recurrence === 'Daily' ? 'selected' : ''}>Daily</option>
                                        <option value="Weekly" ${data.recurrence === 'Weekly' ? 'selected' : ''}>Weekly</option>
                                        <option value="Monthly" ${data.recurrence === 'Monthly' ? 'selected' : ''}>Monthly</option>
                                        <option value="Quarterly" ${data.recurrence === 'Quarterly' ? 'selected' : ''}>Quarterly</option>
                                        <option value="Annually" ${data.recurrence === 'Annually' || data.recurrence === 'Annual' ? 'selected' : ''}>Annually</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Status</label>
                                    <select id="taskFormStatus" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                        <option value="Pending" ${data.status === 'Pending' || !data.status ? 'selected' : ''}>Pending</option>
                                        <option value="In Progress" ${data.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                        <option value="Completed" ${data.status === 'Completed' ? 'selected' : ''}>Completed</option>
                                        <option value="Overdue" ${data.status === 'Overdue' ? 'selected' : ''}>Overdue</option>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Task Visibility (Public/Private) -->
                            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);">
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.75rem;">
                                    <i class="fas fa-eye" style="color: var(--accent-primary);"></i> Task Visibility
                                    <i class="fas fa-info-circle" style="color: var(--text-tertiary); cursor: help; margin-left: 0.25rem; font-size: 0.75rem;" title="Public tasks are visible to all employees. Private tasks are only visible to selected employees."></i>
                                </label>
                                <div style="display: flex; gap: 1rem; margin-bottom: 0.75rem;">
                                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.5rem 1rem; background: var(--card-bg); border-radius: 6px; border: 2px solid ${!data.visibility || data.visibility === 'public' ? 'var(--accent-primary)' : 'var(--border-color)'};" onclick="toggleTaskVisibility('public')">
                                        <input type="radio" name="taskVisibility" value="public" ${!data.visibility || data.visibility === 'public' ? 'checked' : ''} onchange="toggleTaskVisibility('public')" style="accent-color: var(--accent-primary);">
                                        <i class="fas fa-globe" style="color: #10b981;"></i>
                                        <span style="font-size: 0.9rem;">Public</span>
                                    </label>
                                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.5rem 1rem; background: var(--card-bg); border-radius: 6px; border: 2px solid ${data.visibility === 'private' ? 'var(--accent-primary)' : 'var(--border-color)'};" onclick="toggleTaskVisibility('private')">
                                        <input type="radio" name="taskVisibility" value="private" ${data.visibility === 'private' ? 'checked' : ''} onchange="toggleTaskVisibility('private')" style="accent-color: var(--accent-primary);">
                                        <i class="fas fa-lock" style="color: #f59e0b;"></i>
                                        <span style="font-size: 0.9rem;">Private</span>
                                    </label>
                                </div>
                                <div id="taskPrivateEmployeesContainer" style="display: ${data.visibility === 'private' ? 'block' : 'none'};">
                                    <label style="font-size: 0.8rem; color: var(--text-secondary); display: block; margin-bottom: 0.5rem;">
                                        <i class="fas fa-users"></i> Select employees who can view this task:
                                    </label>
                                    <div id="taskPrivateEmployeesList" style="max-height: 150px; overflow-y: auto; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 6px; padding: 0.5rem;">
                                        ${buildPrivateEmployeeCheckboxes(data.visibleTo || [])}
                                    </div>
                                    <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                                        <button type="button" onclick="selectAllPrivateEmployees()" style="padding: 0.4rem 0.75rem; background: var(--accent-primary); color: white; border: none; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">
                                            <i class="fas fa-check-double"></i> Select All
                                        </button>
                                        <button type="button" onclick="clearAllPrivateEmployees()" style="padding: 0.4rem 0.75rem; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.75rem; cursor: pointer;">
                                            <i class="fas fa-times"></i> Clear All
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Manager & Estimated Time -->
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Task Manager/Overseer <i class="fas fa-search" style="color: var(--text-secondary); font-size: 0.7rem;"></i></label>
                                    <select id="taskFormManager" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                        ${managerOptions}
                                    </select>
                                </div>
                                <div>
                                    <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Est. Time (mins)</label>
                                    <input type="number" id="taskFormEstTime" value="${data.estimatedTime || 30}" min="5" step="5" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                </div>
                            </div>
                            
                            <!-- Linked Equipment (Category > Subcategory) -->
                            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px;">
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.5rem;">
                                    <i class="fas fa-cog" style="color: var(--accent-primary);"></i> Linked Equipment
                                </label>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div>
                                        <label style="font-size: 0.75rem; color: var(--text-secondary);">Equipment Category</label>
                                        <select id="taskFormEquipmentCategory" onchange="updateEquipmentItems()" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                            ${equipmentCategoryOptions}
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size: 0.75rem; color: var(--text-secondary);">Equipment Item</label>
                                        <select id="taskFormEquipmentItem" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                            <option value="">Select Item</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Completion Criteria -->
                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Completion Criteria *</label>
                                <textarea id="taskFormCriteria" placeholder="What counts as 'done'? (e.g., Photo of test + log entry, Checkbox + initials, Logged in system)" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem; min-height: 60px; resize: vertical;">${data.completionCriteria || ''}</textarea>
                            </div>
                            
                            <!-- Training Information -->
                            <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px;">
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: block; margin-bottom: 0.5rem;">
                                    <i class="fas fa-graduation-cap" style="color: #8b5cf6;"></i> Training Instructions
                                </label>
                                <textarea id="taskFormTraining" placeholder="Explain the steps to complete this task, or paste a link to pre-recorded training video/document..." style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; min-height: 60px; resize: vertical;">${data.trainingInstructions || ''}</textarea>
                                <div style="margin-top: 0.5rem;">
                                    <label style="font-size: 0.75rem; color: var(--text-secondary);">Training Link (Optional)</label>
                                    <input type="text" id="taskFormTrainingLink" value="${data.trainingLink || ''}" placeholder="Link or file path to training resource" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.85rem; margin-top: 0.25rem;">
                                </div>
                            </div>
                            
                            <!-- Compliance Flag -->
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <input type="checkbox" id="taskFormCompliance" ${data.complianceFlag ? 'checked' : ''}>
                                <label for="taskFormCompliance" style="font-size: 0.85rem; color: var(--text-primary);">
                                    <i class="fas fa-shield-alt" style="color: var(--accent-primary);"></i> This is a compliance/regulatory task
                                </label>
                            </div>

                            <div>
                                <label style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Linked Compliance (Optional)</label>
                                <select id="taskFormLinkedCompliance" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.9rem; margin-top: 0.25rem;">
                                    <option value="">None</option>
                                    ${selectedLinkedComplianceId ? `<option value="${selectedLinkedComplianceId}" selected>${selectedLinkedComplianceTitle || ('Compliance #' + selectedLinkedComplianceId)}</option>` : ''}
                                </select>
                                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                    Linking a compliance enables one-click open and auto-completion sync when this task is completed.
                                </div>
                            </div>
                        </form>
                        
                        <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
                            <button onclick="saveTask()" style="flex: 1; padding: 0.75rem; background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                                <i class="fas fa-save"></i> ${isEdit ? 'Save Changes' : 'Create Task'}
                            </button>
                            <button onclick="document.getElementById('taskFormModal').remove()" style="flex: 1; padding: 0.75rem; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px; font-weight: 600; cursor: pointer;">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            const modalEl = modalContainer.firstElementChild;
            
            modalEl.addEventListener('click', function(e) {
                if (e.target.id === 'taskFormModal') {
                    modalEl.remove();
                }
            });
            
            document.body.appendChild(modalEl);

            if (typeof populateTaskComplianceOptions === 'function') {
                populateTaskComplianceOptions(selectedLinkedComplianceId);
            }
            
            // Set secondary assignee if editing
            if (task?.secondaryAssignee) {
                document.getElementById('taskFormSecondary').value = task.secondaryAssignee;
            }
            
            // Set equipment if editing
            if (data.linkedEquipment?.category) {
                document.getElementById('taskFormEquipmentCategory').value = data.linkedEquipment.category;
                updateEquipmentItems();
                if (data.linkedEquipment?.item) {
                    setTimeout(() => {
                        document.getElementById('taskFormEquipmentItem').value = data.linkedEquipment.item;
                    }, 100);
                }
            }
            
            // Initialize task type fields visibility
            toggleTaskTypeFields();
            
            // Initialize room selection if editing with existing location
            if (data.location) {
                const roomSelect = document.getElementById('taskFormLocationSelect');
                const customInput = document.getElementById('taskFormLocation');
                if (roomSelect && customInput) {
                    // Check if location matches any room option
                    const options = Array.from(roomSelect.options).map(o => o.value);
                    if (options.includes(data.location)) {
                        roomSelect.value = data.location;
                    } else {
                        roomSelect.value = 'Other';
                        customInput.style.display = 'block';
                        customInput.value = data.location;
                    }
                }
            }
            } catch (e) {
                console.error('❌ Task form failed to open:', e);
                if (typeof showNotification === 'function') {
                    showNotification('Task form failed to open. Check console for details.', 'error');
                }
            }
        }
        // Promote real implementation to the public API and flush any queued opens
        window.openTaskFormModal = window.__realOpenTaskFormModal;
        if (typeof attemptFlushTaskFormQueue === 'function') {
            attemptFlushTaskFormQueue();
        }
        
        // Function is now defined and ready to use
        window.openTaskFormModal.__isStub = false; // Mark as NOT a stub
        console.log('✅ openTaskFormModal defined and ready');
        
        // Flush any queued task form calls
        if (window.__taskFormQueue && window.__taskFormQueue.length > 0) {
            console.log('🔄 Flushing', window.__taskFormQueue.length, 'queued task form calls');
            const queue = window.__taskFormQueue.slice();
            window.__taskFormQueue.length = 0;
            queue.forEach(({ taskId, template }) => {
                setTimeout(() => {
                    try {
                        window.openTaskFormModal(taskId || null, template);
                    } catch (e) {
                        console.error('❌ Error flushing queued task form:', e);
                    }
                }, 0);
            });
        }
        
        // Handle room selection change
        window.handleRoomSelection = function() {
            const roomSelect = document.getElementById('taskFormLocationSelect');
            const customInput = document.getElementById('taskFormLocation');
            if (roomSelect && customInput) {
                if (roomSelect.value === 'Other') {
                    customInput.style.display = 'block';
                    customInput.focus();
                } else {
                    customInput.style.display = 'none';
                    customInput.value = roomSelect.value;
                }
            }
        };
        
        // Toggle Task Type fields (Bonus/Floating) - Also controls assignee visibility
        window.toggleTaskTypeFields = function() {
            const taskType = document.getElementById('taskFormTaskType')?.value;
            const bonusFields = document.getElementById('taskFormBonusFields');
            const timeEstimateRow = document.getElementById('taskFormTimeEstimateRow');
            const assigneeSection = document.getElementById('taskFormAssigneeSection');
            const unassignedBanner = document.getElementById('taskFormUnassignedBanner');
            const assigneeInput = document.getElementById('taskFormAssignee');
            
            const isFloatingOrBonus = (taskType === 'Floating' || taskType === 'Bonus');
            
            // Show/hide assignee section based on task type
            if (assigneeSection) {
                assigneeSection.style.display = isFloatingOrBonus ? 'none' : 'grid';
            }
            
            // Show/hide unassigned info banner
            if (unassignedBanner) {
                unassignedBanner.style.display = isFloatingOrBonus ? 'block' : 'none';
            }
            
            // Remove required attribute for Floating/Bonus tasks; keep optional for regular
            if (assigneeInput && isFloatingOrBonus) {
                assigneeInput.removeAttribute('required');
                assigneeInput.value = ''; // Clear assignee for floating/bonus tasks
            }
            
            if (bonusFields) {
                bonusFields.style.display = (taskType === 'Bonus') ? 'grid' : 'none';
                // Auto-check isPaid for Bonus tasks
                if (taskType === 'Bonus') {
                    document.getElementById('taskFormIsPaid').checked = true;
                }
            }
            
            if (timeEstimateRow) {
                timeEstimateRow.style.display = isFloatingOrBonus ? 'block' : 'none';
            }
        };
        
        // Toggle Pay Amount field
        window.togglePayAmountField = function() {
            const isPaid = document.getElementById('taskFormIsPaid')?.checked;
            const payAmountInput = document.getElementById('taskFormPayAmount');
            if (payAmountInput) {
                payAmountInput.disabled = !isPaid;
                if (!isPaid) payAmountInput.value = '';
            }
        };
        
        // Build private employee checkboxes for task visibility
        window.buildPrivateEmployeeCheckboxes = function(selectedEmployees = []) {
            const usersData = getUsersDataSafe();
            const employees = Object.entries(usersData).map(([username, user]) => ({
                id: username,
                name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : username,
                role: user.role || 'User',
                jobTitle: user.jobTitle || ''
            }));
            
            if (employees.length === 0) {
                return '<p style="text-align: center; color: var(--text-secondary); padding: 0.5rem; font-size: 0.85rem;">No employees found</p>';
            }
            
            let html = '';
            employees.forEach(emp => {
                const isChecked = selectedEmployees.includes(emp.id) || selectedEmployees.includes(emp.name);
                html += `
                    <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; cursor: pointer; border-bottom: 1px solid var(--border-color);" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                        <input type="checkbox" name="taskPrivateEmployees" value="${emp.id}" ${isChecked ? 'checked' : ''} style="accent-color: var(--accent-primary);">
                        <span style="font-size: 0.85rem; color: var(--text-primary);">${emp.name}</span>
                        <span style="font-size: 0.75rem; color: var(--text-tertiary); margin-left: auto;">${emp.jobTitle || emp.role}</span>
                    </label>
                `;
            });
            return html;
        };
        
        // Toggle task visibility (public/private)
        window.toggleTaskVisibility = function(visibility) {
            const privateContainer = document.getElementById('taskPrivateEmployeesContainer');
            const publicRadio = document.querySelector('input[name="taskVisibility"][value="public"]');
            const privateRadio = document.querySelector('input[name="taskVisibility"][value="private"]');
            
            // Update radio button states
            if (visibility === 'public') {
                publicRadio.checked = true;
                privateRadio.checked = false;
            } else {
                publicRadio.checked = false;
                privateRadio.checked = true;
            }
            
            // Update container styles
            const publicLabel = publicRadio.closest('label');
            const privateLabel = privateRadio.closest('label');
            
            if (visibility === 'public') {
                publicLabel.style.borderColor = 'var(--accent-primary)';
                privateLabel.style.borderColor = 'var(--border-color)';
                if (privateContainer) privateContainer.style.display = 'none';
            } else {
                publicLabel.style.borderColor = 'var(--border-color)';
                privateLabel.style.borderColor = 'var(--accent-primary)';
                if (privateContainer) {
                    privateContainer.style.display = 'block';
                    // Refresh employee list
                    const listContainer = document.getElementById('taskPrivateEmployeesList');
                    if (listContainer) {
                        listContainer.innerHTML = buildPrivateEmployeeCheckboxes([]);
                    }
                }
            }
        };
        
        // Select all private employees
        window.selectAllPrivateEmployees = function() {
            const checkboxes = document.querySelectorAll('input[name="taskPrivateEmployees"]');
            checkboxes.forEach(cb => cb.checked = true);
        };
        
        // Clear all private employees
        window.clearAllPrivateEmployees = function() {
            const checkboxes = document.querySelectorAll('input[name="taskPrivateEmployees"]');
            checkboxes.forEach(cb => cb.checked = false);
        };
        
        // Get selected private employees
        window.getSelectedPrivateEmployees = function() {
            const checkboxes = document.querySelectorAll('input[name="taskPrivateEmployees"]:checked');
            return Array.from(checkboxes).map(cb => cb.value);
        };
        
        // Update equipment items based on category selection
        window.updateEquipmentItems = function() {
            const category = document.getElementById('taskFormEquipmentCategory').value;
            const itemSelect = document.getElementById('taskFormEquipmentItem');
            itemSelect.innerHTML = '<option value="">Select Item</option>';
            
            // Get dynamic equipment categories
            const dynamicCategories = (typeof getEquipmentCategories === 'function') ? getEquipmentCategories() : {};
            
            if (category && dynamicCategories[category]) {
                dynamicCategories[category].forEach(item => {
                    itemSelect.innerHTML += `<option value="${item}">${item}</option>`;
                });
            }
        };

        window.populateTaskComplianceOptions = async function(selectedId = null) {
            const select = document.getElementById('taskFormLinkedCompliance');
            if (!select) return;

            const currentValue = selectedId || select.value || '';
            const options = [];

            try {
                if (typeof fetchComplianceApi === 'function' && typeof normalizeComplianceRecord === 'function') {
                    const response = await fetchComplianceApi('compliances');
                    if (response.ok) {
                        const payload = await response.json();
                        (Array.isArray(payload) ? payload : []).forEach((raw) => {
                            const compliance = normalizeComplianceRecord(raw) || raw;
                            const id = Number.parseInt(compliance.id || compliance.Id, 10);
                            if (!Number.isInteger(id) || id <= 0) return;
                            const title = compliance.title || compliance.Title || `Compliance #${id}`;
                            options.push({ id, title });
                        });
                    }
                }
            } catch (error) {
                console.warn('Unable to load compliance options for task form:', error);
            }

            const uniqueMap = new Map();
            options.forEach((item) => {
                if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item.title);
            });

            const currentValueId = Number.parseInt(currentValue, 10);
            if (Number.isInteger(currentValueId) && currentValueId > 0 && !uniqueMap.has(currentValueId)) {
                const currentLabel = select.options[select.selectedIndex]?.text || `Compliance #${currentValue}`;
                uniqueMap.set(currentValueId, currentLabel);
            }

            const sorted = Array.from(uniqueMap.entries())
                .map(([id, title]) => ({ id, title }))
                .sort((a, b) => a.title.localeCompare(b.title));

            select.innerHTML = '<option value="">None</option>' + sorted.map((item) => {
                const selected = String(item.id) === String(currentValue) ? ' selected' : '';
                return `<option value="${item.id}"${selected}>${item.title}</option>`;
            }).join('');
        };
        
        // Save task (create or update) - Enhanced Version
        window.saveTask = async function() {
            const tasksData = ensureTasksDataArray();
            const form = document.getElementById('taskForm');
            
            // Get task type to determine if assignee is required
            const taskType = document.getElementById('taskFormTaskType')?.value || 'Regular';
            const isFloatingOrBonus = (taskType === 'Floating' || taskType === 'Bonus');
            
            // Assignee is optional for regular tasks
            
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            
            // Get selected categories
            const categoryCheckboxes = document.querySelectorAll('input[name="taskCategories"]:checked');
            const selectedCategories = Array.from(categoryCheckboxes).map(cb => cb.value);
            
            if (selectedCategories.length === 0) {
                alert('Please select at least one category.');
                return;
            }
            
            const taskId = document.getElementById('taskFormId').value;
            const isEdit = !!taskId;
            
            // Get linked equipment
            const equipmentCategory = document.getElementById('taskFormEquipmentCategory').value;
            const equipmentItem = document.getElementById('taskFormEquipmentItem').value;
            
            // Get location from dropdown or custom input
            const roomSelect = document.getElementById('taskFormLocationSelect');
            const customLocationInput = document.getElementById('taskFormLocation');
            let location = '';
            if (roomSelect && roomSelect.value === 'Other') {
                location = customLocationInput?.value || '';
            } else if (roomSelect) {
                location = roomSelect.value || '';
            } else {
                location = customLocationInput?.value || '';
            }
            
            const isPaid = document.getElementById('taskFormIsPaid')?.checked || false;
            const payAmount = document.getElementById('taskFormPayAmount')?.value ? parseFloat(document.getElementById('taskFormPayAmount').value) : null;
            const timeEstimate = document.getElementById('taskFormTimeEstimate')?.value || null;
            const linkedComplianceSelect = document.getElementById('taskFormLinkedCompliance');
            const linkedComplianceIdRaw = linkedComplianceSelect?.value || '';
            const linkedComplianceId = linkedComplianceIdRaw ? Number.parseInt(linkedComplianceIdRaw, 10) : null;
            const linkedComplianceTitle = linkedComplianceSelect && linkedComplianceSelect.selectedIndex > 0
                ? (linkedComplianceSelect.options[linkedComplianceSelect.selectedIndex]?.text || null)
                : null;
            
            // Get task visibility
            const visibilityRadio = document.querySelector('input[name="taskVisibility"]:checked');
            const visibility = visibilityRadio ? visibilityRadio.value : 'public';
            const visibleTo = visibility === 'private' ? getSelectedPrivateEmployees() : [];
            
            // Get assignee (empty for Floating/Bonus tasks)
            const assigneeValue = isFloatingOrBonus ? '' : (document.getElementById('taskFormAssignee')?.value || '');
            const secondaryAssigneeValue = isFloatingOrBonus ? '' : (document.getElementById('taskFormSecondary')?.value || null);
            
            const dueDateValue = document.getElementById('taskFormDueDate').value || null;
            const dueTimeValue = document.getElementById('taskFormDueTime')?.value || null;

            if (assigneeValue && dueDateValue && isApprovedTimeOffForResourceDate(assigneeValue, dueDateValue)) {
                notifyTaskBlockedByTimeOff(assigneeValue, dueDateValue);
                return;
            }

            const taskData = {
                id: taskId || 'task-' + Date.now(),
                title: document.getElementById('taskFormTitle').value,
                description: document.getElementById('taskFormDescription').value,
                assignee: assigneeValue,
                secondaryAssignee: secondaryAssigneeValue,
                dueDate: dueDateValue,
                dueTime: dueDateValue ? dueTimeValue : null,
                priority: document.getElementById('taskFormPriority').value,
                categories: selectedCategories,
                category: selectedCategories[0], // Keep primary category for backward compatibility
                recurrence: document.getElementById('taskFormRecurrence').value,
                status: document.getElementById('taskFormStatus').value,
                manager: document.getElementById('taskFormManager').value || null,
                estimatedTime: parseInt(document.getElementById('taskFormEstTime').value) || 30,
                linkedEquipment: equipmentCategory ? { category: equipmentCategory, item: equipmentItem } : null,
                completionCriteria: document.getElementById('taskFormCriteria').value,
                trainingInstructions: document.getElementById('taskFormTraining').value || null,
                trainingLink: document.getElementById('taskFormTrainingLink').value || null,
                complianceFlag: document.getElementById('taskFormCompliance').checked || !!linkedComplianceId,
                linkedComplianceId: Number.isInteger(linkedComplianceId) && linkedComplianceId > 0 ? linkedComplianceId : null,
                linkedComplianceTitle: Number.isInteger(linkedComplianceId) && linkedComplianceId > 0 ? linkedComplianceTitle : null,
                linkedComplianceStatus: Number.isInteger(linkedComplianceId) && linkedComplianceId > 0 ? 'pending' : null,
                // New task type fields
                taskType: taskType,
                location: location,
                isPaid: isPaid,
                payAmount: payAmount,
                timeEstimate: timeEstimate,
                claimedBy: null,
                claimedAt: null,
                // Task visibility
                visibility: visibility,
                visibleTo: visibleTo,
                // Timestamps
                createdAt: new Date().toISOString(),
                createdBy: getCurrentUserKeys()[0] || 'Unknown',
                completedAt: null,
                completedBy: null,
                completedTime: null,
                notes: ''
            };
            
            if (isEdit) {
                const index = tasksData.findIndex(t => t.id === taskId);
                if (index > -1) {
                    // Preserve some fields
                    taskData.createdAt = tasksData[index].createdAt;
                    taskData.createdBy = tasksData[index].createdBy;
                    taskData.completedAt = tasksData[index].completedAt;
                    taskData.completedBy = tasksData[index].completedBy;
                    taskData.completedTime = tasksData[index].completedTime;
                    taskData.notes = tasksData[index].notes;
                    taskData.claimedBy = tasksData[index].claimedBy;
                    taskData.claimedAt = tasksData[index].claimedAt;
                    tasksData[index] = taskData;
                    console.log('📋 Updated task data:', taskData);
                    // Update in database
                    if (typeof updateTaskViaAPI === 'function') {
                        updateTaskViaAPI(taskId.replace('task-', ''), {
                            title: taskData.title,
                            description: taskData.description,
                            dueDate: taskData.dueDate || null,
                            dueTime: taskData.dueTime || null,
                            priority: taskData.priority,
                            status: taskData.status,
                            category: taskData.category,
                            taskType: taskData.taskType,
                            location: taskData.location,
                            isPaid: taskData.isPaid,
                            payAmount: taskData.payAmount,
                            timeEstimate: taskData.timeEstimate,
                            assignee: taskData.assignee,
                            complianceFlag: taskData.complianceFlag,
                            linkedComplianceId: taskData.linkedComplianceId,
                            linkedComplianceTitle: taskData.linkedComplianceTitle,
                            linkedComplianceStatus: taskData.linkedComplianceStatus
                        });
                    }
                }
            } else {
                tasksData.push(taskData);
                console.log('📋 New task data:', taskData);
                recordTaskCreator(taskData.id, taskData.createdBy);
                // Save to database
                if (typeof saveTaskToAPI === 'function') {
                    saveTaskToAPI({
                        title: taskData.title,
                        description: taskData.description,
                        dueDate: taskData.dueDate || null,
                        dueTime: taskData.dueTime || null,
                        priority: taskData.priority,
                        status: taskData.status,
                        category: taskData.category,
                        taskType: taskData.taskType,
                        location: taskData.location,
                        isPaid: taskData.isPaid,
                        payAmount: taskData.payAmount,
                        timeEstimate: taskData.timeEstimate,
                        assignee: taskData.assignee,
                        complianceFlag: taskData.complianceFlag,
                        linkedComplianceId: taskData.linkedComplianceId,
                        linkedComplianceTitle: taskData.linkedComplianceTitle,
                        linkedComplianceStatus: taskData.linkedComplianceStatus,
                        createdBy: taskData.createdBy
                    });
                }
            }
            
            // Close modal and reload from API
            document.getElementById('taskFormModal')?.remove();
            
            // Reload tasks from API to get fresh data
            if (typeof loadTasksFromAPI === 'function') {
                await loadTasksFromAPI();
            } else {
                // Fallback: refresh local display
                renderTasksList();
                renderThisWeekTasks();
                
                if (typeof convertTasksToEvents === 'function') {
                    convertTasksToEvents();
                    if (window.calendar) {
                        window.calendar.refetchEvents();
                    }
                }
            }

            // Also trigger a view mode refresh to force complete re-render
            if (typeof switchViewMode === 'function' && typeof currentViewMode !== 'undefined') {
                console.log('🔄 Refreshing view mode:', currentViewMode);
                switchViewMode(currentViewMode);
            }
            
            // Update Task Hub badges
            if (typeof updateTaskHubBadges === 'function') {
                updateTaskHubBadges();
            }

            // Update manage-tasks view if currently active
            if (getActiveViewId() === 'view-manage-tasks') {
                updateTaskManagementStats();
                filterTaskManagementList();
            }

            renderUnassignedTasksSidebar();
            
            alert(`✅ Task ${isEdit ? 'updated' : 'created'} successfully!`);
        };
        
        // Initialize tasks when switching to tasks view
        function setupTaskViewInitialization() {
            window.__onSwitchContentViewHooks = window.__onSwitchContentViewHooks || [];
            const exists = window.__onSwitchContentViewHooks.some(h => h && h.__hookName === 'initTasksViewHook');
            if (exists) return;

            const hook = function(viewName) {
                if (viewName === 'tasks') {
                    setTimeout(initTasksView, 100);
                }
            };
            hook.__hookName = 'initTasksViewHook';
            window.__onSwitchContentViewHooks.push(hook);
        }
        setupTaskViewInitialization();

        // Show working hours detail from schedule list (legacy - keeping for compatibility)
        function showWorkingHoursDetail(employeeName, role, startTime, endTime, clinic, room, assistant) {
            const assistantInfo = assistant ? `
                <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px; margin-top: 0.5rem;">
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">👥 Assistant:</div>
                    <div style="font-weight: 600; color: var(--text-primary);">${assistant}</div>
                </div>
            ` : `
                <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px; margin-top: 0.5rem;">
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">No Assistant Assigned</div>
                </div>
            `;
            
            const modalHtml = `
                <div id="shiftDetailsModal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
                    <div style="background: var(--card-bg); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1.5rem;">
                            <div>
                                <h3 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 0;">
                                    <i class="fas fa-clock" style="color: #10b981; margin-right: 0.5rem;"></i>
                                    Working Hours Shift
                                </h3>
                                <p style="color: var(--text-secondary); margin: 0.5rem 0 0 0; font-size: 0.9rem;">${new Date().toISOString().split('T')[0]}</p>
                            </div>
                            <button onclick="document.getElementById('shiftDetailsModal').remove()" style="background: none; border: none; font-size: 1.5rem; color: var(--text-secondary); cursor: pointer; padding: 0; width: 32px; height: 32px;">&times;</button>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <div style="padding: 1rem; background: var(--accent-light); border-radius: 8px; border-left: 4px solid var(--accent-primary);">
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.5rem;">👤 Employee</div>
                                <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">${employeeName}</div>
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">${role}</div>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">⏰ Start Time</div>
                                    <div style="font-weight: 600; color: var(--text-primary);">${startTime}</div>
                                </div>
                                <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">⏰ End Time</div>
                                    <div style="font-weight: 600; color: var(--text-primary);">${endTime}</div>
                                </div>
                            </div>
                            
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">🏥 Clinic</div>
                                <div style="font-weight: 600; color: var(--text-primary);">${clinic}</div>
                            </div>
                            
                            <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">🚪 Room</div>
                                <div style="font-weight: 600; color: var(--text-primary);">${room}</div>
                            </div>
                            
                            ${assistantInfo}
                        </div>
                        
                        <button onclick="document.getElementById('shiftDetailsModal').remove()" style="margin-top: 1.5rem; width: 100%; padding: 0.75rem; background: var(--accent-primary); color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
                            Close
                        </button>
                    </div>
                </div>
            `;
            
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            const modalEl = modalContainer.firstElementChild;
            
            // Close on background click
            modalEl.addEventListener('click', function(e) {
                if (e.target.id === 'shiftDetailsModal') {
                    modalEl.remove();
                }
            });
            
            document.body.appendChild(modalEl);
        }

        // ========== PDF EXPORT FUNCTIONS ==========
        function exportWorkingHoursToPDF() {
            if (whCurrentView === 'month') {
                exportMonthViewToPDF();
            } else if (whCurrentView === 'week') {
                exportWeekViewToPDF();
            } else {
                exportDayViewToPDF();
            }
        }

        function exportMonthViewToPDF() {
            const filename = `ReformDental_Schedule_${whCurrentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).replace(' ', '_')}.pdf`;
            
            const opt = {
                margin: [8, 8, 12, 8],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, allowTaint: true, logging: false },
                jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4', compress: true }
            };

            const exportContent = document.createElement('div');
            exportContent.style.padding = '0';
            exportContent.style.fontFamily = 'Arial, sans-serif';
            exportContent.style.backgroundColor = '#ffffff';
            exportContent.style.width = '100%';
            
            // Header
            const header = document.createElement('div');
            header.style.marginBottom = '8px';
            header.style.borderBottom = '3px solid #10b981';
            header.style.paddingBottom = '6px';
            header.style.pageBreakAfter = 'avoid';
            header.innerHTML = `
                <h1 style="margin: 0 0 2px 0; color: #10b981; font-size: 18px; font-weight: bold;">ReformDental - Monthly Schedule</h1>
                <p style="margin: 2px 0; color: #555; font-size: 10px;">
                    <strong>${whCurrentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong> | Generated: ${new Date().toLocaleDateString('en-US')}
                </p>
            `;
            exportContent.appendChild(header);

            // Create simple list-based month view
            const year = whCurrentDate.getFullYear();
            const month = whCurrentDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const filteredStaff = getFilteredStaffDatabase();

            const daysContainer = document.createElement('div');
            daysContainer.style.width = '100%';
            daysContainer.style.display = 'grid';
            daysContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
            daysContainer.style.gap = '6px';

            for (let day = 1; day <= daysInMonth; day++) {
                const cellDate = new Date(year, month, day);
                const dayName = cellDate.toLocaleDateString('en-US', { weekday: 'short' });
                
                const dayBox = document.createElement('div');
                dayBox.style.marginBottom = '0';
                dayBox.style.pageBreakInside = 'avoid';
                dayBox.style.backgroundColor = '#f9f9f9';
                dayBox.style.border = '1px solid #ddd';
                dayBox.style.borderRadius = '3px';
                dayBox.style.padding = '6px';

                const dayHeader = document.createElement('div');
                dayHeader.style.backgroundColor = '#10b981';
                dayHeader.style.color = 'white';
                dayHeader.style.padding = '4px 6px';
                dayHeader.style.fontWeight = 'bold';
                dayHeader.style.fontSize = '11px';
                dayHeader.style.marginBottom = '4px';
                dayHeader.style.borderRadius = '2px';
                dayHeader.innerHTML = `${dayName} ${day}`;
                dayBox.appendChild(dayHeader);

                const shiftsContainer = document.createElement('div');
                shiftsContainer.style.fontSize = '9px';

                let hasContent = false;
                filteredStaff.forEach(staff => {
                    const shift = whGenerateShifts(staff.id, cellDate);
                    if (shift.type !== 'off' && isDateInFilterRange(cellDate)) {
                        hasContent = true;
                        const shiftBox = document.createElement('div');
                        shiftBox.style.marginBottom = '2px';
                        shiftBox.style.padding = '3px 4px';
                        shiftBox.style.backgroundColor = getShiftColor(shift.type);
                        shiftBox.style.color = 'white';
                        shiftBox.style.borderRadius = '2px';
                        shiftBox.style.lineHeight = '1.2';
                        shiftBox.style.fontSize = '8px';
                        
                        const icon = staff.type === 'provider' ? '👨‍⚕️' : '👤';
                        shiftBox.innerHTML = `<strong>${icon} ${staff.name}</strong> ${getShiftLabel(shift.type)}`;
                        shiftsContainer.appendChild(shiftBox);
                    }
                });

                if (!hasContent) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.style.color = '#999';
                    emptyDiv.style.fontSize = '10px';
                    emptyDiv.style.fontStyle = 'italic';
                    emptyDiv.style.padding = '4px';
                    emptyDiv.textContent = '(No schedule)';
                    shiftsContainer.appendChild(emptyDiv);
                }

                dayBox.appendChild(shiftsContainer);
                daysContainer.appendChild(dayBox);
            }

            exportContent.appendChild(daysContainer);

            // Add legend at end
            const legend = document.createElement('div');
            legend.style.marginTop = '12px';
            legend.style.borderTop = '2px solid #ddd';
            legend.style.paddingTop = '10px';
            legend.style.fontSize = '10px';
            legend.innerHTML = `
                <strong>Legend:</strong> 
                <span style="display: inline-block; margin-left: 10px;"><span style="display: inline-block; width: 10px; height: 10px; background: #10b981; margin-right: 4px;"></span>Morning (8 AM-4 PM)</span>
                <span style="display: inline-block; margin-left: 10px;"><span style="display: inline-block; width: 10px; height: 10px; background: #3b82f6; margin-right: 4px;"></span>Evening (4-10 PM)</span>
                <span style="display: inline-block; margin-left: 10px;"><span style="display: inline-block; width: 10px; height: 10px; background: #8b5cf6; margin-right: 4px;"></span>Night (10 PM-6 AM)</span>
            `;
            exportContent.appendChild(legend);

            html2pdf().set(opt).from(exportContent).save();
        }

        function exportWeekViewToPDF() {
            const weekStart = new Date(whCurrentDate);
            weekStart.setDate(whCurrentDate.getDate() - whCurrentDate.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            const filename = `ReformDental_Weekly_Schedule_${weekStart.toLocaleDateString('en-US').replace(/\//g, '-')}.pdf`;
            
            const opt = {
                margin: [8, 8, 12, 8],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, allowTaint: true, logging: false },
                jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4', compress: true }
            };

            const exportContent = document.createElement('div');
            exportContent.style.padding = '0';
            exportContent.style.fontFamily = 'Arial, sans-serif';
            exportContent.style.backgroundColor = '#ffffff';
            exportContent.style.width = '100%';
            
            // Header
            const header = document.createElement('div');
            header.style.marginBottom = '8px';
            header.style.borderBottom = '3px solid #3b82f6';
            header.style.paddingBottom = '6px';
            header.style.pageBreakAfter = 'avoid';
            header.innerHTML = `
                <h1 style="margin: 0 0 2px 0; color: #3b82f6; font-size: 18px; font-weight: bold;">ReformDental - Weekly Schedule</h1>
                <p style="margin: 2px 0; color: #555; font-size: 10px;">
                    <strong>${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong> | Generated: ${new Date().toLocaleDateString('en-US')}
                </p>
            `;
            exportContent.appendChild(header);

            // Create week layout
            const filteredStaff = getFilteredStaffDatabase();
            
            for (let day = 0; day < 7; day++) {
                const date = new Date(weekStart);
                date.setDate(weekStart.getDate() + day);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
                const dayNum = date.getDate();

                const dayBox = document.createElement('div');
                dayBox.style.marginBottom = '8px';
                dayBox.style.pageBreakInside = 'avoid';
                dayBox.style.backgroundColor = '#f9f9f9';
                dayBox.style.border = '2px solid #3b82f6';
                dayBox.style.borderRadius = '3px';
                dayBox.style.padding = '8px';

                const dayHeader = document.createElement('div');
                dayHeader.style.backgroundColor = '#3b82f6';
                dayHeader.style.color = 'white';
                dayHeader.style.padding = '6px';
                dayHeader.style.fontWeight = 'bold';
                dayHeader.style.fontSize = '11px';
                dayHeader.style.marginBottom = '6px';
                dayHeader.style.borderRadius = '2px';
                dayHeader.innerHTML = `${dayName} - ${dayNum}`;
                dayBox.appendChild(dayHeader);

                const staffContainer = document.createElement('div');
                staffContainer.style.fontSize = '8px';

                let dayHasContent = false;

                filteredStaff.forEach(staff => {
                    if (staff.type === 'provider') {
                        staff.clinics.forEach(clinicId => {
                            const assignments = providerAssignments[clinicId] || [];
                            const providerAssigns = assignments.filter(a => a.providerId === staff.id);
                            
                            providerAssigns.forEach(assign => {
                                dayHasContent = true;
                                const staffCard = document.createElement('div');
                                staffCard.style.marginBottom = '4px';
                                staffCard.style.padding = '4px';
                                staffCard.style.backgroundColor = '#dbeafe';
                                staffCard.style.border = '1px solid #3b82f6';
                                staffCard.style.borderRadius = '2px';
                                staffCard.style.lineHeight = '1.2';
                                staffCard.innerHTML = `
                                    <strong style="color: #1e40af; font-size: 9px;">👨‍⚕️ ${staff.name}</strong><br>
                                    <small style="font-size: 8px;">Clinic: ${clinicDetails[clinicId].name}</small><br>
                                    <small style="font-size: 8px;">Room: ${assign.room} | Asst: ${assign.assistantName || '-'}</small><br>
                                    <small style="font-size: 8px; font-weight: bold; color: #1e40af;">⏰ ${assign.shift}</small>
                                `;
                                staffContainer.appendChild(staffCard);
                            });
                        });
                    } else if (staff.type === 'assistant') {
                        staff.clinics.forEach(clinicId => {
                            const assignments = providerAssignments[clinicId] || [];
                            const assistantAssigns = assignments.filter(a => a.assistantId === staff.id);
                            
                            assistantAssigns.forEach(assign => {
                                dayHasContent = true;
                                const staffCard = document.createElement('div');
                                staffCard.style.marginBottom = '4px';
                                staffCard.style.padding = '4px';
                                staffCard.style.backgroundColor = '#fef3c7';
                                staffCard.style.border = '1px solid #f59e0b';
                                staffCard.style.borderRadius = '2px';
                                staffCard.style.lineHeight = '1.2';
                                staffCard.innerHTML = `
                                    <strong style="color: #92400e; font-size: 9px;">👤 ${staff.name}</strong><br>
                                    <small style="font-size: 8px;">Provider: ${assign.providerName}</small><br>
                                    <small style="font-size: 8px;">Room: ${assign.room}</small><br>
                                    <small style="font-size: 8px; font-weight: bold; color: #92400e;">⏰ ${assign.shift}</small>
                                `;
                                staffContainer.appendChild(staffCard);
                            });
                        });
                    }
                });

                if (!dayHasContent) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.style.color = '#999';
                    emptyDiv.style.fontSize = '9px';
                    emptyDiv.style.fontStyle = 'italic';
                    emptyDiv.style.padding = '4px';
                    emptyDiv.textContent = 'No schedule for this day';
                    staffContainer.appendChild(emptyDiv);
                }

                dayBox.appendChild(staffContainer);
                exportContent.appendChild(dayBox);
            }

            html2pdf().set(opt).from(exportContent).save();
        }

        function getShiftColor(type) {
            const colors = {
                'morning': '#10b981',
                'afternoon': '#3b82f6',
                'evening': '#8b5cf6',
                'night': '#6366f1'
            };
            return colors[type] || '#999';
        }

        function getShiftLabel(type) {
            const labels = {
                'morning': '(8 AM - 4 PM)',
                'afternoon': '(4 PM - 10 PM)',
                'evening': '(4 PM - 10 PM)',
                'night': '(10 PM - 6 AM)'
            };
            return labels[type] || '';
        }

        function exportDayViewToPDF() {
            const filename = `ReformDental_Daily_Schedule_${whCurrentDate.toLocaleDateString('en-US').replace(/\//g, '-')}.pdf`;
            
            const opt = {
                margin: [10, 10, 15, 10],
                filename: filename,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, allowTaint: true, logging: false },
                jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4', compress: true }
            };

            const exportContent = document.createElement('div');
            exportContent.style.padding = '0';
            exportContent.style.fontFamily = 'Arial, sans-serif';
            exportContent.style.backgroundColor = '#fff';
            
            const header = document.createElement('div');
            header.style.marginBottom = '15px';
            header.style.background = 'linear-gradient(135deg, #10b981, #6ee7b7)';
            header.style.color = 'white';
            header.style.padding = '15px';
            header.style.borderRadius = '6px';
            header.style.textAlign = 'center';
            header.style.pageBreakAfter = 'avoid';
            header.innerHTML = `
                <h1 style="margin: 0 0 5px 0; font-size: 22px; font-weight: bold;">${whCurrentDate.toLocaleDateString('en-US', { weekday: 'long' })}</h1>
                <p style="margin: 0; font-size: 14px;">${whCurrentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                <p style="margin: 5px 0 0 0; font-size: 10px;">Generated: ${new Date().toLocaleDateString('en-US')}</p>
            `;
            exportContent.appendChild(header);

            const filteredStaff = getFilteredStaffDatabase();
            const contentDiv = document.createElement('div');

            let hasContent = false;

            filteredStaff.forEach(staff => {
                const shift = whGenerateShifts(staff.id, whCurrentDate);
                
                if (staff.type === 'provider') {
                    staff.clinics.forEach(clinicId => {
                        const assignments = providerAssignments[clinicId] || [];
                        const providerAssigns = assignments.filter(a => a.providerId === staff.id);
                        
                        providerAssigns.forEach(assign => {
                            hasContent = true;
                            const card = document.createElement('div');
                            card.style.marginBottom = '12px';
                            card.style.padding = '12px';
                            card.style.backgroundColor = '#dbeafe';
                            card.style.border = '2px solid #3b82f6';
                            card.style.borderRadius = '5px';
                            card.style.pageBreakInside = 'avoid';
                            card.innerHTML = `
                                <h3 style="margin: 0 0 8px 0; color: #1e40af; font-size: 13px;">👨‍⚕️ ${staff.name}</h3>
                                <div style="backgroundColor: white; padding: 8px; border-radius: 3px; font-size: 11px; line-height: 1.5;">
                                    <p style="margin: 3px 0;"><strong>Clinic:</strong> ${clinicDetails[clinicId].name}</p>
                                    <p style="margin: 3px 0;"><strong>Room:</strong> ${assign.room}</p>
                                    <p style="margin: 3px 0;"><strong>Assistant:</strong> ${assign.assistantName || 'No Assistant'}</p>
                                    <p style="margin: 3px 0;"><strong>Shift:</strong> ${assign.shift}</p>
                                </div>
                            `;
                            contentDiv.appendChild(card);
                        });
                    });
                } else if (staff.type === 'assistant') {
                    staff.clinics.forEach(clinicId => {
                        const assignments = providerAssignments[clinicId] || [];
                        const assistantAssigns = assignments.filter(a => a.assistantId === staff.id);
                        
                        assistantAssigns.forEach(assign => {
                            hasContent = true;
                            const card = document.createElement('div');
                            card.style.marginBottom = '12px';
                            card.style.padding = '12px';
                            card.style.backgroundColor = '#fef3c7';
                            card.style.border = '2px solid #f59e0b';
                            card.style.borderRadius = '5px';
                            card.style.pageBreakInside = 'avoid';
                            card.innerHTML = `
                                <h3 style="margin: 0 0 8px 0; color: #92400e; font-size: 13px;">👤 ${staff.name}</h3>
                                <div style="backgroundColor: white; padding: 8px; border-radius: 3px; font-size: 11px; line-height: 1.5;">
                                    <p style="margin: 3px 0;"><strong>Clinic:</strong> ${clinicDetails[clinicId].name}</p>
                                    <p style="margin: 3px 0;"><strong>Provider:</strong> ${assign.providerName}</p>
                                    <p style="margin: 3px 0;"><strong>Room:</strong> ${assign.room}</p>
                                    <p style="margin: 3px 0;"><strong>Shift:</strong> ${assign.shift}</p>
                                </div>
                            `;
                            contentDiv.appendChild(card);
                        });
                    });
                } else {
                    if (shift.type !== 'off') {
                        hasContent = true;
                        const card = document.createElement('div');
                        card.style.marginBottom = '12px';
                        card.style.padding = '12px';
                        card.style.backgroundColor = '#f3f4f6';
                        card.style.border = '2px solid #6b7280';
                        card.style.borderRadius = '5px';
                        card.style.pageBreakInside = 'avoid';
                        card.innerHTML = `
                            <h3 style="margin: 0 0 8px 0; color: #4b5563; font-size: 13px;">${staff.name}</h3>
                            <div style="backgroundColor: white; padding: 8px; border-radius: 3px; font-size: 11px; line-height: 1.5;">
                                <p style="margin: 3px 0;"><strong>Clinic:</strong> ${clinicDetails[staff.clinics[0]].name}</p>
                                <p style="margin: 3px 0;"><strong>Role:</strong> Clinic Staff</p>
                                <p style="margin: 3px 0;"><strong>Shift:</strong> ${convertTo12Hour(shift.startTime)} - ${convertTo12Hour(shift.endTime)}</p>
                            </div>
                        `;
                        contentDiv.appendChild(card);
                    }
                }
            });

            if (!hasContent) {
                const emptyDiv = document.createElement('div');
                emptyDiv.style.padding = '20px';
                emptyDiv.style.textAlign = 'center';
                emptyDiv.style.color = '#999';
                emptyDiv.style.fontSize = '14px';
                emptyDiv.textContent = 'No schedule for this day';
                contentDiv.appendChild(emptyDiv);
            }

            exportContent.appendChild(contentDiv);
            html2pdf().set(opt).from(exportContent).save();
        }

        function switchWorkingHoursView(view) {
            whCurrentView = view;
            document.querySelectorAll('.view-toggle-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector(`[data-view="${view}"]`).classList.add('active');
            
            document.getElementById('whMonthView').classList.toggle('hidden', view !== 'month');
            document.getElementById('whWeekView').classList.toggle('hidden', view !== 'week');
            document.getElementById('whDayView').classList.toggle('hidden', view !== 'day');
            
            whRenderCalendar();
        }

        function workingHoursPrevious() {
            if (whCurrentView === 'month') whCurrentDate.setMonth(whCurrentDate.getMonth() - 1);
            else if (whCurrentView === 'week') whCurrentDate.setDate(whCurrentDate.getDate() - 7);
            else whCurrentDate.setDate(whCurrentDate.getDate() - 1);
            whRenderCalendar();
        }

        function workingHoursNext() {
            if (whCurrentView === 'month') whCurrentDate.setMonth(whCurrentDate.getMonth() + 1);
            else if (whCurrentView === 'week') whCurrentDate.setDate(whCurrentDate.getDate() + 7);
            else whCurrentDate.setDate(whCurrentDate.getDate() + 1);
            whRenderCalendar();
        }

        function workingHoursGoToday() {
            whCurrentDate = new Date();
            whRenderCalendar();
        }

        function whRenderCalendar() {
            whUpdateDateDisplay();
            whRenderMiniCalendar();
            if (whCurrentView === 'month') whRenderMonth();
            else if (whCurrentView === 'week') whRenderWeekView();
            else if (whCurrentView === 'day') whRenderDay();
        }

        function whUpdateDateDisplay() {
            const display = document.getElementById('whCurrentDate');
            if (whCurrentView === 'month') {
                display.textContent = whCurrentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            } else if (whCurrentView === 'week') {
                const weekStart = new Date(whCurrentDate);
                weekStart.setDate(whCurrentDate.getDate() - whCurrentDate.getDay());
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                display.textContent = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' - ' + weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else {
                display.textContent = whCurrentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            }
        }

        function whRenderMonth() {
            console.log('=== RENDERING MONTH VIEW ===');
            const year = whCurrentDate.getFullYear();
            const month = whCurrentDate.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const daysInPrevMonth = new Date(year, month, 0).getDate();
            
            const monthDaysContainer = document.getElementById('whMonthDays');
            if (!monthDaysContainer) {
                console.error('whMonthDays container not found!');
                return;
            }
            monthDaysContainer.innerHTML = '';
            
            // Get filtered staff for this month
            const filteredStaff = getFilteredStaffDatabase();
            console.log('Filtered staff for month view:', filteredStaff.length);
            filteredStaff.forEach(emp => {
                console.log('  - Processing:', emp.id, emp.title);
            });
            
            // Add previous month's days
            for (let i = firstDay - 1; i >= 0; i--) {
                const cell = document.createElement('div');
                cell.className = 'calendar-cell other-month';
                cell.innerHTML = `<div class="cell-date">${daysInPrevMonth - i}</div>`;
                monthDaysContainer.appendChild(cell);
            }
            
            // Add current month's days
            for (let day = 1; day <= daysInMonth; day++) {
                const cell = document.createElement('div');
                const date = new Date(year, month, day);
                cell.className = 'calendar-cell';
                if (date.toDateString() === new Date().toDateString()) cell.classList.add('today');
                
                let html = `<div class="cell-date">${day}</div><div class="cell-shifts">`;
                let shiftCount = 0;
                
                filteredStaff.forEach(employee => {
                    const shift = whGenerateShifts(employee.id, date);
                    console.log(`  ${employee.title} on ${date.toDateString()}: ${shift.type}`);
                    if (shift.type !== 'off' && isDateInFilterRange(date)) {
                        const role = employee.extendedProps?.role || 'Staff';
                        const timeRange = `${convertTo12Hour(shift.startTime)} - ${convertTo12Hour(shift.endTime)}`;
                        const shiftColor = employee.extendedProps?.color || '#10b981';
                        const badgeId = `badge-${employee.id}-${date.toISOString().split('T')[0]}`;
                        
                        // Create simpler badge without nested spans
                        html += `<div class="shift-badge ${shift.type}" 
                                 id="${badgeId}"
                                 style="cursor: pointer; border-left: 4px solid ${shiftColor}; pointer-events: auto;" 
                                 data-employee-id="${employee.id}" 
                                 data-shift-date="${date.toISOString().split('T')[0]}" 
                                 data-shift-start="${shift.startTime}" 
                                 data-shift-end="${shift.endTime}">
                            ${employee.title} • ${timeRange}
                        </div>`;
                        shiftCount++;
                    }
                });
                
                console.log(`Day ${day}: ${shiftCount} shifts found`);
                html += '</div>';
                cell.innerHTML = html;
                monthDaysContainer.appendChild(cell);
            }
            
            // Add next month's days
            const remaining = 42 - monthDaysContainer.children.length;
            for (let day = 1; day <= remaining; day++) {
                const cell = document.createElement('div');
                cell.className = 'calendar-cell other-month';
                cell.innerHTML = `<div class="cell-date">${day}</div>`;
                monthDaysContainer.appendChild(cell);
            }
            
            // Add event delegation listener to container
            monthDaysContainer.addEventListener('click', function(e) {
                const badge = e.target.closest('.shift-badge');
                if (badge) {
                    console.log('Shift badge clicked via delegation!');
                    const employeeId = badge.getAttribute('data-employee-id');
                    const shiftDate = badge.getAttribute('data-shift-date');
                    const shiftStart = badge.getAttribute('data-shift-start');
                    const shiftEnd = badge.getAttribute('data-shift-end');
                    console.log('Calling showWorkingHoursDetails:', employeeId, shiftDate, shiftStart, shiftEnd);
                    showWorkingHoursDetails(employeeId, shiftDate, shiftStart, shiftEnd);
                }
            });
            
            console.log('=== MONTH VIEW RENDERED ===');
        }

        function whRenderWeekView() {
            const weekStart = new Date(whCurrentDate);
            weekStart.setDate(whCurrentDate.getDate() - whCurrentDate.getDay());
            
            // Render header with day names and dates
            const headerContainer = document.getElementById('whWeekTimelineHeader');
            headerContainer.innerHTML = '';
            
            for (let day = 0; day < 7; day++) {
                const date = new Date(weekStart);
                date.setDate(weekStart.getDate() + day);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = date.getDate();
                
                const header = document.createElement('div');
                header.className = 'timeline-day-header';
                header.innerHTML = `${dayName}<br><strong>${dayNum}</strong>`;
                headerContainer.appendChild(header);
            }
            
            // Render grid with day columns
            const gridContainer = document.getElementById('whWeekTimelineGrid');
            gridContainer.innerHTML = '';
            
            const filteredStaff = getFilteredStaffDatabase();
            
            for (let day = 0; day < 7; day++) {
                const date = new Date(weekStart);
                date.setDate(weekStart.getDate() + day);
                
                const dayColumn = document.createElement('div');
                dayColumn.className = 'week-day-column';
                
                // Highlight today
                if (date.toDateString() === new Date().toDateString()) {
                    dayColumn.classList.add('today');
                }
                
                // Add day header
                const dayHeader = document.createElement('div');
                dayHeader.style.fontWeight = '700';
                dayHeader.style.fontSize = '0.95rem';
                dayHeader.style.marginBottom = '0.75rem';
                dayHeader.style.color = 'var(--text-primary)';
                dayHeader.textContent = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
                dayColumn.appendChild(dayHeader);
                
                // Create content area for cards
                const contentArea = document.createElement('div');
                contentArea.style.display = 'flex';
                contentArea.style.flexDirection = 'column';
                contentArea.style.gap = '0.75rem';
                
                // Build staff cards for this day with same detail as day view
                let hasContent = false;
                
                filteredStaff.forEach(staff => {
                    const shift = whGenerateShifts(staff.id, date);
                    
                    if (staff.type === 'provider') {
                        // Show provider with their rooms and assistants
                        staff.clinics.forEach(clinicId => {
                            const assignments = providerAssignments[clinicId] || [];
                            const providerAssigns = assignments.filter(a => a.providerId === staff.id);
                            
                            providerAssigns.forEach(assign => {
                                hasContent = true;
                                const card = document.createElement('div');
                                card.className = 'day-provider-card';
                                card.style.borderLeftColor = clinicDetails[clinicId].color;
                                card.style.fontSize = '0.8rem';
                                card.style.padding = '0.6rem';
                                
                                let cardHtml = `
                                    <div class="day-provider-name" style="font-size: 0.9rem;">👨‍⚕️ ${staff.name}</div>
                                    <div class="clinic-section-header" style="font-size: 0.75rem;">${clinicDetails[clinicId].name}</div>
                                    <div class="day-room-detail">
                                        <div class="day-room-name">${assign.room}</div>
                                `;
                                
                                if (assign.assistantName) {
                                    cardHtml += `<div class="day-assistant">👤 ${assign.assistantName}</div>`;
                                } else {
                                    cardHtml += `<div class="day-assistant" style="font-style: italic; color: var(--text-secondary);">No Assistant</div>`;
                                }
                                
                                cardHtml += `
                                        <div class="day-shift"><i class="fas fa-clock"></i> ${assign.shift}</div>
                                    </div>
                                `;
                                
                                card.innerHTML = cardHtml;
                                contentArea.appendChild(card);
                            });
                        });
                    } else if (staff.type === 'assistant') {
                        // Show assistant with their providers
                        staff.clinics.forEach(clinicId => {
                            const assignments = providerAssignments[clinicId] || [];
                            const assistantAssigns = assignments.filter(a => a.assistantId === staff.id);
                            
                            assistantAssigns.forEach(assign => {
                                hasContent = true;
                                const card = document.createElement('div');
                                card.className = 'day-provider-card';
                                card.style.borderLeftColor = clinicDetails[clinicId].color;
                                card.style.fontSize = '0.8rem';
                                card.style.padding = '0.6rem';
                                
                                const cardHtml = `
                                    <div class="day-provider-name" style="font-size: 0.9rem;">👤 ${staff.name}</div>
                                    <div class="clinic-section-header" style="font-size: 0.75rem;">${clinicDetails[clinicId].name}</div>
                                    <div class="day-room-detail">
                                        <div class="day-room-name">👨‍⚕️ ${assign.providerName}</div>
                                        <div class="day-shift"><i class="fas fa-door-open"></i> ${assign.room}</div>
                                        <div class="day-shift"><i class="fas fa-clock"></i> ${assign.shift}</div>
                                    </div>
                                `;
                                
                                card.innerHTML = cardHtml;
                                contentArea.appendChild(card);
                            });
                        });
                    } else {
                        // Other staff
                        if (shift.type !== 'off') {
                            hasContent = true;
                            const card = document.createElement('div');
                            card.className = 'day-provider-card';
                            card.style.borderLeftColor = clinicDetails[staff.clinics[0]].color;
                            card.style.fontSize = '0.8rem';
                            card.style.padding = '0.6rem';
                            
                            card.innerHTML = `
                                <div class="day-provider-name" style="font-size: 0.9rem;">${staff.name}</div>
                                <div class="clinic-section-header" style="font-size: 0.75rem;">${clinicDetails[staff.clinics[0]].name}</div>
                                <div class="day-room-detail">
                                    <div style="color: var(--text-secondary); font-style: italic; font-size: 0.75rem;">Clinic Staff</div>
                                    <div class="day-shift"><i class="fas fa-clock"></i> ${convertTo12Hour(shift.startTime)} - ${convertTo12Hour(shift.endTime)}</div>
                                </div>
                            `;
                            
                            contentArea.appendChild(card);
                        }
                    }
                });
                
                if (!hasContent) {
                    const emptyMsg = document.createElement('div');
                    emptyMsg.style.color = 'var(--text-secondary)';
                    emptyMsg.style.textAlign = 'center';
                    emptyMsg.style.fontSize = '0.9rem';
                    emptyMsg.style.padding = '1rem';
                    emptyMsg.textContent = 'No schedule';
                    contentArea.appendChild(emptyMsg);
                }
                
                dayColumn.appendChild(contentArea);
                gridContainer.appendChild(dayColumn);
            }
        }

        function whRenderWeek() {
            const weekStart = new Date(whCurrentDate);
            weekStart.setDate(whCurrentDate.getDate() - whCurrentDate.getDay());
            
            const filteredStaff = getFilteredStaffDatabase();
            const numEmployees = Math.max(filteredStaff.length, 1);
            const numDays = 7;
            
            // Generate time slots (6 AM to 10 PM)
            const timeSlots = [];
            for (let hour = 6; hour < 22; hour++) {
                timeSlots.push(hour);
            }
            
            // Build week header with dates and employee names
            const weekHeader = document.getElementById('whWeekHeader');
            weekHeader.innerHTML = '<div class="week-time-label">Time</div>';
            
            // Create column layout: Time | Day1Emp1 | Day1Emp2 | ... | Day2Emp1 | etc
            const gridTemplateColumns = `80px repeat(${numDays * numEmployees}, 1fr)`;
            weekHeader.style.display = 'grid';
            weekHeader.style.gridTemplateColumns = gridTemplateColumns;
            
            // Add date column headers
            for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
                const date = new Date(weekStart);
                date.setDate(weekStart.getDate() + dayIdx);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                const dayDate = date.getDate();
                
                const dateCol = document.createElement('div');
                dateCol.className = 'week-date-column-header';
                dateCol.innerHTML = `<div class="week-date-name">${dayName}</div><div class="week-date-num">${dayDate}</div>`;
                dateCol.style.gridColumn = `${dayIdx * numEmployees + 2} / span ${numEmployees}`;
                dateCol.style.borderBottom = '2px solid var(--accent-primary)';
                weekHeader.appendChild(dateCol);
            }
            
            // Add employee sub-headers
            for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
                filteredStaff.forEach((staff, staffIdx) => {
                    const empHeader = document.createElement('div');
                    empHeader.className = 'week-employee-column-header';
                    empHeader.textContent = staff.title;
                    empHeader.style.gridColumn = `${dayIdx * numEmployees + staffIdx + 2}`;
                    weekHeader.appendChild(empHeader);
                });
            }
            
            // Build timeline grid
            const weekTimeline = document.getElementById('whWeekTimeline');
            weekTimeline.innerHTML = '';
            weekTimeline.style.display = 'grid';
            weekTimeline.style.gridTemplateColumns = gridTemplateColumns;
            weekTimeline.style.gridAutoRows = '60px';
            
            // Add time labels and shift blocks
            timeSlots.forEach((hour, hourIdx) => {
                const timeLabel = document.createElement('div');
                timeLabel.className = 'time-row';
                timeLabel.style.gridRow = `${hourIdx + 1}`;
                timeLabel.style.gridColumn = '1';
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                timeLabel.textContent = `${displayHour} ${ampm}`;
                weekTimeline.appendChild(timeLabel);
                
                // Add cells for each day/employee combination
                for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
                    const date = new Date(weekStart);
                    date.setDate(weekStart.getDate() + dayIdx);
                    
                    filteredStaff.forEach((staff, staffIdx) => {
                        const shift = whGenerateShifts(staff.id, date);
                        const colIdx = dayIdx * numEmployees + staffIdx + 2;
                        
                        if (shift.type !== 'off' && isDateInFilterRange(date)) {
                            const startHour = parseInt(shift.startTime.split(':')[0]);
                            const endHour = parseInt(shift.endTime.split(':')[0]);
                            
                            // Only render on the first hour of the shift
                            if (hour === startHour) {
                                const cell = document.createElement('div');
                                cell.className = `shift-event-badge ${shift.type}`;
                                cell.textContent = `${staff.title}\n${convertTo12Hour(shift.startTime)} - ${convertTo12Hour(shift.endTime)}`;
                                cell.title = `${staff.title} - ${convertTo12Hour(shift.startTime)} to ${convertTo12Hour(shift.endTime)}`;
                                cell.style.gridColumn = colIdx;
                                cell.style.gridRow = `${hourIdx + 1} / span ${endHour - startHour}`;
                                cell.style.margin = '3px';
                                cell.style.whiteSpace = 'pre-wrap';
                                cell.style.fontSize = '0.7rem';
                                cell.style.padding = '6px 4px';
                                cell.style.cursor = 'pointer';
                                
                                // Store data for click handler
                                cell.dataset.employeeId = staff.id;
                                cell.dataset.shiftDate = date.toISOString().split('T')[0];
                                cell.dataset.shiftStart = shift.startTime;
                                cell.dataset.shiftEnd = shift.endTime;
                                
                                // Add click listener
                                cell.addEventListener('click', function(e) {
                                    e.stopPropagation();
                                    console.log('Week shift clicked:', this.dataset.employeeId);
                                    showWorkingHoursDetails(
                                        this.dataset.employeeId,
                                        this.dataset.shiftDate,
                                        this.dataset.shiftStart,
                                        this.dataset.shiftEnd
                                    );
                                });
                                
                                weekTimeline.appendChild(cell);
                            }
                        } else if (shift.type === 'off' && isDateInFilterRange(date) && hour === timeSlots[0]) {
                            // Show OFF status only once per day/employee
                            const cell = document.createElement('div');
                            cell.className = 'shift-event-badge off';
                            cell.textContent = 'OFF';
                            cell.style.gridColumn = colIdx;
                            cell.style.gridRow = `${hourIdx + 1}`;
                            cell.style.margin = '3px';
                            cell.style.fontSize = '0.65rem';
                            cell.style.padding = '4px';
                            weekTimeline.appendChild(cell);
                        }
                    });
                }
            });
        }

        function whRenderDay() {
            console.log('=== RENDERING DAY VIEW ===');
            const dayHeader = document.getElementById('whDayHeader');
            const dayName = whCurrentDate.toLocaleDateString('en-US', { weekday: 'long' });
            const dayDate = whCurrentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            dayHeader.innerHTML = `<h3>${dayName}</h3><p>${dayDate}</p>`;
            
            // Get filtered staff for this day
            const filteredStaff = getFilteredStaffDatabase();
            console.log('Day view - Filtered staff:', filteredStaff.length, 'employees');
            
            const dayContent = document.getElementById('whDayContent');
            if (!dayContent) {
                console.error('whDayContent not found!');
                return;
            }
            dayContent.innerHTML = '';
            
            // Create a grid container
            const gridContainer = document.createElement('div');
            gridContainer.className = 'day-view-grid';
            gridContainer.style.display = 'flex';
            gridContainer.style.flexDirection = 'column';
            gridContainer.style.gap = '1rem';
            
            let shiftCount = 0;
            let offCount = 0;
            
            filteredStaff.forEach(employee => {
                const shift = whGenerateShifts(employee.id, whCurrentDate);
                console.log(`Day view - ${employee.title}: ${shift.type} (${shift.startTime}-${shift.endTime})`);
                
                if (shift.type === 'off') {
                    // Show as off day
                    const card = document.createElement('div');
                    card.className = 'day-provider-card';
                    card.style.borderLeftColor = employee.extendedProps?.color || '#10b981';
                    card.style.opacity = '0.6';
                    card.innerHTML = `
                        <div class="day-provider-name" style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 1.2rem;">🌙</span>
                            <span>${employee.title}</span>
                        </div>
                        <div class="day-shift" style="color: var(--text-secondary);">Day Off</div>
                    `;
                    gridContainer.appendChild(card);
                    offCount++;
                } else {
                    // Show shift details
                    const card = document.createElement('div');
                    card.className = 'day-provider-card';
                    card.style.borderLeftColor = employee.extendedProps?.color || '#10b981';
                    card.style.cursor = 'pointer';
                    
                    const startTime = new Date(`2000-01-01T${shift.startTime}:00`);
                    const endTime = new Date(`2000-01-01T${shift.endTime}:00`);
                    
                    card.innerHTML = `
                        <div class="day-provider-name" style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 1.2rem;">👤</span>
                            <span>${employee.title}</span>
                        </div>
                        <div class="clinic-section-header">${employee.extendedProps?.role || 'Staff'}</div>
                        <div class="day-room-detail">
                            <div class="day-shift"><i class="fas fa-clock"></i> ${startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                            <div class="day-shift" style="text-transform: capitalize;"><i class="fas fa-briefcase"></i> ${shift.type} Shift</div>
                        </div>
                    `;
                    
                    // Store data in element for click handler
                    card.dataset.employeeId = employee.id;
                    card.dataset.shiftDate = whCurrentDate.toISOString().split('T')[0];
                    card.dataset.shiftStart = shift.startTime;
                    card.dataset.shiftEnd = shift.endTime;
                    
                    // Add click listener
                    card.addEventListener('click', function() {
                        console.log('Day card clicked:', this.dataset.employeeId);
                        showWorkingHoursDetails(
                            this.dataset.employeeId, 
                            this.dataset.shiftDate, 
                            this.dataset.shiftStart, 
                            this.dataset.shiftEnd
                        );
                    });
                    
                    gridContainer.appendChild(card);
                    shiftCount++;
                }
            });
            
            console.log(`Day view complete: ${shiftCount} shifts, ${offCount} days off`);
            
            if (filteredStaff.length === 0) {
                gridContainer.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">No employees to display</div>';
            }
            
            dayContent.appendChild(gridContainer);
            console.log('=== DAY VIEW RENDERED ===');
        }

        // Helper function to convert 24-hour time to 12-hour AM/PM format
        function convertTo12Hour(time24) {
            if (!time24) return time24;
            const [hours, minutes] = time24.split(':');
            let hours24 = parseInt(hours);
            const period = hours24 >= 12 ? 'PM' : 'AM';
            hours24 = hours24 % 12 || 12;
            return `${hours24}:${minutes} ${period}`;
        }

        // ========== FILTER STATE MANAGEMENT ==========
        const whFilterState = {
            clinic: '',
            employee: '',
            dateStart: null,
            dateEnd: null
        };

        // Initialize filters on page load
        function initializeWorkingHoursFilters() {
            const employeeSelect = document.getElementById('whEmployeeFilter');
            
            // If element doesn't exist, don't try to initialize
            if (!employeeSelect) {
                console.warn('whEmployeeFilter element not found in DOM');
                return;
            }
            
            updateEmployeeFilterByClinic();
            
            // Clear date filters
            const dateStartEl = document.getElementById('whDateFilterStart');
            const dateEndEl = document.getElementById('whDateFilterEnd');
            if (dateStartEl) dateStartEl.value = '';
            if (dateEndEl) dateEndEl.value = '';
            
            // Reset filters
            whFilterState.clinic = '';
            whFilterState.employee = '';
            whFilterState.dateStart = null;
            whFilterState.dateEnd = null;
            
            console.log('Filter initialization complete');
        }
        
        // Update employee dropdown based on selected clinic
        function updateEmployeeFilterByClinic() {
            const employeeSelect = document.getElementById('whEmployeeFilter');
            if (!employeeSelect) return;
            
            const currentEmployee = whFilterState.employee;
            employeeSelect.innerHTML = '<option value="">All Employees</option>';
            
            // Use employeeResources (unified database)
            if (employeeResources && Array.isArray(employeeResources)) {
                let filteredEmployees = employeeResources;
                
                // If clinic is selected, filter employees by clinic
                if (whFilterState.clinic) {
                    filteredEmployees = employeeResources.filter(emp => {
                        const clinics = emp.extendedProps?.clinics || [];
                        return clinics.includes(whFilterState.clinic);
                    });
                    console.log('Filtered employees for clinic', whFilterState.clinic, ':', filteredEmployees.map(e => e.title));
                }
                
                filteredEmployees.forEach(employee => {
                    const option = document.createElement('option');
                    option.value = employee.id;
                    option.textContent = employee.title;
                    employeeSelect.appendChild(option);
                });
                
                // Restore previous selection if still valid
                if (currentEmployee) {
                    const isStillValid = filteredEmployees.some(emp => emp.id === currentEmployee);
                    if (isStillValid) {
                        employeeSelect.value = currentEmployee;
                    } else {
                        whFilterState.employee = '';
                    }
                }
                
                console.log('Updated employee filter with', filteredEmployees.length, 'employees');
            } else {
                console.warn('employeeResources not available');
            }
        }

        // Get filtered employee list for working hours display
        function getFilteredStaffDatabase() {
            if (!employeeResources || employeeResources.length === 0) {
                console.warn('employeeResources is empty or not defined');
                return [];
            }
            
            let filtered = [...employeeResources];
            
            console.log('=== GET FILTERED STAFF DATABASE ===');
            console.log('Starting with employee count:', filtered.length);
            console.log('All employees:', filtered.map(e => ({ id: e.id, title: e.title, role: e.extendedProps?.role })));

            // Filter by clinic if selected
            if (whFilterState.clinic) {
                console.log('Filtering by clinic:', whFilterState.clinic);
                filtered = filtered.filter(employee => {
                    const clinics = employee.extendedProps?.clinics || [];
                    const matches = clinics.includes(whFilterState.clinic);
                    console.log(`  Employee ${employee.title} - clinics: [${clinics.join(', ')}] - matches: ${matches}`);
                    return matches;
                });
                console.log('After clinic filter:', filtered.length, filtered.map(e => e.title));
            }

            // Filter by employee if selected
            if (whFilterState.employee) {
                console.log('Filtering by employee:', whFilterState.employee);
                filtered = filtered.filter(employee => {
                    const matches = employee.id == whFilterState.employee;
                    console.log(`  Employee ${employee.title} (id: ${employee.id}) - matches: ${matches}`);
                    if (matches) {
                        // Log sample shifts for this employee
                        const testDate = new Date();
                        const shift = whGenerateShifts(employee.id, testDate);
                        console.log(`    Sample shift for today: ${shift.type} ${shift.startTime}-${shift.endTime}`);
                    }
                    return matches;
                });
                console.log('After employee filter:', filtered.length, filtered.map(e => e.title));
            }

            console.log('=== FINAL FILTERED RESULT ===');
            console.log('Returning:', filtered.length, 'employees');
            filtered.forEach(e => {
                console.log(`  - ${e.id}: ${e.title} (${e.extendedProps?.role})`);
            });
            return filtered;
        }

        // Check if a date is within the filter range
        function isDateInFilterRange(date) {
            if (!whFilterState.dateStart && !whFilterState.dateEnd) {
                return true;
            }

            const dateTime = date.getTime();
            if (whFilterState.dateStart && dateTime < whFilterState.dateStart.getTime()) {
                return false;
            }
            if (whFilterState.dateEnd) {
                const endDate = new Date(whFilterState.dateEnd);
                endDate.setHours(23, 59, 59, 999);
                if (dateTime > endDate.getTime()) {
                    return false;
                }
            }

            return true;
        }

        // Mini Calendar Variables
        let whMiniCalendarDate = new Date();
        let whIsDragging = false;
        let whDragOffsetX = 0;
        let whDragOffsetY = 0;

        // Enable dragging for mini calendar
        function whEnableDrag() {
            const calendar = document.getElementById('whMiniCalendar');
            const header = calendar.querySelector('.wh-mini-calendar-header');
            
            header.addEventListener('mousedown', (e) => {
                whIsDragging = true;
                whDragOffsetX = e.clientX - calendar.offsetLeft;
                whDragOffsetY = e.clientY - calendar.offsetTop;
                header.style.cursor = 'grabbing';
            });

            document.addEventListener('mousemove', (e) => {
                if (!whIsDragging) return;
                const calendar = document.getElementById('whMiniCalendar');
                calendar.style.left = (e.clientX - whDragOffsetX) + 'px';
                calendar.style.top = (e.clientY - whDragOffsetY) + 'px';
                calendar.style.right = 'auto';
                calendar.style.bottom = 'auto';
            });

            document.addEventListener('mouseup', () => {
                whIsDragging = false;
                header.style.cursor = 'grab';
            });
        }

        // Show/hide month/year picker
        function whShowMonthYearPicker() {
            const picker = document.getElementById('whMonthYearPicker');
            if (!picker) return;
            
            const isOpen = picker.classList.contains('open');
            
            if (!isOpen) {
                whPopulatePickerOptions();
                picker.classList.add('open');
            } else {
                picker.classList.remove('open');
            }
        }

        // Populate month and year options in picker
        function whPopulatePickerOptions() {
            const picker = document.getElementById('whMonthYearPicker');
            if (!picker) return;

            const year = whMiniCalendarDate.getFullYear();
            const month = whMiniCalendarDate.getMonth();
            const currentYear = new Date().getFullYear();

            // Find or create months section
            let monthsSection = picker.querySelector('.wh-months-section');
            if (!monthsSection) {
                monthsSection = document.createElement('div');
                monthsSection.className = 'wh-months-section';
                monthsSection.innerHTML = '<div class="wh-picker-section-title">Month</div>';
                const monthsGrid = document.createElement('div');
                monthsGrid.className = 'wh-months-grid';
                monthsSection.appendChild(monthsGrid);
                picker.appendChild(monthsSection);
            }

            // Update month options
            const monthsGrid = monthsSection.querySelector('.wh-months-grid');
            monthsGrid.innerHTML = '';
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            months.forEach((mon, idx) => {
                const opt = document.createElement('div');
                opt.className = 'wh-month-year-option';
                if (idx === month) opt.classList.add('active');
                opt.textContent = mon;
                opt.onclick = () => whSelectMonth(idx);
                monthsGrid.appendChild(opt);
            });

            // Find or create years section
            let yearsSection = picker.querySelector('.wh-years-section');
            if (!yearsSection) {
                yearsSection = document.createElement('div');
                yearsSection.className = 'wh-years-section';
                yearsSection.innerHTML = '<div class="wh-picker-section-title">Year</div>';
                const yearsGrid = document.createElement('div');
                yearsGrid.className = 'wh-years-grid';
                yearsSection.appendChild(yearsGrid);
                picker.appendChild(yearsSection);
            }

            // Update year options (current year ± 5 years)
            const yearsGrid = yearsSection.querySelector('.wh-years-grid');
            yearsGrid.innerHTML = '';
            for (let y = currentYear - 5; y <= currentYear + 5; y++) {
                const opt = document.createElement('div');
                opt.className = 'wh-month-year-option';
                if (y === year) opt.classList.add('active');
                opt.textContent = y;
                opt.onclick = () => whSelectYear(y);
                yearsGrid.appendChild(opt);
            }
        }

        // Select month from picker
        function whSelectMonth(monthIndex) {
            whMiniCalendarDate.setMonth(monthIndex);
            whCurrentDate.setMonth(monthIndex);
            whRenderMiniCalendar();
            switchWorkingHoursView('month');
            whShowMonthYearPicker();
        }

        // Select year from picker
        function whSelectYear(selectedYear) {
            whMiniCalendarDate.setFullYear(selectedYear);
            whCurrentDate.setFullYear(selectedYear);
            whRenderMiniCalendar();
            switchWorkingHoursView('month');
            whShowMonthYearPicker();
        }

        // Render mini calendar
        function whRenderMiniCalendar() {
            const year = whMiniCalendarDate.getFullYear();
            const month = whMiniCalendarDate.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const daysInPrevMonth = new Date(year, month, 0).getDate();

            const container = document.getElementById('whMiniCalendar');
            
            // Preserve picker if it exists and is open
            let pickerHTML = '';
            const existingPicker = container.querySelector('#whMonthYearPicker');
            const pickerWasOpen = existingPicker && existingPicker.classList.contains('open');
            const isMinimized = container.classList.contains('minimized');
            
            container.innerHTML = '';

            // Header with month/year and nav buttons
            const header = document.createElement('div');
            header.className = 'wh-mini-calendar-header';
            header.innerHTML = `
                <div class="wh-mini-calendar-nav">
                    <button onclick="whPrevMiniMonth()"><i class="fas fa-chevron-left"></i></button>
                    <button onclick="whNextMiniMonth()"><i class="fas fa-chevron-right"></i></button>
                </div>
                <div class="wh-mini-calendar-month" onclick="whShowMonthYearPicker()" style="user-select: none; flex: 1;">${new Date(year, month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</div>
                <div class="wh-mini-calendar-header-actions">
                    <button class="wh-mini-toggle-btn" onclick="whToggleMiniCalendar()" title="Toggle minimize">
                        <i class="fas ${isMinimized ? 'fa-expand' : 'fa-compress'}"></i>
                    </button>
                </div>
            `;
            container.appendChild(header);

            // Month/Year Picker
            const picker = document.createElement('div');
            picker.id = 'whMonthYearPicker';
            picker.className = 'wh-month-year-picker';
            if (pickerWasOpen) picker.classList.add('open');
            container.appendChild(picker);

            // Weekday headers
            const weekdays = document.createElement('div');
            weekdays.className = 'wh-mini-calendar-weekdays';
            ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(day => {
                const dayEl = document.createElement('div');
                dayEl.className = 'wh-mini-calendar-weekday';
                dayEl.textContent = day;
                weekdays.appendChild(dayEl);
            });
            container.appendChild(weekdays);

            // Days grid
            const days = document.createElement('div');
            days.className = 'wh-mini-calendar-days';

            // Previous month days
            for (let i = firstDay - 1; i >= 0; i--) {
                const dayEl = document.createElement('div');
                dayEl.className = 'wh-mini-calendar-day other-month';
                dayEl.textContent = daysInPrevMonth - i;
                days.appendChild(dayEl);
            }

            // Current month days
            const today = new Date();
            for (let day = 1; day <= daysInMonth; day++) {
                const dayEl = document.createElement('div');
                dayEl.className = 'wh-mini-calendar-day';
                dayEl.textContent = day;

                const currentDate = new Date(year, month, day);

                // Check if today
                if (currentDate.toDateString() === today.toDateString()) {
                    dayEl.classList.add('today');
                }

                // Check if selected (current whCurrentDate)
                if (currentDate.toDateString() === whCurrentDate.toDateString()) {
                    dayEl.classList.add('selected');
                }

                // Click to navigate
                dayEl.onclick = () => {
                    whCurrentDate = new Date(year, month, day);
                    whRenderMiniCalendar();
                    switchWorkingHoursView('day');
                };

                days.appendChild(dayEl);
            }

            // Next month days
            const remaining = 42 - (firstDay + daysInMonth);
            for (let day = 1; day <= remaining; day++) {
                const dayEl = document.createElement('div');
                dayEl.className = 'wh-mini-calendar-day other-month';
                dayEl.textContent = day;
                days.appendChild(dayEl);
            }

            container.appendChild(days);

            // Add Today button
            const todayBtn = document.createElement('button');
            todayBtn.className = 'wh-mini-calendar-today-btn';
            todayBtn.innerHTML = '<i class="fas fa-calendar-check"></i> Today';
            todayBtn.onclick = whMiniCalendarGoToday;
            container.appendChild(todayBtn);
            
            // Populate picker options if it was open
            if (pickerWasOpen) {
                whPopulatePickerOptions();
            }
            
            // Enable dragging
            setTimeout(() => whEnableDrag(), 100);
        }

        function whPrevMiniMonth() {
            whMiniCalendarDate.setMonth(whMiniCalendarDate.getMonth() - 1);
            whRenderMiniCalendar();
        }

        function whNextMiniMonth() {
            whMiniCalendarDate.setMonth(whMiniCalendarDate.getMonth() + 1);
            whRenderMiniCalendar();
        }

        // Toggle minimize/maximize mini calendar
        function whToggleMiniCalendar() {
            const container = document.getElementById('whMiniCalendar');
            container.classList.toggle('minimized');
        }

        // Jump to today in mini calendar
        function whMiniCalendarGoToday() {
            whMiniCalendarDate = new Date();
            whCurrentDate = new Date();
            whRenderCalendar();
            whRenderMiniCalendar();
        }

        // Apply working hours filters and re-render
        function applyWorkingHoursFilters() {
            console.log('=== FILTER APPLICATION START ===');
            
            try {
                // Update filter state - safely check if elements exist
                const clinicFilterEl = document.getElementById('whClinicFilter');
                
                if (clinicFilterEl) {
                    whFilterState.clinic = clinicFilterEl.value;
                    console.log('Clinic filter selected:', whFilterState.clinic);
                }

                console.log('Filter State:', whFilterState);
                
                // Force re-render by calling changeCalendarView with current view
                if (window.changeCalendarView && window.calendarInstance) {
                    const currentView = window.calendarInstance.currentView;
                    window.changeCalendarView(currentView);
                }

                console.log('=== FILTER APPLICATION COMPLETE ===');
            } catch (e) {
                console.error('Error in applyWorkingHoursFilters:', e);
            }
        }

        // Show employee profile card with clinic assignments and relationships
        function showEmployeeProfileCard(employeeId) {
            const employee = employeeResources.find(emp => emp.id == employeeId);
            if (!employee) return;

            // Populate employee info
            const initials = employee.title.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            document.getElementById('empAvatar').textContent = initials;
            document.getElementById('empName').textContent = employee.title;
            document.getElementById('empRole').textContent = employee.extendedProps?.role || 'Staff';

            const clinicsContent = document.getElementById('clinicsContent');
            clinicsContent.innerHTML = '';

            // Show employee role and color
            const roleSection = document.createElement('div');
            roleSection.className = 'clinic-section';
            roleSection.style.padding = '1rem';
            roleSection.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 16px; height: 16px; border-radius: 50%; background: ${employee.extendedProps?.color || '#10b981'};"></div>
                    <div>
                        <strong>${employee.extendedProps?.role || 'Staff'}</strong>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">ID: ${employee.id}</div>
                    </div>
                </div>
            `;
            clinicsContent.appendChild(roleSection);

            document.getElementById('employeeProfileCard').classList.remove('hidden');
        }

        // Show information for a provider (doctor)
        function showProviderInfo(container, employee, clinicId) {
            const assignments = providerAssignments[clinicId] || [];
            const providerAssigns = assignments.filter(a => a.providerId === employee.id);

            if (providerAssigns.length === 0) {
                const noAssign = document.createElement('div');
                noAssign.className = 'no-assistant';
                noAssign.innerHTML = '<i class="fas fa-user-slash"></i> No assistants assigned';
                container.appendChild(noAssign);
                return;
            }

            providerAssigns.forEach(assign => {
                const providerItem = document.createElement('div');
                providerItem.className = 'provider-item';
                providerItem.style.borderLeftColor = clinicDetails[clinicId].color;

                let html = `<div class="provider-name">${assign.room}</div>`;
                
                if (assign.assistantName) {
                    html += `
                        <div class="assistant-info">
                            <i class="fas fa-user"></i>
                            <span>${assign.assistantName}</span>
                        </div>
                    `;
                } else {
                    html += `<div class="no-assistant"><i class="fas fa-user-slash"></i> No Assistant</div>`;
                }

                html += `<div class="shift-time"><i class="fas fa-clock"></i> ${assign.shift}</div>`;

                providerItem.innerHTML = html;
                container.appendChild(providerItem);
            });
        }

        // Show information for an assistant
        function showAssistantInfo(container, employee, clinicId) {
            const assignments = providerAssignments[clinicId] || [];
            const assistantAssigns = assignments.filter(a => a.assistantId === employee.id);

            if (assistantAssigns.length === 0) {
                const clinicOnlyInfo = document.createElement('div');
                clinicOnlyInfo.className = 'clinic-only-info';
                clinicOnlyInfo.innerHTML = `<i class="fas fa-building"></i> No Provider Assigned`;
                container.appendChild(clinicOnlyInfo);
                return;
            }

            assistantAssigns.forEach(assign => {
                const assistantItem = document.createElement('div');
                assistantItem.className = 'provider-item';
                assistantItem.style.borderLeftColor = clinicDetails[clinicId].color;

                const html = `
                    <div class="provider-name"><i class="fas fa-user-md"></i> ${assign.providerName}</div>
                    <div class="room-info"><i class="fas fa-door-open"></i> ${assign.room}</div>
                    <div class="shift-time"><i class="fas fa-clock"></i> ${assign.shift}</div>
                `;

                assistantItem.innerHTML = html;
                container.appendChild(assistantItem);
            });
        }

        // Close employee profile card
        function closeEmployeeProfileCard() {
            document.getElementById('employeeProfileCard').classList.add('hidden');
        }
        function resetWorkingHoursFilters() {
            // Clear all filter dropdowns
            const clinicFilter = document.getElementById('whClinicFilter');
            if (clinicFilter) {
                clinicFilter.value = '';
            }
            
            // Reset filter state
            whFilterState.clinic = '';
            whFilterState.employee = '';
            whFilterState.dateStart = null;
            whFilterState.dateEnd = null;
            
            // Re-render the main calendar
            if (window.calendarInstance) {
                window.calendarInstance.render();
            }
        }

        // ========== SYNC MECHANISMS WITH OTHER CALENDARS ==========

        // Sync working hours with big calendar employees
        function syncWorkingHoursWithBigCalendar() {
            // Get filtered staff
            const filteredStaff = getFilteredStaffDatabase();
            
            // Update big calendar with filtered employee data
            // This assumes your big calendar is using FullCalendar
            if (window.bigCalendar && window.bigCalendar.getApi) {
                const api = window.bigCalendar.getApi();
                
                // Remove all existing resource events
                const events = api.getEvents();
                events.forEach(event => {
                    if (event.extendedProps && event.extendedProps.type === 'workingHours') {
                        event.remove();
                    }
                });

                // Add new events for filtered staff
                filteredStaff.forEach(staff => {
                    // Generate events for the calendar view range
                    const calendarInfo = api.currentData.calendarOptions;
                    const viewStart = api.view.activeStart;
                    const viewEnd = api.view.activeEnd;

                    // Create working hours events
                    const currentDate = new Date(viewStart);
                    while (currentDate < viewEnd) {
                        if (isDateInFilterRange(currentDate)) {
                            const shift = whGenerateShifts(staff.id, new Date(currentDate));
                            if (shift.type !== 'off') {
                                api.addEvent({
                                    title: `${staff.name} - ${shift.type}`,
                                    start: `${currentDate.toISOString().split('T')[0]}T${shift.startTime}:00`,
                                    end: `${currentDate.toISOString().split('T')[0]}T${shift.endTime}:00`,
                                    resourceId: staff.id,
                                    extendedProps: {
                                        type: 'workingHours',
                                        shiftType: shift.type,
                                        staffId: staff.id
                                    },
                                    backgroundColor: getShiftColor(shift.type)
                                });
                            }
                        }
                        currentDate.setDate(currentDate.getDate() + 1);
                    }
                });
            }
        }

        // Sync working hours with quick calendar
        function syncWorkingHoursWithQuickCalendar() {
            // Get filtered staff
            const filteredStaff = getFilteredStaffDatabase();
            
            // Update quick calendar display
            if (window.quickCalendarContainer) {
                const container = document.getElementById(window.quickCalendarContainer);
                if (container) {
                    // Update the quick calendar with filtered data
                    // This might involve updating event displays or indicator dots
                    filteredStaff.forEach(staff => {
                        const staffElement = container.querySelector(`[data-staff-id="${staff.id}"]`);
                        if (staffElement) {
                            const shift = whGenerateShifts(staff.id, whCurrentDate);
                            const shiftIndicator = staffElement.querySelector('.shift-indicator');
                            if (shiftIndicator) {
                                shiftIndicator.className = `shift-indicator ${shift.type}`;
                                shiftIndicator.textContent = shift.type !== 'off' ? `${convertTo12Hour(shift.startTime)} - ${convertTo12Hour(shift.endTime)}` : 'Off';
                            }
                        }
                    });
                }
            }
        }

        // Sync working hours with schedule view
        function syncWorkingHoursWithScheduleView() {
            // Get filtered staff and date range
            const filteredStaff = getFilteredStaffDatabase();
            const scheduleContainer = document.getElementById('scheduleViewContainer');
            
            if (scheduleContainer) {
                // Update schedule table/view with filtered data
                filteredStaff.forEach(staff => {
                    const staffRow = scheduleContainer.querySelector(`[data-staff-id="${staff.id}"]`);
                    if (staffRow) {
                        // Update shift information for each day in filter range
                        let currentDate = whFilterState.dateStart || new Date();
                        const endDate = whFilterState.dateEnd || new Date();
                        
                        while (currentDate <= endDate) {
                            const shift = whGenerateShifts(staff.id, new Date(currentDate));
                            const dayCell = staffRow.querySelector(`[data-date="${currentDate.toISOString().split('T')[0]}"]`);
                            if (dayCell) {
                                dayCell.className = `schedule-day-cell ${shift.type}`;
                                dayCell.textContent = shift.type !== 'off' ? `${convertTo12Hour(shift.startTime)} - ${convertTo12Hour(shift.endTime)}` : 'Off';
                            }
                            currentDate.setDate(currentDate.getDate() + 1);
                        }
                    }
                });
            }
        }

        // Helper function to get shift color based on type
        function getShiftColor(shiftType) {
            const colors = {
                'morning': '#10b981',
                'afternoon': '#3b82f6',
                'evening': '#8b5cf6',
                'off': '#ef4444'
            };
            return colors[shiftType] || '#gray';
        }

        // Modified render functions to use filtered data
        function whRenderMonthWithFilters() {
            const filteredStaff = getFilteredStaffDatabase();
            const monthDaysContainer = document.getElementById('whMonthDays');
            monthDaysContainer.innerHTML = '';

            const year = whCurrentDate.getFullYear();
            const month = whCurrentDate.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);

            const prevMonth = new Date(year, month, 0);
            const prevMonthDays = prevMonth.getDate();
            const startDate = firstDay.getDay();

            for (let i = startDate - 1; i >= 0; i--) {
                const cell = document.createElement('div');
                cell.className = 'calendar-cell other-month';
                cell.innerHTML = `<div class="cell-date">${prevMonthDays - i}</div>`;
                monthDaysContainer.appendChild(cell);
            }

            for (let day = 1; day <= lastDay.getDate(); day++) {
                const cell = document.createElement('div');
                const cellDate = new Date(year, month, day);
                
                cell.className = 'calendar-cell';
                if (cellDate.toDateString() === new Date().toDateString()) {
                    cell.classList.add('today');
                }

                let cellContent = `<div class="cell-date">${day}</div><div class="cell-shifts">`;

                filteredStaff.forEach(staff => {
                    const shift = whGenerateShifts(staff.id, cellDate);
                    if (shift.type !== 'off') {
                        cellContent += `<div class="mini-shift ${shift.type}" title="${staff.name}">${staff.initials}</div>`;
                    }
                });

                cellContent += '</div>';
                cell.innerHTML = cellContent;
                monthDaysContainer.appendChild(cell);
            }

            const remaining = 42 - (startDate + lastDay.getDate());
            for (let day = 1; day <= remaining; day++) {
                const cell = document.createElement('div');
                cell.className = 'calendar-cell other-month';
                cell.innerHTML = `<div class="cell-date">${day}</div>`;
                monthDaysContainer.appendChild(cell);
            }
        }

        function whRenderWeekWithFilters() {
            const filteredStaff = getFilteredStaffDatabase();
            const weekStart = new Date(whCurrentDate);
            weekStart.setDate(whCurrentDate.getDate() - whCurrentDate.getDay());
            
            const weekHeader = document.getElementById('whWeekHeader');
            weekHeader.innerHTML = '<div class="week-time-label">Time</div>';
            
            for (let i = 0; i < 7; i++) {
                const date = new Date(weekStart);
                date.setDate(weekStart.getDate() + i);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                const dayDate = date.getDate();
                const col = document.createElement('div');
                col.className = 'week-day-column';
                col.innerHTML = `<div class="week-day-name">${dayName}</div><div class="week-day-date">${dayDate}</div>`;
                weekHeader.appendChild(col);
            }
            
            const weekTimeline = document.getElementById('whWeekTimeline');
            weekTimeline.innerHTML = '';
            
            for (let hour = 6; hour < 22; hour++) {
                const timeLabel = document.createElement('div');
                timeLabel.className = 'time-row';
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                timeLabel.textContent = `${displayHour} ${ampm}`;
                weekTimeline.appendChild(timeLabel);
                
                for (let i = 0; i < 7; i++) {
                    const date = new Date(weekStart);
                    date.setDate(weekStart.getDate() + i);
                    const cell = document.createElement('div');
                    cell.className = 'time-cell';
                    
                    if (isDateInFilterRange(date)) {
                        filteredStaff.forEach(staff => {
                            const shift = whGenerateShifts(staff.id, date);
                            if (shift.type !== 'off') {
                                const startHour = parseInt(shift.startTime.split(':')[0]);
                                const endHour = parseInt(shift.endTime.split(':')[0]);
                                
                                if (hour >= startHour && hour < endHour) {
                                    const badge = document.createElement('div');
                                    badge.className = `shift-event-badge ${shift.type}`;
                                    badge.textContent = staff.initials;
                                    badge.title = `${staff.name} - ${convertTo12Hour(shift.startTime)} to ${convertTo12Hour(shift.endTime)}`;
                                    cell.appendChild(badge);
                                }
                            }
                        });
                    }
                    
                    weekTimeline.appendChild(cell);
                }
            }
        }

        function whRenderDayWithFilters() {
            const filteredStaff = getFilteredStaffDatabase();
            const dayHeader = document.getElementById('whDayHeader');
            const dayName = whCurrentDate.toLocaleDateString('en-US', { weekday: 'long' });
            const dayDate = whCurrentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            dayHeader.innerHTML = `<h3>${dayName}</h3><p>${dayDate}</p>`;
            
            const dayContent = document.getElementById('whDayContent');
            dayContent.innerHTML = '';
            
            if (!isDateInFilterRange(whCurrentDate)) {
                dayContent.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">No data available for the selected date range</div>';
                return;
            }

            filteredStaff.forEach(staff => {
                const shift = whGenerateShifts(staff.id, whCurrentDate);
                const block = document.createElement('div');
                block.className = 'staff-shift-block';
                
                let html = `<div class="staff-name-header">${staff.name}</div><div class="shift-time-display">`;
                if (shift.type !== 'off') {
                    html += `<div class="shift-time-item ${shift.type}">${convertTo12Hour(shift.startTime)} - ${convertTo12Hour(shift.endTime)}</div>`;
                } else {
                    html += `<div class="shift-time-item off">Off</div>`;
                }
                html += '</div>';
                
                block.innerHTML = html;
                dayContent.appendChild(block);
            });
        }

        // Close on Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const container = document.getElementById('workingHoursContainer');
                if (container && !container.classList.contains('hidden')) {
                    closeWorkingHours();
                }
            }
        });

        // Show working hours details when clicking on a shift badge
        function showWorkingHoursDetails(employeeId, date, startTime, endTime) {
            try {
                console.log('showWorkingHoursDetails called:', employeeId);
                
                const employee = employeeResources.find(e => e.id === employeeId);
                if (!employee) {
                    console.error('Employee not found:', employeeId);
                    return;
                }
                
                console.log('Found employee:', employee.title);
                
                // Update header
                const initials = employee.title.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                document.getElementById('empAvatar').textContent = initials;
                document.getElementById('empName').textContent = employee.title;
                document.getElementById('empRole').textContent = employee.extendedProps?.role || 'Staff';
                
                // Create content
                const clinicsContent = document.getElementById('clinicsContent');
                clinicsContent.innerHTML = '';
                
                const dateObj = new Date(date + 'T00:00:00');
                const startDateTime = new Date(date + 'T' + startTime + ':00');
                const endDateTime = new Date(date + 'T' + endTime + ':00');
                
                const isProvider = employee.extendedProps?.type === 'provider';
                
                const html = `
                    <div style="padding: 1rem; display: flex; flex-direction: column; gap: 1rem;">
                        <div>
                            <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; font-weight: bold;">Position Type</div>
                            <div style="font-size: 1rem; font-weight: bold; margin-top: 0.25rem;">${isProvider ? '👨‍⚕️ Provider' : '👤 Employee'}</div>
                        </div>
                        
                        <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                            <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; font-weight: bold;">Department</div>
                            <div style="font-size: 1rem; margin-top: 0.25rem;">${employee.extendedProps?.role || 'Staff'}</div>
                        </div>
                        
                        <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                            <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; font-weight: bold;">Shift Date</div>
                            <div style="font-size: 1rem; margin-top: 0.25rem;">${dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                        </div>
                        
                        <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                            <div style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; font-weight: bold;">Working Hours</div>
                            <div style="font-size: 1.1rem; font-weight: bold; color: var(--accent-primary); margin-top: 0.25rem;">
                                ${startDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${endDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                `;
                
                clinicsContent.innerHTML = html;
                
                // Show card
                const card = document.getElementById('employeeProfileCard');
                if (card) {
                    card.classList.remove('hidden');
                    console.log('Card shown successfully');
                } else {
                    console.error('employeeProfileCard not found');
                }
                
            } catch (e) {
                console.error('Error in showWorkingHoursDetails:', e);
            }
        }

        // Test function to manually trigger details display
        window.testShowDetails = function() {
            console.log('=== TEST SHOW DETAILS ===');
            if (employeeResources && employeeResources.length > 0) {
                const testEmp = employeeResources[0];
                console.log('Testing with employee:', testEmp.title);
                showWorkingHoursDetails(testEmp.id, '2025-11-22', '08:00', '16:00');
            } else {
                console.error('No employees available for testing');
            }
        };

        // Test function - run this from console: testWorkingHoursClick()
        window.testWorkingHoursClick = function() {
            console.log('=== TESTING WORKING HOURS CLICK ===');
            const badges = document.querySelectorAll('.shift-badge');
            console.log('Found', badges.length, 'shift badges');
            
            if (badges.length > 0) {
                const firstBadge = badges[0];
                console.log('First badge:', firstBadge);
                console.log('Data:', {
                    employeeId: firstBadge.getAttribute('data-employee-id'),
                    date: firstBadge.getAttribute('data-shift-date'),
                    start: firstBadge.getAttribute('data-shift-start'),
                    end: firstBadge.getAttribute('data-shift-end')
                });
                console.log('Manually triggering click...');
                firstBadge.click();
            } else {
                console.log('No shift badges found! Make sure working hours are visible.');
            }
        };
        
        // Initialize filters when DOM is ready
        
        function ensureFilterInitialization() {
            // Wait for DOM and employee resources to be ready
            const employeeFilterEl = document.getElementById('whEmployeeFilter');
            
            if (!employeeFilterEl) {
                if (filterInitRetries < MAX_FILTER_RETRIES) {
                    filterInitRetries++;
                    setTimeout(ensureFilterInitialization, 500);
                }
                return;
            }
            
            if (typeof employeeResources === 'undefined' || employeeResources.length === 0) {
                if (filterInitRetries < MAX_FILTER_RETRIES) {
                    filterInitRetries++;
                    console.log('Waiting for employee data... (' + filterInitRetries + '/' + MAX_FILTER_RETRIES + ')');
                    setTimeout(ensureFilterInitialization, 500);
                } else {
                    console.log('No employees found after max retries - this is OK if no employees are configured');
                }
                return;
            }
            
            console.log('Initializing working hours filters...');
            console.log('Employee resources available:', employeeResources.length);
            initializeWorkingHoursFilters();
        }
        
        // TROUBLESHOOTING FUNCTION - Run this in browser console if filters aren't working
        window.debugWorkingHours = function() {
            console.log('=== WORKING HOURS DEBUGGING ===\n');
            
            console.log('1. Employee Resources Status:');
            console.log('   - employeeResources exists:', typeof employeeResources !== 'undefined');
            console.log('   - Employee count:', employeeResources?.length || 0);
            if (employeeResources && employeeResources.length > 0) {
                console.log('   - First employee:', employeeResources[0]);
            }
            
            console.log('\n2. Filter Elements:');
            console.log('   - Employee filter exists:', !!document.getElementById('whEmployeeFilter'));
            console.log('   - Date start exists:', !!document.getElementById('whDateFilterStart'));
            console.log('   - Date end exists:', !!document.getElementById('whDateFilterEnd'));
            
            console.log('\n3. Filter State:');
            console.log('   - whFilterState:', window.whFilterState);
            
            console.log('\n4. Functions:');
            console.log('   - initializeWorkingHoursFilters:', typeof initializeWorkingHoursFilters);
            console.log('   - applyWorkingHoursFilters:', typeof applyWorkingHoursFilters);
            console.log('   - getFilteredStaffDatabase:', typeof getFilteredStaffDatabase);
            
            console.log('\n5. Test Filter:');
            const testFiltered = getFilteredStaffDatabase();
            console.log('   - getFilteredStaffDatabase() returns:', testFiltered.length, 'employees');
            
            console.log('\n6. Working Hours Container:');
            console.log('   - Container exists:', !!document.getElementById('workingHoursContainer'));
            console.log('   - Container visible:', !document.getElementById('workingHoursContainer')?.classList.contains('hidden'));
            
            console.log('\n7. Recommended Actions:');
            if (!employeeResources || employeeResources.length === 0) {
                console.log('   ⚠️ Employee resources not found. Make sure employeeResources is populated.');
            } else {
                console.log('   ✓ Employee resources loaded');
            }
            console.log('   ✓ Run: initializeWorkingHoursFilters()');
            console.log('   ✓ Run: applyWorkingHoursFilters()');
            
            console.log('\n=== END DEBUG ===');
        };
        
        // Try to initialize on multiple events
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', ensureFilterInitialization);
        } else {
            // DOM already loaded
            ensureFilterInitialization();
        }
        
        // Also try initialization when working hours is opened
        document.addEventListener('click', function(e) {
            // If user clicks to open working hours and filters aren't initialized
            if (e.target.closest('[onclick*="openWorkingHours"]') || 
                e.target.closest('button')?.textContent?.includes('Hours')) {
                setTimeout(ensureFilterInitialization, 100);
            }
        });

        // ============ KANBAN BOARD FUNCTIONALITY ============
        
        // Drag and Drop functionality for Kanban cards
        let draggedCard = null;

        // Initialize drag and drop
        function initializeKanbanDragDrop() {
            const cards = document.querySelectorAll('.kanban-card');
            const columns = document.querySelectorAll('.kanban-column-body');

            cards.forEach(card => {
                card.addEventListener('dragstart', handleDragStart);
                card.addEventListener('dragend', handleDragEnd);
            });

            columns.forEach(column => {
                column.addEventListener('dragover', handleDragOver);
                column.addEventListener('drop', handleDrop);
                column.addEventListener('dragenter', handleDragEnter);
                column.addEventListener('dragleave', handleDragLeave);
            });
        }

        function handleDragStart(e) {
            draggedCard = this;
            this.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
        }

        function handleDragEnd(e) {
            this.classList.remove('dragging');
            
            // Remove drag-over class from all columns
            document.querySelectorAll('.kanban-column-body').forEach(column => {
                column.classList.remove('drag-over');
            });
        }

        function handleDragOver(e) {
            if (e.preventDefault) {
                e.preventDefault();
            }
            e.dataTransfer.dropEffect = 'move';
            return false;
        }

        function handleDragEnter(e) {
            this.classList.add('drag-over');
        }

        function handleDragLeave(e) {
            if (e.target === this) {
                this.classList.remove('drag-over');
            }
        }

        function handleDrop(e) {
            if (e.stopPropagation) {
                e.stopPropagation();
            }

            if (draggedCard !== this) {
                // Move the card to new column
                this.appendChild(draggedCard);
                
                // Update column badges
                updateKanbanBadges();
                
                // Log the status change
                const newStatus = this.closest('.kanban-column').dataset.status;
                const projectId = draggedCard.dataset.projectId;
                console.log(`Project ${projectId} moved to ${newStatus}`);
            }

            return false;
        }

        // Update badge counts for each column
        function updateKanbanBadges() {
            document.querySelectorAll('.kanban-column').forEach(column => {
                const badge = column.querySelector('.kanban-column-badge');
                const cardCount = column.querySelectorAll('.kanban-card').length;
                badge.textContent = cardCount;
            });
            
            // Update header stats
            updateKanbanStats();
        }

        // Update kanban statistics
        function updateKanbanStats() {
            const allCards = document.querySelectorAll('.kanban-card');
            const doneCards = document.querySelectorAll('.kanban-column.done .kanban-card');
            const backlogCards = document.querySelectorAll('.kanban-column.backlog .kanban-card');
            const todoCards = document.querySelectorAll('.kanban-column.todo .kanban-card');
            const inProgressCards = document.querySelectorAll('.kanban-column.in-progress .kanban-card');
            const reviewCards = document.querySelectorAll('.kanban-column.review .kanban-card');
            
            document.getElementById('totalProjects').textContent = allCards.length;
            document.getElementById('activeProjects').textContent = 
                todoCards.length + inProgressCards.length + reviewCards.length;
            document.getElementById('completedProjects').textContent = doneCards.length;
            
            // Count overdue (simplified - checking for red dates)
            const overdueCards = document.querySelectorAll('.kanban-card-due').length;
            document.getElementById('overdueProjects').textContent = overdueCards;
        }

        // Filter projects by type
        function filterProjects(filterType) {
            const filterButtons = document.querySelectorAll('.kanban-filter');
            const allCards = document.querySelectorAll('.kanban-card');
            
            // Update active filter button
            filterButtons.forEach(btn => {
                if (btn.dataset.filter === filterType) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            // Apply filter
            if (filterType === 'all') {
                allCards.forEach(card => card.style.display = 'block');
            } else if (filterType === 'active') {
                allCards.forEach(card => {
                    const isDone = card.closest('.kanban-column').dataset.status === 'done';
                    card.style.display = isDone ? 'none' : 'block';
                });
            } else if (filterType === 'completed') {
                allCards.forEach(card => {
                    const isDone = card.closest('.kanban-column').dataset.status === 'done';
                    card.style.display = isDone ? 'block' : 'none';
                });
            } else if (filterType === 'my') {
                // This would filter by current user - simplified version
                allCards.forEach(card => card.style.display = 'block');
            }
            
            updateKanbanBadges();
        }

        // Open new project modal (placeholder)
        function openNewProjectModal() {
            alert('New Project Modal - To be implemented\n\nThis would open a modal form to create a new project with:\n- Project name\n- Description\n- Priority level\n- Assigned team members\n- Due date\n- Tags');
        }

        // Initialize filter buttons
        function initializeKanbanFilters() {
            const filterButtons = document.querySelectorAll('.kanban-filter');
            filterButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    const filterType = this.dataset.filter;
                    filterProjects(filterType);
                });
            });
        }

        // Initialize kanban board when projects view is loaded
        document.addEventListener('DOMContentLoaded', function() {
            // Check if kanban board exists
            if (document.getElementById('kanbanBoard')) {
                initializeKanbanDragDrop();
                initializeKanbanFilters();
                updateKanbanStats();
            }
        });

        // Re-initialize when switching to projects view
        window.__onSwitchContentViewHooks = window.__onSwitchContentViewHooks || [];
        if (!window.__onSwitchContentViewHooks.some(h => h && h.__hookName === 'projectsKanbanInitHook')) {
            const hook = function(viewName) {
                if (viewName === 'projects') {
                    setTimeout(() => {
                        initializeKanbanDragDrop();
                        initializeKanbanFilters();
                        updateKanbanStats();
                    }, 100);
                }
            };
            hook.__hookName = 'projectsKanbanInitHook';
            window.__onSwitchContentViewHooks.push(hook);
        }

        