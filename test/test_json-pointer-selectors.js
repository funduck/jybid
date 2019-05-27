'use strict';
const assert = require('assert');
const jps = require('../json-pointer-selectors');

const cases = {
    'prefix': {
        argument: '/aaa',
        result: {
            prefix: '/aaa',
            infix: '',
            suffix: ''
        }
    },
    'empty prefix': {
        argument: '',
        result: {
            prefix: '',
            infix: '',
            suffix: ''
        }
    },
    '/ prefix': {
        argument: '/',
        result: {
            prefix: '/',
            infix: '',
            suffix: ''
        }
    },
    'prefixed': {
        argument: '/aaa/[b=2]',
        result: {
            prefix: '/aaa',
            infix: '/[b=2]',
            suffix: '',
            selector: [{key: 'b', value: 2}]
        }
    },
    'empty prefix': {
        argument: '[b=2]',
        result: {
            prefix: '',
            infix: '[b=2]',
            suffix: '',
            selector: [{key: 'b', value: 2}]
        }
    },
    '/ prefix': {
        argument: '/[b=2]',
        result: {
            prefix: '',
            infix: '/[b=2]',
            suffix: '',
            selector: [{key: 'b', value: 2}]
        }
    },
    'prefix, infix, suffix': {
        argument: '/aaa/[b=2]/ccc',
        result: {
            prefix: '/aaa',
            infix: '/[b=2]',
            suffix: '/ccc',
            selector: [{key: 'b', value: 2}]
        }
    },
    'quoted property name and value': {
        argument: '/aaa/["/b"="2"]/ccc',
        result: {
            prefix: '/aaa',
            infix: '/["/b"="2"]',
            suffix: '/ccc',
            selector: [{key: '/b', value: '2'}]
        }
    },
    'multiple': {
        argument: `/aaa/[=2][="3"][""=true]["[\\"]"="]"]["\\""=4][n=null][nn="null"][u=]/ccc`,
        result: {
            prefix: '/aaa',
            infix: `/[=2][="3"][""=true]["[\\"]"="]"]["\\""=4][n=null][nn="null"][u=]`,
            suffix: '/ccc',
            selector: [
                {key: null, value: 2},
                {key: null, value: '3'},
                {key: '', value: true}, 
                {key: '["]', value: ']'}, 
                {key: '"', value: 4}, 
                {key: 'n', value: null},
                {key: 'nn', value: 'null'},
                {key: 'u', value: undefined}
            ]
        }
    },
};

