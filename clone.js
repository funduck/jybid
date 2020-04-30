module.exports = function (obj) {
    switch (typeof obj) {
        case 'undefined':
        case 'string':
        case 'boolean':
        case 'number':
        case 'function':
            return obj;
    }

    if (obj == null) {
        return null;
    }

    if (obj instanceof Date) {
        return new Date(obj);
    }

    if (obj instanceof RegExp) {
        throw new Error('dunno how to clone', obj);
        //console.error('clone RegExp is unsafe');
        //return RegExp(obj);
    }

    if (typeof obj != 'object' && !Array.isArray(obj)) {
        throw new Error('dunno how to clone', obj);
    }
    const newObj = (Array.isArray(obj)) ? [] : {};
    for (const i in obj) {
        newObj[i] = module.exports(obj[i]);
    }
    return newObj;
};
