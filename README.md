# JYBID
![main](https://github.com/funduck/jybid/actions/workflows/main.yml/badge.svg)

**j**son **y**aml **b**undle **i**nherit **d**ereference **

This lib allows to manipulate `json` and `yaml` documents:
* bundle a collection of related documents into one
* inherit documents using [JSON-Patch](http://jsonpatch.com/)
* dereference - remove all internal and external references and make a flat document

[Good example](#long-story-short)

## Installation  
```
npm i jybid
```

## Contents

[Bundle](#bundle)  
[Dereference](#dereference)  
[Selectors](#selectors)  
[Examples](#examples)  

## Purpose
* Split big documents into parts
* Reference and **inherit** one documents from another
* Have differences between documents in form of [JSON-Patch](http://jsonpatch.com/)  

## Why would somebody want that?  
Well, when I was writing some API docs in [OpenAPI](https://www.openapis.org/) I had troubles:
1. One doc for whole API is too big
2. Docs sometimes logically extend one another, especially when new versions of API added
3. How to get pretty diff between versions of API? It would be great to have [JSON-Patch](http://jsonpatch.com/) and visualize it [somehow](https://github.com/benjamine/jsondiffpatch)

So I wanted to:
1. Use `json` and `yaml` files
2. Be able to split big files into several smaller
3. Have some inheritance technique based on JSON-Patch

**1** comes easy, it can be solved by [json-schema-ref-parser](https://github.com/APIDevTools/json-schema-ref-parser)  
**2** also has a solution like [ajv-merge-patch](https://github.com/epoberezkin/ajv-merge-patch)  
But all together it doesn't work out of box.

So I made a little patch to [json-schema-ref-parser](https://github.com/APIDevTools/json-schema-ref-parser) that enables inheritance based on JSON-Patch syntax.  
Also I extended JSON-Pointer with more pretty array indexes in [selectors](#selectors).

# Methods
## Bundle
**bundle(filepath, options) returns Promise with object** - to bundle a file.  
File `filepath` is read, all its external references are collected and added into resulting document.  
Resulting document may contain internal references.  

## Dereference
**dereference(filepath, options) returns Promise with object** - to bundle a file and resolve even internal references.  
Bundles file `filepath` and then resolves all internal references.


## Options
### For both
* if `options.inherit==true` then **json-patches** under keyword `$inherit` will be compiled and [jybid selectors](#selectors) are available  
* if `options.inherit` is a string then this value is used as keyword instead of `"$inherit"`. If `options.inherit="$patch"` then document automatically complies by [ajv-merge-patch](https://github.com/ajv-validator/ajv-merge-patch) and [jybid selectors](#selectors) are **not** available.

## Example:
```JavaScript
const { bundle, dereference } = require('./index')
const fs = require('fs')
const files = {
    'a.json': `
{
    "a": 1,
    "c": {
        "$ref": "#/d"
    },
    "d": 4
}
`,
    'b.json': `
{
    "$inherit": {
        "source": {"$ref": "./a.json"},
        "with": [{"op": "add", "path": "/b", "value": 2}]
    }
}
`
}
for (const [filepath, content] of Object.entries(files)) {
    fs.writeFileSync(filepath, content, {encoding: 'utf8'})
}

bundle('b.json').then((doc) => {console.log('\nSimple bundle:\n', JSON.stringify(doc));})

bundle('b.json', {inherit: true}).then((doc) => {console.log('\nBundle and compile inheritance:\n', JSON.stringify(doc));})

dereference('b.json', {inherit: true}).then((doc) => {console.log('\nDereference:\n', JSON.stringify(doc));})
```

```
Bundle (external references resolved):
 {"$inherit":{"source":{"a":1,"c":{"$ref":"#/%24inherit/source/d"},"d":4},"with":[{"op":"add","path":"/b","value":2}]}}

Bundle and compile inheritance:
 {"a":1,"c":{"$ref":"#/d"},"d":4,"b":2}

Dereference:
 {"a":1,"c":4,"d":4,"b":2}
```

## CompilePatchOps
**compilePatchOps(source, patch) returns Array**  

If we use [jybid selectors](#selectors) in [JSON-Patch](http://jsonpatch.com/), we can compile patches to JSON-Patch with [JSON-Pointer](https://tools.ietf.org/html/rfc6901)

When source document is bundled we check every patch operation:
1. if it contains selector in **path**
2. corresponding object in source is array  

then we replace it with equal operation with JSON-Pointer path, for example we have an object:
```
{
  arr: [
    {a: 1},
    {c: 2},
    {c: {$ref: '#/d'}},
    {d: 4}
  ]
}
```
And we want to replace all `{c:*}` with `{c:2}`  
We could write a selector for that: `/arr/[c=]`  
And after compilation we would have ordinary JSON-Patch object
```
[ { op: 'replace', path: '/arr/1', value: 2 },
  { op: 'replace', path: '/arr/2', value: 2 } ]
```
Full example:
```JavaScript
const { compilePatchOps } = require('./index')

compilePatchOps(
    {arr: [{a: 1}, {c: 2}, {c: {$ref: '#/d'}}, {d: 4}]},
    [{op: 'replace', path: '/arr/[c=]', value: 2}]
);

[ { op: 'replace', path: '/arr/1', value: 2 },
  { op: 'replace', path: '/arr/2', value: 2 } ]
>
```

# Selectors
[by property value](#by-propertyvalue-pairs)  
[with property](#with-property)  
[with value](#with-value)  

In [JSON-Patch](http://jsonpatch.com/) **path** must be a [JSON-Pointer](https://tools.ietf.org/html/rfc6901), but referencing array elements does not look good: what means `path: '/2'`?  You never know until you see the object to which you apply the patch.  
```
object = [1,2,234]
patch = [{op: 'remove', path: '/2'}]
```
Now we know, we wanted to remove `234`.  
Why not select element by its properties or value like in jquery? For particular example it could be like this:
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

## by property=value pairs
Value is treated as string if possible and as number if it can't be string
* `[prop=value]` == `{prop: 'value'}`  
* `[prop="13"]` == `{prop: '13'}`  
* `[prop=42]` == `{prop: 42}`  
* `["string attr name"=name]` == `{'string attr name': 'name'}` To reference compicated property name use double quotes  

## with property
* `[prop=]` == `{prop: 1}` or `{prop: 'a'}` or `{prop: null}`  
* `["string attr name"=]` for quoted property name  
* `[prop=null]` == `{prop: null}`
* `[prop="null"]` == `{prop: "null"}`

## with value
* `[="name"]` == `'name'`
* `[=13]` == `13`

## multiple conditions
Logical **and**  
`[prop=name][date=]` == `{prop: 'name', date: 'anything'}`

# Examples
## Long story short
Suppose we have a weather service API version 1 file ![api_v1](./examples/api_v1.yaml)  
```
node index.js bundle --file examples/api_v1.yaml
```
And you have [bundled](./examples/api_v1.bundled.json) API file for version 1.  

Now we write version 2 in file [api_v2](./examples/api_v2.yaml), look how short it is! Compile it to have full API file for version 2
```
node index.js bundle --file examples/api_v2.yaml
```
Without JYBID you would have to write it manually: [bundled](./examples/api_v2.bundled.json)

## Long story long
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

Keywords are
* $inherit
* source
* with

Also there is an example of array selector  
```
    path: '/paths/~1city/get/parameters/[name=names]'
```

# Thanks
[json-schema-ref-parser](https://github.com/APIDevTools/json-schema-ref-parser)  
[rfc6902](https://github.com/chbrown/rfc6902)  
[json-ptr](https://github.com/flitbit/json-ptr)
