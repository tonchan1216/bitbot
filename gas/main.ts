const prop = PropertiesService.getScriptProperties().getProperties()
const COINCHECK_BASEURI = 'https://coincheck.com/api'
const COINCHECK_ACCESS_KEY = prop.COINCHECK_ACCESS_KEY
const COINCHECK_SECRET_KEY = prop.COINCHECK_SECRET_KEY
const SLACK_BASEURI = 'https://slack.com/api/chat.postMessage'
const SLACK_ACCESS_TOKEN = prop.SLACK_ACCESS_TOKEN
const CHANNEL_NAME = prop.CHANNEL_NAME

type Contents = Array<{
  type: string
  text?: Text
  accessory?: {
    type: string
    options: Array<{
      text: Text
      description: Text
      value: string
    }>
    action_id?: string
  }
  elements?: Array<{
    type: string
    text: Text
    value: string
    action_id: string
  }>
}>

type Text = {
  type: string
  text: string
  emoji?: boolean
}

// Slackにメッセージを投稿
function postMessage(contents: Contents, thread_ts = '') {
  // 投稿するチャンネルやメッセージ内容を入れる
  const payload = {
    token: SLACK_ACCESS_TOKEN,
    channel: CHANNEL_NAME,
    thread_ts: thread_ts,
    text: '',
    username: 'BitBot',
    icon_emoji: ':robot_face:',
    blocks: JSON.stringify(contents),
  }

  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    payload: payload,
    muteHttpExceptions: true,
  }

  const response = UrlFetchApp.fetch(SLACK_BASEURI, params)
  return JSON.parse(response.getContentText('UTF-8'))
}

// CoincheckからTickerを取得
function getTicker(pair = 'btc_jpy') {
  const query = {
    pair: pair,
  }
  const url = COINCHECK_BASEURI + '/ticker?' + buildParameter(query)
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'get',
    muteHttpExceptions: true,
  }

  const response = UrlFetchApp.fetch(url, params)
  return JSON.parse(response.getContentText('UTF-8'))
}

// Coincheckからレートを取得
function getRate(order_type = 'sell', pair = 'btc_jpy', amount = 1) {
  const query = {
    order_type: order_type,
    pair: pair,
    amount: amount,
  }
  const url = COINCHECK_BASEURI + '/exchange/orders/rate?' + buildParameter(query)
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'get',
    muteHttpExceptions: true,
  }

  const response = UrlFetchApp.fetch(url, params)
  return JSON.parse(response.getContentText('UTF-8'))
}

// CoincheckからAccount情報を取得
function getAccount() {
  const url = COINCHECK_BASEURI + '/accounts/balance'
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'get',
    headers: hmac(url),
    muteHttpExceptions: true,
  }

  const response = UrlFetchApp.fetch(url, params)
  return JSON.parse(response.getContentText('UTF-8'))
}

// 取引実行
function postOrder(rate: number, ammount: number, orderType = 'buy', pair = 'btc_jpy') {
  const url = COINCHECK_BASEURI + '/exchange/orders'
  const body = {
    pair: pair,
    order_type: orderType,
    rate: ['buy', 'sell'].includes(orderType) ? rate : null,
    ammount: orderType == 'market_buy' ? null : ammount,
    market_buy_amount: orderType == 'market_buy' ? ammount : null,
    stop_loss_rate: null,
  }
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    payload: JSON.stringify(body),
    headers: hmac(url, JSON.stringify(body)),
    contentType: 'application/json',
    muteHttpExceptions: true,
  }

  const response = UrlFetchApp.fetch(url, params)
  return JSON.parse(response.getContentText('UTF-8'))
}

