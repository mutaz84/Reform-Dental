const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const acorn = require('acorn');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'Update12152025_Manage Roles-Equimpent-Task-Insturments-Supplies-Scheduling System Updated.html'), 'utf8');
const sources = new Map();
let scriptCount = 0;
for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const source = match[1];
    const nodes = [acorn.parse(source, { ecmaVersion: 'latest' })];
    scriptCount++;
    while (nodes.length) {
        const node = nodes.pop();
        if (node.type === 'VariableDeclarator' && node.id?.name === 'allowedViewNames') {
            sources.set('allowedViewNames', [`const ${source.slice(node.start, node.end)};`]);
        }
        if (node.type === 'FunctionDeclaration' && node.id) {
            const declarations = sources.get(node.id.name) || [];
            declarations.push(source.slice(node.start, node.end));
            sources.set(node.id.name, declarations);
        }
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) nodes.push(...value.filter(item => item && typeof item.type === 'string'));
            else if (value && typeof value.type === 'string') nodes.push(value);
        }
    }
}

const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const layout = { id: 'rooms', name: 'Treatment rooms', columns: [
    { id: 'one', name: 'Room 1', active: true, color: '#0F5E75' },
    { id: 'two', name: 'Consultation', active: true, color: '#16803D' },
    { id: 'retired', name: 'Retired room', active: false, color: '#777777' }
] };

function contextFor(names, globals = {}) {
    const context = vm.createContext({ console, Date, ...globals });
    context.window = context;
    const code = names.map(name => {
        const declarations = sources.get(name) || [];
        assert.equal(declarations.length, 1, `${name} must have exactly one declaration`);
        return declarations[0];
    }).join('\n');
    vm.runInContext(code, context);
    return context;
}

function gridContext(scope = 'mine', mode = 'calendar') {
    return contextFor(['renderDashboardScheduleBody'], {
        dashboardCalendarScope: scope,
        dashboardCalendarViewMode: mode,
        dashboardCalendarDate: new Date('2026-11-15T00:00:00'),
        dashboardLocalDateIso: dateKey,
        escapeDashboardHtml: String,
        dashboardSelectedCalendarLayout: () => layout,
        getDashboardCalendarEntries: () => [],
        dashboardScheduleEntryHtml: entry => `<article data-test-event="${entry.id}">${entry.title}</article>`,
        renderDashboardMonthGridHtml: () => '<div data-month-grid></div>'
    });
}

test('all inline scripts parse, without duplicate calendar helpers', () => {
    assert(scriptCount >= 22);
    for (const name of ['renderDashboardScheduleBody', 'renderDashboardEventForm', 'dashboardCalendarLayouts', 'syncDashboardEventTypeFormControls']) {
        assert.equal(sources.get(name).length, 1);
    }
    assert.equal((html.match(/const buildVersion =/g) || []).length, 1);
    assert.equal((html.match(/id="calendarSettingsMenuItem"/g) || []).length, 1);
});

test('compact operation cards open the original record by click and keyboard without hijacking controls', () => {
    const entry = { id: 'ticket-7', kind: 'Service', equipmentId: 42 };
    const opened = [];
    const context = contextFor(['openDashboardOperationCard'], {
        getDashboardOperationEntryFromRow: () => entry,
        openDashboardOperationSource: source => opened.push(source)
    });
    const row = { closest: () => null };
    const event = { type: 'click', target: row, preventDefault() {}, stopPropagation() {} };
    context.openDashboardOperationCard(row, event);
    context.openDashboardOperationCard(row, { ...event, type: 'keydown', key: 'Enter' });
    context.openDashboardOperationCard(row, { ...event, type: 'keydown', key: ' ' });
    assert.equal(opened.length, 3);
    assert(opened.every(source => source === entry));
    context.openDashboardOperationCard(row, { ...event, target: { closest: () => ({}) } });
    context.openDashboardOperationCard(row, { ...event, type: 'keydown', key: 'Tab' });
    assert.equal(opened.length, 3);
});

test('original operation source resolves the service ticket rather than a dashboard preview', () => {
    const opened = [];
    const context = contextFor(['openDashboardOperationSource'], {
        loadEquipmentServiceTickets: () => [{ id: 'ticket-7', equipmentID: 42 }],
        openEquipmentServiceDetails: (...args) => opened.push(args)
    });
    context.openDashboardOperationSource({ kind: 'Service', id: 'ticket-7', equipmentId: 42 });
    context.openDashboardOperationSource({ kind: 'Equipment', id: 42, serviceTicketId: 'ticket-7', equipmentId: 42 });
    assert.deepEqual(opened, [['ticket-7', 42], ['ticket-7', 42]]);
});

