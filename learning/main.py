from coincheck import market, account, order
import os
from dotenv import load_dotenv

# .envファイルの内容を読み込みます
load_dotenv()

# os.environを用いて環境変数を表示させます
print (os.environ['ACCESS_KEY'])
print (os.environ['SECRET_KEY'])
access_key = os.environ['ACCESS_KEY']
secret_key = os.environ['SECRET_KEY']

mkt = market.Market()
act = account.Account(secret_key=secret_key, access_key=access_key)
ord = order.Order(secret_key=secret_key, access_key=access_key)

print(mkt.ticker())
print(act.get_info())
print(ord.history())
print(mkt.ticker())
