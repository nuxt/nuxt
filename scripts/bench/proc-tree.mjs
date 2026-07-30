import { readdirSync, readFileSync } from 'node:fs'
const root = Number(process.argv[2])
const rows = []
for (const e of readdirSync('/proc')) {
  if (!/^\d+$/.test(e)) { continue }
  try {
    const stat = readFileSync(`/proc/${e}/stat`, 'utf8')
    const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1])
    const rss = Number(readFileSync(`/proc/${e}/statm`, 'utf8').split(' ')[1]) * 4096
    const cmd = readFileSync(`/proc/${e}/cmdline`, 'utf8').split('\0').join(' ').trim()
    rows.push({ pid: Number(e), ppid, rss, cmd })
  } catch {}
}
const wanted = new Set([root])
let changed = true
while (changed) { changed = false; for (const r of rows) { if (wanted.has(r.ppid) && !wanted.has(r.pid)) { wanted.add(r.pid); changed = true } } }
let total = 0
for (const r of rows.filter(r => wanted.has(r.pid))) { total += r.rss; console.log(`${String(r.pid).padStart(7)} ppid=${String(r.ppid).padStart(7)} ${(r.rss / 1048576).toFixed(0).padStart(5)} MB  ${r.cmd.slice(0, 120)}`) }
console.log(`total ${(total / 1048576).toFixed(0)} MB`)