test('calendar item click focuses its dashboard card instead of opening the right-rail story', () => {
    const calls = [];
    const row = {
        dataset: { entryKind: 'Service', entryId: 'ticket-7', serviceTicketId: 'ticket-7' },
        getBoundingClientRect: () => ({ top: 420 }), offsetHeight: 60,
        focus: options => calls.push(['focus', options]),
        classList: { remove: value => calls.push(['remove', value]), add: value => calls.push(['add', value]) }
    };
    const panel = { scrollTop: 0, clientHeight: 300, getBoundingClientRect: () => ({ top: 100 }) };
    const root = { querySelectorAll: () => [row], querySelector: () => panel };
    const story = { remove: () => calls.push(['remove-story']) };
    const context = contextFor(['focusDashboardOperationCard'], {
        document: { getElementById: () => story },
        getActiveOperationsDashboardRoot: () => root,
        openDashboardOperationSource: () => calls.push(['open-source']),
        setTimeout: callback => callback()
    });
    assert.equal(context.focusDashboardOperationCard({ kind: 'Service', id: 'ticket-7', serviceTicketId: 'ticket-7' }), true);
    assert(calls.some(([name]) => name === 'remove-story'));
    assert(calls.some(([name, value]) => name === 'focus' && value.preventScroll));
    assert(!calls.some(([name]) => name === 'open-source'));
    assert.equal(panel.scrollTop, 200);
});

test('calendar event move preserves duration and persists through the event API', async () => {
    const events = [{ id: 'event-4', kind: 'meeting', dashboardScope: 'office', start: '2026-11-15T09:00:00.000Z', end: '2026-11-15T10:30:00.000Z' }];
    const updates = [];
    const stored = [];
    let refreshed = 0;
    const context = contextFor(['moveDashboardCalendarEvent'], {
        dashboardCalendarReadArray: () => events,
        updateEventViaApi: async (id, record) => updates.push([id, record]),
        localStorage: { setItem: (key, value) => stored.push([key, JSON.parse(value)]) },
        dashboardCalendarDate: new Date('2026-11-15T00:00:00'),
        showDashboardScheduleUndo() {},
        refreshDashboardScheduleSurfaces: () => { refreshed++; },
        showNotification() {}
    });
    context.window.updateEventList = () => {};
    context.window.calendarInstance = { refetchEvents() {} };
    assert.equal(await context.moveDashboardCalendarEvent({ id: 'event-4' }, '2026-11-18', '13:15'), true);
    assert.equal(updates[0][0], 'event-4');
    assert.equal(new Date(updates[0][1].start).getHours(), 13);
    assert.equal(new Date(updates[0][1].start).getMinutes(), 15);
    assert.equal(Date.parse(updates[0][1].end) - Date.parse(updates[0][1].start), 90 * 60 * 1000);
    assert.equal(stored[0][1][0].start, updates[0][1].start);
    assert.equal(refreshed, 1);
});

test('calendar drop updates existing items and leaves unscheduled items on the date-time picker path', async () => {
    const calls = [];
    const context = contextFor(['applyDashboardCalendarDrop'], {
        moveDashboardCalendarEvent: async (...args) => { calls.push(['event', ...args]); return true; },
        dashboardScheduleOperationSnapshot: () => ({ record: { scheduleDate: '2026-11-15' } }),
        showDashboardScheduleUndo: (...args) => calls.push(['undo', ...args]),
        scheduleDashboardOperationFromDrop: (...args) => { calls.push(['operation', ...args]); return true; },
        refreshDashboardScheduleSurfaces() {}, showNotification() {},
        dashboardCalendarDate: new Date('2026-11-15T00:00:00')
    });
    context.window.openDashboardSchedulePicker = (...args) => calls.push(['picker', ...args]);
    await context.applyDashboardCalendarDrop({ source: 'calendar-event', id: 'event-4' }, { date: '2026-11-18', time: '13:15' });
    assert.equal(calls[0][0], 'event');
    assert.equal(calls[0][2], '2026-11-18');
    assert.equal(calls[0][3], '13:15');
    await context.applyDashboardCalendarDrop({ source: 'calendar-operation', kind: 'Service', id: 'ticket-7' }, { date: '2026-11-18', time: '14:00' });
    assert.equal(calls[1][0], 'operation');
    await context.applyDashboardCalendarDrop({ kind: 'Service', id: 'ticket-8' }, { date: '2026-11-18', time: '15:00' });
    assert.equal(calls[2][0], 'undo');
    assert.equal(calls[3][0], 'picker');
});

