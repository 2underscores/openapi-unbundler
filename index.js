import $RefParser from "@apidevtools/json-schema-ref-parser"
import fs from 'fs'
import path from 'path'
import { dirname } from 'path'
import yaml from 'js-yaml'

// Lot of weird variable names, following the spec - https://learn.openapis.org/specification/

const writeYaml = async (path, contents) => {
    await fs.promises.mkdir(dirname(path), { recursive: true });
    await fs.promises.writeFile(
        path,
        yaml.dump(contents,{lineWidth: -1,})
    );
}

const intersect = (a, b) => {
    var setB = new Set(b);
    return [...new Set(a)].filter(x => setB.has(x));
}

const filterPathItemMethodsByTags = (pathItem, targetTags, filterForHasTag=true) => {
    // Might need an "untagged" one to sweep untagged endpoint into one
    const pathItemMethodKeys = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] // https://spec.openapis.org/oas/v3.1.0#path-item-object
    const PathItemKeys = Object.keys(pathItem)
    console.log({PathItemKeys, targetTags})
    const PathItemKeysNoUntaggedMethodKeys = PathItemKeys.filter(k=>{
        const isMethodKey = pathItemMethodKeys.includes(k)
        const noTargetTag = !intersect(pathItem[k].tags ?? [], targetTags).length
        return (filterForHasTag) ? !(isMethodKey && noTargetTag) : (isMethodKey && noTargetTag) 
    })
    console.log({PathItemKeysNoUntaggedMethodKeys});
    const strippedPathItem = {}
    for (const k of PathItemKeysNoUntaggedMethodKeys) {
        strippedPathItem[k] = pathItem[k]
    }
    // If none of the methods had tags, don't return any of the other fields
    return (intersect(PathItemKeysNoUntaggedMethodKeys, pathItemMethodKeys).length) ? strippedPathItem : {}
}


const timestamp = Date.now().toString()
const apiFileSuffix = 'openapi.yaml'
const originalFile = path.join('testfiles', 'original', 'petstore-tag-grouped.yaml')
const unbundledDir = path.join('testfiles', 'unbundled', timestamp)
const rebundledDir = path.join('testfiles', 'rebundled', timestamp)
const sharedComponentFile = 'components.yaml'

// Unbundling
const originalSchema = await $RefParser.bundle(originalFile); // In case URL/other refs
let schemaToSplit = structuredClone(originalSchema)
// Pull out shared components file
// TODO: optimise. All references actually need to point direct to external file.
// Right now they all point components, which points to external file
// This means on rebundle, everything is reimported
const components = {components: schemaToSplit.components}
const componentsFile = path.join(unbundledDir, sharedComponentFile)
await writeYaml(componentsFile, components)
schemaToSplit.components = {'$ref': `./${sharedComponentFile}#/components`}
// Make new API file per tag group
for (const tagGroup of schemaToSplit['x-tagGroups']) {
    console.log({tagGroup});
    const groupedSchema = structuredClone(schemaToSplit)
    groupedSchema.info.title = tagGroup.name // Naming the API spec
    let paths = {}
    // Only include paths that have keys in the tag group
    for (const path of Object.keys(groupedSchema.paths)) {
        console.log(path);
        const strippedPath = filterPathItemMethodsByTags(groupedSchema.paths[path], tagGroup.tags)
        if (Object.keys(strippedPath).length) {
            paths[path] = strippedPath
        }
    }
    console.log({paths});
    groupedSchema.paths = paths
    // Write file. TODO: parallel writes
    const tagGroupFile = tagGroup.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    await writeYaml(
        path.join(unbundledDir,`${tagGroupFile}-${apiFileSuffix}`),
        groupedSchema
    )
}
// Write file for all missing tags
const untaggedRoutesApiName = 'Ungrouped APIs' // hardcoded filename
const allGroupedTags = schemaToSplit['x-tagGroups'].reduce((allTags, tagGrp)=>[...allTags, ...tagGrp.tags], [])
console.log({allGroupedTags});
const groupedSchema = structuredClone(schemaToSplit)
groupedSchema.info.title = untaggedRoutesApiName // Naming the API spec
let paths = {}
for (const path of Object.keys(groupedSchema.paths)) {
    console.log(path);
    const strippedPath = filterPathItemMethodsByTags(groupedSchema.paths[path], allGroupedTags, false) // Inverted, different tag set
    if (Object.keys(strippedPath).length) {
        paths[path] = strippedPath
    }
}
groupedSchema.paths = paths
const tagGroupFile = untaggedRoutesApiName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
await writeYaml(
    path.join(unbundledDir,`${tagGroupFile}-${apiFileSuffix}`),
    groupedSchema
)

// Rebundling the shared components to each API
const files = (await fs.promises.readdir(unbundledDir)).filter(f=>f.endsWith(apiFileSuffix))
console.log({files});
for (const file of files) {
    const rebundledSchema = await $RefParser.bundle(path.join(unbundledDir, file));
    console.log({rebundledSchema});
    await writeYaml(
        path.join(rebundledDir, file), 
        rebundledSchema,
    )
}

