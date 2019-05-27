'use strict';

const opsPriority = {};
['remove', 'move', 'replace', 'copy', 'add'].reverse().forEach((op, i) => {
    opsPriority[op] = i;
});

const rePath = /(^.*?)\/?([0-9]+|)$/;

const sortJsonPatchOps = (ops) => {
    const sortFunction = (a, b) => {
        if (a.op != b.op) {
            if (opsPriority[a.op] > opsPriority[b.op]) {
                return -1;
            }
            return 1;
        }
        
        let [reA, pathA, idA] = a.path.match(rePath);
        let [reB, pathB, idB] = b.path.match(rePath);
        const comparePathes = pathA.localeCompare(pathB);

        switch (a.op) {
            case 'remove':
                if (comparePathes != 0) {
                    return -comparePathes;
                }
                // reverse sorting indexes of arrays
                if (idA != null) idA = parseInt(idA, 10);
                if (idB != null) idB = parseInt(idB, 10);
                if (idB == null) {
                    return 1;
                }
                if (idA == null) {
                    return -1;
                }
                return idB - idA;
            case 'add':
                if (comparePathes == 0) {
                    if (JSON.stringify(a.value) > JSON.stringify(b.value)) {
                        return -1;
                    }
                    return 1;
                }
            default: 
                return -comparePathes;
        }
    };
    ops.sort((a, b) => {
        const res = sortFunction(a, b);
        return res;
    });
    return ops;
};

module.exports = sortJsonPatchOps;
