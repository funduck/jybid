'use strict';

// nmantsif@mts.ru
//
//  Some jsonpath additions (path with object selectors)
//

function toValue(v, escaped) {
    if (escaped) {
        return v.replace(/\\([\\"])/g, '$1');
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
        if (v === 'undefined' || v === '') {
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
}

function toName(n, escaped) {
    if (escaped) {
        return n.replace(/\\([\\"])/g, '$1');
    } else {
        if (n === '') {
            return null;
        } else {
            return n;
        }
    }
}

    
module.exports = {
    
    // path: "/aaaaaaaa/[bb=bb]/ccc"
    //        ^        ^       ^
    // path = prefix + infix + suffix
    
    parsePath: function (path) {
        
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
    },
    
    buildPath: function (selector) {
        let path = '';
        for (let i = 0; i < selector.length; i++) {
            let key = selector[i].key;
            if (key != null) {
                key = JSON.stringify(key);
            } else {
                key = '';
            }
            
            let value = selector[i].value;
            if (value != null) {
                value = JSON.stringify(value);
            } else {
                value = '';
            }
            path += `[${key}=${value}]`;
        }
        return path;
    }
};

