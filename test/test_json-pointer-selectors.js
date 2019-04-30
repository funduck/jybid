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
        argument: `/aaa/[=2][="3"][""=true]["[\\"]"="]"]["\\""=4][n=null][u=]/ccc`,
        result: {
            prefix: '/aaa',
            infix: `/[=2][="3"][""=true]["[\\"]"="]"]["\\""=4][n=null][u=]`,
            suffix: '/ccc',
            selector: [
                {key: null, value: 2},
                {key: null, value: '3'},
                {key: '', value: true}, 
                {key: '["]', value: ']'}, 
                {key: '"', value: 4}, 
                {key: 'n', value: null},  
                {key: 'u', value: undefined}
            ]
        }
    },
};

describe('jps', function () {

    for (const name in cases) {
        it(name, () => {
            const res = jps.parsePath(cases[name].argument);
            assert.deepEqual(res, cases[name].result);
        });        
    }
    
    it('should ignore bad', () => {
        const res = jps.parsePath('aaa/[=2][skip]"]/ccc');
        assert.equal(res.prefix, 'aaa/[=2][skip]"]/ccc', 'bad prefix');
        assert.equal(res.infix, '', 'bad infix');
        assert.equal(res.suffix, '', 'bad suffix');
    });

    it('should ignore partitial bad', () => {
        const res = jps.parsePath('aaa/[hoho/[a=1]/hehe]');
        assert.equal(res.prefix, 'aaa/[hoho', 'bad prefix');
        assert.equal(res.infix, '/[a=1]', 'bad infix');
        assert.equal(res.suffix, '/hehe]', 'bad suffix');
    });

    it('should parsePath partitial escaped', () => {
        const res = jps.parsePath('aaa/["hoho/[a"=1]/hehe]');
        assert.equal(res.prefix, 'aaa', 'bad prefix');
        assert.equal(res.infix, '/["hoho/[a"=1]', 'bad infix');
        assert.equal(res.suffix, '/hehe]', 'bad suffix');
        assert.equal(res.selector[0].key, 'hoho/[a', 'bad param1 name');
        assert.equal(res.selector[0].value, 1, 'bad param1 value');
    });
    
    it('should ignore misspelled bad', () => {
        const res = jps.parsePath('aaa/[skip= "oops"]"]/ccc');
        assert.equal(res.prefix, 'aaa/[skip= "oops"]"]/ccc', 'bad prefix');
        assert.equal(res.infix, '', 'bad infix');
        assert.equal(res.suffix, '', 'bad suffix');
    });
    
    it('should ignore bad and parsePath next strange', () => {
        const res = jps.parsePath('aaa/[=2][skip]"]/ccc/[d=null]["="=-1.11]/next');
        assert.equal(res.prefix, 'aaa/[=2][skip]"]/ccc', 'bad prefix');
        assert.equal(res.infix, '/[d=null]["="=-1.11]', 'bad infix');
        assert.equal(res.suffix, '/next', 'bad suffix');
        assert.equal(res.selector[0].key, 'd', 'bad param1 name');
        assert.equal(res.selector[0].value, null, 'bad param1 value');
        assert.equal(res.selector[1].key, '=', 'bad param2 name');
        assert.equal(res.selector[1].value, -1.11, 'bad param2 value');
    });
    
    it('buildPath', () => {
        assert.equal(jps.buildPath([
            {key: null, value: 1},
            {key: null, value: '2'},
            {key: '', value: '\''},
            {key: 'a', value: '"'}
        ]), `[=1][="2"][""="'"]["a"="\\""]`);
    });
    
});

