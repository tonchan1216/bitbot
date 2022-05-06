import logging
import math
import os
import json

import talib

import datetime
import numpy as np
import pandas as pd
from gmo import api
from slack_sdk import WebClient
from dotenv import load_dotenv
load_dotenv()

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Slack
client = WebClient(token=os.environ["SLACK_API_TOKEN"])
channel_name=os.environ["CHANNEL_NAME"]

SYMBOL = 'BTC_JPY'
JST = datetime.timezone(datetime.timedelta(hours=9), 'JST')
E_TYPE = 'LIMIT'
PIPS = 0.01 

def notify(message, level=logging.INFO):
    if level == logging.WARNING:
        logger.warning(message)
    else:
        logger.info(message)

    client.chat_postMessage(text=message, channel=channel_name)
    return

def calc_features(df):
    df['open'] = df['open'].astype('int')
    df['high'] = df['high'].astype('int')
    df['low'] = df['low'].astype('int')
    df['close'] = df['close'].astype('int')
    df['volume'] = df['volume'].astype('float')

    open = df['open']
    high = df['high']
    low = df['low']
    close = df['close']
    volume = df['volume']
    orig_columns = df.columns

    hilo = (high + low) / 2
    df['BBANDS_upperband'], df['BBANDS_middleband'], df['BBANDS_lowerband'] = talib.BBANDS(close, timeperiod=5, nbdevup=2, nbdevdn=2, matype=0)
    df['BBANDS_upperband'] -= hilo
    df['BBANDS_middleband'] -= hilo
    df['BBANDS_lowerband'] -= hilo
    df['DEMA'] = talib.DEMA(close, timeperiod=30) - hilo
    df['EMA'] = talib.EMA(close, timeperiod=30) - hilo
    df['HT_TRENDLINE'] = talib.HT_TRENDLINE(close) - hilo
    df['KAMA'] = talib.KAMA(close, timeperiod=30) - hilo
    df['MA'] = talib.MA(close, timeperiod=30, matype=0) - hilo
    df['MIDPOINT'] = talib.MIDPOINT(close, timeperiod=14) - hilo
    df['SMA'] = talib.SMA(close, timeperiod=30) - hilo
    df['T3'] = talib.T3(close, timeperiod=5, vfactor=0) - hilo
    df['TEMA'] = talib.TEMA(close, timeperiod=30) - hilo
    df['TRIMA'] = talib.TRIMA(close, timeperiod=30) - hilo
    df['WMA'] = talib.WMA(close, timeperiod=30) - hilo

    df['ADX'] = talib.ADX(high, low, close, timeperiod=14)
    df['ADXR'] = talib.ADXR(high, low, close, timeperiod=14)
    df['APO'] = talib.APO(close, fastperiod=12, slowperiod=26, matype=0)
    df['AROON_aroondown'], df['AROON_aroonup'] = talib.AROON(high, low, timeperiod=14)
    df['AROONOSC'] = talib.AROONOSC(high, low, timeperiod=14)
    df['BOP'] = talib.BOP(open, high, low, close)
    df['CCI'] = talib.CCI(high, low, close, timeperiod=14)
    df['DX'] = talib.DX(high, low, close, timeperiod=14)
    df['MACD_macd'], df['MACD_macdsignal'], df['MACD_macdhist'] = talib.MACD(close, fastperiod=12, slowperiod=26, signalperiod=9)
    df['MFI'] = talib.MFI(high, low, close, volume, timeperiod=14)
    df['MINUS_DI'] = talib.MINUS_DI(high, low, close, timeperiod=14)
    df['MINUS_DM'] = talib.MINUS_DM(high, low, timeperiod=14)
    df['MOM'] = talib.MOM(close, timeperiod=10)
    df['PLUS_DI'] = talib.PLUS_DI(high, low, close, timeperiod=14)
    df['PLUS_DM'] = talib.PLUS_DM(high, low, timeperiod=14)
    df['RSI'] = talib.RSI(close, timeperiod=14)
    df['STOCH_slowk'], df['STOCH_slowd'] = talib.STOCH(high, low, close, fastk_period=5, slowk_period=3, slowk_matype=0, slowd_period=3, slowd_matype=0)
    df['STOCHF_fastk'], df['STOCHF_fastd'] = talib.STOCHF(high, low, close, fastk_period=5, fastd_period=3, fastd_matype=0)
    df['STOCHRSI_fastk'], df['STOCHRSI_fastd'] = talib.STOCHRSI(close, timeperiod=14, fastk_period=5, fastd_period=3, fastd_matype=0)
    df['TRIX'] = talib.TRIX(close, timeperiod=30)
    df['ULTOSC'] = talib.ULTOSC(high, low, close, timeperiod1=7, timeperiod2=14, timeperiod3=28)
    df['WILLR'] = talib.WILLR(high, low, close, timeperiod=14)

    df['AD'] = talib.AD(high, low, close, volume)
    df['ADOSC'] = talib.ADOSC(high, low, close, volume, fastperiod=3, slowperiod=10)
    df['OBV'] = talib.OBV(close, volume)

    df['ATR'] = talib.ATR(high, low, close, timeperiod=14)
    df['NATR'] = talib.NATR(high, low, close, timeperiod=14)
    df['TRANGE'] = talib.TRANGE(high, low, close)

    df['HT_DCPERIOD'] = talib.HT_DCPERIOD(close)
    df['HT_DCPHASE'] = talib.HT_DCPHASE(close)
    df['HT_PHASOR_inphase'], df['HT_PHASOR_quadrature'] = talib.HT_PHASOR(close)
    df['HT_SINE_sine'], df['HT_SINE_leadsine'] = talib.HT_SINE(close)
    df['HT_TRENDMODE'] = talib.HT_TRENDMODE(close)

    df['BETA'] = talib.BETA(high, low, timeperiod=5)
    df['CORREL'] = talib.CORREL(high, low, timeperiod=30)
    df['LINEARREG'] = talib.LINEARREG(close, timeperiod=14) - close
    df['LINEARREG_ANGLE'] = talib.LINEARREG_ANGLE(close, timeperiod=14)
    df['LINEARREG_INTERCEPT'] = talib.LINEARREG_INTERCEPT(close, timeperiod=14) - close
    df['LINEARREG_SLOPE'] = talib.LINEARREG_SLOPE(close, timeperiod=14)
    df['STDDEV'] = talib.STDDEV(close, timeperiod=5, nbdev=1)

    return df

