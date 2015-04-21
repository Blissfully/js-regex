/*global test,regex,strictEqual,module*/

module('fromRegex');

test('simple RegExp', function () {
    'use strict';
    regex()
        .regex(/abc/)
        .call(function (rb) {
            strictEqual(rb.peek(), 'abc');
        });
});

test('nodes identify their type (via - ors get wrapped)', function () {
    'use strict';
    regex()
        .literals('a')
        .regex(/UNIX|WINDOWS|MAC/)
        .call(function (rb) {
            strictEqual(rb.peek(), 'a(?:UNIX|WINDOWS|MAC)');
        });
});

// TESTCASE - from(a\|a).literals(a) does not get noncapture
// TESTCASE - from(aa).repeat() gets noncapture
// TESTCASE - from((a)(a)).repeat() gets noncapture
// TESTCASE - from((a)(a)).capture() gets new capture parens
// TESTCASE - from((a), {captures:['a']}) is valid and makes capture group
// TESTCASE - basically the same as above, but backrefs too