# JYBID
**j**son **y**aml **b**undle **i**nherit **d**ereference **

This lib allows to bundle/dereference `json` and `yaml` documents and extend a document with [JSON-Patch](http://jsonpatch.com/)

[bundle](#bundle)  
[dereference](#dereference)  
[selectors](#selectors)  
[examples](#examples)  

## Purpose
* Split big documents
* Not only reference but inherit one documents from another
* Have differences between documents in form of [JSON-Patch](http://jsonpatch.com/)  

Why does somebody want that?  
Well, when I was writing some API docs in [OpenAPI](https://www.openapis.org/) format I had troubles:
1. one doc for whole API is too big
2. docs sometimes logically extend one another
3. how to get diff between versions of API? It would be great to have [JSON-Patch](http://jsonpatch.com/) and visualize it [somehow](https://github.com/benjamine/jsondiffpatch)

So I wanted to:
1. Use `json` and `yaml` files simultaneously, being able to split big files into several smaller
2. Have some inheritance technique based on JSON-Patch

1 comes easy, it can be solved by [json-schema-ref-parser](https://github.com/APIDevTools/json-schema-ref-parser)  
2 also has a solution like [ajv-merge-patch](https://github.com/epoberezkin/ajv-merge-patch)  
But all together it doesn't work out of box.  
So I made a little patch to json-schema-ref-parser that enables inheritance based on JSON-Patch syntax.  
Also I extended JSON-Pointer for array indexes in [selectors](#selectors).

## Methods
### bundle
**bundle(filepath, options) returns Promise with object** - to bundle a file  

### dereference
**dereference(filepath, options) returns Promise with object** - to bundle a file and resolve even internal references 

For both
* if `options.inherit==true` then json-patches will be compiled  
* if `options.inherit` is a string then it will set a keyword instead of `"$inherit"` and if it is `"$patch"` then document syntax complies to [ajv-merge-patch](https://github.com/epoberezkin/ajv-merge-patch)

Example:
```
const { bundle, dereference } = require('./index')
const fs = require('fs')
fs.writeFileSync('/tmp/a.json', JSON.stringify({
    a: 1,
    c: {$ref: '#/d'},
    d: 4
}), {encoding: 'utf8'})

fs.writeFileSync('/tmp/b.json', JSON.stringify({
    $inherit: {
        source: {$ref: '/tmp/a.json'},
        with: [{op: 'add', path: '/b', value: 2}]
    }
}), {encoding: 'utf8'})

bundle('/tmp/a.json').then((doc) => {console.log(JSON.stringify(doc));})
{"a":1,"c":{"$ref":"#/d"},"d":4}

bundle('/tmp/b.json', {inherit: true}).then((doc) => {console.log(JSON.stringify(doc));})
{"a":1,"c":{"$ref":"#/d"},"d":4,"b":2}

dereference('/tmp/b.json', {inherit: true}).then((doc) => {console.log(JSON.stringify(doc));})
{"a":1,"c":4,"d":4,"b":2}
```

### compilePatchOps
**compilePatchOps(source, patch) returns Array**  

To compile [JSON-Patch](http://jsonpatch.com/) with [selectors](#selectors) in pathes to JSON-Patch with [JSON-Pointer](https://tools.ietf.org/html/rfc6901) pathes there is a method  

When source document is bundled we check every patch operation:
1. if it contains selector in **path**
2. corresponding object in **source** is array  

then we replace it with equal operation with JSON-Pointer path, for example:

```
const { compilePatchOps } = require('./index')

compilePatchOps(
    {arr: [{a: 1}, {c: 2}, {c: {$ref: '#/d'}}, {d: 4}]},
    [{op: 'replace', path: '/arr/[c=]', value: 2}]
);
[ { op: 'replace', path: '/arr/1', value: 2 },
  { op: 'replace', path: '/arr/2', value: 2 } ]
>
```

## Selectors
[by property value](#by-property=value-pairs)  
[with property](#with-property)  
[with value](#with-value)  

In [JSON-Patch](http://jsonpatch.com/) path must be a [JSON-Pointer](https://tools.ietf.org/html/rfc6901), but referencing array elements does not look good: what means `path: '/2'`?. At what element do we point? You never know until you see object to which you apply the patch  
```
object = [1,2,234]
patch = [{op: 'remove', path: '/2'}]
```
Now we know, we wanted to remove `234`.  
Here I say, lets select element by its properties or value like in jquery
```
// selector by value
patch = [{op: 'remove', path: '/[=234]'}]

// compiling patch
compilePatchOps(object, patch)

// patch with JSON-Pointer path
[{op: 'remove', path: '/2'}]
```
So you can have documents with easier to understand JSON-Patch operations and compile them when needed.

Note that inside selectors quotation is used:
* `\"` is `"`
* `\\` is `\`
* `/` is `/`
* `~` is `~`, not `~1` and `~0` like in [JSON-Pointer](https://tools.ietf.org/html/rfc6901)

so, selectors are:

### by property=value pairs
Value is treated as string if possible and as number if it can't be string
* `[prop=value]` == `{prop: 'value'}`  
* `[prop="13"]` == `{prop: '13'}`  
* `[prop=42]` == `{prop: 42}`  
* `["string attr name"=name]` == `{'string attr name': 'name'}` To reference compicated property name use double quotes  

### with property
* `[prop=]` == `{prop: 1}` or `{prop: 'a'}` or `{prop: null}`  
* `["string attr name"=]` for quoted property name  
* `[prop=null]` == `{prop: null}`
* `[prop="null"]` == `{prop: "null"}`

### with value
* `[="name"]` == `'name'`
* `[=13]` == `13`

### multiple conditions
It works like AND  
`[prop=name][date=]` == `{prop: 'name', date: 'anything'}`

## Examples
### Long story short
Weather service API v1 file ![api_v1](./examples/api_v1.yaml)  
```
node index.js bundle --file examples/api_v1.yaml
```
And you have [bundled](./examples/api_v1.bundled.json) API file for version 1.  

Next you have version 2 in file [api_v2](./examples/api_v2.yaml), look how short it is. Compile it to have correct service API file for version 2
```
node index.js bundle --file examples/api_v2.yaml
```
Without JYBID you'd have to write it manually: [bundled](./examples/api_v2.bundled.json)

### Long story long
Suppose we have a weather forecast database and want to build a readonly service for it. We have data only for Russia and Finland and we supposed that cities in these countries always have different names so we dont need to specify country in request to our service. Of course this is not the best idea, but just for example..   
So, we have a sevice API [api_v1](./examples/api_v1.yaml).  
Also there are [bundled](./examples/api_v1.bundled.json) and [dereferenced](./examples/api_v1.dereferenced.json) documents.  
You can try bundling or dereferencing like this
```
node index.js bundle --file examples/api_v1.yaml
``` 

Ok, next month we add forecasts for Belarus and we have troubles now: for example a town named 'Kamenka' exists in Russia and in Belarus.  
Of course we need to add parameter `country` but we can't add it to v1 because some people already use our API in their app and it works ok in Russia and in Finland. If we add `country` with some default value many requests will fail. Well, we could make some workarounds based on city name being checked against list of all cities in our 3 countries but.. it is just better to make next version of API correct and ask our clients to use it instead of incorrect v1.  
So we need to replace unclear parameter 'names' with 'cities' and add 'country', this [api_v2](./examples/api_v2.yaml) is how we could do it with jybid  
Without inheritance you would have to make one of these documents manually [bundled](./examples/api_v2.bundled.json) [dereferenced](./examples/api_v2.dereferenced.json)  

In [api_v2](./examples/api_v2.yaml) you can find examples of inheritance  
```
$inherit:
  source:
    $ref: ./api_v1.yaml
  with:
```

Codewords are
* $inherit
* source
* with

Also there is an example of array selector  
```
    path: '/paths/~1city/get/parameters/[name=names]'
```

## Thanks
[json-schema-ref-parser](https://github.com/APIDevTools/json-schema-ref-parser)  
[rfc6902](https://github.com/chbrown/rfc6902)  
[json-ptr](https://github.com/flitbit/json-ptr)