def run(event, context):
    # GMO
    api_key = os.environ["GMO_ACCESS_KEY"]
    secret = os.environ["GMO_ACCESS_SECRET"]
    gmo = api.GMOCoin(api_key, secret, late_limit=True, logger=logger)

    # 開設ステータスチェック
    health = gmo.status()['data']
    if health['status'] != 'OPEN':
        notify('MAINTENANCE MODE', logging.WARNING)
        return 1

    # 当日のレート情報を取得
    today = datetime.datetime.now(JST).strftime('%Y%m%d')
    resp = gmo.klines(symbol=SYMBOL, interval='5min', date=today)
    ohlcv = pd.DataFrame(resp['data'])
    features = calc_features(ohlcv)
    notify(ohlcv.iloc[-1, 1:].to_json())

    # ATRで指値距離を計算します
    limit_price_dist = features['ATR'] * 0.5
    limit_price_dist = np.maximum(1, (limit_price_dist / PIPS).round().fillna(1)) * PIPS

    # 終値から両側にlimit_price_distだけ離れたところに、買い指値と売り指値を出します
    features['buy_price'] = features['close'] - limit_price_dist
    features['sell_price'] = features['close'] + limit_price_dist
    buy_price = int(features['buy_price'].iloc[-1])
    sell_price = int(features['sell_price'].iloc[-1])

    # 現在の未約定注文を一括キャンセル
    resp = gmo.cancelBulkOrder(symbol=[SYMBOL])
    if resp['status'] == 0 and len(resp['data']) > 0:
        notify(f'Order {resp.data} was canceled.')

    # 現在の建玉情報を取得
    resp = gmo.openpositions(symbol=SYMBOL)

    # Positionがあるときは決済
    if resp['status'] == 0 and 'list' in resp['data']:
        potisions = resp['data']['list']
        for p in potisions:
            close_side = 'BUY' if p['side'] == 'SELL' else 'SELL'
            price = buy_price if close_side == 'BUY' else sell_price
            # 決済注文
            resp = gmo.closeorder(symbol=p['symbol'], side=close_side,
                             executionType=E_TYPE, 
                             settlePosition_positionId = p['positionId'],
                             settlePosition_size = p['size'],
                             price=price)
            if resp['status'] != 0:
                notify(json.dumps(resp['messages']), logging.WARNING)
                return 1
            else:
                notify(f'Exit order #{resp.data} is succeeded.')
        return 0

    # Positionがないときは新規エントリー
    buy = 0	
    side = 'BUY' if True else 'SELL'
    price = buy_price if side == 'BUY' else sell_price
    size = PIPS
    # 新規エントリー注文
    resp = gmo.order(symbol=SYMBOL, side=side, executionType=E_TYPE, size=size, price=buy)
    if resp['status'] != 0:
        notify(json.dumps(resp['messages']), logging.WARNING)
        return 1
    else:
        notify(f'Entry orderyu #{resp.data} is succeeded.')

    # 余力情報を取得
    # resp = gmo.account_margin()
    # margin = resp['data']

    # 資産残高を表示
    # resp = gmo.account_assets()
    # balance = resp['data']

    # # 最寄買い気配地 - 5000の価格に買い指値



run(0,0)