test('calendar Undo restores only the saved event record and syncs its prior state', async () => {
    const events = [{ id: 'event-4', title: 'Moved event', start: '2026-11-18T13:15:00.000Z', end: '2026-11-18T14:45:00.000Z' }, { id: 'other', title: 'Leave alone' }];
    const original = { id: 'event-4', title: 'Moved event', start: '2026-11-15T09:00:00.000Z', end: '2026-11-15T10:30:00.000Z', description: 'Original details' };
    const writes = [];
    const apiUpdates = [];
    let refreshed = 0;
    const context = contextFor(['undoDashboardScheduleChange'], {
        dashboardScheduleUndoState: { type: 'calendar-event', id: 'event-4', record: original },
        dashboardCalendarReadArray: () => events,
        updateEventViaApi: async (id, record) => apiUpdates.push([id, record]),
        localStorage: { setItem: (key, value) => writes.push([key, JSON.parse(value)]) },
        refreshDashboardScheduleSurfaces: () => { refreshed++; },
        syncDashboardScheduleUndoButton() {},
        showNotification() {}
    });
    context.window.undoDashboardScheduleChange = context.undoDashboardScheduleChange;
    context.window.updateEventList = () => {};
    context.window.calendarInstance = { refetchEvents() {} };
    const toast = { remove() {} };
    context.document = { getElementById: () => toast };
    assert.equal(await context.undoDashboardScheduleChange(), true);
    assert.equal(apiUpdates[0][0], 'event-4');
    assert.equal(apiUpdates[0][1].start, original.start);
    assert.equal(writes[0][1][0].description, 'Original details');
    assert.equal(writes[0][1][1].title, 'Leave alone');
    assert.equal(refreshed, 1);
});

test('calendar Undo state enables every visible calendar toolbar button', () => {
    const buttons = [{ disabled: true, setAttribute(name, value) { this[name] = value; } }, { disabled: true, setAttribute(name, value) { this[name] = value; } }];
    const context = contextFor(['syncDashboardScheduleUndoButton'], {
        dashboardScheduleUndoState: { type: 'calendar-event' },
        document: { querySelectorAll: () => buttons }
    });
    context.syncDashboardScheduleUndoButton();
    assert.deepEqual(buttons.map(button => button.disabled), [false, false]);
    assert(buttons.every(button => button['aria-label'] === 'Calendar changed. Undo the last change.'));
    assert(buttons.every(button => button.title === 'Calendar changed. Undo the last change.'));
});

test('recording a calendar change enables Undo in every calendar instance', () => {
    const buttons = [{ disabled: true, setAttribute(name, value) { this[name] = value; } }, { disabled: true, setAttribute(name, value) { this[name] = value; } }];
    const context = contextFor(['showDashboardScheduleUndo', 'syncDashboardScheduleUndoButton'], {
        document: { getElementById: () => null, querySelectorAll: () => buttons }
    });
    context.showDashboardScheduleUndo({ type: 'calendar-event', id: 'event-4' }, 'Calendar event moved');
    assert.deepEqual(buttons.map(button => button.disabled), [false, false]);
    assert(buttons.every(button => button.title.includes('Calendar event moved')));
});

test('operation Undo restores the prior service ticket without reverting other records', async () => {
    const records = [{ id: 'ticket-7', scheduleDate: '2026-11-18', scheduledTime: '14:30' }, { id: 'ticket-8', scheduleDate: '2026-11-20' }];
    const original = { id: 'ticket-7', scheduleDate: '', scheduledTime: '', status: 'Open' };
    const writes = [];
    const synced = [];
    const context = contextFor(['undoDashboardScheduleChange'], {
        dashboardScheduleUndoState: { type: 'operation', storageKey: 'equipmentServiceTickets', identity: 'ticket-7', record: original, payload: { kind: 'Service', id: 'ticket-7' } },
        dashboardCalendarReadArray: () => records,
        localStorage: { setItem: (key, value) => writes.push([key, JSON.parse(value)]) },
        syncDashboardServiceScheduleToApi: async payload => { synced.push(payload.id); return true; },
        syncDashboardScheduleUndoButton() {},
        refreshDashboardScheduleSurfaces() {}, showNotification() {}
    });
    context.window.undoDashboardScheduleChange = context.undoDashboardScheduleChange;
    context.document = { getElementById: () => ({ remove() {} }) };
    assert.equal(await context.undoDashboardScheduleChange(), true);
    assert.deepEqual(writes[0][1], [original, records[1]]);
    assert.deepEqual(synced, ['ticket-7']);
});

test('calendar typography matches rail label/value colors and sizes within the calendar only', () => {
    const attached = [];
    const context = contextFor(['ensureDashboardCalendarTypography'], {
        document: {
            getElementById: id => attached.find(style => style.id === id) || null,
            createElement: () => ({ id: '', textContent: '' }),
            head: { appendChild: style => attached.push(style) }
        }
    });
    context.ensureDashboardCalendarTypography();
    context.ensureDashboardCalendarTypography();
    assert.equal(attached.length, 1);
    assert(attached[0].textContent.includes('color:#64748b'));
    assert(attached[0].textContent.includes('color:#111827'));
    assert(attached[0].textContent.includes('font-size:.625rem'));
    assert(attached[0].textContent.includes('.rd-calendar-time-grid'));
    assert(!attached[0].textContent.includes('.unified-right-rail'));
});

