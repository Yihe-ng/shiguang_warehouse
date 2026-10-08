const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../../resources/GDOU/gdouyj.js'), 'utf8');
const entry = 'runImportFlow();';
assert.equal(source.split(entry).length, 2);

function loadAdapter(location, confirm) {
    const context = vm.createContext({
        window: { location, shiguangBridgePromise: { showAlert: confirm } },
        document: { getElementById: () => null }
    });
    vm.runInContext(source.replace(entry,
        'globalThis.adapter = { normalizeWfwPageHtml, openTimetableFromMobilePortal };'), context);
    return context.adapter;
}

test('normalizes both HTML URLs and escaped script paths without changing unrelated origins', () => {
    const adapter = loadAdapter({}, () => { throw new Error('No prompt expected'); });
    const html = '<script src="https://wfw.gdou.edu.cn/https://jw.gdou.edu.cn/js/a.js"></script>'
        + 'var p="https:\\/\\/wfw.gdou.edu.cn\\/https:\\/\\/jw.gdou.edu.cn";'
        + '<a href="https://jxpj.gdou.edu.cn/wx/">备用</a>';
    const result = adapter.normalizeWfwPageHtml(html, 'https://wfw.gdou.edu.cn');
    assert.ok(result.includes('src="https://wfw.gdou.edu.cn/js/a.js"'));
    assert.ok(result.includes('var p="https:\\/\\/wfw.gdou.edu.cn";'));
    assert.ok(result.includes('https://jxpj.gdou.edu.cn/wx/'));
    assert.ok(!result.includes('/https://jw.gdou.edu.cn'));
});

test('only opens the known WFW mobile application page', async () => {
    for (const location of [
        { hostname: 'jw.gdou.edu.cn', pathname: '/xtgl/index_cxAllApp.html' },
        { hostname: 'wfw.gdou.edu.cn', pathname: '/authserver/login' },
        { hostname: 'wfw.gdou.edu.cn', pathname: '/kbcx/xskbcx_cxXskbcxIndex.html' }
    ]) {
        const adapter = loadAdapter(location, () => { throw new Error('No prompt expected'); });
        assert.equal(await adapter.openTimetableFromMobilePortal(), false);
    }
});

test('canceling the page prompt stops before fetching or importing anything', async () => {
    let prompts = 0;
    const adapter = loadAdapter(
        { hostname: 'wfw.gdou.edu.cn', pathname: '/xtgl/index_cxAllApp.html' },
        async () => { prompts++; return false; }
    );
    assert.equal(await adapter.openTimetableFromMobilePortal(), true);
    assert.equal(prompts, 1);
});
