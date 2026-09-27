import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generate, loadPreset, presetNames, validateSpec, layoutMap, planTravel, tokenAt, encodeSpecForUrl, decodeSpecFromUrl, metrics } from '../src/index'

test('every preset generates a valid spec', () => {
  for (const name of presetNames()) {
    const spec = generate(loadPreset(name), 7)
    const v = validateSpec(spec)
    assert.ok(v.ok, `${name}: ${v.errors.join('; ')}`)
    assert.ok(spec.tokens.length > 0)
  }
})

test('same seed, same spec; different seed, different tokens', () => {
  const a = generate(loadPreset('procedural'), 42), b = generate(loadPreset('procedural'), 42), c = generate(loadPreset('procedural'), 43)
  assert.deepEqual(a, b)
  assert.notDeepEqual(a.tokens, c.tokens)
})

test('layout places every node, end and edge, in both orientations', () => {
  const spec = generate(loadPreset('play-classic'), 1)
  for (const [w, h] of [[1200, 600], [420, 800]] as const) {
    const L = layoutMap(spec, { width: w, height: h })
    assert.equal(Object.keys(L.nodes).length, spec.nodes.length)
    assert.equal(Object.keys(L.ends).length, spec.endStates.length)
    assert.equal(Object.keys(L.edges).length, spec.edges.length)
    for (const e of Object.values(L.edges)) assert.ok(e.path.length > 0, `edge ${e.id} has length`)
    assert.equal(L.orientation, w < 640 ? 'vertical' : 'horizontal')
  }
})

test('tokens travel from start to finish inside the canvas', () => {
  const spec = generate(loadPreset('rework-loop'), 3)
  const L = layoutMap(spec, { width: 1000, height: 500 })
  for (const t of spec.tokens.slice(0, 20)) {
    const plan = planTravel(spec, t)
    assert.equal(plan.legs[0].t0, t.startedAt)
    assert.ok(Math.abs(plan.legs[plan.legs.length - 1].t1 - t.finishedAt) < 1e-6)
    for (let k = 0; k <= 10; k++) {
      const s = tokenAt(plan, L, t.startedAt + ((t.finishedAt - t.startedAt) * k) / 10)
      assert.ok(s, 'token has a position during its life')
      assert.ok(s!.x >= -1 && s!.x <= 1001 && s!.y >= -1 && s!.y <= 501, `inside canvas: ${s!.x},${s!.y}`)
    }
    assert.equal(tokenAt(plan, L, t.finishedAt + 1), null)
  }
})

test('metrics trace to the token list', () => {
  const spec = generate(loadPreset('model-split'), 5)
  const s = metrics.strip(spec)
  assert.equal(s.finished, spec.tokens.length)
  const dist = metrics.endStateDistribution(spec)
  assert.equal(Object.values(dist).reduce((a, b) => a + b, 0), spec.tokens.length)
  const rows = metrics.splitBy(spec, 'model')
  assert.ok(rows.some((r) => r.key === 'Model A') && rows.some((r) => r.key === 'Model B'))
  assert.ok(metrics.strip(spec, 300).finished < s.finished, 'fewer finished earlier in the clock')
  assert.ok(metrics.describe(spec).includes('work items finished'))
})

test('spec survives a URL round trip', () => {
  const spec = generate(loadPreset('agent-handoff-to-qa'), 9)
  const back = decodeSpecFromUrl(encodeSpecForUrl(spec))
  assert.ok(back)
  assert.deepEqual(back!.nodes, spec.nodes)
  assert.deepEqual(back!.edges, spec.edges)
})
