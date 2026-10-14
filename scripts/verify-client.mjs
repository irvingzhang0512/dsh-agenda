import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url),code=fs.readFileSync(new URL('../lib/client.js',import.meta.url),'utf8')
assert(!/require\(["'](?:node:|@deepseek-ai\/(?!dsh-client-ui-primitives))/.test(code),'client contains host imports')
let bundle
const styles=[],slots=[],disposers=[]
const document={head:{appendChild:node=>styles.push(node),querySelectorAll:()=>styles},createElement:()=>({setAttribute(){},remove(){styles.splice(0)}})}
vm.runInNewContext(code,{console,document,window:{clearTimeout,__ModuleLoader__:{load(value){assert.equal(value.id,'dsh-agenda');bundle=value.factory(id=>{
  if(id==='react'||id==='react/jsx-runtime')return require(id)
  if(id==='@deepseek-ai/dsh-client-ui-primitives')return {Button:'button',SegmentedTabs:'div'}
  throw Error('Unexpected client dependency '+id)
})}}}})
bundle.apply({slots:{inject(_name,fn){disposers.push(fn())},register(options,component){slots.push({options,component});return ()=>{slots.splice(slots.findIndex(x=>x.options===options),1)}}},effect(fn){disposers.push(fn())}})
assert.deepEqual(slots.map(x=>x.options.name),['main','plugins.bundle.config','sidebar.panellist'])
for(const {component} of slots)assert(component({view:'summary',size:18,active:false}),'initial slot render failed')
assert.equal(styles.length,1)
for(const dispose of disposers.reverse())dispose()
assert.equal(slots.length,0);assert.equal(styles.length,0)
console.log('Client bundle: host import fence, loader, three slots, initial elements and cleanup passed')
