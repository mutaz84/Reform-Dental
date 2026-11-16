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