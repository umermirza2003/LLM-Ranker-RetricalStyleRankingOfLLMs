/**

 * Loads provider definitions from numbered env vars API1..API5 (HF + Gemini).

 * The UI exposes 30 panels slots; wired slots map env blocks → panel positions:

 * API1→1 Gemini, API2→23 Qwen (HF Router), API3→2 Chat GPT, API4→30 Llama, API5→8 DeepSeek.

 */



const DEFAULT_MAX_SLOTS = 30

const HARD_CAP_SLOTS = 100



/** Panel column order (slots 1..30); only wired panels are selectable when keys exist. */

const PUBLIC_PANEL_LABELS = [

  'Gemini',

  'Chat GPT',

  'Copilot',

  'Claude',

  'Perplexity',

  'Z AI',

  'MGX',

  'DeepSeek',

  'Toolsaday',

  'Grok',

  'Meta',

  'Pi AI',

  'Sciweave',

  'Resea',

  'Deft GPT',

  'Deep AI',

  'Character AI',

  'KoalaChat',

  'FastBots',

  'ChatBot App',

  'Julius',

  'Gemma',

  'Mistral',

  'ChatGLM',

  'Qwen AI',

  'Replika AI',

  'Tulu Allen AI',

  'Noor AI',

  'Poe',

  'Llama',

]



/**

 * Env index (`API{k}_*` with k 1–5) → UI panel slot (1–30).

 */

const ENV_INDEX_TO_PANEL_SLOT = [undefined, 1, 23, 2, 30, 8]



const WIRED_ENV_COUNT = 5



function trimOrEmpty(value) {

  return typeof value === 'string' ? value.trim() : ''

}



function getMaxSlots() {

  const n = Number(process.env.API_MAX_SLOTS)

  if (Number.isFinite(n)) {

    const rounded = Math.trunc(n)

    if (rounded >= 1 && rounded <= HARD_CAP_SLOTS) return rounded

    console.warn(`[providers] API_MAX_SLOTS invalid (${process.env.API_MAX_SLOTS}); using ${DEFAULT_MAX_SLOTS}`)

    return DEFAULT_MAX_SLOTS

  }

  return DEFAULT_MAX_SLOTS

}



function parseSlot(envIndex) {

  const name = trimOrEmpty(process.env[`API${envIndex}_NAME`])

  const url = trimOrEmpty(process.env[`API${envIndex}_URL`])

  const requestBodyType = trimOrEmpty(process.env[`API${envIndex}_REQUEST_BODY_TYPE`]) || 'generic'

  const model = trimOrEmpty(process.env[`API${envIndex}_MODEL`])

  const key = trimOrEmpty(process.env[`API${envIndex}_KEY`])

  const responseJsonPath = trimOrEmpty(process.env[`API${envIndex}_RESPONSE_JSON_PATH`])

  const keyUrlPlaceholder = trimOrEmpty(process.env[`API${envIndex}_KEY_URL_PLACEHOLDER`])

  const extraPrompt = trimOrEmpty(process.env[`API${envIndex}_EXTRA_PROMPT`])



  const hasName = name.length > 0

  const hasUrl = url.length > 0



  if (!hasName && !hasUrl) {

    return { provider: null, skipReason: 'empty' }

  }



  if (!hasName || !hasUrl) {

    return {

      provider: null,

      skipReason: 'incomplete',

      detail: !hasName ? 'missing NAME' : 'missing URL',

    }

  }

  const provider = {

    envIndex,

    name,

    url,

    key,

    responseJsonPath,

    keyUrlPlaceholder,

    requestBodyType,

    model,

    extraPrompt,

  }



  return { provider, skipReason: null }

}



/**

 * Whether the server can authenticate this provider (never inspects or returns key material).

 */

function providerHasCredentials(provider) {

  const k = (provider.key || '').trim()

  if (k.length > 0) return true



  const url = provider.url || ''

  const placeholder =

    url.includes('{{API_KEY}}') ||

    url.includes('{API_KEY}') ||

    (provider.keyUrlPlaceholder && url.includes(provider.keyUrlPlaceholder))



  if (placeholder) return false



  const keyParam = url.match(/[?&]key=([^&]+)/i)

  if (keyParam && keyParam[1] && keyParam[1].trim().length > 0) return true



  const accessTok = url.match(/[?&]access_token=([^&]+)/i)

  if (accessTok && accessTok[1] && accessTok[1].trim().length > 0) return true



  return false

}



