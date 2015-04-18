/*global define,module*/

/**!
 * js-regex: a chainable regex building library for Javascript.
 *
 * @author    Brian Wyant <wyantb@gmail.com>
 * @license   http://opensource.org/licenses/MIT
**/

(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module, also provide global
        define([], function () {
            /*jshint -W093*/
            return (root.regex = factory());
            /*jshint +W093*/
        });
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like enviroments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals
        root.regex = factory();
    }
}(this, function () {
    'use strict';

    // -----------------------
    // Root Regex
    // -----------------------

    var regex = function () {
        return Object.create(RegexRoot)._init(regex);
    };

    regex._macros = {};
    regex._getMacro = function _getMacro(name) {
        if (!regex._macros[name]) {
            throw new Error('Attempted to use macro ' + name + ', which doesn\'t exist.');
        }

        return regex._macros[name];
    };

    // Can use regex() or regex.create()
    regex.create = regex;

    regex.addMacro = function addMacro(name) {
        var macro;
        if (!arguments.length) {
            throw new Error('addMacro() must be given the name of the macro to create');
        }
        else if (arguments.length === 1) {
            macro = regex._macros[name] = Object.create(RegexMacro);
            macro._init(regex);
            return macro;
        }
        else if (arguments.length > 1) {
            macro = regex._macros[name] = Object.create(RegexMacro);
            macro._init(regex);
            applyArgs(macro, rest(arguments));
            macro.endMacro();
            return regex;
        }
    };

    var RegexBase = {};
    RegexBase._type = 'base';

    RegexBase._initFields = function _initFields(_parent) {
        this._terms = [];
        this._parent = _parent || {};
        this._macros = {};
        return this;
    };
    RegexBase._init = function _init(_parent) {
        this._initFields(_parent);
        makeFlagFns(this);
        return this;
    };

    RegexBase.clone = function clone() {
        var newRe = regex();
        return deepExtend(newRe, this);
    };

    RegexBase._getMacro = function _getMacro(name) {
        return this._macros[name] || this._parent._getMacro(name);
    };

    RegexBase._nodesToArray = function _nodesToArray() {
        var parts = [];
        var nodes = this._terms;
        for (var i = 0, len = nodes.length; i < len; i++) {
            var node = nodes[i];
            var term = node.term;

            if (node.type === TYPE_OR && hasNonEmptyNeighborNode(nodes, i)) {
                parts.push('(?:' + term + ')');
            }
            else {
                parts.push(term);
            }
        }
        return parts;
    };
    RegexBase._renderNodes = function _renderNodes() {
        return this._nodesToArray().join('');
    };

    RegexBase._toTerm = function _toTerm() {
        return {
            captures: flatten(pluck(this._terms, 'captures')),
            term: this._renderNodes(),
        };
    };

    RegexBase._addTerm = function _addTerm(term, typeOverride) {
        this._terms.push({
            captures: [],
            type: typeOverride,
            term: term
        });
        return this;
    };
    RegexBase._addBuilderTerm = function _addBuilderTerm(term) {
        this._terms.push(term);
        return this;
    };

    function currentTerm(rb) {
        return rb._terms[rb._terms.length - 1];
    }
    function wrapCurrentTerm(rb, pre, post) {
        var curTerm = currentTerm(rb);
        curTerm.type = TYPE_TERM;
        curTerm.term = pre + curTerm.term + post;
        return rb;
    }
    function replaceCurrentTerm(rb, match, replace) {
        var curTerm = currentTerm(rb);
        curTerm.type = TYPE_TERM;
        curTerm.term.replace(match, replace);
        return rb;
    }
    function identifyCurrentTerm(rb) {
        return identifyState(currentTerm(rb).term);
    }
    function addCapture(rb, capture) {
        currentTerm(rb).captures.unshift(capture);
    }
    function applyArgumentsToNode(proto, node, args) {
        var toApply = Object.create(proto)._init(node);
        applyArgs(toApply, args);
        return node._addBuilderTerm(toApply._toTerm());
    }
    function applyArgumentsWithoutNode(proto, args) {
        var toApply = Object.create(proto)._init(regex);
        if (args.length) {
            applyArgs(toApply, args);
        }
        return toApply;
    }

    RegexBase.call = function call(callback) {
        callback.call(this, this);
        return this;
    };

    RegexBase.peek = function peek() {
        return this._renderNodes(this._terms);
    };

    RegexBase.literal = function literal(character) {
        return this._addTerm(getNormalLiteral(character));
    };

    RegexBase.literals = function literals(string) {
        return this._addTerm(getLiterals(string));
    };

    RegexBase.macro = function macro(name) {
        var mac = this._getMacro(name);
        this._addBuilderTerm(mac._toTerm());
        return this;
    };

    regex.macro = function macro(name) {
        var reBase = Object.create(RegexBase)._init(regex);
        reBase.macro(name);
        return reBase;
    };

    RegexBase.seq = RegexBase.sequence = function sequence() {
        if (!arguments.length) {
            return Object.create(RegexSequence)._init(this);
        }
        else {
            return applyArgumentsToNode(RegexSequence, this, arrayCopy(arguments));
        }
    };

    regex.seq = regex.sequence = function sequence() {
        return applyArgumentsWithoutNode(RegexSequence, arrayCopy(arguments));
    };

    RegexBase.capture = function capture(name) {
        if (name == null) {
            name = String(Math.random() * 1000000);
        }
        if (typeof name !== 'string') {
            throw new Error('named error groups for capture must be a String');
        }
        if (identifyCurrentTerm(this) === STATE_EMPTY) {
            throw new Error('nothing to capture');
        }
        if (name === 'match') {
            throw new Error('the capture group \'match\' represents the entire match group, and cannot be used as a custom named group');
        }

        addCapture(this, name);

        if (currentTerm(this).type !== TYPE_MULTITERM && identifyCurrentTerm(this) === STATE_OPENNONCAPTURE) {
            return replaceCurrentTerm(this, '(?:', '(');
        }
        else {
            return wrapCurrentTerm(this, '(', ')');
        }
    };

    function maybeWrapInOpennoncapture(rb) {
        if (currentTerm(rb).type === TYPE_OR || currentTerm(rb).type === TYPE_MULTITERM) {
            wrapCurrentTerm(rb, '(?:', ')');
            return;
        }
        switch (identifyCurrentTerm(rb)) {
        case STATE_CHARACTER:
        case STATE_CLOSEDGROUP:
        case STATE_ANY:
            break;
        default:
            wrapCurrentTerm(rb, '(?:', ')');
            return;
        }

    }
    RegexBase.repeat = function repeat(min, max) {
        if (identifyCurrentTerm(this) === STATE_EMPTY) {
            throw new Error('nothing to repeat');
        }

        maybeWrapInOpennoncapture(this);

        if (!arguments.length) {
            return wrapCurrentTerm(this, '', '*');
        }
        else if (arguments.length === 1) {
            if (min === 0) {
                return wrapCurrentTerm(this, '', '*');
            }
            else if (min === 1) {
                return wrapCurrentTerm(this, '', '+');
            }
            else {
                return wrapCurrentTerm(this, '', '{' + min + ',}');
            }
        }
        else if (min !== max) {
            return wrapCurrentTerm(this, '', '{' + min + ',' + max + '}');
        }
        else {
            return wrapCurrentTerm(this, '', '{' + min + '}');
        }
    };

    RegexBase.optional = function optional() {
        if (identifyCurrentTerm(this) === STATE_EMPTY) {
            throw new Error('nothing to mark as optional');
        }

        maybeWrapInOpennoncapture(this);
        return wrapCurrentTerm(this, '', '?');
    };

    RegexBase.followedBy = function followedBy(string) {
        if (arguments.length && typeof string !== 'string') {
            throw new Error('if specifying arguments for followedBy(), must be a String of literals');
        }

        if (arguments.length) {
            return this._addTerm('(?=' + getLiterals(string) + ')');
        }
        else {
            return Object.create(RegexIsFollowedBy)._init(this);
        }
    };

    regex.followedBy = function followedBy() {
        return applyArgumentsWithoutNode(RegexIsFollowedBy, arrayCopy(arguments));
    };

    RegexBase.notFollowedBy = function notFollowedBy(string) {
        if (arguments.length && typeof string !== 'string') {
            throw new Error('if specifying arguments for notFollowedBy(), must be a String of literals');
        }

        if (arguments.length) {
            return this._addTerm('(?!' + getLiterals(string) + ')');
        }
        else {
            return Object.create(RegexNotFollowedBy)._init(this);
        }
    };

    regex.notFollowedBy = function notFollowedBy(literals) {
        return applyArgumentsWithoutNode(RegexNotFollowedBy, arrayCopy(arguments));
    };

    RegexBase.anyFrom = function anyFrom(firstChar, secondChar) {
        if (typeof firstChar !== 'string' || typeof secondChar !== 'string') {
            throw new Error('must specify two characters for anyFrom() method');
        }

        var term = '[' + getSetLiteral(firstChar) + '-' + getSetLiteral(secondChar) + ']';
        return this._addTerm(term);
    };

    regex.anyFrom = function anyFrom(firstChar, secondChar) {
        return Object.create(RegexBase)._init(regex).anyFrom(firstChar, secondChar);
    };

    RegexBase.any = RegexBase.anyOf = function any(characters) {
        if (arguments.length && typeof characters !== 'string') {
            throw new Error('if specifying arguments for any(), must be a String of literals');
        }

        if (arguments.length) {
            return this._addTerm('[' + getSetLiterals(characters) + ']');
        }
        else {
            return Object.create(RegexAny)._init(this);
        }
    };

    regex.any = regex.anyOf = function any(literals) {
        return Object.create(RegexBase)._init(regex).any(literals);
    };

    RegexBase.noneFrom = function noneFrom(firstChar, secondChar) {
        if (typeof firstChar !== 'string' || typeof secondChar !== 'string') {
            throw new Error('must specify two characters for noneFrom() method');
        }

        var term = '[^' + getSetLiteral(firstChar) + '-' + getSetLiteral(secondChar) + ']';
        return this._addTerm(term);
    };

    regex.noneFrom = function noneFrom(firstChar, secondChar) {
        return Object.create(RegexBase)._init(regex).noneFrom(firstChar, secondChar);
    };

    RegexBase.none = RegexBase.noneOf = function none(characters) {
        if (arguments.length && typeof characters !== 'string') {
            throw new Error('if specifying arguments for none(), must be a String of literals');
        }

        if (arguments.length) {
            return this._addTerm('[^' + getSetLiterals(characters) + ']');
        }
        else {
            return Object.create(RegexNone)._init(this);
        }
    };

    regex.none = regex.noneOf = function none(literals) {
        return Object.create(RegexBase)._init(regex).none(literals);
    };

    RegexBase.or = RegexBase.either = function either(/* Optional: [literals|RegexBase] */) {
        if (!arguments.length) {
            return Object.create(RegexEither)._init(this);
        }
        else {
            return applyArgumentsToNode(RegexEither, this, arrayCopy(arguments));
        }
    };

    regex.or = regex.either = function either(/* Optional: [literals|RegexBase] */) {
        return applyArgumentsWithoutNode(RegexEither, arrayCopy(arguments));
    };

    var flagCharacters = {
        '.': '.',
        '^': '^',
        '$': '^',
        'd': '\\d',
        'D': '\\D',
        's': '\\s',
        'S': '\\S',
        'f': '\\f',
        'n': '\\n',
        'r': '\\r',
        't': '\\t',
        'v': '\\v',
        'w': '\\w',
        'W': '\\W',
        '0': '\\0',
    };

    function makeFlagFns(node) {
        function addFlag(flag) {
            return function flagFn() {
                return node._addTerm(flag);
            };
        }

        var flags = function flags(flagsToAdd) {
            var newFlags = '';
            for (var i = 0, len = flagsToAdd.length; i < len; i++) {
                var newFlag = flagsToAdd[i];
                if (!flagCharacters[newFlag]) {
                    throw new Error('unrecognized flag: ' + newFlag);
                }
                newFlags += flagCharacters[newFlag];
            }

            return node._addTerm(newFlags);
        };

        flags.start =                    addFlag('^');
        flags.end =                      addFlag('$');

        flags.any = flags.dot =          addFlag('.');
        flags.digit =                    addFlag('\\d');
        flags.nonDigit =                 addFlag('\\D');
        flags.whitespace =               addFlag('\\s');
        flags.nonWhitespace =            addFlag('\\S');

        flags.backspace =                addFlag('[\\b]');
        flags.wordBoundary =             addFlag('\\b');
        flags.nonWordBoundary =          addFlag('\\B');
        flags.formfeed =                 addFlag('\\f');
        flags.newline = flags.linefeed = addFlag('\\n');
        flags.carriageReturn =           addFlag('\\r');
        flags.tab =                      addFlag('\\t');
        flags.verticalTab =              addFlag('\\v');
        flags.alphanumeric =             addFlag('\\w');
        flags.nonAlphanumberic =         addFlag('\\W');
        flags.nullCharacter =            addFlag('\\0');

        // TODO hexadecimal flags

        node.f = node.flags = flags;
        return node;
    }

    var RegexFlags = {};
    RegexFlags._type = 'flags';
    RegexFlags._initFields = RegexBase._initFields;
    RegexFlags._addTerm = RegexBase._addTerm;
    RegexFlags._renderNodes = RegexBase._renderNodes;
    RegexFlags._toTerm = RegexBase._toTerm;
    RegexFlags._nodesToArray = RegexBase._nodesToArray;
    RegexFlags.peek = RegexBase.peek;
    RegexFlags.repeat = RegexBase.repeat;
    RegexFlags.capture = RegexBase.capture;
    RegexFlags.optional = RegexBase.optional;

    Object.defineProperty(regex, 'flags', {
        get: function () {
            var reFlags = Object.create(RegexFlags)._initFields(regex);
            makeFlagFns(reFlags);
            return reFlags.flags;
        },
        enumerable: true
    });

    var RegexGroup = Object.create(RegexBase);
    RegexGroup._type = 'group';
    RegexGroup.end = function end() {
        if (this._parent !== regex) {
            return this._parent._addBuilderTerm(this._toTerm());
        }
        return this;
    };

    var RegexSequence = Object.create(RegexGroup);
    RegexSequence._type = 'sequence';
    RegexSequence.endSequence = RegexSequence.endSeq = RegexGroup.end;

    RegexSequence._toTerm = function _toTerm() {
        if (this._terms.length === 1) {
            return objectCopy(this._terms[0]);
        }
        return {
            captures: flatten(pluck(this._terms, 'captures')),
            type: this._terms.length > 1 ? TYPE_MULTITERM : TYPE_TERM,
            term: this._renderNodes()
        };
    };

    var RegexCharacterSet = Object.create(RegexBase);
    RegexCharacterSet._type = 'characterSet';
    RegexCharacterSet.end = RegexGroup.end;

    RegexCharacterSet._renderNodes = function _renderNodes() {
        var pre = this._anyExclueFlag === true ? '[^' : '[';
        return pre + this._nodesToArray().join('') + ']';
    };

    // TODO am I really not creative enough to do better?  Not to mention, liskov substitution principle...
    delete RegexCharacterSet.noneFrom;
    delete RegexCharacterSet.none;
    delete RegexCharacterSet.anyFrom;
    delete RegexCharacterSet.any;
    delete RegexCharacterSet.seq;
    delete RegexCharacterSet.sequence;
    delete RegexCharacterSet.capture;
    delete RegexCharacterSet.repeat;

    var RegexAny = Object.create(RegexCharacterSet);
    RegexAny._type = 'any';
    RegexAny._anyExcludeFlag = false;
    RegexAny.endAny = RegexAny.end;

    var RegexNone = Object.create(RegexCharacterSet);
    RegexNone._type = 'none';
    RegexNone._anyExclueFlag = true;
    RegexNone.endNone = RegexNone.end;

    var RegexEither = Object.create(RegexBase);
    RegexEither._type = 'either';
    RegexEither.end = RegexEither.endEither = RegexEither.endOr = RegexGroup.end;

    RegexEither._renderNodes = function _renderNodes() {
        return this._nodesToArray().join('|');
    };
    RegexEither._toTerm = function _toTerm() {
        if (this._terms.length === 1) {
            return objectCopy(this._terms[0]);
        }
        return {
            captures: flatten(pluck(this._terms, 'captures')),
            type: this._terms.length > 1 ? TYPE_OR : TYPE_TERM,
            term: this._renderNodes()
        };
    };

    var RegexFollowedBy = Object.create(RegexBase);
    RegexFollowedBy._type = 'followedByBase';
    RegexFollowedBy.end = RegexGroup.end;

    RegexFollowedBy._renderNodes = function _renderNodes() {
        var pre = this._notFlag === true ? '(?!' : '(?=';
        return pre + this._nodesToArray().join('') + ')';
    };

    var RegexIsFollowedBy = Object.create(RegexFollowedBy);
    RegexIsFollowedBy._type = 'isFollowedBy';
    RegexIsFollowedBy._notFlag = false;
    RegexIsFollowedBy.endFollowedBy = RegexIsFollowedBy.end;

    var RegexNotFollowedBy = Object.create(RegexFollowedBy);
    RegexNotFollowedBy._type = 'notFollowedBy';
    RegexNotFollowedBy._notFlag = true;
    RegexNotFollowedBy.endNotFollowedBy = RegexNotFollowedBy.end;

    var RegexMacro = Object.create(RegexSequence);
    RegexMacro._type = 'macro';

    RegexMacro._toTerm = function _toTerm() {
        if (this._terms.length === 1) {
            return objectCopy(this._terms[0]);
        }
        return {
            captures: flatten(pluck(this._terms, 'captures')),
            type: TYPE_MULTITERM,
            term: this._renderNodes()
        };
    };

    RegexMacro.endMacro = RegexMacro.end = function end() {
        return this._parent;
    };

    delete RegexMacro.endSequence;
    delete RegexMacro.endSeq;

    // Represents the root object created by executing regex()
    var RegexRoot = Object.create(RegexBase);
    RegexRoot._type = 'root';

    RegexRoot.addMacro = function addMacro(name) {
        /*jshint -W093*/
        if (!arguments.length) {
            throw new Error('addMacro() must be given the name of the macro to create');
        }
        else if (arguments.length === 1) {
            return this._macros[name] = Object.create(RegexMacro)._init(this);
        }
        else if (arguments.length > 1) {
            var macro = this._macros[name] = Object.create(RegexMacro)._init(this);
            applyArgs(macro, rest(arguments));
            macro.endMacro();
            return this;
        }
        /*jshint +W093*/
    };

    RegexRoot.test = function test(string) {
        return toRegExp(this).exec(string);
    };

    RegexRoot.replace = function replace(string, callback) {
        if (typeof string !== 'string') {
            throw new Error('can only call replace with a String and callback replace method');
        }

        // TODO callback can be a string or function
        // TODO can handle capture never getting called

        var node = this;
        return string.replace(toRegExp(this), function () {
            var args = rest(arguments);

            var captures = flatten(pluck(node._terms, 'captures'));
            var callbackHash = {};

            for (var i = 0, len = args.length; i < len; i++) {
                var name = captures[i];
                callbackHash[name] = args[i];
            }

            return callback(callbackHash);
        });
    };

    RegexRoot.exec = function exec(string) {
        if (typeof string !== 'string') {
            throw new Error('can only call exec with a String');
        }

        var execed = toRegExp(this).exec(string);

        if (!execed) {
            return null;
        }

        var captures = flatten(pluck(this._terms, 'captures'));
        var result = {
            match: execed[0]
        };

        for (var i = 1, len = execed.length; i < len; i++) {
            var name = captures[i - 1];
            result[name] = execed[i];
        }

        return result;
    };

    // -----------------------
    // Helpers
    // -----------------------

    var specialCharacters = '\\^$*+?(){}[]|.';
    var specialSetCharacters = specialCharacters + '-';

    function getLiteral(character, specialSet) {
        if (typeof character !== 'string') {
            throw new Error('the literal() and literals() functions only takes Strings');
        }
        if (character.length !== 1) {
            throw new Error('only one characteer can be given for literal()');
        }
        return specialSet.indexOf(character) === -1 ? character : '\\' + character;
    }
    function getNormalLiteral(character) {
        return getLiteral(character, specialCharacters);
    }
    function getSetLiteral(character) {
        return getLiteral(character, specialSetCharacters);
    }

    function getLiterals(string) {
        var literals = '';
        for (var i = 0, len = string.length; i < len; i++) {
            literals += getNormalLiteral(string[i]);
        }
        return literals;
    }
    function getSetLiterals(string) {
        var literals = '';
        for (var i = 0, len = string.length; i < len; i++) {
            literals += getSetLiteral(string[i]);
        }
        return literals;
    }

    function deepExtend(target, src) {
        var value, prop;
        for (prop in src) {
            if (src.hasOwnProperty(prop)) {
                value = src[prop];

                if (value instanceof Array) {
                    target[prop] = deepExtend([], value);
                }
                else if (value instanceof Function) {
                    // ignore; only used where target should win over source (i.e., bound fns)
                }
                else if (value instanceof Object) {
                    target[prop] = deepExtend({}, value);
                }
                else {
                    target[prop] = value;
                }
            }
        }
        return target;
    }

    function arrayCopyFrom(arry, idx) {
        var result = new Array(arry.length - idx);
        for (var i = 0, len = arry.length - idx; i < len; i++) {
            result[i] = arry[i + idx];
        }
        return result;
    }
    function arrayCopy(arry) {
        return arrayCopyFrom(arry, 0);
    }
    function rest(arry) {
        return arrayCopyFrom(arry, 1);
    }
    function flatten(arry, accum) {
        accum = accum || [];
        for (var i = 0, len = arry.length; i < len; i++) {
            var val = arry[i];
            if (val instanceof Array) {
                flatten(val, accum);
            }
            else {
                accum.push(val);
            }
        }
        return accum;
    }
    function objectCopy(obj) {
        return deepExtend({}, obj);
    }

    function toRegExp(node) {
        return new RegExp(node.peek());
    }

    function applyArgs(reNode, args) {
        for (var i = 0, len = args.length; i < len; i++) {
            var arg = args[i];
            if (typeof arg === 'string') {
                reNode.literals(arg);
            }
            else if (RegexBase.isPrototypeOf(arg) || RegexFlags.isPrototypeOf(arg)) {
                reNode._addBuilderTerm(arg._toTerm());
            }
            else {
                throw new Error('if arguments are given to or(), must be either strings or js-regex objects.');
            }
        }
    }

    function pluck(arry, field) {
        var res = [];
        for (var i = 0, len = arry.length; i < len; i++) {
            res.push(arry[i][field]);
        }
        return res;
    }
    function startsWith(str, match) {
        return str.indexOf(match) === 0;
    }
    function endsWith(str, match) {
        return str.lastIndexOf(match) === (str.length - match.length);
    }
    function endsWithNonEscaped(str, match) {
        return endsWith(str, match) && !endsWith(str, '\\' + match);
    }

    function identifyState(snippet) {
        if (snippet.length === 0) {
            return STATE_EMPTY;
        }
        if (snippet.length === 1 || (startsWith(snippet, '\\') && snippet.length === 2)) {
             // TODO FIXME could be true with unicode also
            return STATE_CHARACTER;
        }
        if (endsWithNonEscaped(snippet, '*')) {
            return STATE_REPEAT;
        }
        if (endsWithNonEscaped(snippet, '?')) {
            return STATE_MODIFIEDTERM;
        }
        if (startsWith(snippet, '(?:')) {
            return STATE_OPENNONCAPTURE;
        }
        if (startsWith(snippet, '[') && endsWithNonEscaped(snippet, ']')) {
            return STATE_ANY;
        }
        if (startsWith(snippet, '(') && endsWithNonEscaped(snippet, ')')) {
            return STATE_CLOSEDGROUP;
        }
        return STATE_TERM;
    }

    function hasNonEmptyNeighborNode(nodes, i) {
        if (i > 0 && identifyState(nodes[i - 1].term) !== STATE_EMPTY) {
            return true;
        }
        if (i < (nodes.length - 1) && identifyState(nodes[i + 1].term) !== STATE_EMPTY) {
            return true;
        }
        return false;

    }

    // TODO FIXME exclude from 'production' builds, if I make that a thing
    regex._identifyState = identifyState;

    // TODO separate logical states (some type of closed group) from concrete ones (any, star)

    /** catchall state - generally, when I don't know what to make of a thing, but also, that it doesn't matter anyway */
    var STATE_TERM = 'STATE_TERM';
    /** catchall group state - when I know I have some kind of group, but don't care what type */
    var STATE_CLOSEDGROUP = 'STATE_CLOSEDGROUP';
    /** literally empty */
    var STATE_EMPTY = 'STATE_EMPTY';
    /** see or.js testcases - a(?:b|c) is an open noncaptured group - but if user tries to capture right after that, minimal regex demands we replace the noncapture with a capture */
    var STATE_OPENNONCAPTURE = 'STATE_OPENNONCAPTURE';
    /** like *, or {}, or ? after a term */
    var STATE_MODIFIEDTERM = 'STATE_MODIFIEDTERM';
    /** [abc] - you know, character sets */
    var STATE_ANY = 'STATE_ANY';
    var STATE_CHARACTER = 'STATE_CHARACTER';
    var STATE_REPEAT = 'STATE_REPEAT';

    /** a term type, rather than identified state */
    var TYPE_OR = 'TYPE_OR';
    var TYPE_MULTITERM = 'TYPE_MULTITERM';
    var TYPE_TERM = 'TYPE_TERM';

    return regex;
}));

