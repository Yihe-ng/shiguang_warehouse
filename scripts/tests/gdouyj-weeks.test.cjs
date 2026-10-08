const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../../resources/GDOU/gdouyj.js'), 'utf8');
const entry = 'runImportFlow();';
assert.equal(source.split(entry).length, 2, 'Only replace the import entry point');
const context = vm.createContext({ console: { log() {}, warn() {} } });
vm.runInContext(source.replace(entry, 'globalThis.adapter = { parseWeeks, parseJsonData };'), context);
const { parseWeeks, parseJsonData } = context.adapter;
const plain = value => JSON.parse(JSON.stringify(value));

test('single-week rows returned with 第N周 retain their scheduled week', () => {
    assert.deepEqual(plain(parseWeeks('第9周')), [9]);
    assert.deepEqual(plain(parseWeeks('第15周')), [15]);
    assert.deepEqual(plain(parseWeeks('第 3 周')), [3]);
});

test('existing ranges, odd/even weeks and mixed lists remain compatible', () => {
    assert.deepEqual(plain(parseWeeks('1-5周(单),第9周，15周')), [1, 3, 5, 9, 15]);
    assert.deepEqual(plain(parseWeeks('2-6周(双)')), [2, 4, 6]);
    assert.deepEqual(plain(parseWeeks('')), []);
});

test('one-off and rescheduled rows survive parsing at distinct days and times', () => {
    const result = plain(parseJsonData({ kbList: [
        { kcmc: '测试课程', xqj: '1', jcs: '3-4', zcd: '第15周', cdmc: '慎思楼A101' },
        { kcmc: '测试课程', xqj: '2', jcs: '5-6', zcd: '第9周', cdmc: '慎思楼A101' },
        { kcmc: '测试劳动教育', xqj: '2', jcs: '9-10', zcd: '第9周', cdmc: '慎思楼A203' }
    ] }));
    assert.equal(result.length, 3);
    assert.deepEqual(result.map(c => [c.day, c.startSection, c.endSection, c.weeks]), [
        [1, 3, 4, [15]], [2, 5, 6, [9]], [2, 9, 10, [9]]
    ]);
});

test('single-week parsing retains the existing other-venue custom time', () => {
    const result = plain(parseJsonData({ kbList: [
        { kcmc: '测试课程', xqj: '6', jcs: '3-4', zcd: '第6周', cdmc: '博学楼B202' }
    ] }));
    assert.equal(result.length, 1);
    assert.equal(result[0].isCustomTime, true);
    assert.equal(result[0].customStartTime, '10:10');
    assert.equal(result[0].customEndTime, '11:40');
});