function warnIfRisky(provider) {

  const t = String(provider.requestBodyType).toLowerCase()

  const ix = provider.envIndex

  const urlHasKeySlot =

    provider.url.includes('{{API_KEY}}') ||

    provider.url.includes('{API_KEY}') ||

    provider.url.includes('key=')



  if (t === 'gemini' && provider.key.length === 0) {

    console.warn(

      `[providers] Env API${ix} (${provider.name}): Gemini REQUEST_BODY_TYPE but API${ix}_KEY is empty.`,

    )

  }



  if (

    (t === 'openai_chat' || t === 'chat_completions') &&

    provider.key.length === 0 &&

    !urlHasKeySlot

  ) {

    console.warn(

      `[providers] Env API${ix} (${provider.name}): ${t} with no API${ix}_KEY and no key placeholder in URL — requests may fail with 401.`,

    )

  }

}



/**

 * Fully configured runnable providers from API1..API5, each stamped with panelSlot.

 */

function getConfiguredProviders() {

  const providers = []



  for (let envIndex = 1; envIndex <= WIRED_ENV_COUNT; envIndex += 1) {

    const panelSlot = ENV_INDEX_TO_PANEL_SLOT[envIndex]

    if (!Number.isFinite(panelSlot)) continue



    const { provider, skipReason, detail } = parseSlot(envIndex)



    if (skipReason === 'incomplete') {

      console.warn(

        `[providers] Env API${envIndex} incomplete (${detail}); fix API${envIndex}_NAME/API${envIndex}_URL (panels ${panelSlot} depends on this).`,

      )

      continue

    }

    if (!provider) continue



    provider.panelSlot = panelSlot

    warnIfRisky(provider)

    providers.push(provider)

  }



  return providers

}



function panelLabel(panelIndex0) {

  if (panelIndex0 >= 0 && panelIndex0 < PUBLIC_PANEL_LABELS.length)

    return PUBLIC_PANEL_LABELS[panelIndex0]

  return `Slot ${panelIndex0 + 1}`

}



/**

 * GET /providers: rows for panel slots 1..maxSlots; wired slots use API1–5 above.

 */

function getPublicProvidersCatalog() {

  const max = Math.min(Math.max(getMaxSlots(), PUBLIC_PANEL_LABELS.length), HARD_CAP_SLOTS)

  const runnable = getConfiguredProviders()

  const byPanel = new Map(runnable.map((p) => [p.panelSlot, p]))



  const out = []

  for (let panelSlot = 1; panelSlot <= max; panelSlot += 1) {

    const p = byPanel.get(panelSlot)

    const name = panelLabel(panelSlot - 1)

    const configured = Boolean(p)

    const hasApiKey = Boolean(configured && providerHasCredentials(p))



    out.push({

      slot: panelSlot,

      name,

      configured,

      hasApiKey,

    })

  }



  return out

}



/**

 * Order runnable providers by selected panel-slot order.

 */

function pickProvidersBySlotOrder(activeProviders, wantedSlotOrder) {

  if (!Array.isArray(wantedSlotOrder) || wantedSlotOrder.length === 0) return [...activeProviders]



  const byPanel = new Map(activeProviders.map((p) => [p.panelSlot, p]))

  const ordered = []

  const seen = new Set()



  wantedSlotOrder.forEach((raw) => {

    const slotNum = Math.trunc(Number(raw))

    if (!Number.isFinite(slotNum) || slotNum < 1 || seen.has(slotNum)) return

    seen.add(slotNum)

    const found = byPanel.get(slotNum)

    if (found) ordered.push(found)

    else console.warn(`[providers] Panel slot ${slotNum} has no wired backend — ignoring.`)

  })



  return ordered

}



module.exports = {

  DEFAULT_MAX_SLOTS,

  getMaxSlots,

  getConfiguredProviders,

  getPublicProvidersCatalog,

  pickProvidersBySlotOrder,

  providerHasCredentials,

  PUBLIC_PANEL_LABELS,

}


