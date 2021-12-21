import requests,time
import pandas as pd
from datetime import datetime

TIME_FORMAT = '%Y-%m-%d %H:%M %z'
DURATION = 86400

def get_OHLC(before,after):
    url = 'https://api.cryptowat.ch/markets/bitflyer/btcjpy/ohlc'
    query = {
        'periods':DURATION,
        'before': get_UTC(before),
        'after': get_UTC(after),
        }
    res = requests.get(url,params=query).json()
    if ('error' in res):
        raise Exception(res['error'])

    Time,Open,High,Low,Close,Volume = [],[],[],[],[],[]
    for i in res['result'][str(DURATION)]:
        Time.append(i[0])
        Open.append(i[1])
        High.append(i[2])
        Low.append(i[3])
        Close.append(i[4])
        Volume.append(i[5])

    return pd.DataFrame(
        {'time':Time, 'open':Open, 'high':High, 'low':Low, 'close':Close})

def get_UTC(dt):
    return int(datetime.strptime(dt, TIME_FORMAT).timestamp())