describe('Json pointer selectors', function () {

    for (const name in cases) {
        it(name, () => {
            const res = jps.parseJsonPointer(cases[name].argument);
            assert.deepEqual(res, cases[name].result);
        });        
    }
    
    it('should ignore bad', () => {
        const res = jps.parseJsonPointer('aaa/[=2][skip]"]/ccc');
        assert.equal(res.prefix, 'aaa/[=2][skip]"]/ccc', 'bad prefix');
        assert.equal(res.infix, '', 'bad infix');
        assert.equal(res.suffix, '', 'bad suffix');
    });

    it('should ignore partitial bad', () => {
        const res = jps.parseJsonPointer('aaa/[hoho/[a=1]/hehe]');
        assert.equal(res.prefix, 'aaa/[hoho', 'bad prefix');
        assert.equal(res.infix, '/[a=1]', 'bad infix');
        assert.equal(res.suffix, '/hehe]', 'bad suffix');
    });

    it('should parseJsonPointer partitial escaped', () => {
        const res = jps.parseJsonPointer('aaa/["hoho/[a"=1]/hehe]');
        assert.equal(res.prefix, 'aaa', 'bad prefix');
        assert.equal(res.infix, '/["hoho/[a"=1]', 'bad infix');
        assert.equal(res.suffix, '/hehe]', 'bad suffix');
        assert.equal(res.selector[0].key, 'hoho/[a', 'bad param1 name');
        assert.equal(res.selector[0].value, 1, 'bad param1 value');
    });
    
    it('should ignore misspelled bad', () => {
        const res = jps.parseJsonPointer('aaa/[skip= "oops"]"]/ccc');
        assert.equal(res.prefix, 'aaa/[skip= "oops"]"]/ccc', 'bad prefix');
        assert.equal(res.infix, '', 'bad infix');
        assert.equal(res.suffix, '', 'bad suffix');
    });
    
    it('should ignore bad and parseJsonPointer next strange', () => {
        const res = jps.parseJsonPointer('aaa/[=2][skip]"]/ccc/[d=null]["="=-1.11]/next');
        assert.equal(res.prefix, 'aaa/[=2][skip]"]/ccc', 'bad prefix');
        assert.equal(res.infix, '/[d=null]["="=-1.11]', 'bad infix');
        assert.equal(res.suffix, '/next', 'bad suffix');
        assert.equal(res.selector[0].key, 'd', 'bad param1 name');
        assert.equal(res.selector[0].value, null, 'bad param1 value');
        assert.equal(res.selector[1].key, '=', 'bad param2 name');
        assert.equal(res.selector[1].value, -1.11, 'bad param2 value');
    });
    
    it('buildSelectorString', () => {
        assert.equal(jps.buildSelectorString([
            {key: null, value: 1},
            {key: null, value: '2'},
            {key: '', value: '\''},
            {key: 'a', value: '"'},
            {key: 'b', value: null}
        ]), `[=1][="2"][""="'"]["a"="\\""]["b"=null]`);
    });
    
    it('objectMatchesSelector', () => {
        const cases = {
            1: {
                obj: 1,
                selector: [{key:null,value:1}]
            },
            '2': {
                obj: '2',
                selector: [{key:null,value:'2'}]
            },
            3:  {
                obj: {c: 3},
                selector: [{key:'c',value:3}]
            },
            4:  {
                obj: {d: '4'},
                selector: [{key:'d',value:'4'}]
            },
            5:  {
                obj: {c: 3},
                selector: [{key:'c',value:null}]
            },
            6:  {
                obj: {c: 3, d: '4'},
                selector: [{key:'c',value:3},{key:'d',value:'4'}]
            }
        };
        for (const k in cases) {
            assert(jps.objectMatchesSelector(cases[k].obj, cases[k].selector), k);
        }
    });
    
    it('not objectMatchesSelector', (done) => {
        const cases = {
            1: {
                obj: 2,
                selector: [{key:null,value:1}]
            },
            '2': {
                obj: 2,
                selector: [{key:null,value:'2'}]
            },
            3:  {
                obj: {c: '3'},
                selector: [{key:'c',value:3}]
            },
            4:  {
                obj: {d: '5'},
                selector: [{key:'d',value:'4'}]
            },
            5:  {
                obj: {d: 3},
                selector: [{key:'c',value:null}]
            },
            6:  {
                obj: {c: 3, d: '4'},
                selector: [{key:'c',value:3},{key:'d',value:'5'}]
            }
        };
        let ok = true;
        for (const k in cases) {
            try {
                assert(jps.objectMatchesSelector(cases[k].obj, cases[k].selector), k);
                console.error('returned true in case:', k);
                ok = false;
                break;
            } catch (e) {
            }
        }
        if (ok) done(); else done(new Error('some tests failed'));
    });

    it('compileJsonPatch', () => {
        const cpo = jps.compileJsonPatch({arr: [1,'2',{c:3},{d:'4'},{d:'5'},{"1 2 ":6},{r:[7,8]}]}, [{
            op: 'remove', path: '/arr/[=1]'     },{
            op: 'remove', path: '/arr/[="2"]'   },{
            op: 'remove', path: '/arr/[c=3]'    },{
            op: 'remove', path: '/arr/[d="4"]'  },{
            op: 'remove', path: '/arr/[d=]'     },{
            op: 'remove', path: '/arr/[1 2 =]'  },{
            op: 'remove', path: '/arr/["1 2 "=]'},{
            op: 'remove', path: '/arr/[r=]/r/[=7]'
        }]);
        const res = [{
            op: 'remove', path: '/arr/0'    },{
            op: 'remove', path: '/arr/1'    },{
            op: 'remove', path: '/arr/2'    },{
            op: 'remove', path: '/arr/3'    },{
            op: 'remove', path: '/arr/3'    },{
            op: 'remove', path: '/arr/4'    },{
            op: 'remove', path: '/arr/5'    },{
            op: 'remove', path: '/arr/5'    },{
            op: 'remove', path: '/arr/6/r/0'
        }].reverse();
        try {
            assert.deepEqual(
                cpo,
                res
            );
        } catch (e) {
            console.log('result:', JSON.stringify(cpo, null, '  '))
            console.log('should be:', JSON.stringify(res, null, '  '))
            throw e;
        }
    });

    
});