test('calendar drag payload preserves source identifiers and blocks unauthorized event moves', () => {
    const payloads = [];
    let prevented = false;
    const transfer = { setData: (type, value) => { if (type === 'application/x-rd-dashboard-operation') payloads.push(JSON.parse(value)); }, effectAllowed: '' };
    const context = contextFor(['startDashboardScheduledDrag'], {
        getDashboardCalendarEntryFromCard: card => card.entry,
        dashboardOperationSchedulePayload: entry => ({ id: entry.id, kind: entry.kind, serviceTicketId: entry.serviceTicketId, title: entry.title }),
        dashboardCalendarEntryCanModify: () => false
    });
    const operationCard = { entry: { kind: 'Service', id: 'ticket-7', title: 'Repair', start: new Date('2026-11-15T09:00:00'), serviceTicketId: 'ticket-7' } };
    context.startDashboardScheduledDrag({ currentTarget: {}, target: { closest: () => operationCard }, dataTransfer: transfer });
    assert.equal(payloads[0].source, 'calendar-operation');
    assert.equal(payloads[0].serviceTicketId, 'ticket-7');
    const blockedContext = contextFor(['startDashboardScheduledDrag'], {
        getDashboardCalendarEntryFromCard: () => ({ kind: 'Calendar', id: 'event-4', title: 'Meeting', start: new Date('2026-11-15T09:00:00'), end: new Date('2026-11-15T10:00:00') }),
        dashboardCalendarEntryCanModify: () => false
    });
    const eventCard = { entry: { kind: 'Calendar', id: 'event-4', title: 'Meeting', start: new Date('2026-11-15T09:00:00'), end: new Date('2026-11-15T10:00:00') } };
    blockedContext.startDashboardScheduledDrag({ currentTarget: {}, target: { closest: () => eventCard }, dataTransfer: transfer, preventDefault: () => { prevented = true; } });
    assert(prevented);
    assert.equal(payloads.length, 1);
});

test('scheduled cards enable dragging only for operations or calendar events the user can edit', () => {
    const cards = [
        { dataset: { dashboardScheduledOperation: 'true' }, entry: { kind: 'Service' }, draggable: false },
        { dataset: { dashboardScheduledOperation: 'false' }, entry: { kind: 'Calendar', owner: true }, draggable: false },
        { dataset: { dashboardScheduledOperation: 'false' }, entry: { kind: 'Calendar', owner: false }, draggable: true },
        { dataset: { dashboardScheduledOperation: 'false' }, entry: { kind: 'Assignment' }, draggable: true }
    ];
    const context = contextFor(['enableDashboardScheduledCardDragging'], {
        getDashboardCalendarEntryFromCard: card => card.entry,
        dashboardCalendarEntryCanModify: entry => entry.owner === true
    });
    context.enableDashboardScheduledCardDragging({ querySelectorAll: () => cards });
    assert.deepEqual(cards.map(card => card.draggable), [true, true, false, false]);
});

test('operation cards retain metadata and an accessible icon schedule action in their own scroll container', () => {
    const context = contextFor(['dashboardOperationRowHtml', 'renderDashboardAttentionPanel'], {
        dashboardTypeClass: () => ({ cls: 'office', icon: 'fas fa-mug-hot' }),
        dashboardPriority: () => 'Medium', dashboardStatus: () => 'Pending',
        dashboardSentenceCase: String, dashboardOperationIsOverdue: () => false,
        dashboardOverdueDays: () => 2, dashboardScheduleDateOnly: () => '',
        dashboardScheduleText: () => '', dashboardScheduleTimeLabel: () => '',
        dashboardEntryAttrs: entry => `data-entry-id="${entry.id}"`,
        dashboardMetaHtml: () => 'Office improvements / Unassigned', escapeDashboardHtml: String
    });
    const entries = Array.from({ length: 30 }, (_, index) => ({ id: index + 1, title: `Refill stock ${index + 1}`, scheduleState: 'unscheduled' }));
    const output = context.renderDashboardAttentionPanel({ overdue: [], unscheduled: entries });
    assert.equal((output.match(/rd-dashboard-row rd-ops-row rd-ops-compact-row/g) || []).length, 30);
    assert(output.includes('onclick="window.openDashboardOperationCard(this,event)"'));
    assert(output.includes('aria-label="Schedule Refill stock 1"'));
    assert(output.includes('fa-calendar-plus'));
    assert(output.includes('overscroll-behavior-y:contain'));
    assert(output.includes('overflow-y:auto'));
    assert(output.includes('Office improvements / Unassigned'));
    assert(!output.includes('>Schedule</button>'));
});

