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

const prop = PropertiesService.getScriptProperties().getProperties()
const coincheck_baseuri = "https://coincheck.com/api"
const slack_baseuri = "https://slack.com/api/chat.postMessage"
const COINCHECK_ACCESS_KEY = prop.COINCHECK_ACCESS_KEY
const COINCHECK_SECRET_KEY = prop.COINCHECK_SECRET_KEY
const SLACK_ACCESS_TOKEN = prop.SLACK_ACCESS_TOKEN
const CHANNEL_ID = prop.CHANNEL_ID

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

// CoincheckからAccountを取得
function getAccount() {
  const url = coincheck_baseuri + '/accounts/balance'
  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'get',
    headers: hmac(url)
  }

  const response = UrlFetchApp.fetch(url, params)
  console.log(JSON.parse(response.getContentText('UTF-8')))
  return JSON.parse(response.getContentText('UTF-8'))
}

// HMAC認証ダイジェストの発行
function hmac(url: string, body?: any) : GoogleAppsScript.URL_Fetch.HttpHeaders {
  const date = new Date()
  var nonce = Math.floor(date.getTime()/1000).toString();
  const message = (body) ? nonce + url + JSON.stringify(body) : nonce + url
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