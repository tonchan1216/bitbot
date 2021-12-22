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
    muteHttpExceptions : true,
  }

  const response = UrlFetchApp.fetch(SLACK_BASEURI, params)
  return JSON.parse(response.getContentText('UTF-8'))
}

// CoincheckからTickerを取得
function getTicker() {
  const url = COINCHECK_BASEURI + '/ticker'
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'get',
    muteHttpExceptions : true,
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
    muteHttpExceptions : true,
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
    payload: body,
    headers: hmac(url, body),
    muteHttpExceptions : true,
  }

  const response = UrlFetchApp.fetch(url, params)
  console.log(JSON.parse(response.getContentText('UTF-8')))
  return JSON.parse(response.getContentText('UTF-8'))
}

// HMAC認証ダイジェストの発行
function hmac(url: string, data?: any): GoogleAppsScript.URL_Fetch.HttpHeaders {
  const date = new Date()
  var nonce = Math.floor(date.getTime() / 1000).toString()
  const message = data ? nonce + url + JSON.stringify(data) : nonce + url
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

// エラー処理
function errorHandle(header: string, msg: string) {
  const contents: Contents = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: ':warning: ' + header,
      },
    },
    {
      type: 'section',
      text: {
        type: 'plain_text',
        text: msg,
      },
    },
  ]

  const response = postMessage(contents)

  if (!response['ok']) {
    console.log(msg)
    console.log(response)
  }
}

// 取引実行のお知らせ
function notification(msg: string) {
  const contents: Contents = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: ':information_source: 取引を実行しました',
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
    console.log(response)
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

function main() {
  const account = getAccount()
  if (!account['success']) {
    errorHandle('missed getAccount', account['error'])
    return
  }

  const ticker = getTicker()
  const rate = Number(ticker['last'])

  const evaluate = account['jpy'] + account['jpy_reserved'] + rate * (account['btc'] + account['btc_reserved'])

  const targetVolume = getTarget()

  if (targetVolume == 0) {
    errorHandle('missed targetVolume', '積み立て目標金額が設定できませんでした')
    return
  }

  let action = 'SKIP' // default
  let tradeVolume = 0
  if (evaluate > targetVolume * 1.12) {
    tradeVolume = (evaluate - targetVolume) / rate // BTC
    const res = postOrder(rate, tradeVolume, 'sell')

    if (!res['success']) {
      action = 'FAIL'
      errorHandle('missed sell BTC', res['error'])
    } else {
      action = 'SELL'
      notification('SELL')
    }
  } else if (evaluate < targetVolume) {
    if (account['jpy'] <= targetVolume - evaluate) {
      action = 'SHORT'
      errorHandle('missed buy BTC', '残高が不足しています')
    } else {
      tradeVolume = targetVolume - evaluate // JPY
      const res = postOrder(rate, tradeVolume, 'market_buy_amount')

      if (!res['success']) {
        action = 'FAIL'
        errorHandle('missed buy BTC', res['error'])
      } else {
        action = 'BUY'
        notification('BUY')
      }
    }
  }

  sheetLogger(evaluate, rate, action, tradeVolume)
}