test('dashboard refresh preserves the independent operation list scroll position', () => {
    const previous = { scrollTop: 237 };
    const updated = { scrollTop: 0 };
    let replaced = false;
    Object.defineProperty(previous, 'outerHTML', { set() { replaced = true; } });
    const root = { querySelector: selector => selector === '#dashboardAttentionPanel' ? (replaced ? updated : previous) : null };
    const context = contextFor(['refreshOperationsDashboardRedesign'], {
        getActiveOperationsDashboardRoot: () => root, dashboardBuildModel: () => ({}),
        renderDashboardAttentionPanel: () => '<div></div>', renderDashboardScheduleCard() {},
        renderDashboardAttendanceCard() {}, renderDashboardHeaderSearchResults() {}
    });
    context.refreshOperationsDashboardRedesign(root);
    assert.equal(updated.scrollTop, 237);
});

test('operation panel tracks the calendar height without duplicate observers', () => {
    let height = 812;
    let callback;
    let observers = 0;
    let disconnected = false;
    const properties = new Map();
    const calendar = { getBoundingClientRect: () => ({ height }) };
    const root = { isConnected: true, querySelector: () => calendar, style: { setProperty: (name, value) => properties.set(name, value) } };
    const context = contextFor(['syncDashboardOperationPanelHeight'], {
        ResizeObserver: class {
            constructor(handler) { callback = handler; observers++; }
            observe(target) { assert.equal(target, calendar); }
            disconnect() { disconnected = true; }
        }
    });
    context.syncDashboardOperationPanelHeight(root);
    assert.equal(properties.get('--dashboard-calendar-panel-height'), '812px');
    height = 1036;
    callback();
    assert.equal(properties.get('--dashboard-calendar-panel-height'), '1036px');
    context.syncDashboardOperationPanelHeight(root);
    assert.equal(observers, 1);
    height = 0;
    callback();
    assert.equal(properties.get('--dashboard-calendar-panel-height'), '1036px');
    root.isConnected = false;
    callback();
    assert(disconnected);
});

test('starter navigation opens Calendar Settings while retaining restrictions on other views', () => {
    const navigated = [];
    const context = contextFor(['allowedViewNames', 'installSwitchGuard'], {
        switchContentView: (...args) => { navigated.push(args); return true; }
    });
    context.installSwitchGuard();
    assert.equal(context.switchContentView('manage-calendar-settings', null, { force: true }), true);
    assert.equal(navigated[0][0], 'manage-calendar-settings');
    assert.equal(navigated[0][2].force, true);
    assert.equal(context.switchContentView('stationary'), false);
    assert.equal(navigated.length, 1);
});

test('empty day and week views retain headers and half-hour cells', () => {
    for (const [scope, mode, count] of [['mine', 'calendar', 1], ['office', 'calendar', 3], ['mine', 'week', 7]]) {
        const context = gridContext(scope, mode);
        const output = context.renderDashboardScheduleBody([], '2026-11-15');
        assert.equal((output.match(/data-dashboard-calendar-dropzone/g) || []).length, count);
        assert.equal((output.match(/data-calendar-time=/g) || []).length, count * 48);
        assert(output.includes('Time'));
        assert(!output.includes('Nothing scheduled'));
        assert(!output.includes('Retired room'));
    }
});

test('month remains a date grid and list retains its empty state', () => {
    const context = gridContext('mine', 'month');
    assert(context.renderDashboardScheduleBody([], '2026-11-15').includes('data-month-grid'));
    context.dashboardCalendarViewMode = 'list';
    assert(context.renderDashboardScheduleBody([], '2026-11-15').includes('Nothing scheduled'));
});

test('office assignment, retired-column fallback, and overlaps never duplicate events', () => {
    const context = gridContext('office');
    const entries = ['one', 'one', 'retired', 'missing'].map((column, index) => ({
        id: `event-${index}`, title: `Event ${index}`,
        start: new Date('2026-11-15T09:00:00'), end: new Date('2026-11-15T10:00:00'),
        record: { calendarLayoutId: 'rooms', calendarColumnId: column }
    }));
    const output = context.renderDashboardScheduleBody(entries, '2026-11-15');
    for (const entry of entries) assert.equal(output.split(`data-test-event="${entry.id}"`).length - 1, 1);
    assert(output.includes('width:calc(50% - 6px)'));
    assert(output.includes('data-calendar-column="rooms:one"'));
});

test('grid click and drop slots preserve the lane date and midnight', () => {
    const context = contextFor(['getDashboardCalendarDropSlot'], { dashboardCalendarDate: new Date('2026-11-15T00:00:00'), dashboardLocalDateIso: dateKey });
    const lane = { dataset: { calendarDate: '2026-11-18', calendarStartHour: '0', calendarEndHour: '24' }, getBoundingClientRect: () => ({ top: 0, height: 1536 }) };
    assert.equal(context.getDashboardCalendarDropSlot({ type: 'drop', clientY: 0 }, lane).time, '00:00');
    assert.equal(context.getDashboardCalendarDropSlot({ type: 'drop', clientY: 576 }, lane).time, '09:00');
    const slot = context.getDashboardCalendarDropSlot({ type: 'click', clientY: 0, target: { closest: () => ({ dataset: { calendarTime: '10:30' } }) } }, lane);
    assert.equal(slot.date, '2026-11-18');
    assert.equal(slot.time, '10:30');
    assert.equal(context.getDashboardCalendarDropSlot({ type: 'drop', clientY: 310, target: { closest: () => ({ dataset: { calendarTime: '14:30' } }) } }, lane).time, '14:30');
});

