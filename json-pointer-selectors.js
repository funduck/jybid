'use strict';

const jsonPtr = require('json-ptr');
const sortJsonPatchOps = require('./sort-json-patch-ops')

//
//  Some json pointer additions (path with object selectors)
//

const toValue = (v, escaped) => {
    if (escaped) {
        return v.replace(/\\(\\|")/g, '$1');
    } else {
        if (v === 'true') {
            return true;
        }
        if (v === 'false') {
            return false;
        }
        if (v === 'null') {
            return null;
        }
        if (v === '') {
            return undefined;
        }
        if (v.match(/^-?[0-9]+$/)) {
            return parseInt(v, 10);
        }
        if (v.match(/^-?[0-9]+\.[0-9]*$/)) {
            return parseFloat(v);
        }
        return v;
    }
};

const toName = (n, escaped) => {
    if (escaped) {
        return n.replace(/\\(\\|")/g, '$1');
    } else {
        if (n === '') {
            return null;
        } else {
            return n;
        }
    }
};

// path: "/aaaaaaaa/[bb=bb]/ccc"
//        ^        ^       ^
// path = prefix + infix + suffix
const parseJsonPointer = (path) => {
    let pos = path.indexOf('[');
    let parse;
    do {
    
        if (pos === -1) {
            return {
                prefix: path,
                infix: '',
                suffix: ''
            };
        } else {
            if (pos === 0) {
                parse = true;
            } else {
                if (path.charAt(pos - 1) === '/') {
                    parse = true;
                } else {
                    pos = path.indexOf('[', pos + 1);
                }
            }
        }
    
        const parseStart = pos;
        while (parse) {
            const selector = [];

            do {
                let tail = path.substr(pos);
                let name = tail.match(/^\[([^"\/]*?)=/);
                let escaped;
                
                escaped = false;
                if (name == null) {
                    name = tail.match(/^\["((?:[^\\"]|\\"|\\\\)*?)"=/);
                    escaped = true;
                }
                if (name != null) {
                    pos += name[0].length;
                    name = toName(name[1], escaped);
                } else {
                    pos = path.indexOf('[', pos + 1);
                    parse = false;
                    break;
                }
                
                tail = path.substr(pos);
                escaped = false;
                let value = tail.match(/^([^"]*?)\]/);
                if (value == null) {
                    value = tail.match(/^"((?:[^\\"]|\\"|\\\\)*?)"\]/);
                    escaped = true;
                }
                
                if (value != null) {
                    pos += value[0].length;
                    value = toValue(value[1], escaped);
                } else {
                    pos = path.indexOf('[', pos);
                    parse = false;
                    break;
                }
                
                selector.push({key: name, value: value});
                
                const eos = pos >= path.length;
        
                /*eslint no-multi-spaces: ["error", { ignoreEOLComments: true }]*/
        
                if (eos || path.charAt(pos) === '/') {
                    if (eos) {
                        if (parseStart === 0) {                                 // [infix]
                            return {
                                prefix: '',                                     //  ''
                                infix: path.substr(0, pos),                     //  [infix]
                                suffix: '',                                     //  ''
                                selector: selector
                            };
                        } else {                                                // prefix/[infix]
                            return {
                                prefix: path.substr(0, parseStart - 1),         //  prefix
                                infix: path.substr(parseStart - 1),             //  /[infix]
                                suffix: '',                                     //  ''
                                selector: selector
                            };
                        }
                    } else {
                        if (parseStart === 0) {                                 // [infix]/suffix
                            return {
                                prefix: '',                                     //  ''
                                infix: path.substr(0, pos),                     //  [infix]
                                suffix: path.substr(pos),                       //  /suffix
                                selector: selector
                            };
                        } else {                                                // prefix/[infix]/suffix
                            return {
                                prefix: path.substr(0, parseStart - 1),         //  prefix
                                infix: path.substring(parseStart - 1, pos),     //  /[infix]
                                suffix: path.substr(pos),                       //  /suffix
                                selector: selector
                            };
                        }
                    }
                }
                
                /*eslint no-multi-spaces: ["error", { ignoreEOLComments: false }]*/
                
            } while (true);
        }
    
    } while (true);
}; 

const buildSelectorString = (selector) => {
    let path = '';
    for (let i = 0; i < selector.length; i++) {
        let key = selector[i].key;
        if (key != null) {
            key = '"' + key.replace(/(\\|")/g, '\\$1') + '"';
        } else {
            key = '';
        }
        
        let value = selector[i].value;
        if (value != null) {
            if (typeof value == 'string') {
                value = '"' + value.replace(/(\\|")/g, '\\$1') + '"';
            }
        } else {
            if (value === null) {
                value = 'null';
            } else {
                value = '';
            }
        }
        path += `[${key}=${value}]`;
    }
    return path;
};

const objectMatchesSelector = (obj, selector) => {
    let c;
    for (let i = 0; i < selector.length; i++) {
        c = selector[i];
        if (c.key != null && c.value != null && obj[c.key] !== c.value ||
            c.key != null && c.value == null && obj[c.key] == undefined ||
            c.key == null && c.value != null && obj !== c.value
        ) {
            return false;
        }
    }
    return true;
};

/**
    @param {object} source - object to which patch will be applied
    @param {Array} patchOperations
    
    @return {Array} - JSON Patch
*/
const compileJsonPatch = (source, patchOperations) => {
    const res = [];
    for (let i = 0; i < patchOperations.length; i++) {
        if (!patchOperations[i].path) continue;

        const re = parseJsonPointer(patchOperations[i].path);
        if (re.selector) {
            const arr = jsonPtr.get(source, re.prefix);
            let tmp = [];
            // if object is not array check deeper
            if (!Array.isArray(arr)) {
                if (arr[re.infix] != undefined && re.suffix != '') {
                    // relative pathes
                    tmp = compileJsonPatch(arr[re.infix], [Object.assign({}, patchOperations[i], {path: re.suffix})]);
                    for (let j = 0;j < tmp.length; j++) {
                        // relative pathes back to absolute
                        tmp[j].path = re.prefix + re.infix + tmp[j].path;
                        res.push(tmp[j]);
                    }
                } else {
                    res.push(patchOperations[i]);
                }
                continue;
            }
            // if found array check conditions
            for (let j = 0; j < arr.length; j++) {
                if (objectMatchesSelector(arr[j], re.selector)) {
                    // changing path to JSON-Pointer with number
                    tmp.push(Object.assign({}, patchOperations[i], {path: re.prefix + '/' + j + re.suffix}));
                }
            }
            if (tmp.length) {
                // checking new pathes deeper
                tmp = compileJsonPatch(source, tmp);
            }
            if (tmp.length) {
                res.push(...tmp);
            }
        } else {
            res.push(patchOperations[i]);
        }
    }
    return sortJsonPatchOps(res);
};

module.exports = { buildSelectorString, parseJsonPointer, objectMatchesSelector, compileJsonPatch };