// HMAC認証ダイジェストの発行
function hmac(url: string, payload?: string): GoogleAppsScript.URL_Fetch.HttpHeaders {
  const date = new Date()
  var nonce = Math.floor(date.getTime() / 1000).toString()
  const message = payload ? nonce + url + payload : nonce + url
  const signature = Utilities.computeHmacSha256Signature(message, COINCHECK_SECRET_KEY)
  const sign = signature.reduce((prev: string, current: number) => {
    const hexstr = (current < 0 ? current + 256 : current).toString(16)
    return prev + (hexstr.length == 1 ? '0' : '') + hexstr
  }, '')
  return {
    'ACCESS-KEY': COINCHECK_ACCESS_KEY,
    'ACCESS-NONCE': nonce,
    'ACCESS-SIGNATURE': sign,
  }
}

function buildParameter(params: { [key: string]: string | number }): string {
  return Object.keys(params)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
    .join('&')
}

// Slack通知
function notification(type: string, header: string, msg: string) {
  const icon = type == 'WARN' ? 'warning' : 'information_source'
  const contents: Contents = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `:${icon}: ${header}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'plain_text',
        text: msg,
        emoji: true,
      },
    },
  ]

  const response = postMessage(contents)

  if (!response['ok']) {
    console.error(response)
    throw new Error('slack post exception')
  }
}

// 取引ログ
function sheetLogger(rate: number, evaluate: number, action: string, volume: number) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('trade_log')
  const row: number = (sheet?.getLastRow() ?? 1) + 1
  const now: Date = new Date()

  sheet?.getRange(row, 1).setValue(Utilities.formatDate(now, 'JST', 'yyyy/MM/dd HH:mm:ss'))
  sheet?.getRange(row, 2).setNumberFormat('@')
  sheet?.getRange(row, 2).setValue(rate)
  sheet?.getRange(row, 3).setNumberFormat('@')
  sheet?.getRange(row, 3).setValue(evaluate)
  sheet?.getRange(row, 4).setValue(action)
  sheet?.getRange(row, 5).setValue(volume)
}

// 目標額の設定
function getTarget(): number {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('master')
  const start: string = sheet?.getRange(1, 2).getValue()
  const volume: string = sheet?.getRange(2, 2).getValue()

  const startDate = Date.parse(start)
  const today = new Date().getTime()
  const diff: number = Math.ceil((today - startDate) / 86400000)

  return diff > 0 ? diff * Number(volume) : 0
}

function getCurrency(): { currency: string; pair: string } {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('master')
  const currency: string = sheet?.getRange(3, 2).getValue() || 'btc'

  return { currency, pair: `${currency}_jpy` }
}

function main() {
  const { currency, pair } = getCurrency()

  const account = getAccount()
  if (!account['success']) {
    notification('WARN', `missed getAccount`, `account['error']`)
    throw new Error('account info exception')
  }

  const rate = Number(getRate('sell', pair)['rate'])

  const evaluate =
    account['jpy'] + account['jpy_reserved'] + rate * (account[currency] + account[`${currency}_reserved`])

  const targetVolume = getTarget()

  if (targetVolume == 0) {
    notification('WARN', `missed targetVolume`, `積み立て目標金額が設定できませんでした`)
    throw new Error('target volume exception')
  }

  let action = 'SKIP' // default
  let tradeVolume = 0
  let errorMsg = null

  if (evaluate > targetVolume * 1) {
    action = 'SELL'
    tradeVolume = evaluate - targetVolume
    const res = postOrder(rate, tradeVolume / rate, 'sell', pair)

    if (!res['success']) {
      errorMsg = res['error']
    }
  } else if (evaluate < targetVolume) {
    action = 'BUY'
    tradeVolume = targetVolume - evaluate
    const res = postOrder(rate, tradeVolume, 'market_buy', pair)

    if (!res['success']) {
      errorMsg = res['error']
    }
  }

  if (errorMsg) {
    notification('WARN', `missed ${action} ${currency.toUpperCase()}`, errorMsg)
    action += ' (FAIL)'
  } else {
    notification(
      'INFO',
      `取引(${action})を実行しました`,
      `通貨: ${currency.toUpperCase()}\n レート: ${rate}\n 取引額: ${tradeVolume}`
    )
  }

  sheetLogger(evaluate, rate, action, tradeVolume)
}