test('personal scope hides people and columns, and clears selected people', () => {
    const elements = { dashboardEventScope: { value: 'mine' }, dashboardEventColumnField: { style: {} } };
    const picker = { style: {}, hidden: false };
    let cleared = false;
    const context = contextFor(['dashboardEventFormScope', 'syncDashboardEventScopeFormControls'], {
        document: { getElementById: id => elements[id], querySelectorAll: () => [], querySelector: () => picker },
        updateDashboardEventPeoplePicker: value => { cleared = value === ''; }
    });
    context.syncDashboardEventScopeFormControls(true);
    assert.equal(picker.hidden, true);
    assert.equal(elements.dashboardEventColumnField.style.display, 'none');
    assert(cleared);
    elements.dashboardEventScope.value = 'office';
    context.syncDashboardEventScopeFormControls();
    assert.equal(picker.hidden, false);
});

test('single-date and date-range modes show and preserve the correct dates', () => {
    const elements = Object.fromEntries(['dashboardEventType', 'dashboardEventDate', 'dashboardEventEndDate', 'dashboardEventStart', 'dashboardEventEnd', 'dashboardEventDateMode'].map(id => [id, { style: {}, value: '' }]));
    elements.dashboardEventDate.value = '2026-11-15';
    elements.dashboardEventEndDate.value = '2026-11-18';
    elements.dashboardEventDateMode.value = 'range';
    const context = contextFor(['dashboardEventDateMode', 'syncDashboardEventTypeFormControls'], {
        document: { getElementById: id => elements[id], querySelectorAll: () => [] },
        syncDashboardEventScopeFormControls: () => {}, updateDashboardEventTypePicker: () => {}
    });
    context.syncDashboardEventTypeFormControls(true);
    assert.equal(elements.dashboardEventEndDate.value, '2026-11-18');
    assert.equal(elements.dashboardEventEndDate.required, true);
    elements.dashboardEventDateMode.value = 'single';
    context.syncDashboardEventTypeFormControls(true);
    assert.equal(elements.dashboardEventEndDate.style.display, 'none');
    assert.equal(elements.dashboardEventEndDate.value, '2026-11-15');
});

test('calendar settings retry reloads a docked editor and displays server errors safely', async () => {
    let attempts = 0;
    let renders = 0;
    const host = { textContent: '', innerHTML: '', prepend(node) { this.message = node.textContent; } };
    const context = contextFor(['loadDashboardCalendarSettingsEditor'], {
        document: { getElementById: () => host, createElement: () => ({ textContent: '' }) },
        canManageDashboardCalendarLayouts: () => true,
        dashboardCalendarDraftClinic: 7,
        dashboardCalendarClinicId: () => 7,
        dashboardCalendarLayoutsKey: () => 'clinic-7',
        dashboardCalendarLayoutsCache: new Map([['clinic-7', { error: 'Database <unavailable>' }]]),
        loadDashboardCalendarLayouts: async () => ++attempts > 1,
        dashboardCalendarLayouts: () => [layout],
        renderDashboardCalendarSettingsEditor: () => { renders++; }
    });
    await context.loadDashboardCalendarSettingsEditor();
    assert.equal(host.message, 'Database <unavailable>');
    assert(host.innerHTML.includes('window.retryDashboardCalendarSettings()'));
    assert(!host.innerHTML.includes('window.openDashboardCalendarSettings()'));
    await context.loadDashboardCalendarSettingsEditor();
    assert.equal(attempts, 2);
    assert.equal(renders, 1);
});

test('event API payload and response retain column IDs and timed ranges', () => {
    const context = contextFor(['mapCalendarEventToApiPayload', 'mapApiEventToCalendarEvent'], {
        normalizeEventAttendees: value => value,
        getCalendarEventRange: () => ({ startKey: '2026-11-15' }),
        getEventCategory: () => 'general',
        getCalendarEventTypeConfig: () => ({ dateMode: 'single_timed' }),
        isCalendarEventAllDayOrRange: () => true
    });
    const payload = context.mapCalendarEventToApiPayload({ title: 'Review', type: 'meeting', dashboardScope: 'office', calendarLayoutId: 'rooms', calendarColumnId: 'one', start: '2026-11-15T09:00:00Z', end: '2026-11-18T10:00:00Z', attendees: [] });
    assert.equal(payload.allDay, false);
    assert.equal(payload.calendarLayoutId, 'rooms');
    const restored = context.mapApiEventToCalendarEvent({ id: 8, ...payload });
    assert.equal(restored.calendarColumnId, 'one');
    assert.equal(restored.end, payload.endDateTime);
});

