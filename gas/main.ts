const prop = PropertiesService.getScriptProperties().getProperties()
const coincheck_baseuri = "https://coincheck.com/api"
const slack_baseuri = "https://slack.com/api/chat.postMessage"
const COINCHECK_ACCESS_KEY = prop.COINCHECK_ACCESS_KEY
const COINCHECK_SECRET_KEY = prop.COINCHECK_SECRET_KEY
const SLACK_ACCESS_TOKEN = prop.SLACK_ACCESS_TOKEN
const CHANNEL_ID = prop.CHANNEL_ID

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
    token: prop.ACCESS_TOKEN,
    channel: prop.CHANNEL_ID,
    thread_ts: thread_ts,
    text: '',
    blocks: JSON.stringify(contents),
  }

  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    payload: payload,
  }

  const response = UrlFetchApp.fetch(slack_baseuri, params)
  return JSON.parse(response.getContentText('UTF-8'))
}

// CoincheckからTickerを取得
function getTicker() {
  const url = coincheck_baseuri + '/ticker'
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'get',
  }

  const response = UrlFetchApp.fetch(url, params)
  return JSON.parse(response.getContentText('UTF-8'))
}

// CoincheckからAccount情報を取得
function getAccount() {
  const url = coincheck_baseuri + '/accounts/balance'
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'get',
    headers: hmac(url)
  }

  const response = UrlFetchApp.fetch(url, params)
  return JSON.parse(response.getContentText('UTF-8'))
}

// 取引実行
function postOrder(rate:number, ammount:number, order_type = "buy", pair = "btc_jpy") {
  const url = coincheck_baseuri + '/exchange/orders'
  const body = {
    rate: rate,
    ammount: ammount,
    order_type: order_type,
    pair: pair
  }
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    payload: body,
    headers: hmac(url, body)
  }

  const response = UrlFetchApp.fetch(url, params)
  console.log(JSON.parse(response.getContentText('UTF-8')))
  return JSON.parse(response.getContentText('UTF-8'))
}

// HMAC認証ダイジェストの発行
function hmac(url: string, data?: any) : GoogleAppsScript.URL_Fetch.HttpHeaders {
  const date = new Date()
  var nonce = Math.floor(date.getTime()/1000).toString();
  const message = (data) ? nonce + url + JSON.stringify(data) : nonce + url
  const signature = Utilities.computeHmacSha256Signature(message, COINCHECK_SECRET_KEY)
  const sign = signature.reduce(
    (prev: string, current: number) => {
      const hexstr = (current < 0 ? current + 256 : current).toString(16);
      return prev + (hexstr.length == 1 ? '0' : '') + hexstr;
    },''
  );
  return {
    "ACCESS-KEY": COINCHECK_ACCESS_KEY,
    "ACCESS-NONCE": nonce,
    "ACCESS-SIGNATURE": sign
  }
}

// エラー処理
function throwError(msg:string) {
  console.log(msg)
}

// 取引ログ
function logging(rate: number, evaluate: number, action: string, volume: number) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('trade_log')
  const row: number = (sheet?.getLastRow() ?? 1) + 1
  const now: Date = new Date()

  sheet?.getRange(row, 1).setValue(Utilities.formatDate(now, "JST", "yyyy/MM/dd HH:mm:ss"))
  sheet?.getRange(row, 2).setNumberFormat('@')
  sheet?.getRange(row, 2).setValue(rate)
  sheet?.getRange(row, 3).setNumberFormat('@')
  sheet?.getRange(row, 3).setValue(evaluate)
  sheet?.getRange(row, 4).setValue(action)
  sheet?.getRange(row, 5).setValue(volume)
}

// 目標額の設定
function getTarget(evaluate: number): number {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('master')
  const start: string = sheet?.getRange(1, 2).getValue()
  const volume: string = sheet?.getRange(2, 2).getValue()

  const startDate = Date.parse(start);
  const today = new Date().getTime()
  const diff: number = Math.ceil((today - startDate) / 86400000)

  return (diff > 0) ? diff * Number(volume) : 0
}

function main() {
  const account = getAccount()
  if (account["success"] != true) {
    throwError(account["error"])
    return
  }

  const ticker = getTicker()
  const rate = Number(ticker["last"])

  const evaluate = account["jpy"] + account["jpy_reserved"] + rate * (account["btc"] + account["btc_reserved"])

  const targetVolume = getTarget(evaluate)

  if (targetVolume == 0) {
    throwError("積み立て開始日前")
    return
  }

  let trade_type = "SKIP" // default
  let tradeVolume = 0
  if (evaluate > targetVolume * 1.12) {
    trade_type = "SELL"
    tradeVolume = evaluate - targetVolume
    postOrder(rate, tradeVolume, "sell")
  } else if(evaluate < targetVolume) {
    if (account["jpy"] <= targetVolume-evaluate) {
      trade_type = "SHORT"
      throwError("残高が不足しています")
    } else {
      trade_type = "BUY"
      tradeVolume = targetVolume - evaluate
      postOrder(rate, tradeVolume, "buy")
    }
  }

  logging(evaluate, rate, trade_type, tradeVolume)
}