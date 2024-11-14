import $RefParser from "@apidevtools/json-schema-ref-parser"
import fs from 'fs'
import path from 'path'
import { dirname } from 'path'  // Changed this line
import yaml from 'js-yaml'

// Lot of weird variable names, following the spec - https://learn.openapis.org/specification/

const writeYaml = async (path, contents) => {
    try {
        await fs.promises.mkdir(dirname(path), { recursive: true });
        await fs.promises.writeFile(
            path,
            yaml.dump(contents,{lineWidth: -1,})
        );
      } catch (error) {
        throw error; // lol, TODO: make work blank file
      }
}

const intersect = (a, b) => {
    var setB = new Set(b);
    return [...new Set(a)].filter(x => setB.has(x));
}

const pathItemMethodKeys = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] // https://spec.openapis.org/oas/v3.1.0#path-item-object

const removeUntaggedMethodsFromPathItem = (pathItem, targetTags) => {
    const PathItemKeys = Object.keys(pathItem)
    console.log({PathItemKeys, targetTags})
    const PathItemKeysNoUntaggedMethodKeys = PathItemKeys.filter(k=>{
        const isMethodKey = pathItemMethodKeys.includes(k)
        const noTargetTag = !intersect(pathItem[k].tags ?? [], targetTags).length
        return !(isMethodKey && noTargetTag)
    })
    console.log({PathItemKeysNoUntaggedMethodKeys});
    const strippedPathItem = {}
    for (const k of PathItemKeysNoUntaggedMethodKeys) {
        strippedPathItem[k] = pathItem[k]
    }
    // console.log(strippedPathItem);
    // If none of the methods had tags, don't return any of the other fields
    return (intersect(PathItemKeysNoUntaggedMethodKeys, pathItemMethodKeys).length) ? strippedPathItem : {}
}



const timestamp = Date.now().toString()
const apiFileSuffix = 'openapi.yaml'
// const timestamp = 'hardcoded' // TODO: remove
const originalFile = path.join('testfiles', 'original', 'petstore-tag-grouped.yaml')
const unbundledDir = path.join('testfiles', 'unbundled', timestamp)
const rebundledDir = path.join('testfiles', 'rebundled', timestamp)
// Unbundling
// -----------------------
const originalSchema = await $RefParser.bundle(originalFile); // In case URL/other refs
let schemaToSplit = structuredClone(originalSchema)
// pull out shared components
const components = {components: schemaToSplit.components}
const componentsFile = path.join(unbundledDir, 'components.yaml')
schemaToSplit.components = {'$ref': `./components.yaml#/components`}
await writeYaml(componentsFile, components)
// TODO: Split out files by tag group
for (const tagGroup of schemaToSplit['x-tagGroups']) {
    console.log({tagGroup});
    const groupedSchema = structuredClone(schemaToSplit)
    // console.log({groupedSchema});
    groupedSchema.info.title = tagGroup.name // Naming the spec
    let paths = {}
    for (const path of Object.keys(groupedSchema.paths)) {
        console.log(path);
        const strippedPath = removeUntaggedMethodsFromPathItem(groupedSchema.paths[path], tagGroup.tags)
        if (Object.keys(strippedPath).length) {
            paths[path] = strippedPath
        }
    }
    console.log({paths});
    groupedSchema.paths = paths
    // TODO: parallel promises
    const tagGroupFile = tagGroup.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    await writeYaml(
        path.join(unbundledDir,`${tagGroupFile}-${apiFileSuffix}`),
        groupedSchema
    )
}

const files = (await fs.promises.readdir(unbundledDir)).filter(f=>f.endsWith(apiFileSuffix))
console.log({files});
// Rebundling
for (const file of files) {
    const rebundledSchema = await $RefParser.bundle(path.join(unbundledDir, file));
    console.log({rebundledSchema});
    await writeYaml(
        path.join(rebundledDir, file), 
        rebundledSchema,
    )
}