test('timed multi-day events are clipped rather than converted to all-day', () => {
    const events = [{ id: 'range', title: 'Range', start: '2026-11-15T09:00:00', end: '2026-11-17T10:00:00', allDay: false }];
    const context = contextFor(['getDashboardCalendarEntries'], {
        dashboardCalendarReadArray: key => key === 'calendarEvents' ? events : [],
        dashboardLocalDateIso: dateKey, getDashboardOwnershipKeys: () => [], getDashboardEventScopeMap: () => ({}),
        dashboardScheduleDateOnly: value => String(value).slice(0, 10), dashboardScheduleTimeOnly: value => String(value).slice(11, 16),
        dashboardCalendarScopeState: () => ({ isMine: true, isOffice: false }), dashboardEventAttendeesText: () => ''
    });
    const first = context.getDashboardCalendarEntries(new Date('2026-11-15T00:00:00'))[0];
    const middle = context.getDashboardCalendarEntries(new Date('2026-11-16T00:00:00'))[0];
    const last = context.getDashboardCalendarEntries(new Date('2026-11-17T00:00:00'))[0];
    assert.equal(first.start.getHours(), 9);
    assert.equal(first.end.getDate(), 16);
    assert.equal(first.allDay, false);
    assert.equal(middle.start.getHours(), 0);
    assert.equal(last.end.getHours(), 10);
    assert.equal(context.getDashboardCalendarEntries(new Date('2026-11-18T00:00:00')).length, 0);
});

function settingsHandler(role = 'admin', visibleClinic = 7, options = {}) {
    const writes = [];
    let closeCount = 0;
    const rows = [{ SettingKey: 'calendarLayouts:clinic:7', SettingValue: JSON.stringify([layout]) }, { SettingKey: 'calendarLayouts:clinic:8', SettingValue: '[{"name":"Private clinic"}]' }];
    const pool = {
        request() {
            const inputs = {};
            return {
                input(name, type, value) { inputs[name] = value; return this; },
                async query(query) {
                    if (options.noSubscriptionColumn && query.includes('SELECT TOP 1 SubscriptionId')) throw new Error("Invalid column name 'SubscriptionId'.");
                    if (query.includes('SELECT TOP 1 Role')) return { recordset: [{ Role: role }] };
                    if (query.includes('SELECT SettingKey')) return { recordset: rows };
                    if (query.includes('IF EXISTS')) writes.push({ ...inputs });
                    return { recordset: [] };
                }
            };
        },
        async close() { closeCount++; }
    };
    const sql = { connect: async () => pool, NVarChar: () => 'nvarchar', Int: 'int' };
    const context = vm.createContext({ module: { exports: {} }, require: name => name === 'mssql' ? sql : name === '../shared/database' ? { sql, getPool: async () => pool } : { getRequestUserId: () => 12, isPlatformAdmin: async () => false, resolveVisibleClinicId: async () => visibleClinic }, process: { env: {} }, console });
    vm.runInContext(fs.readFileSync(path.join(root, 'api/settings/index.js'), 'utf8'), context);
    return { handler: context.module.exports, writes, closeCount: () => closeCount };
}

test('calendar settings do not depend on subscription schema', async () => {
    const { handler } = settingsHandler('admin', 7, { noSubscriptionColumn: true });
    const context = { log: { error() {} } };
    await handler(context, { method: 'GET', query: { calendarClinicId: '7' } });
    assert.equal(context.res.status, 200);
    assert.equal(context.res.body.calendarLayouts[0].id, 'rooms');
});

test('overlapping settings requests leave the managed database pool open', async () => {
    const { handler, closeCount } = settingsHandler();
    const contexts = [{ log: { error() {} } }, { log: { error() {} } }];
    await Promise.all(contexts.map(context => handler(context, { method: 'GET', query: { calendarClinicId: '7' } })));
    assert(contexts.every(context => context.res.status === 200));
    assert.equal(closeCount(), 0);
});

test('layout settings reads are clinic-scoped and never expose other clinics', async () => {
    const { handler } = settingsHandler();
    const context = { log: { error: assert.fail } };
    await handler(context, { method: 'GET', query: { calendarClinicId: '7' } });
    assert.equal(context.res.status, 200);
    assert.equal(context.res.body.calendarLayouts[0].name, 'Treatment rooms');
    assert(!JSON.stringify(context.res.body).includes('Private clinic'));
    await handler(context, { method: 'GET', query: {} });
    assert.equal(context.res.body.calendarLayouts, undefined);
});

