import { expect, test } from 'vitest'
import { createServer } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import WebSocket from 'ws'
import { apply } from '../src/index.ts'
import { AGENDA_TOOL_NAMES } from '../src/host/tools.ts'

test('真实目标 peers：工具和两页面共用通知；年度监听刷新；卸载移除注册', async () => {
  const root = await mkdtemp(join(tmpdir(),'agenda-host-'))
  const previous = process.env.DSH_DATA_DIR; process.env.DSH_DATA_DIR = root
  const disposers: Array<() => unknown> = [], tools = new Map<string,any>()
  let upgrade: any, agenda: any
  const ctx: any = {
    effect(fn: () => () => unknown) { disposers.push(fn()) },
    provide(_name: string, value: unknown) { agenda=value; return () => { agenda=null } },
    inject(_services: string[], _fn: unknown) {},
    logger: { warn(message: unknown) { throw Error(String(message)) } },
    tools: { register(tool: any) { tools.set(tool.name,tool); return () => tools.delete(tool.name) } },
    webServer: { registerUpgrade(route: any) { upgrade=route; return () => {upgrade=null} } },
  }
  const server = createServer(); const sockets: WebSocket[] = []
  try {
    await apply(ctx)
    expect([...tools.keys()]).toEqual([...AGENDA_TOOL_NAMES])
    server.on('upgrade',(req,socket,head) => upgrade.handler(req,socket,head))
    server.listen(0,'127.0.0.1'); await once(server,'listening')
    const url = `ws://127.0.0.1:${(server.address() as any).port}/agenda/ws`
    const snapshots: any[][] = [[],[]]
    for (let i=0;i<2;i++) {
      const socket = new WebSocket(url,{origin:'dsh-app://app'}); sockets.push(socket)
      socket.on('message',raw => { const value=JSON.parse(String(raw)); if(value.type==='snapshot') snapshots[i]!.push(value.snapshot) })
      await once(socket,'open'); socket.send(JSON.stringify({type:'hello'}))
    }
    const wait = async (predicate: () => boolean) => {
      const deadline=Date.now()+3000
      while(!predicate() && Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,20))
      expect(predicate()).toBe(true)
    }
    await wait(()=>snapshots.every(list=>list.length===1))
    const tool = tools.get('agenda_create_event')
    const result=await tool.execute({title:'同步验证',start:'2026-10-14T09:00',end:'2026-10-14T10:00'}, {signal:new AbortController().signal})
    expect(result.ok).toBe(true)
    await wait(()=>snapshots.every(list=>list.at(-1)?.events.length===1))
    const rev=snapshots[0]!.at(-1).settingsRevision
    sockets[0]!.send(JSON.stringify({type:'op',id:'settings',op:'update-settings',args:{patch:{weekStart:'sunday'},expectedRevision:rev}}))
    await wait(()=>snapshots.every(list=>list.at(-1)?.settings.weekStart==='sunday'))
    await writeFile(join(root,'agenda','holidays','2027.yaml'),'year: 2027\nholidays:\n  - name: 自定义假期\n    dates: ["2027-01-04"]\nworkdays: []\n')
    await wait(()=>snapshots.every(list=>list.at(-1)?.holidayData.localOverrideYears.includes(2027)))
    const effective=await agenda.getSnapshot(); expect(effective.dataVersion).toBe(3)
    const bad = new WebSocket(url,{origin:'dsh-app://evil'}); bad.on('error',()=>{}); await new Promise(resolve=>bad.once('close',resolve))
    for(const socket of sockets) socket.close()
    await Promise.all(sockets.map(socket=>socket.readyState===WebSocket.CLOSED?Promise.resolve():once(socket,'close')))
    for(const dispose of disposers.splice(0).reverse()) await dispose()
    expect(upgrade).toBe(null); expect(tools.size).toBe(0); expect(agenda).toBe(null)
  } finally {
    sockets.forEach(socket=>socket.terminate())
    for(const dispose of disposers.splice(0).reverse()) await dispose()
    await new Promise<void>(resolve=>server.close(()=>resolve()))
    if(previous===undefined) delete process.env.DSH_DATA_DIR; else process.env.DSH_DATA_DIR=previous
    await rm(root,{recursive:true,force:true})
  }
},10_000)
