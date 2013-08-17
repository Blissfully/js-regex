js-regex
========

Why?
----

Because if you're using RegExp, and your problem isn't solved yet, you're not using
enough RegExp.

Tests
-----

In addition to the usage documented below, with a matching test suite [here](https://github.com/wyantb/js-regex/blob/master/test/cases/readme_cases.js), there's a fair number of other test cases [here](https://github.com/wyantb/js-regex/tree/master/test/cases).

Although there's a small number of testcase files right now, they actually cover the bases of the library and the combinations of methods you can invoke pretty well; please check them out if you're at all interested.

Usage
-----

### Simple usage with peek()

```javascript
regex()
    .literals('abc')
    .peek();        // Will return 'abc'
```

### Never stop chaining!

```javascript
regex()
    .literals('abc')
    .call(function (curNode) {
        console.log(this === curNode); // Will print true
        console.log(curNode.peek());   // Will print 'abc'
    })
    .literals('def')
    .call(function (curNode) {
        console.log(curNode.peek());   // Will print 'abcdef'
    });
```

### Special Flags

```javascript
regex()
    .f.digit()
    .f.whitespace()
    .peek();       // Will return '\d\s'
```

### Capture Groups

```javascript
regex()
    .literals('aaa')
      .capture()
    .peek();        // Will return '(aaa)'
```

### Repeating

```javascript
regex()
    .literals('aaa')
      .repeat()
    .peek();        // Will return '(?:aaa)*'

regex()
    .literals('aaa')
    .call(function (curNode) {
        console.log(curNode.peek()); // Will print 'aaa'
    })
      .repeat(1, 3)
    .peek();                         // Will return '(?:aaa){1,3}'
```

### Simple Grouping

```javascript
regex()
    .sequence()
        .literals('aaa')
        .f.digit()
        .literals('bbb')
    .endSequence()
      .repeat()
    .peek();            // Will return '(?:aaa\dbbb)*'
```

### Character Sets

```javascript
regex()
    .any('abcdefg')
    .peek();       // Will return '[abcdefg]'

regex()
    .any()
        .literals('abc')
        .f.digit()
    .endAny()
    .peek();            // Will return '[abc\d]'

regex()
    .none()
        .literals('abc')
        .f.whitespace()
    .endNone()
    .peek();            // Will return '[^abc\s]'
```

### Or

```javascript
regex()
    .either()
        .literals('abc')
        .literals('def')
    .endEither()
    .peek();             // Will return 'abc|def'

regex()
    .either('abc', 'def')
    .peek();             // Will return 'abc|def'
```

### Macros

```javascript
regex.create(); // Alternate form of regex()

regex
    .addMacro('any-quote') // Adding a global macro for single or double quote
        .any('\'"')
    .endMacro()
    .create()
        .macro('any-quote')
        .f.dot()
          .repeat()
        .macro('any-quote')
        .peek();           // Will return '['"].*['"]'

regex
    .addMacro('quote')
        .any('\'"')
    .endMacro()
    .create()
        .addMacro('quote') // Local macros override global ones
            .literal('"')  //  Here, restricting to double quote only
        .endMacro()
        .macro('quote')
        .f.dot()
          .repeat()
        .macro('quote')
        .peek();           // Will return '".*"'
```

### Followed By

```javascript
regex()
    .literals('aaa')
      .followedBy('bbb')
    .peek();            // Will return '(?:aaa)(?=bbb)'

regex()
    .literals('ccc')
      .notFollowedBy('ddd')
    .peek();               // Will return '(?:ccc)(?!ddd)
```

Complicated Regexes
-------------------

### Example 1

How quickly can you figure out what this is supposed to represent?

```javascript
regex()
    .addMacro('0-255')
        .either()
            .sequence()
                .literals('25')
                .anyFrom('0', '5')
            .endSequence()
            .sequence()
                .literal('2')
                .anyFrom('0', '4')
                .anyFrom('0', '9')
            .endSequence()
            .sequence()
                .any('01').optional()
                .anyFrom('0', '9')
                .anyFrom('0', '9').optional()
            .endSequence()
        .endEither()
    .endMacro()
    .macro('0-255').capture()
    .literal('.')
    .macro('0-255').capture()
    .literal('.')
    .macro('0-255').capture()
    .literal('.')
    .macro('0-255').capture()
    .peek();
```

(Hint: it's described [here](http://www.regular-expressions.info/examples.html), in the fourth section on the page.)

(Also note: this example uses the 'verbose' usage form, always closing portions with endXXX(); the [Readme tests](https://github.com/wyantb/js-regex/blob/master/test/cases/readme_cases.js) cover the same using an alternate form)

Experimental Methods
--------------------

### Simple Testing

test() is still kinda pointless.

```javascript
regex()
    .literal('a')
    .test('a');   // Will return true
```

### Simple Replacing

replace() is probably pretty buggy, especially with multiple named capture groups
 in a row.

```javascript
regex()
    .literals('abc')
    .replace('abc', function () {
        return 'def';
    });              // Will return 'def'
```

### Named Capture Groups

Probably buggy.

```javascript
regex()
    .literals('bbb')
    .literals('aaa')
      .capture('named')
    .literals('bbb')
    .replace('aaa', function (groups) {
        console.log(groups.named);     // Will print 'aaa'
        return 'ccc' + groups.named + 'ccc';
    });                                // Will return 'cccaaaccc'
```