test('calendar settings preflight permits event identity headers', async () => {
    const { handler } = settingsHandler();
    const context = {};
    await handler(context, { method: 'OPTIONS' });
    assert.equal(context.res.status, 204);
    for (const header of ['X-User-Id', 'X-Username', 'X-User-Name', 'X-User-Email']) assert(context.res.headers['Access-Control-Allow-Headers'].includes(header));
});

test('layout settings reject non-admins, invalid payloads, and inaccessible clinics', async () => {
    for (const [role, clinic, layouts, status] of [['employee', 7, [layout], 403], ['admin', 8, [layout], 403], ['admin', 7, [{ id: 'invalid' }], 400]]) {
        const { handler, writes } = settingsHandler(role, clinic);
        const context = { log: { error: assert.fail } };
        await handler(context, { method: 'POST', query: {}, body: { calendarClinicId: 7, calendarLayouts: layouts } });
        assert.equal(context.res.status, status);
        assert.equal(writes.length, 0);
    }
});

test('admin layout saves persist only under the resolved clinic key', async () => {
    const { handler, writes } = settingsHandler();
    const context = { log: { error: assert.fail } };
    await handler(context, { method: 'POST', query: {}, body: { calendarClinicId: 7, calendarLayouts: [layout] } });
    assert.equal(context.res.status, 200);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].key, 'calendarLayouts:clinic:7');
    assert.equal(JSON.parse(writes[0].value)[0].columns[0].id, 'one');
});

test('live event handler persists column assignments through create, read, and update', async () => {
    const calls = [];
    const columns = ['Id', 'Title', 'Description', 'EventType', 'StartDateTime', 'EndDateTime', 'AllDay', 'CreatedBy', 'OrganizerUserId', 'DashboardScope', 'CalendarLayoutId', 'CalendarColumnId', 'ClinicId'];
    let row = null;
    const pool = {
        request() {
            const inputs = {};
            return {
                input(name, type, value) { inputs[name] = value; return this; },
                async query(query) {
                    calls.push({ query, inputs });
                    if (query.includes('INFORMATION_SCHEMA')) return { recordset: (inputs.tableName === 'Events' ? columns : []).map(name => ({ COLUMN_NAME: name })) };
                    if (query.includes('INSERT INTO Events')) {
                        row = { Id: 44 };
                        const names = query.match(/INSERT INTO Events \(([^)]+)\)/)[1].split(', ');
                        const params = query.match(/VALUES \(([^)]+)\)/)[1].split(', ');
                        names.forEach((name, index) => { row[name] = inputs[params[index].slice(1)]; });
                        return { recordset: [{ Id: 44 }] };
                    }
                    if (query.includes('UPDATE Events')) {
                        for (const match of query.matchAll(/(\w+)\s*=\s*@(\w+)/g)) if (match[1] !== 'Id') row[match[1]] = inputs[match[2]];
                        return { recordset: [] };
                    }
                    if (query.includes('e.*') || query.includes('SELECT TOP 1 Id,')) return { recordset: row ? [row] : [] };
                    return { recordset: [] };
                }
            };
        }
    };
    const sql = { NVarChar: () => 'nvarchar', Int: 'int', DateTime2: 'datetime', Bit: 'bit' };
    const context = vm.createContext({ module: { exports: {} }, Date, console, require: name => name === '../shared/database' ? { sql, getPool: async () => pool, resetPool: () => {} } : {
        getRequestUserId: () => 12, tenantClinicScopeSql: () => '1=1', resolveWritableClinicId: async () => 7, TENANT_PARAM: '_tenantUserId'
    } });
    vm.runInContext(fs.readFileSync(path.join(root, 'api/events/index.js'), 'utf8'), context);
    const handler = context.module.exports;
    const requestContext = { log: { error: assert.fail } };
    const body = { title: 'Review', eventType: 'meeting', startDateTime: '2026-11-15T09:00:00Z', endDateTime: '2026-11-15T10:00:00Z', organizerUserId: 12, createdBy: 12, dashboardScope: 'office', calendarLayoutId: 'rooms', calendarColumnId: 'one', clinicId: 7 };
    await handler(requestContext, { method: 'POST', params: {}, query: {}, body });
    assert.equal(requestContext.res.status, 201);
    assert.equal(row.CalendarLayoutId, 'rooms');
    assert.equal(row.CalendarColumnId, 'one');
    const dedupe = calls.find(call => call.query.includes('ORDER BY Id ASC'));
    assert(dedupe.query.includes('CalendarColumnId = @CalendarColumnId'));
    await handler(requestContext, { method: 'GET', params: { id: '44' }, query: {} });
    assert.equal(requestContext.res.body.calendarColumnId, 'one');
    await handler(requestContext, { method: 'PUT', params: { id: '44' }, query: {}, body: { ...body, calendarColumnId: 'two' } });
    assert.equal(requestContext.res.status, 200);
    await handler(requestContext, { method: 'GET', params: { id: '44' }, query: {} });
    assert.equal(requestContext.res.body.calendarColumnId, 'two');
});